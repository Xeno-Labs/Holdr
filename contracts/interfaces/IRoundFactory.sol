// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRoundFactory {
    enum Status { DRAFT, OPEN, CLOSED, CANCELLED }

    struct Round {
        address founder;
        string name;
        uint256 targetRaise;
        uint64 deadline;
        Status status;
        uint256 totalRaised;
    }

    function createRound(string calldata name, uint256 targetRaise, uint64 deadline) external returns (uint256);
    function openRound(uint256 roundId) external;
    function cancelRound(uint256 roundId) external;
    function finaliseClose(uint256 roundId, uint256 totalRaised) external;
    function getRound(uint256 roundId) external view returns (Round memory);
    function getStatus(uint256 roundId) external view returns (Status);
    function getFounder(uint256 roundId) external view returns (address);
    function roundCount() external view returns (uint256);
}
