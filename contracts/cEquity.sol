// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm-contracts/contracts/token/ERC20/ConfidentialERC20.sol";

/**
 * @title  cEquity
 * @notice Confidential equity token (ERC-7984 style) issued to investors upon subscription.
 *         Balances are encrypted — no one can see how much equity any holder has except
 *         the holder themselves and the founder (via explicit TFHE.allow grants).
 *
 *         One cEquity contract is deployed per Vestr deployment. The `roundId` is stored
 *         per-holder so the frontend can associate holdings with rounds.
 *
 *         Transfer policy: free by default for v1. A `transferRequiresApproval` flag
 *         can be added in v2 for ROFR enforcement.
 */
contract cEquity is ConfidentialERC20 {
    address public immutable subscriptionContract;

    // investor => roundId (tracks which round minted their equity)
    // If an investor participates in multiple rounds, this stores the latest.
    // A mapping(address => uint256[]) rounds is v2 scope.
    mapping(address => uint256) public holderRound;

    // roundId => founder address (for ACL grants at mint time)
    mapping(uint256 => address) public roundFounder;

    event EquityMinted(uint256 indexed roundId, address indexed investor);

    error OnlySubscription();
    error OverflowCheck();

    uint64 private constant MAX_SUPPLY = type(uint64).max;

    modifier onlySubscription() {
        if (msg.sender != subscriptionContract) revert OnlySubscription();
        _;
    }

    constructor(address _subscriptionContract) ConfidentialERC20("Vestr Equity", "cEQTY") {
        subscriptionContract = _subscriptionContract;
    }

    /**
     * @notice Register a round's founder so mint() can grant them view access.
     *         Called by the deploy script after all contracts are wired.
     */
    function registerRound(uint256 roundId, address founder) external onlySubscription {
        roundFounder[roundId] = founder;
    }

    /**
     * @notice Mint encrypted equity to an investor.
     *         The minted amount mirrors their encrypted allocation (euint64 handle).
     *         Grants ACL to: investor (already via ConfidentialERC20._unsafeMintNoEvent),
     *         and founder (explicit TFHE.allow).
     *
     * @param investor  Recipient of the equity tokens.
     * @param roundId   The round being subscribed to.
     * @param amount    Plaintext allocation amount in cUSDT base units.
     *                  Scaled 1:1 — 1 cUSDT unit = 1 cEquity unit for v1.
     */
    function mint(address investor, uint256 roundId, uint64 amount) external onlySubscription {
        if (uint256(_totalSupply) + uint256(amount) > uint256(MAX_SUPPLY)) revert OverflowCheck();

        _totalSupply += amount;
        holderRound[investor] = roundId;

        // _unsafeMint grants: allowThis + allow(investor) internally
        _unsafeMint(investor, amount);

        // Additionally grant founder view of this investor's balance
        address founder = roundFounder[roundId];
        if (founder != address(0)) {
            euint64 bal = _balances[investor];
            TFHE.allow(bal, founder);
        }

        emit EquityMinted(roundId, investor);
    }
}
