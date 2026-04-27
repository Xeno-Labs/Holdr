// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./Allocations.sol";

/**
 * @title  Disclosure
 * @notice Selective disclosure — lets an investor grant a specific counterparty
 *         the ability to decrypt their allocation handle.
 *
 *         Use cases: next-round lead verifying cap-table position, M&A acquirer,
 *         auditor reviewing a specific holding.
 *
 *         Mechanics:
 *           At addInvestor time, Allocations grants Disclosure ACL access on the handle.
 *           When grantView is called by the investor, Disclosure calls FHE.allow(handle, counterparty)
 *           to extend that permission — without revealing the plaintext value.
 *           Permission is permanent in v1 (no revoke).
 */
contract Disclosure is ZamaEthereumConfig {
    Allocations public immutable allocations;

    // Informational record for frontend queries; ACL is the actual source of truth
    mapping(uint256 => mapping(address => mapping(address => bool))) public viewGranted;

    event ViewGranted(
        uint256 indexed roundId,
        address indexed investor,
        address indexed counterparty
    );

    error InvalidCounterparty();

    constructor(address _allocations) {
        allocations = Allocations(_allocations);
    }

    /**
     * @notice Grant a counterparty the ability to decrypt your allocation in a round.
     *
     * @param roundId      The round containing the allocation.
     * @param counterparty The address to grant view access to.
     *
     * @dev  This contract has been pre-granted ACL access on the handle by Allocations
     *       at addInvestor time (FHE.allow(amt, disclosureContract)). This allows
     *       Disclosure to extend that permission to any counterparty the investor names.
     *
     *       getAllocation reverts with NotFound if msg.sender has no allocation,
     *       enforcing "only investors can grant view of their own row".
     */
    function grantView(uint256 roundId, address counterparty) external {
        if (counterparty == address(0)) revert InvalidCounterparty();

        euint64 handle = allocations.getAllocation(roundId, msg.sender);

        // Disclosure has ACL access (granted at addInvestor time) — extend to counterparty
        FHE.allow(handle, counterparty);

        viewGranted[roundId][msg.sender][counterparty] = true;
        emit ViewGranted(roundId, msg.sender, counterparty);
    }
}
