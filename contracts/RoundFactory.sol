// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  RoundFactory
 * @notice Manages the lifecycle of confidential fundraising rounds.
 *         Round metadata (name, target, deadline) is public.
 *         Per-investor allocations live in Allocations.sol and remain encrypted.
 */
contract RoundFactory {
    enum Status {
        DRAFT,
        OPEN,
        CLOSED,
        CANCELLED
    }

    struct Round {
        address founder;
        string name;
        uint256 targetRaise; // plaintext, in cUSDT base units (6 decimals)
        uint64 deadline;     // unix timestamp
        Status status;
        uint256 totalRaised; // populated post-close via gateway callback
    }

    uint256 public roundCount;
    mapping(uint256 => Round) private _rounds;

    // Trusted Allocations contract — set once at construction
    address public allocationsContract;

    event RoundCreated(uint256 indexed roundId, address indexed founder, string name, uint256 targetRaise);
    event RoundOpened(uint256 indexed roundId);
    event RoundClosed(uint256 indexed roundId, uint256 totalRaised);
    event RoundCancelled(uint256 indexed roundId);

    error NotFounder();
    error InvalidStatus(Status current, Status required);
    error DeadlineMustBeFuture();
    error AllocationsAlreadySet();
    error OnlyAllocations();

    modifier onlyFounder(uint256 roundId) {
        if (_rounds[roundId].founder != msg.sender) revert NotFounder();
        _;
    }

    modifier inStatus(uint256 roundId, Status required) {
        if (_rounds[roundId].status != required) revert InvalidStatus(_rounds[roundId].status, required);
        _;
    }

    /**
     * @notice Set the trusted Allocations contract address. One-time call by deployer.
     */
    function setAllocationsContract(address _allocations) external {
        if (allocationsContract != address(0)) revert AllocationsAlreadySet();
        allocationsContract = _allocations;
    }

    /**
     * @notice Create a new round in DRAFT status.
     * @param name         Public name for the round (e.g. "Seed").
     * @param targetRaise  Total target in cUSDT base units.
     * @param deadline     Unix timestamp after which anyone can close the round.
     */
    function createRound(
        string calldata name,
        uint256 targetRaise,
        uint64 deadline
    ) external returns (uint256 roundId) {
        if (deadline <= block.timestamp) revert DeadlineMustBeFuture();

        roundId = ++roundCount;
        _rounds[roundId] = Round({
            founder: msg.sender,
            name: name,
            targetRaise: targetRaise,
            deadline: deadline,
            status: Status.DRAFT,
            totalRaised: 0
        });

        emit RoundCreated(roundId, msg.sender, name, targetRaise);
    }

    /**
     * @notice Transition a DRAFT round to OPEN. Only the founder can call this.
     *         Investors should be added via Allocations.sol before opening.
     */
    function openRound(uint256 roundId)
        external
        onlyFounder(roundId)
        inStatus(roundId, Status.DRAFT)
    {
        _rounds[roundId].status = Status.OPEN;
        emit RoundOpened(roundId);
    }

    /**
     * @notice Called by Subscription.sol (via Allocations) after the gateway
     *         returns the decrypted aggregate. Sets totalRaised and marks CLOSED.
     */
    function finaliseClose(uint256 roundId, uint256 totalRaised) external {
        if (msg.sender != allocationsContract) revert OnlyAllocations();
        _rounds[roundId].status = Status.CLOSED;
        _rounds[roundId].totalRaised = totalRaised;
        emit RoundClosed(roundId, totalRaised);
    }

    /**
     * @notice Cancel a DRAFT or OPEN round. Only the founder.
     */
    function cancelRound(uint256 roundId) external onlyFounder(roundId) {
        Status s = _rounds[roundId].status;
        if (s != Status.DRAFT && s != Status.OPEN) {
            revert InvalidStatus(s, Status.DRAFT);
        }
        _rounds[roundId].status = Status.CANCELLED;
        emit RoundCancelled(roundId);
    }

    function getRound(uint256 roundId) external view returns (Round memory) {
        return _rounds[roundId];
    }

    function getStatus(uint256 roundId) external view returns (Status) {
        return _rounds[roundId].status;
    }

    function getFounder(uint256 roundId) external view returns (address) {
        return _rounds[roundId].founder;
    }
}
