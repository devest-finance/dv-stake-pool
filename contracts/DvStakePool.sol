// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DeVest.sol";

// DevStakePool Investment Model One
// Bid & Offer
contract DvStakePool is ReentrancyGuard, Context, DeVest {
    // ---------------------------- EVENTS ------------------------------------

    // When an shareholder exchanged his shares
    event Trade(address indexed from, address indexed to, uint256 quantity, uint256 price);

    // When dividends been disbursed
    event disbursed(uint256 amount);

    // ---------------------------- ERRORS --------------------------------


    // ---------------------------------------------------------------------

    enum States {
        Created,
        Trading,
        Terminated
    }

    States public state = States.Created;

    /**
     *  Order struct
     *  @param index - index of the order
     *  @param price - price of the order
     *  @param amount - amount of shares
     *  @param escrow - amount in escrow
     *  @param bid - true = buy | false = sell
     */
    struct Order {
        uint256 index;
        uint256 price;
        uint256 amount;
        uint256 escrow;
        bool bid; // buy = true | sell = false
    }
    mapping(address => Order) public orders; // all orders
    address[] public orderAddresses; // all order addresses

    // TODO: Check if this is needed
    // the reserves
    // uint256 public reservesShares;
    // uint256 public reservesTokens;

    // Shares contribution to the tangible
    uint256 public tangibleTax = 0;

    // Stakes
    mapping(address => uint256) internal shares; // shares of shareholder
    mapping(address => uint256) internal shareholdersIndex; // index of the shareholders address
    address[] internal shareholders; // all current shareholders

    // ---- assets

    // assets added to this fund
    struct Asset {
        address token;
        uint256 amount;
        uint256 disbursed;
    }
    Asset[] public assets;

    // metadata
    IERC20 private _vestingToken;
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _totalSupply;



    // Set owner and DI OriToken
    constructor(address _tokenAddress, string memory __name, string memory __symbol, address _owner, address _factory) 
     DeVest(_owner, _factory) {
        _vestingToken = IERC20(_tokenAddress);
        _symbol = string(abi.encodePacked("% ", __symbol));
        _name = __name;
    }

    // ----------------------------------------------------------------------------------------------------------
    // ----------------------------------------------- MODIFIERS ------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    /**
    *  Verify required state
    *
    */
    modifier atState(States _state) {
        require(state == _state, "Not available in current state");
        _;
    }

    modifier notState(States _state) {
        require(state != _state, "Not available in current state");
        _;
    }

    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------ INTERNAL ------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------


    /**
     *  Internal token allowance
     */
    function __allowance(address account, uint256 amount) internal view {
        require(_vestingToken.allowance(account, address(this)) >= amount, 'Insufficient allowance provided');
    }

    /**
     *  Update stored bids, if bid was spend, remove from list
     */
    function _removeOrder(address orderOwner) internal {
        uint256 index = orders[orderOwner].index;
        orderAddresses[index] = orderAddresses[orderAddresses.length - 1];
        orders[orderAddresses[orderAddresses.length - 1]].index = index;
        delete orders[orderOwner];
        orderAddresses.pop();
    }

    function swapShares(address to, address from, uint256 amount) internal { 
        require(getShares(from) >= amount, "Insufficient shares");
        require(from != to, "Can't transfer to yourself");

        // if shareholder has no shares add him as new
        if (shares[to] == 0) {
            shareholdersIndex[to] = shareholders.length;
            shareholders.push(to);
        }

        // update shares
        shares[to] += amount;
        shares[from] -= amount;

        // remove shareholder without shares
        if (shares[from] == 0) {
            shareholders[shareholdersIndex[from]] = shareholders[shareholders.length - 1];
            shareholdersIndex[shareholders[shareholders.length - 1]] = shareholdersIndex[from];
            shareholders.pop();
        }
    }

    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------- PUBLIC -------------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    /**
     *  Initialize TST as tangible
     */
    function initialize(uint royalty, uint8 decimal) public virtual onlyOwner atState(States.Created) returns (bool) {
        require(royalty >= 0 && royalty <= 1000, "Invalid tax value");
        require (decimal >= 0 && decimal <= 10, 'Max 16 decimals');

        _decimals = decimal + 2;
        uint256 totalShares = (10 ** _decimals);
        _totalSupply = totalShares;

        _setRoyalties(royalty, _msgSender());

        // TODO: Check if this is needed
        // reservesTokens = _initialValue;
        // reservesShares = totalShares;

        shareholders.push(_msgSender());
        shares[_msgSender()] = totalShares;

        // start bidding
        state = States.Trading;

        return true;
    }

    // ----------------------------------------------------------------------------------------------------------
    // ------------------------------------------------ TRADING -------------------------------------------------

    /**
     * Swap shares between owners,
     * Check for same level of disburse !!
     */
    function transfer(address recipient, uint256 amount) external payable takeFee nonReentrant atState(States.Trading) {
        require(_msgSender() != owner(), "Publisher cannot transfer shares");

        swapShares(recipient, _msgSender(), amount);
    }

    /**
    *  Buy Order
    *  _price: price for the amount of shares
    *  amount: amount
    */
    function buy(uint256 _price, uint256 amount) public payable virtual nonReentrant atState(States.Trading) {
        require(amount > 0 && amount <= _totalSupply, 'Invalid amount submitted');
        require(_price > 0, 'Invalid price submitted');
        require(orders[_msgSender()].amount == 0, 'Active buy order, cancel first');

        // add tax to escrow
        uint256 _escrow = (_price * amount) + (_price * amount * getRoyalty()) / 1000;

        // check if enough escrow allowed
        __allowance(_msgSender(), _escrow);

        // store bid
        orders[_msgSender()] = Order(orderAddresses.length, _price, amount, _escrow, true);
        orderAddresses.push(_msgSender());

        // pull escrow
        _vestingToken.transferFrom(_msgSender(), address(this), _escrow);
    }

    /**
     *  Sell order
     */
    function sell(uint256 _price, uint256 amount) public payable nonReentrant atState(States.Trading) {
        require(amount > 0 && amount <= _totalSupply, 'Invalid amount submitted');
        require(_price > 0, 'Invalid price submitted');
        require(shares[_msgSender()]  > 0, 'Insufficient shares');
        require(orders[_msgSender()].amount == 0, 'Active order, cancel first');
        require(amount <= shares[_msgSender()], 'Invalid amount submitted');

        // store bid
        orders[_msgSender()] = Order(orderAddresses.length, _price, amount, 0, false);
        orderAddresses.push(_msgSender());
    }

    /**
     *  Accept order
     */
    function accept(address orderOwner, uint256 amount) external payable nonReentrant atState(States.Trading) takeFee {
        require(amount > 0, "Invalid amount submitted");
        require(orders[orderOwner].amount >= amount, "Invalid order");
        require(_msgSender() != orderOwner, "Can't accept your own order");

        Order memory order = orders[orderOwner];

        // calculate taxes
        uint256 cost = order.price * amount;
        uint256 tax = (cost * getRoyalty()) / 1000;
        uint256 totalCost = cost + tax;

        // deduct amount from order
        orders[orderOwner].amount -= amount;

        // accepting on bid order
        if (order.bid == true) {
            _acceptBidOrder(orderOwner, cost, totalCost, amount, order.price);
        } else {
            _acceptAskOrder(orderOwner, cost, totalCost, amount, order.price);
        }

        // pay royalty
        _vestingToken.transfer(owner(), tax);
    }

    /**
     * accepting bid order
     * so caller is accepting to sell his share to order owner
     * -> escrow from order can be transferred to owner
     */
    function _acceptBidOrder(address orderOwner, uint256 cost, uint256 totalCost, uint256 amount, uint256 price) internal {
        require(shares[_msgSender()] >= amount,"Insufficient shares");

        _vestingToken.transfer(_msgSender(), cost);
        swapShares(orderOwner, _msgSender(), amount);
        emit Trade(orderOwner, _msgSender(), amount, price);

        orders[orderOwner].escrow -= totalCost;

        if (orders[orderOwner].amount == 0)
            _removeOrder(orderOwner);
    }


    function _acceptAskOrder(address orderOwner, uint256 cost, uint256 totalCost, uint256 amount, uint256 price) internal {
        require(shares[orderOwner] >= amount, "Insufficient shares");

        _vestingToken.transferFrom(_msgSender(), address(this), totalCost);
        _vestingToken.transfer(orderOwner, cost);
        swapShares(_msgSender(), orderOwner, amount);
        emit Trade(_msgSender(), orderOwner, amount, price);

        // update offer
        if (orders[orderOwner].amount == 0)
            _removeOrder(orderOwner);
    }

    // Cancel order and return escrow
    function cancel() public virtual notState(States.Created) {
        require(orders[_msgSender()].amount > 0, 'Invalid order');

        Order memory _order = orders[_msgSender()];
        // return escrow leftover
        if (_order.bid) {
            _vestingToken.transfer(_msgSender(), _order.escrow);
        }
        
        // update bids
        _removeOrder(_msgSender());
    }

    // Terminate this contract, and pay-out all remaining investors
    function terminate() public nonReentrant onlyOwner notState(States.Terminated) returns (bool) {
        require(owner() == _msgSender(), "Only owner can terminate");
        
        // check if state is created
        if (state == States.Created) {
            // transfet all assets back to owner
            for (uint256 i = 0; i < assets.length; i++) {
                IERC20 _token = IERC20(assets[i].token);
                _token.transfer(owner(), assets[i].amount);
            }
        }

        state = States.Terminated;

        return true;
    }

    // ----------------------------------------------------------------------------------------------------------
    // -------------------------------------------- PUBLIC GETTERS ----------------------------------------------
    // ----------------------------------------------------------------------------------------------------------

    /**
     *  Add a token to the fund
     *  token: address of token to add
     *  amount: amount to add
     */
    function addAsset(address token,uint256 amount) public payable virtual nonReentrant atState(States.Created) onlyOwner {
        // TODO: Check if you can add same token in to the pool
        require(token != address(_vestingToken), "Vesting token cannot be added as Asset");
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
            uint256 balance = _vestingToken.balanceOf(address(this));
            _vestingToken.transfer(_msgSender(), balance);
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

    // Get shares of one investor
    function balanceOf(address _owner) public view returns (uint256) {
        return getShares(_owner);
    }

    // Get shares of one investor
    function getShares(address _owner) public view returns (uint256) {
        if (orders[_owner].amount > 0 && !orders[_owner].bid){
            return shares[_owner] - orders[_owner].amount;
        } else
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
