// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title  InvestorCredential
 * @notice Soulbound ERC-721 issued to every investor added to a Holdr round.
 *
 *         Key properties:
 *           - Non-transferable (soulbound): proves wallet participation without
 *             exposing the encrypted allocation amount.
 *           - One token per (roundId, investor) pair — re-adding the same wallet
 *             to the same round reverts.
 *           - Minted by Allocations.addInvestor() — only the Allocations contract
 *             can call issue().
 *           - On-chain metadata: roundId is embedded in the token; anyone can
 *             verify participation on-chain via hasCredential().
 *
 *         What it does NOT encode:
 *           - Allocation amount (stays in the FHE ciphertext on Allocations).
 *           - Investor identity beyond their wallet address.
 */
contract InvestorCredential is ERC721 {
    address public immutable allocations;

    uint256 private _nextTokenId;

    /// @dev tokenId => roundId
    mapping(uint256 => uint256) public tokenRound;

    /// @dev roundId => investor => tokenId  (0 means no credential)
    mapping(uint256 => mapping(address => uint256)) public credentialOf;

    event CredentialIssued(
        uint256 indexed roundId,
        address indexed investor,
        uint256 indexed tokenId
    );

    error OnlyAllocations();
    error AlreadyIssued();
    error Soulbound();

    modifier onlyAllocations() {
        if (msg.sender != allocations) revert OnlyAllocations();
        _;
    }

    constructor(address _allocations)
        ERC721("Holdr Investor Credential", "HOLDR-CRED")
    {
        allocations = _allocations;
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────

    /**
     * @notice Issue a participation credential to an investor.
     *         Called by Allocations.addInvestor() only.
     * @param roundId  The round the investor was added to.
     * @param investor The investor's wallet address.
     * @return tokenId The minted token ID.
     */
    function issue(uint256 roundId, address investor)
        external
        onlyAllocations
        returns (uint256 tokenId)
    {
        if (credentialOf[roundId][investor] != 0) revert AlreadyIssued();

        unchecked { _nextTokenId++; }
        tokenId = _nextTokenId;

        _mint(investor, tokenId);
        tokenRound[tokenId] = roundId;
        credentialOf[roundId][investor] = tokenId;

        emit CredentialIssued(roundId, investor, tokenId);
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    /**
     * @notice Returns true if the investor holds a credential for this round.
     */
    function hasCredential(uint256 roundId, address investor)
        external
        view
        returns (bool)
    {
        return credentialOf[roundId][investor] != 0;
    }

    /**
     * @notice Total credentials issued across all rounds.
     */
    function totalIssued() external view returns (uint256) {
        return _nextTokenId;
    }

    // ─── Soulbound: block all transfers ───────────────────────────────────────

    /**
     * @dev Override _update to block all transfers except mints (from == address(0)).
     *      Burns are also blocked — credentials are permanent records.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }
}
