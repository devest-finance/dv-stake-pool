// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DeVest.sol";
import "./DvOrderBook.sol";

// DevStakePool Investment Model One
// Bid & Offer
contract DvStakePool is DvOrderBook {

    // ---- assets

    // assets added to this fund
    struct Asset {
        address token;
        uint256 amount;
        uint256 disbursed;
    }
    Asset[] public assets;

    // Set owner and DI OriToken
    constructor(address _tokenAddress, string memory __name, string memory __symbol, address _factory, address _owner) 
     DvOrderBook(_tokenAddress, __name, __symbol, _owner, _factory) {}

    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------- PUBLIC -------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    // Terminate this contract, and pay-out all remaining investors
    function terminate() public override nonReentrant onlyOwner notState(States.Terminated) {

        // check if state is created
        if (state == States.Created) {
            // transfet all assets back to owner
            for (uint256 i = 0; i < assets.length; i++) {
                IERC20 _token = IERC20(assets[i].token);
                _token.transfer(owner(), assets[i].amount);
            }
        }

        state = States.Terminated;
    }

 
    /**
     *  Add a token to the fund
     *  token: address of token to add
     *  amount: amount to add
     */
    function addAsset(address token,uint256 amount) public payable virtual nonReentrant atState(States.Created) onlyOwner {
        // TODO: Check if you can add same token in to the pool
        require(token != address(_token), "Vesting token cannot be added as Asset");
        require(amount >= 0, "Invalid amount");

        IERC20 _token = IERC20(token);

        // transfer assets to this contract
        _token.transferFrom(_msgSender(), address(this), amount);

        // check if asset is already in the pool
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i].token == token) {
                assets[i].amount += amount;
                return;
            }
        }

        assets.push(Asset(token, amount, 0));
    }

    function withdraw() public payable nonReentrant atState(States.Terminated) {
        require(shares[_msgSender()] > 0, "No shares available");


        // publisher also receives trading asset
        if (_msgSender() == owner()) {
            uint256 balance = _token.balanceOf(address(this));
            _token.transfer(_msgSender(), balance);
        }

        // receive shares of assets
        for (uint256 i = 0; i < assets.length; i++) {
            IERC20 _token = IERC20(assets[i].token);
            
            // TODO: Check if this is correct!!!
            uint256 amount = ((shares[_msgSender()] * assets[i].amount) / 10 ** _decimals);
            _token.transfer(_msgSender(), amount);
        }

        shares[_msgSender()] = 0;
    }

    // ----------------------------------------------------------------------------------------------------------
    // -------------------------------------------- PUBLIC GETTERS ----------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    struct AssetInfo {
        address token;
        uint256 balance;
    }

    function getAssetBalance() public view returns (AssetInfo[] memory) {
        AssetInfo[] memory _assets = new AssetInfo[](assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            IERC20 _token = IERC20(assets[i].token);
            _assets[i] = AssetInfo(assets[i].token, _token.balanceOf(address(this)));
        }

        return _assets;
    }


    // Function to receive Ether only allowed when contract Native Token
    receive() override external payable {}

}
