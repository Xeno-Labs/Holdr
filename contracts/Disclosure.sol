// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "./Allocations.sol";

/**
 * @title  Disclosure
 * @notice Selective disclosure — lets an investor grant a specific counterparty
 *         the ability to decrypt their allocation handle.
 *
 *         Use cases:
 *           - Next-round lead investor verifying cap table position
 *           - M&A acquirer confirming ownership
 *           - Auditor reviewing a specific holding
 *
 *         Mechanics:
 *           TFHE.allow(handle, counterparty) — adds the counterparty to the
 *           on-chain ACL for that ciphertext. The counterparty can then call
 *           the relayer SDK to decrypt the value. This permission is permanent
 *           in v1 (no revoke). Revocation can be added in v2 via re-encryption.
 *
 *         The public never gains access — only the named counterparty.
 */
contract Disclosure {
    Allocations public immutable allocations;

    event ViewGranted(
        uint256 indexed roundId,
        address indexed investor,
        address indexed counterparty
    );

    error NotAnInvestor();
    error InvalidCounterparty();

    constructor(address _allocations) {
        allocations = Allocations(_allocations);
    }

    /**
     * @notice Grant a counterparty the ability to decrypt your allocation in a round.
     * @param roundId      The round containing the allocation.
     * @param counterparty The address to grant view access to.
     */
    function grantView(uint256 roundId, address counterparty) external {
        if (counterparty == address(0)) revert InvalidCounterparty();

        // getAllocation reverts with NotFound if msg.sender has no allocation —
        // effectively enforces "only investors can grant view of their own row"
        euint64 handle = allocations.getAllocation(roundId, msg.sender);

        // Add counterparty to the ACL for this ciphertext handle
        TFHE.allow(handle, counterparty);

        // Record on-chain for frontend queries (informational; ACL is the source of truth)
        viewGranted[roundId][msg.sender][counterparty] = true;

        emit ViewGranted(roundId, msg.sender, counterparty);
    }

    /**
     * @notice Check whether a counterparty has been granted view access.
     *         Informational only — the actual permission lives in the TFHE ACL.
     */
    mapping(uint256 => mapping(address => mapping(address => bool))) public viewGranted;
}
