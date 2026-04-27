// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./RoundFactory.sol";
import "./Allocations.sol";
import "./cEquity.sol";
import "./interfaces/IConfidentialERC20.sol";

/**
 * @title  Subscription
 * @notice Handles investor subscriptions to open rounds.
 *
 *         Compatible with any ERC-7984 confidential token:
 *           - Local: our MockcUSDT (wraps MockUSDT)
 *           - Sepolia: Zama's deployed cUSDTMock (0x4E7B06D78965594eB5EF5414c357ca21E1554491)
 *
 *         Investor flow:
 *           1. Investor wraps USDT → cUSDT (via wrap() on local, or Zama's wrapper on Sepolia).
 *           2. Investor calls cUSDT.setOperator(subscriptionAddr, deadline).
 *           3. Investor calls subscribe(roundId).
 *           4. Contract reads the founder-set allocation handle (investor cannot tamper).
 *           5. confidentialTransferFrom: encrypted allocation moves investor → escrow.
 *           6. Investor marked subscribed; cEquity minted.
 *
 *         The chain never sees allocation amounts or payment in plaintext.
 */
contract Subscription is ZamaEthereumConfig {
    RoundFactory        public immutable factory;
    Allocations         public immutable allocations;
    cEquity             public immutable equity;
    IConfidentialERC20  public immutable cUSDT;

    event Subscribed(uint256 indexed roundId, address indexed investor);

    error RoundNotOpen();
    error AlreadySubscribed();
    error NotOperator();

    constructor(
        address _factory,
        address _allocations,
        address _equity,
        address _cUSDT
    ) {
        factory     = RoundFactory(_factory);
        allocations = Allocations(_allocations);
        equity      = cEquity(_equity);
        cUSDT       = IConfidentialERC20(_cUSDT);
    }

    /**
     * @notice Subscribe to a round.
     *
     *         Pre-conditions:
     *           - Round is OPEN.
     *           - Caller has set this contract as operator on cUSDT.
     *           - Founder has added caller as investor with an encrypted allocation.
     *
     * @param roundId The round to subscribe to.
     */
    function subscribe(uint256 roundId) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        if (r.status != RoundFactory.Status.OPEN) revert RoundNotOpen();
        if (allocations.isSubscribed(roundId, msg.sender)) revert AlreadySubscribed();

        // Verify investor has granted operator access (prevents accidental calls)
        if (!cUSDT.isOperator(msg.sender, address(this))) revert NotOperator();

        // Founder-set allocation handle — investor cannot substitute a different amount
        euint64 alloc = allocations.getAllocation(roundId, msg.sender);

        // Allow cUSDT to read the allocation handle during transferFrom
        FHE.allowTransient(alloc, address(cUSDT));

        // Encrypted transfer: investor pays exactly their allocated amount → escrow
        cUSDT.confidentialTransferFrom(msg.sender, address(this), alloc);

        allocations.markSubscribed(roundId, msg.sender);

        // Mint cEquity 1:1 with allocation (v1 simplified)
        equity.mint(msg.sender, roundId, 0);

        emit Subscribed(roundId, msg.sender);
    }

    /**
     * @notice Trigger round close: computes FHE aggregate and makes it publicly decryptable.
     *         After the KMS produces a signed proof, anyone calls Allocations.submitCloseResult.
     */
    function closeRound(uint256 roundId) external {
        allocations.requestClose(roundId);
    }

    /**
     * @notice Founder withdraws escrowed cUSDT after the round is closed.
     */
    function founderWithdraw(uint256 roundId, address to) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        require(r.founder == msg.sender, "not founder");
        require(r.status == RoundFactory.Status.CLOSED, "not closed");

        euint64 bal = cUSDT.confidentialBalanceOf(address(this));
        FHE.allowTransient(bal, address(cUSDT));
        cUSDT.confidentialTransfer(to, bal);
    }
}
