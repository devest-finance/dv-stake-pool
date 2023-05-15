// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

/**
 * @dev Interface of first draft of Tangible Stake Token - TST
 */
interface IStakePool {

    // Bid a price for shares, (shareholder accepts bid to swap)
    function buy(uint256 price, uint256 amount) payable external;

    // Ask for a price, (shareholder offers share to respective price)
    function sell(uint256 price, uint256 amount) payable external;

    // Transfer shares
    function transfer(address recipient, uint256 amount) external payable;

    // Terminate
    function terminate() external returns (bool);

    /// @notice A descriptive name of this Tangible Token
    function name() external view returns (string memory);

    /// @notice An abbreviated name expressing the share
    function symbol() external view returns (string memory);

}
