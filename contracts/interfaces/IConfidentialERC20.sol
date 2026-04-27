// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title  IConfidentialERC20
 * @notice Subset of ERC-7984 used by Vestr contracts.
 *
 *         Compatible with:
 *           - Our MockcUSDT (local Hardhat node)
 *           - Zama's deployed cUSDTMock on Sepolia
 *             (0x4E7B06D78965594eB5EF5414c357ca21E1554491)
 *
 *         Operator model (replaces approve/allowance):
 *           Investors call setOperator(subscriptionContract, deadline) once.
 *           Subscription.sol then calls confidentialTransferFrom freely until deadline.
 */
interface IConfidentialERC20 {
    // ── Operator management ───────────────────────────────────────────────────

    /**
     * @notice Approve `operator` to move any amount on behalf of caller until `until`.
     * @param operator Address permitted to call confidentialTransferFrom.
     * @param until    Unix timestamp after which the operator access expires.
     */
    function setOperator(address operator, uint48 until) external;

    /// @notice Returns true if `spender` is a current operator for `holder`.
    function isOperator(address holder, address spender) external view returns (bool);

    // ── Transfers ─────────────────────────────────────────────────────────────

    /**
     * @notice Move `amount` from `from` to `to`. Caller must be `from` or an operator.
     *         The `amount` handle must be ACL-allowed to `msg.sender` beforehand.
     */
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64 transferred);

    /**
     * @notice Move `amount` from msg.sender to `to`.
     */
    function confidentialTransfer(
        address to,
        euint64 amount
    ) external returns (euint64 transferred);

    // ── View ──────────────────────────────────────────────────────────────────

    /// @notice Returns the encrypted balance of `account`.
    function confidentialBalanceOf(address account) external view returns (euint64);
}
