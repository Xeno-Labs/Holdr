// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title  cEquity
 * @notice Confidential equity token issued to investors on subscription.
 *         Balances are encrypted — only the holder and the round founder can decrypt.
 *
 *         One cEquity contract is shared across all rounds.
 *         `holderRound[investor]` stores which round minted their equity.
 */
contract cEquity is ZamaEthereumConfig {
    address public immutable subscriptionContract;

    mapping(address => euint64) private _balances;
    mapping(address => uint256) public holderRound;
    mapping(uint256 => address) public roundFounder;

    uint64 private _totalSupply;

    event EquityMinted(uint256 indexed roundId, address indexed investor);

    error OnlySubscription();

    modifier onlySubscription() {
        if (msg.sender != subscriptionContract) revert OnlySubscription();
        _;
    }

    constructor(address _subscriptionContract) {
        subscriptionContract = _subscriptionContract;
    }

    /**
     * @notice Register a round → founder mapping so mint() can grant founder view.
     *         Called by deploy script after all contracts are wired.
     */
    function registerRound(uint256 roundId, address founder) external onlySubscription {
        roundFounder[roundId] = founder;
    }

    /**
     * @notice Mint encrypted equity to an investor. Amount mirrors their encrypted allocation.
     * @param investor  Recipient.
     * @param roundId   Source round.
     * @param amount    Plaintext allocation amount in cUSDT base units (1:1 mapping for v1).
     */
    function mint(address investor, uint256 roundId, uint64 amount) external onlySubscription {
        _totalSupply += amount;
        holderRound[investor] = roundId;

        euint64 enc = FHE.asEuint64(amount);
        euint64 newBal = FHE.add(_balances[investor], enc);
        _balances[investor] = FHE.allowThis(newBal);
        FHE.allow(newBal, investor);

        // Grant founder view of this investor's equity balance
        address founder = roundFounder[roundId];
        if (founder != address(0)) {
            FHE.allow(newBal, founder);
        }

        emit EquityMinted(roundId, investor);
    }

    function balanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    function totalSupply() external view returns (uint64) {
        return _totalSupply;
    }
}
