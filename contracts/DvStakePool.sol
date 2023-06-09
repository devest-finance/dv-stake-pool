// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./VestingToken.sol";
import "./DeVest.sol";

// DevStakePool Investment Model One
// Bid & Offer
contract DvStakePool is VestingToken, ReentrancyGuard, Context, DeVest {

    // ---------------------------- EVENTS ------------------------------------

    // When an shareholder exchanged his shares
    event swapped(address indexed from, address indexed to, uint256 share, uint256 totalCost);

    // When dividends been disbursed
    event disbursed(uint256 amount);

    // ---------------------------- ERRORS --------------------------------


    // ---------------------------------------------------------------------


    // contract was terminated and can't be used anymore
    bool public terminated = false;

    // initialized
    bool internal initialized = false;

    // the reserves
    uint256 public reservesShares;
    uint256 public reservesTokens;

    // Shares contribution to the tangible
    uint256 public tangibleTax = 0;

    // Stakes
    mapping (address => uint256) internal shares;                   // shares of shareholder
    mapping (address => uint256) internal shareholdersIndex;        // index of the shareholders address
    address[] internal shareholders;                                // all current shareholders

    // metadata
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _totalSupply;

    // ---- assets

    // assets added to this fund
    struct Asset {
        address token;
        uint256 amount;
        uint256 disbursed;
    }
    Asset[] public assets;


    // Set owner and DI OriToken
    constructor(address _tokenAddress, string memory __name, string memory __symbol, address _owner, address _factory)
    VestingToken(_tokenAddress) DeVest(_owner, _factory) {

        _symbol = string(abi.encodePacked("% ", __symbol));
        _name = __name;
    }

    // ----------------------------------------------------------------------------------------------------------
    // ----------------------------------------------- MODIFIERS ------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    /**
    *  Verify tangible is active and initialized
    *
    */
    modifier _isActive() {
        require(initialized, 'Only owner can initialize tangibles');
        require(!terminated, 'Tangible was terminated');
        _;
    }

    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------ INTERNAL ------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    function swapShares(address from, address to, uint256 amount) internal {
        // if shareholder has no shares add him as new
        if (shares[to] == 0) {
            shareholdersIndex[to] = shareholders.length;
            shareholders.push(to);
        }

        shares[to] += amount;
        shares[from] -= amount;

        // remove shareholder without shares
        if (shares[from] == 0){
            shareholders[shareholdersIndex[from]] = shareholders[shareholders.length-1];
            shareholders.pop();
        }
    }

    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------- PUBLIC -------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    /**
     *  Initialize TST as tangible
     */
    function initialize(uint256 _initialValue, uint _royalty, uint8 __decimals) public virtual returns (bool){
        require(!initialized, 'Tangible already initialized');
        require(owner() == _msgSender(), 'Only owner can initialize tangibles');
        require(_royalty >= 0 && _royalty <= 1000, 'Invalid tax value');

        _decimals = __decimals + 2;
        uint256 totalShares = (10 ** _decimals);
        _totalSupply = totalShares;

        require(_initialValue >= totalShares, 'Amount must be larger than 100');

        _setRoyalties(_royalty, _msgSender());

        reservesTokens = _initialValue;
        reservesShares = totalShares;

        shareholders.push(_msgSender());
        shares[_msgSender()] = totalShares;

        // start bidding
        initialized = true;

        return true;
    }

    function test(uint256 _initialValue, uint _royalty, uint8 __decimals) public {

    }

    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------ TRADING -------------------------------------------------

    /**
    * Swap shares between owners,
    * Check for same level of disburse !!
    */
    function transfer(address recipient, uint256 amount) external payable takeFee nonReentrant _isActive {
        require(_msgSender() != owner(), 'Publisher cannot transfer shares');

        swapShares(_msgSender(), recipient, amount);
    }

    /**
    *  Buy Shares
    *  amountIn: How much tokens to Spend
    *  amountOutMin: Minimal amount of shares to accept (according to price-movement)
    */
    function buy(uint256 amountIn, uint256 amountOutMin) public payable virtual takeFee nonReentrant _isActive{
        require(_msgSender() != owner(), 'Publisher cannot buy shares');
        require(amountOutMin > 0 && amountOutMin <= _totalSupply, 'Invalid amount submitted');
        uint256 _amountOut = (reservesShares * amountIn) / (reservesTokens + amountIn);
        require(_amountOut > 0, 'PURCHASE QUANTITY TO LOW');
        require(_amountOut >= amountOutMin, 'SLIPPAGE FAILED');

        // calculate tax and charge and pull tokens
        uint256 _taxCharge = (amountIn * getRoyalty()) / 1000;
        uint256 _totalCost = amountIn + _taxCharge;
        __transferFrom(_msgSender(), address(this), _totalCost);

        // swap shares from publisher (manager) to new owner
        swapShares(owner(), _msgSender(), _amountOut);

        // pay tax
        __transfer(owner(), _taxCharge);

        // update balances
        reservesShares -= _amountOut;
        reservesTokens += amountIn;
    }

    /**
     *  Sell order
     */
    function sell(uint256 sharesIn, uint256 tokensOutMin) public payable takeFee nonReentrant _isActive {
        require(_msgSender() != owner(), 'Publisher cannot sell shares');
        require(sharesIn > 0 && sharesIn <= _totalSupply, 'Invalid amount submitted');
        require(shares[_msgSender()]  > 0, 'Insufficient shares');

        uint256 _amountOut = (reservesTokens * sharesIn) / (reservesShares + sharesIn);
        require(_amountOut >= tokensOutMin, 'SLIPPAGE FAILED');

        // swap shares from publisher (manager) to new owner
        swapShares(_msgSender(), owner(), sharesIn);

        __transfer(_msgSender(), _amountOut);

        // update balances
        reservesShares += sharesIn;
        reservesTokens -= _amountOut;
    }

    // Terminate this contract, and pay-out all remaining investors
    function terminate() public nonReentrant onlyOwner returns (bool) {
        require(terminated == false, 'Already terminated');
        require(owner() == _msgSender(), 'Only owner can terminate');

        terminated = true;

        // if not initialized return all assets to owner
        if (!initialized){
            for(uint256 i=0;i<assets.length;i++){
                IERC20 _token = IERC20(assets[i].token);
                _token.transfer(_msgSender(), assets[i].amount);
            }
        }

        return terminated;
    }

    // ----------------------------------------------------------------------------------------------------------
    // -------------------------------------------- PUBLIC GETTERS ----------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    /**
    *  Add a token to the fund
    *  token: address of token to add
    *  amount: amount to add
    */
    function addAsset(address token, uint256 amount) public payable virtual nonReentrant {
        require(token != _vestingToken, "Vesting token cannot be added as Asset");
        require(!initialized, 'Tangible already initialized');
        require(amount >= 0, 'Invalid amount');

        IERC20 _token = IERC20(token);

        // transfer assets to this contract
        _token.transferFrom(_msgSender(), address(this), amount);

        assets.push(Asset(token, amount, 0));
    }

    function withdraw() public payable nonReentrant{
        require(shares[_msgSender()] > 0, 'No shares available');

        require(terminated, 'Withdraw is only possible after termination');

        // publisher also receives trading asset
        if (_msgSender() == owner()){
            uint256 balance = __balanceOf(address(this));
            __transfer(_msgSender(), balance);
        }

        // receive shares of assets
        for(uint256 i=0;i<assets.length;i++){
            IERC20 _token = IERC20(assets[i].token);
            uint256 amount = ((shares[_msgSender()] * assets[i].amount) / 1000);
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

    function getAssetBalance() public view returns (AssetInfo[] memory){
        AssetInfo[] memory _assets = new AssetInfo[](assets.length);

        for(uint256 i=0;i<assets.length;i++){
            IERC20 _token = IERC20(assets[i].token);
            _assets[i] = AssetInfo(assets[i].token, _token.balanceOf(address(this)));
        }

        return _assets;
    }

    // Get shares of one investor
    function balanceOf(address _owner) public view returns (uint256) {
        return shares[_owner];
    }

    // Get shares of one investor
    function getShares(address _owner) public view returns (uint256) {
        return shares[_owner];
    }

    // Get shareholder addresses
    function getShareholders() public view returns (address[] memory) {
        return shareholders;
    }

    /**
    * @dev Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view returns (uint8) {
        return _decimals;
    }

    // Function to receive Ether only allowed when contract Native Token
    receive() external payable {}

}
