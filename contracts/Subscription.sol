// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./RoundFactory.sol";
import "./Allocations.sol";
import "./cEquity.sol";
import "./mocks/MockcUSDT.sol";

/**
 * @title  Subscription
 * @notice Handles investor subscriptions to open rounds.
 *
 *         Flow:
 *           1. Investor has wrapped cUSDT (encrypted balance via MockcUSDT.wrap).
 *           2. Investor approves this contract for their allocation amount
 *              (MockcUSDT.approve(subscriptionAddr, encAllocation, proof)).
 *           3. Investor calls subscribe(roundId).
 *           4. Contract reads the founder-set allocation handle (investor cannot tamper).
 *           5. Encrypted transferFrom: allocation amount moves investor → escrow.
 *           6. Investor marked as subscribed; cEquity minted.
 *
 *         The chain never sees allocation or payment in plaintext.
 */
contract Subscription is ZamaEthereumConfig {
    RoundFactory   public immutable factory;
    Allocations    public immutable allocations;
    cEquity        public immutable equity;
    MockcUSDT      public immutable cUSDT;

    event Subscribed(uint256 indexed roundId, address indexed investor);

    error RoundNotOpen();
    error AlreadySubscribed();

    constructor(
        address _factory,
        address _allocations,
        address _equity,
        address _cUSDT
    ) {
        factory     = RoundFactory(_factory);
        allocations = Allocations(_allocations);
        equity      = cEquity(_equity);
        cUSDT       = MockcUSDT(_cUSDT);
    }

    /**
     * @notice Subscribe to a round.
     *
     *         The transfer amount is the founder-set allocation handle — the investor
     *         cannot substitute their own amount. They must have pre-approved this
     *         contract for that allocation via MockcUSDT.approve().
     *
     * @param roundId The round to subscribe to.
     */
    function subscribe(uint256 roundId) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        if (r.status != RoundFactory.Status.OPEN) revert RoundNotOpen();
        if (allocations.isSubscribed(roundId, msg.sender)) revert AlreadySubscribed();

        // Founder-set allocation handle — investor cannot substitute a different amount
        euint64 alloc = allocations.getAllocation(roundId, msg.sender);

        // Allow cUSDT contract to read the handle during transferFrom
        FHE.allowTransient(alloc, address(cUSDT));

        // Encrypted transfer: investor pays exactly their allocated amount → escrow
        cUSDT.transferFrom(msg.sender, address(this), alloc);

        allocations.markSubscribed(roundId, msg.sender);

        // Mint cEquity — amount=0 means equity contract reads allocation handle itself
        // For v1 we use the allocation value as the equity amount (1:1 cUSDT:cEquity)
        // A real amount requires the founder to pass it; simplified here to 0 for MVP
        equity.mint(msg.sender, roundId, 0);

        emit Subscribed(roundId, msg.sender);
    }

    /**
     * @notice Trigger close: computes FHE aggregate + makes it publicly decryptable.
     *         After the KMS produces a signed proof, anyone calls Allocations.submitCloseResult.
     */
    function closeRound(uint256 roundId) external {
        allocations.requestClose(roundId);
    }

    /**
     * @notice Founder withdraws the escrowed cUSDT after the round is closed.
     */
    function founderWithdraw(uint256 roundId, address to) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        require(r.founder == msg.sender, "not founder");
        require(r.status == RoundFactory.Status.CLOSED, "not closed");

        euint64 bal = cUSDT.balanceOf(address(this));
        FHE.allowTransient(bal, address(cUSDT));
        cUSDT.transfer(to, bal);
    }
}
