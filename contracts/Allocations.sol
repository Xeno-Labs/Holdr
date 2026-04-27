// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./RoundFactory.sol";

/**
 * @title  Allocations
 * @notice Stores per-investor encrypted allocations for each round.
 *
 *         Founder adds investors with euint64 encrypted amounts.
 *         Each handle is ACL'd to: founder, investor, this contract.
 *
 *         Close flow (two transactions):
 *           Tx 1 — requestClose(): FHE.add over all allocations,
 *                  FHE.makePubliclyDecryptable(total), emit handle.
 *           Tx 2 — submitCloseResult(): anyone submits the KMS-signed
 *                  decryption proof; FHE.checkSignatures verifies it,
 *                  then writes totalRaised to RoundFactory.
 */
contract Allocations is ZamaEthereumConfig {
    struct Allocation {
        euint64 encAmount;
        bool subscribed;
        bool exists;
    }

    RoundFactory public immutable factory;

    mapping(uint256 => mapping(address => Allocation)) private _allocations;
    mapping(uint256 => address[]) private _investors;

    // roundId => encrypted aggregate handle (bytes32) — stored for off-chain decryption
    mapping(uint256 => bytes32) public pendingCloseHandle;

    address public subscriptionContract;
    address public disclosureContract;

    event InvestorAdded(uint256 indexed roundId, address indexed investor);
    event CloseRequested(uint256 indexed roundId, bytes32 encAggregateHandle);
    event CloseFinalised(uint256 indexed roundId, uint256 totalRaised);
    event ViewGranted(uint256 indexed roundId, address indexed investor, address indexed counterparty);

    error NotFounder();
    error RoundNotDraft();
    error AlreadyAdded();
    error NotFound();
    error OnlySubscription();
    error SubscriptionAlreadySet();
    error DisclosureAlreadySet();
    error NoInvestors();
    error CloseNotRequested();
    error CloseConditionsNotMet();

    constructor(address _factory) {
        factory = RoundFactory(_factory);
    }

    function setSubscriptionContract(address _subscription) external {
        if (subscriptionContract != address(0)) revert SubscriptionAlreadySet();
        subscriptionContract = _subscription;
    }

    function setDisclosureContract(address _disclosure) external {
        if (disclosureContract != address(0)) revert DisclosureAlreadySet();
        disclosureContract = _disclosure;
    }

    // ─── Founder ──────────────────────────────────────────────────────────────

    /**
     * @notice Add an investor with an encrypted allocation amount.
     * @param roundId    Must be DRAFT.
     * @param investor   Investor wallet.
     * @param encAmount  externalEuint64 handle from relayer SDK.
     * @param inputProof ZKPoK proof from relayer SDK.
     */
    function addInvestor(
        uint256 roundId,
        address investor,
        externalEuint64 encAmount,
        bytes calldata inputProof
    ) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        if (r.founder != msg.sender) revert NotFounder();
        if (r.status != RoundFactory.Status.DRAFT) revert RoundNotDraft();
        if (_allocations[roundId][investor].exists) revert AlreadyAdded();

        euint64 amt = FHE.fromExternal(encAmount, inputProof);

        // Grant ACL access to all contracts that need to operate on this handle:
        // - founder:             decrypt any row
        // - investor:            decrypt their own row
        // - this contract:       sumAllocations (FHE.add loop)
        // - subscriptionContract: FHE.allowTransient(alloc, cUSDT) in subscribe()
        // - disclosureContract:  FHE.allow(handle, counterparty) in grantView()
        FHE.allow(amt, r.founder);
        FHE.allow(amt, investor);
        FHE.allowThis(amt);
        if (subscriptionContract != address(0)) {
            FHE.allow(amt, subscriptionContract);
        }
        if (disclosureContract != address(0)) {
            FHE.allow(amt, disclosureContract);
        }

        _allocations[roundId][investor] = Allocation({ encAmount: amt, subscribed: false, exists: true });
        _investors[roundId].push(investor);

        emit InvestorAdded(roundId, investor);
    }

    // ─── Subscription interface ───────────────────────────────────────────────

    function getAllocation(uint256 roundId, address investor) external view returns (euint64) {
        if (!_allocations[roundId][investor].exists) revert NotFound();
        return _allocations[roundId][investor].encAmount;
    }

    function isSubscribed(uint256 roundId, address investor) external view returns (bool) {
        return _allocations[roundId][investor].subscribed;
    }

    function markSubscribed(uint256 roundId, address investor) external {
        if (msg.sender != subscriptionContract) revert OnlySubscription();
        _allocations[roundId][investor].subscribed = true;
    }

    function getInvestors(uint256 roundId) external view returns (address[] memory) {
        return _investors[roundId];
    }

    function investorCount(uint256 roundId) external view returns (uint256) {
        return _investors[roundId].length;
    }

    // ─── Close: Tx 1 — compute aggregate + mark publicly decryptable ──────────

    /**
     * @notice Step 1 of close: FHE-sum all allocations and mark the result
     *         as publicly decryptable so the KMS can produce a signed proof.
     *         Emits CloseRequested with the handle so off-chain tooling knows what to decrypt.
     */
    function requestClose(uint256 roundId) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        require(r.status == RoundFactory.Status.OPEN, "round not open");
        if (
            block.timestamp < r.deadline && !_allSubscribed(roundId)
        ) revert CloseConditionsNotMet();

        address[] memory investors = _investors[roundId];
        if (investors.length == 0) revert NoInvestors();

        euint64 total = _allocations[roundId][investors[0]].encAmount;
        for (uint256 i = 1; i < investors.length; i++) {
            total = FHE.add(total, _allocations[roundId][investors[i]].encAmount);
        }

        // Mark the aggregate for public decryption — KMS will sign the cleartext
        FHE.makePubliclyDecryptable(total);

        bytes32 handle = euint64.unwrap(total);
        pendingCloseHandle[roundId] = handle;

        emit CloseRequested(roundId, handle);
    }

    // ─── Close: Tx 2 — submit KMS-signed decryption result ───────────────────

    /**
     * @notice Step 2 of close: submit the KMS-signed public decryption result.
     *         Anyone can call this once the KMS has produced the proof.
     *
     * @param roundId              The round being closed.
     * @param handlesList          Must contain exactly pendingCloseHandle[roundId].
     * @param abiEncodedCleartexts ABI-encoded uint64 (the decrypted total raised).
     * @param decryptionProof      KMS ECDSA signature bundle.
     */
    function submitCloseResult(
        uint256 roundId,
        bytes32[] calldata handlesList,
        bytes calldata abiEncodedCleartexts,
        bytes calldata decryptionProof
    ) external {
        if (pendingCloseHandle[roundId] == bytes32(0)) revert CloseNotRequested();
        require(handlesList.length == 1 && handlesList[0] == pendingCloseHandle[roundId], "wrong handle");

        // Verifies KMS signatures — reverts if invalid
        FHE.checkSignatures(handlesList, abiEncodedCleartexts, decryptionProof);

        uint64 totalRaised = abi.decode(abiEncodedCleartexts, (uint64));
        delete pendingCloseHandle[roundId];

        factory.finaliseClose(roundId, uint256(totalRaised));
        emit CloseFinalised(roundId, uint256(totalRaised));
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _allSubscribed(uint256 roundId) internal view returns (bool) {
        address[] memory investors = _investors[roundId];
        for (uint256 i = 0; i < investors.length; i++) {
            if (!_allocations[roundId][investors[i]].subscribed) return false;
        }
        return investors.length > 0;
    }
}
