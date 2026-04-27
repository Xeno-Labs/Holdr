// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IConfidentialERC20.sol";

/**
 * @title  MockcUSDT
 * @notice ERC-7984-compatible confidential USDT for local development.
 *
 *         Wraps MockUSDT (local) or Zama's mock USDT (Sepolia) into FHE-encrypted
 *         balances. Implements IConfidentialERC20 so Subscription.sol is identical
 *         across both networks — on Sepolia we simply point at Zama's deployed
 *         cUSDTMock (0x4E7B06D78965594eB5EF5414c357ca21E1554491) instead.
 *
 *         Key differences from ERC-20 allowance model:
 *           - NO encrypted approve. Investors call setOperator(subscriptionAddr, deadline).
 *           - Operators may move any amount on the holder's behalf until the deadline.
 *           - This mirrors how Zama's live cUSDTMock works.
 *
 *         Wrap flow (seed script / frontend):
 *           1. investor.approve(mockCUSDT, amount)          — plaintext ERC-20 approval
 *           2. mockCUSDT.wrap(amount)                       — locks mUSDT, credits euint64 balance
 *           3. mockCUSDT.setOperator(subscriptionAddr, deadline) — grant operator access
 *           4. subscription.subscribe(roundId)              — confidentialTransferFrom
 */
contract MockcUSDT is IConfidentialERC20, ZamaEthereumConfig, ReentrancyGuard {
    IERC20 public immutable underlying;

    mapping(address => euint64) private _balances;

    // Operator model: holder → operator → expiry timestamp
    mapping(address => mapping(address => uint48)) private _operators;

    event Wrap(address indexed account, uint256 amount);
    event Unwrap(address indexed account, uint256 amount);
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);

    error ZeroAmount();
    error NotOperator();

    constructor(address underlying_) {
        underlying = IERC20(underlying_);
    }

    // ── Wrap / Unwrap ─────────────────────────────────────────────────────────

    /**
     * @notice Lock plaintext USDT and credit an encrypted balance.
     *         Caller must ERC-20-approve this contract for `amount` beforehand.
     */
    function wrap(uint64 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        underlying.transferFrom(msg.sender, address(this), uint256(amount));

        euint64 enc    = FHE.asEuint64(amount);
        euint64 newBal = FHE.add(_balances[msg.sender], enc);
        _balances[msg.sender] = FHE.allowThis(newBal);
        FHE.allow(newBal, msg.sender);

        emit Wrap(msg.sender, amount);
    }

    /**
     * @notice Burn encrypted balance and withdraw plaintext USDT.
     *         Caller supplies the plaintext amount they wish to reclaim.
     *         (V1 demo: trusts the caller knows their balance via decryption.)
     */
    function unwrap(uint64 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        euint64 enc    = FHE.asEuint64(amount);
        euint64 newBal = FHE.sub(_balances[msg.sender], enc);
        _balances[msg.sender] = FHE.allowThis(newBal);
        FHE.allow(newBal, msg.sender);

        underlying.transfer(msg.sender, uint256(amount));
        emit Unwrap(msg.sender, amount);
    }

    // ── IConfidentialERC20 ────────────────────────────────────────────────────

    /**
     * @notice Grant `operator` permission to transfer any amount on the caller's
     *         behalf until `until` (Unix timestamp). Replaces encrypted approve.
     */
    function setOperator(address operator, uint48 until) external override {
        _operators[msg.sender][operator] = until;
        emit OperatorSet(msg.sender, operator, until);
    }

    function isOperator(address holder, address spender) external view override returns (bool) {
        return _operators[holder][spender] >= uint48(block.timestamp);
    }

    function confidentialBalanceOf(address account) external view override returns (euint64) {
        return _balances[account];
    }

    /**
     * @notice Encrypted transfer from `from` to `to`.
     *         Caller must be `from` OR a valid operator for `from`.
     *         The `amount` handle must be ACL-allowed to msg.sender.
     */
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external override returns (euint64 transferred) {
        if (msg.sender != from) {
            if (_operators[from][msg.sender] < uint48(block.timestamp)) revert NotOperator();
        }

        euint64 newFromBal = FHE.sub(_balances[from], amount);
        _balances[from] = FHE.allowThis(newFromBal);
        FHE.allow(newFromBal, from);

        euint64 newToBal = FHE.add(_balances[to], amount);
        _balances[to] = FHE.allowThis(newToBal);
        FHE.allow(newToBal, to);

        return amount;
    }

    /**
     * @notice Encrypted transfer from msg.sender to `to`.
     */
    function confidentialTransfer(
        address to,
        euint64 amount
    ) external override returns (euint64 transferred) {
        euint64 newFromBal = FHE.sub(_balances[msg.sender], amount);
        _balances[msg.sender] = FHE.allowThis(newFromBal);
        FHE.allow(newFromBal, msg.sender);

        euint64 newToBal = FHE.add(_balances[to], amount);
        _balances[to] = FHE.allowThis(newToBal);
        FHE.allow(newToBal, to);

        return amount;
    }
}
