// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@devest/contracts/DvFactory.sol";
import "./DvStakePool.sol";


contract DvStakePoolFactory is DvFactory {

    constructor() DvFactory() {}

    /**
     * @dev detach a token from this factory
     */
    function detach(address payable _tokenAddress) external payable onlyOwner {
        DvStakePool fund = DvStakePool(_tokenAddress);
        fund.detach();
    }

    function issue(address tradingTokenAddress, string memory name, string memory symbol) public payable isActive returns (address)
    {
        // take royalty
        require(msg.value >= _issueFee, "Please provide enough fee");
        if (_issueFee > 0 && _feeRecipient != address(0))
            payable(_feeRecipient).transfer(_issueFee);

        // issue token
        DvStakePool token = new DvStakePool(tradingTokenAddress, name, symbol, address(this), _msgSender());

        emit deployed(_msgSender(), address(token));
        return address(token);
    }

}
