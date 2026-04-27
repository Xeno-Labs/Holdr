// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";
import "./RoundFactory.sol";

/**
 * @title  Allocations
 * @notice Stores per-investor encrypted allocations for each round.
 *         Founder adds investors with euint64 encrypted amounts.
 *         Each allocation handle is ACL'd to: founder, investor, this contract.
 *         Post-close, sumAllocations triggers a gateway decryption callback
 *         that writes the public aggregate back to RoundFactory.
 */
contract Allocations is GatewayCaller {
    struct Allocation {
        euint64 encAmount;
        bool subscribed;
        bool exists;
    }

    RoundFactory public immutable factory;

    // roundId => investor => Allocation
    mapping(uint256 => mapping(address => Allocation)) private _allocations;

    // roundId => ordered investor list (for iteration)
    mapping(uint256 => address[]) private _investors;

    // Trusted Subscription contract — set once
    address public subscriptionContract;

    // Gateway callback tracking: requestId => roundId
    mapping(uint256 => uint256) private _pendingClose;

    event InvestorAdded(uint256 indexed roundId, address indexed investor);
    event CloseRequested(uint256 indexed roundId, uint256 requestId);

    error NotFounder();
    error RoundNotDraft();
    error AlreadyAdded();
    error NotFound();
    error OnlySubscription();
    error SubscriptionAlreadySet();
    error NoInvestors();

    constructor(address _factory) {
        factory = RoundFactory(_factory);
    }

    function setSubscriptionContract(address _subscription) external {
        if (subscriptionContract != address(0)) revert SubscriptionAlreadySet();
        subscriptionContract = _subscription;
    }

    // ─── Founder actions ──────────────────────────────────────────────────────

    /**
     * @notice Add an investor with an encrypted allocation.
     * @param roundId    Target round (must be in DRAFT status).
     * @param investor   Investor wallet address.
     * @param encAmount  Encrypted allocation amount (euint64, encrypted client-side).
     * @param inputProof ZKPoK proof from relayer SDK.
     */
    function addInvestor(
        uint256 roundId,
        address investor,
        einput encAmount,
        bytes calldata inputProof
    ) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        if (r.founder != msg.sender) revert NotFounder();
        if (r.status != RoundFactory.Status.DRAFT) revert RoundNotDraft();
        if (_allocations[roundId][investor].exists) revert AlreadyAdded();

        euint64 amt = TFHE.asEuint64(encAmount, inputProof);

        // Grant decryption rights:
        // - founder:       can see all rows
        // - investor:      can see their own row
        // - this contract: needed for sumAllocations computation
        TFHE.allow(amt, r.founder);
        TFHE.allow(amt, investor);
        TFHE.allow(amt, address(this));

        _allocations[roundId][investor] = Allocation({
            encAmount: amt,
            subscribed: false,
            exists: true
        });
        _investors[roundId].push(investor);

        emit InvestorAdded(roundId, investor);
    }

    // ─── Subscription.sol interface ───────────────────────────────────────────

    /**
     * @notice Returns the encrypted allocation handle for an investor.
     *         Caller must have been ACL'd (founder, investor, or grantee via Disclosure).
     */
    function getAllocation(uint256 roundId, address investor) external view returns (euint64) {
        if (!_allocations[roundId][investor].exists) revert NotFound();
        return _allocations[roundId][investor].encAmount;
    }

    function isSubscribed(uint256 roundId, address investor) external view returns (bool) {
        return _allocations[roundId][investor].subscribed;
    }

    /**
     * @notice Mark an investor as subscribed. Only callable by Subscription.sol.
     */
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

    // ─── Close round: aggregate sum + gateway decryption ─────────────────────

    /**
     * @notice Compute FHE sum of all subscribed allocations and request public
     *         gateway decryption. Anyone can call this after round close conditions are met.
     *         The callback writes totalRaised to RoundFactory.
     */
    function requestClose(uint256 roundId) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        require(r.status == RoundFactory.Status.OPEN, "round not open");
        require(
            block.timestamp >= r.deadline || _allSubscribed(roundId),
            "close conditions not met"
        );

        address[] memory investors = _investors[roundId];
        if (investors.length == 0) revert NoInvestors();

        // Sum all encrypted allocations under FHE
        euint64 total = _allocations[roundId][investors[0]].encAmount;
        for (uint256 i = 1; i < investors.length; i++) {
            total = TFHE.add(total, _allocations[roundId][investors[i]].encAmount);
        }

        // Allow gateway to handle the ciphertext
        TFHE.allow(total, address(this));

        // Request public decryption — callback: closeRoundCallback(uint256,uint64)
        uint256[] memory handles = new uint256[](1);
        handles[0] = Gateway.toUint256(total);

        uint256 requestId = Gateway.requestDecryption(
            handles,
            this.closeRoundCallback.selector,
            0,
            block.timestamp + 1 days,
            false
        );

        _pendingClose[requestId] = roundId;
        emit CloseRequested(roundId, requestId);
    }

    /**
     * @notice Gateway callback — receives the decrypted aggregate and finalises the round.
     */
    function closeRoundCallback(uint256 requestId, uint64 decryptedTotal) external onlyGateway {
        uint256 roundId = _pendingClose[requestId];
        delete _pendingClose[requestId];
        factory.finaliseClose(roundId, uint256(decryptedTotal));
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _allSubscribed(uint256 roundId) internal view returns (bool) {
        address[] memory investors = _investors[roundId];
        for (uint256 i = 0; i < investors.length; i++) {
            if (!_allocations[roundId][investors[i]].subscribed) return false;
        }
        return investors.length > 0;
    }
}
