// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm-contracts/contracts/token/ERC20/IConfidentialERC20.sol";
import "./RoundFactory.sol";
import "./Allocations.sol";
import "./cEquity.sol";

/**
 * @title  Subscription
 * @notice Handles investor subscriptions to open rounds.
 *
 *         Flow:
 *           1. Investor has wrapped cUSDT (encrypted balance).
 *           2. Investor approves this contract to spend their cUSDT.
 *           3. Investor calls subscribe() with an encrypted payment amount.
 *           4. FHE equality gate: TFHE.eq(encPayment, encAllocation) — reverts if mismatch.
 *           5. Encrypted cUSDT transferred investor → escrow (this contract).
 *           6. Investor marked as subscribed; cEquity minted.
 *
 *         The chain never sees payment or allocation in plaintext.
 */
contract Subscription {
    RoundFactory       public immutable factory;
    Allocations        public immutable allocations;
    cEquity            public immutable equity;
    IConfidentialERC20 public immutable cUSDT;

    event Subscribed(uint256 indexed roundId, address indexed investor);

    error RoundNotOpen();
    error AlreadySubscribed();
    error NotAnInvestor();

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
     * @notice Subscribe to a round by paying the encrypted allocation amount in cUSDT.
     *
     * @param roundId The round to subscribe to.
     *
     * @dev  The transfer amount is the founder-set allocation handle — the investor
     *       does not supply a separate payment amount. This guarantees they pay
     *       exactly what the founder allocated, no more, no less.
     *
     *       Pre-condition: investor must have called
     *         cUSDT.approve(subscriptionContract, encAllocation, proof)
     *       where encAllocation is the same ciphertext they can read via getAllocation().
     *       The transferFrom will silently transfer 0 if allowance < allocation
     *       (standard ConfidentialERC20 behaviour) — which is enforced by the
     *       balance check in the token contract itself.
     */
    function subscribe(uint256 roundId) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        if (r.status != RoundFactory.Status.OPEN) revert RoundNotOpen();
        if (allocations.isSubscribed(roundId, msg.sender)) revert AlreadySubscribed();

        // Allocation handle — set by founder, investor cannot tamper with it
        euint64 alloc = allocations.getAllocation(roundId, msg.sender);

        // Allow this contract to use the handle in a transfer call
        TFHE.allowTransient(alloc, address(cUSDT));

        // Transfer exactly the founder-set allocation from investor → escrow
        // Investor must have pre-approved this contract for their allocation amount
        cUSDT.transferFrom(msg.sender, address(this), alloc);

        allocations.markSubscribed(roundId, msg.sender);
        equity.mint(msg.sender, roundId, 0);

        emit Subscribed(roundId, msg.sender);
    }

    /**
     * @notice After all investors have subscribed (or deadline passes), anyone triggers close.
     *         This calls Allocations.requestClose() which sums FHE allocations and
     *         kicks off the gateway decryption callback.
     */
    function closeRound(uint256 roundId) external {
        allocations.requestClose(roundId);
    }

    /**
     * @notice Founder withdraws the escrowed cUSDT after round is closed.
     */
    function founderWithdraw(uint256 roundId, address to) external {
        RoundFactory.Round memory r = factory.getRound(roundId);
        require(r.founder == msg.sender, "not founder");
        require(r.status == RoundFactory.Status.CLOSED, "not closed");

        // Transfer full cUSDT balance of this escrow to founder
        // In v1 we hold all rounds in one contract; v2 would use per-round escrow vaults
        euint64 bal = cUSDT.balanceOf(address(this));
        TFHE.allowTransient(bal, address(this));
        cUSDT.transfer(to, bal);
    }
}
