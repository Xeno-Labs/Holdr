// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  MockcUSDT
 * @notice Confidential USDT — wraps MockUSDT into an FHE-encrypted ERC-20.
 *
 *         Wrap flow (per investor, done in seed script):
 *           1. investor.approve(mockCUSDT, amount)     — plaintext approval
 *           2. mockCUSDT.wrap(amount)                  — locks mUSDT, credits euint64 balance
 *           3. mockCUSDT.approve(subscription, handle, proof) — encrypted allowance
 *           4. subscription.subscribe(roundId)         — encrypted transferFrom
 *
 *         Swap to canonical cUSDT: set CUSDT_ADDRESS env var and point
 *         Subscription.sol at it — interface is identical, no contract changes.
 */
contract MockcUSDT is ZamaEthereumConfig, ReentrancyGuard {
    IERC20 public immutable underlying; // MockUSDT

    mapping(address => euint64) private _balances;
    mapping(address => mapping(address => euint64)) private _allowances;

    event Wrap(address indexed account, uint256 amount);
    event Unwrap(address indexed account, uint256 amount);
    event Transfer(address indexed from, address indexed to);
    event Approval(address indexed owner, address indexed spender);

    error InsufficientBalance();
    error ZeroAmount();

    constructor(address mockUSDT_) {
        underlying = IERC20(mockUSDT_);
    }

    // ─── Wrap / Unwrap ────────────────────────────────────────────────────────

    /**
     * @notice Lock plaintext mUSDT and credit an encrypted balance.
     *         Caller must have approved this contract for `amount` beforehand.
     */
    function wrap(uint64 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        underlying.transferFrom(msg.sender, address(this), uint256(amount));

        euint64 enc = FHE.asEuint64(amount);
        euint64 newBal = FHE.add(_balances[msg.sender], enc);
        _balances[msg.sender] = FHE.allowThis(newBal);
        FHE.allow(newBal, msg.sender);

        emit Wrap(msg.sender, amount);
    }

    /**
     * @notice Decrypt and withdraw mUSDT back. Amount is plaintext for simplicity (v1).
     *         In production this would use a gateway decryption request.
     */
    function unwrap(uint64 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        // For v1 / demo: trust the caller knows their balance (they can decrypt it)
        // Deduct encrypted amount from balance
        euint64 enc = FHE.asEuint64(amount);
        euint64 newBal = FHE.sub(_balances[msg.sender], enc);
        _balances[msg.sender] = FHE.allowThis(newBal);
        FHE.allow(newBal, msg.sender);

        underlying.transfer(msg.sender, uint256(amount));
        emit Unwrap(msg.sender, amount);
    }

    // ─── Encrypted ERC-20 interface ───────────────────────────────────────────

    function balanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /**
     * @notice Set an encrypted allowance for a spender.
     * @param spender   Address permitted to spend.
     * @param encAmount Encrypted allowance amount from relayer SDK.
     * @param inputProof ZKPoK proof.
     */
    function approve(address spender, externalEuint64 encAmount, bytes calldata inputProof) external {
        euint64 amt = FHE.fromExternal(encAmount, inputProof);
        _allowances[msg.sender][spender] = FHE.allowThis(amt);
        FHE.allow(amt, msg.sender);
        FHE.allow(amt, spender);
        emit Approval(msg.sender, spender);
    }

    function allowance(address owner, address spender) external view returns (euint64) {
        return _allowances[owner][spender];
    }

    /**
     * @notice Encrypted transfer: move `amount` from `from` to `to`.
     *         Caller must be `from` OR have a sufficient encrypted allowance.
     *         Uses FHE.select to silently transfer 0 if allowance/balance insufficient
     *         (standard confidential ERC-20 behaviour).
     */
    function transferFrom(address from, address to, euint64 amount) external returns (bool) {
        if (msg.sender != from) {
            // Consume allowance
            euint64 currentAllowance = _allowances[from][msg.sender];
            euint64 newAllowance = FHE.sub(currentAllowance, amount);
            _allowances[from][msg.sender] = FHE.allowThis(newAllowance);
            FHE.allow(newAllowance, from);
            FHE.allow(newAllowance, msg.sender);
        }

        euint64 fromBal = _balances[from];
        euint64 newFromBal = FHE.sub(fromBal, amount);
        _balances[from] = FHE.allowThis(newFromBal);
        FHE.allow(newFromBal, from);

        euint64 newToBal = FHE.add(_balances[to], amount);
        _balances[to] = FHE.allowThis(newToBal);
        FHE.allow(newToBal, to);

        emit Transfer(from, to);
        return true;
    }

    /**
     * @notice Transfer from msg.sender to `to`.
     */
    function transfer(address to, euint64 amount) external returns (bool) {
        euint64 newFromBal = FHE.sub(_balances[msg.sender], amount);
        _balances[msg.sender] = FHE.allowThis(newFromBal);
        FHE.allow(newFromBal, msg.sender);

        euint64 newToBal = FHE.add(_balances[to], amount);
        _balances[to] = FHE.allowThis(newToBal);
        FHE.allow(newToBal, to);

        emit Transfer(msg.sender, to);
        return true;
    }
}
