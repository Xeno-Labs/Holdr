// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title  MockUSDT
 * @notice Freely-mintable plaintext ERC-20 used as the underlying asset for MockcUSDT.
 *         Replace with canonical USDT address on Sepolia when deploying to production.
 *         6 decimals to match USDT convention.
 */
contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
