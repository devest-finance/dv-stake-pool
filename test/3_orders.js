const AccountHelper = require("./helpers/Helper");

const ERC20 = artifacts.require("ERC20PresetFixedSupply");
const DvStakePoolFactory = artifacts.require("DvStakePoolFactory");
const DvStakePool = artifacts.require("DvStakePool");

contract('Functions accessability', (accounts) => {

    let vestingToken;
    let factory;
    let stakePool;
    let token1;
    let token2;
    let token3;

    const decimals = 3;


    before(async () => {
        vestingToken = await ERC20.deployed();
        factory = await DvStakePoolFactory.deployed();
        await AccountHelper.setupAccountFunds(accounts, vestingToken, 40000000000);
        stakePool = await AccountHelper.createTangible(factory, vestingToken.address, "Example Pool", "EXP", 5000, 10, 0,  accounts[0]);

        // new erc20 token
        token1 = await AccountHelper.createERCToken("ERC20 Token #1", "TK1", 1000000000000, accounts[0], accounts[0]);
        token2 = await AccountHelper.createERCToken("ERC20 Token #2", "TK2", 1000000000000, accounts[0], accounts[0]);
        token3 = await AccountHelper.createERCToken("ERC20 Token #3", "TK3", 1000000000000, accounts[0], accounts[0]);

        // setup account founds for all tokens
        await AccountHelper.setupAccountFunds(accounts, token1, 40000000000);
        await AccountHelper.setupAccountFunds(accounts, token2, 40000000000);
        await AccountHelper.setupAccountFunds(accounts, token3, 40000000000);

        // initialaze stake pool - 10% tax
        // initilize with account that is owner
        await stakePool.initialize(100, decimals, { from: accounts[0] });
    });

    // make sell orders
    it("Owner make sell orders", async () => {
        const shares = 50 * Math.pow(10, decimals);
        // account 0 make sell order for 50% of shares
        await stakePool.sell(5000, shares, {from: accounts[0]});
        // account 0 can't make more sell orders
        try {
            await stakePool.sell(5000, 50, {from: accounts[0]});
            assert.fail("Expected error not received");
        }
        catch (error) {
            assert.equal(error.reason, "Active order, cancel first", "Expected error not received")
        }
    });

    // check that account 3 can't make sell order
    it("Account 3 can't make sell order", async () => {
        try {
            await stakePool.sell(50, 50, {from: accounts[3]});
            assert.fail("Expected error not received");
        }
        catch (error) {
            assert.equal(error.reason, "Insufficient shares", "Expected error not received")
        }
    });

    // account 2,3,4 accept sell order
    it("Account 2,3,4 accept sell order", async () => {
        const pricePerShare = 5000;

        const account2PurchaseShares = 10 * Math.pow(10, decimals);
        const account3PurchaseShares = 20 * Math.pow(10, decimals);
        const account4PurchaseShares = 20 * Math.pow(10, decimals);

        // allowance for account 2,3,4
        await vestingToken.approve(stakePool.address, (account2PurchaseShares * pricePerShare * 1.1).toFixed(0), {from: accounts[2]});
        await vestingToken.approve(stakePool.address, (account3PurchaseShares * pricePerShare * 1.1).toFixed(0), {from: accounts[3]});
        await vestingToken.approve(stakePool.address, (account4PurchaseShares * pricePerShare * 1.1).toFixed(0), {from: accounts[4]});

        // check owner balance before accept
        const balance0Before = await vestingToken.balanceOf.call(accounts[0]);

        await stakePool.accept(accounts[0], account2PurchaseShares, {from: accounts[2], value: 10000000});
        await stakePool.accept(accounts[0], account3PurchaseShares, {from: accounts[3], value: 10000000});
        await stakePool.accept(accounts[0], account4PurchaseShares, {from: accounts[4], value: 10000000});

        // check that owner got 10% tax on all purchases + pricePerShare * shares
        const balance0After = await vestingToken.balanceOf.call(accounts[0]);
        assert.equal(balance0After.toNumber(), balance0Before.toNumber() + account2PurchaseShares * pricePerShare + account3PurchaseShares * pricePerShare +
        account4PurchaseShares * pricePerShare + (account2PurchaseShares * pricePerShare * 0.1) + (account3PurchaseShares * pricePerShare * 0.1) + 
        (account4PurchaseShares * pricePerShare * 0.1), "Balance should be 1000 less");

        // check shares of account 0,2,3,4
        const shares0 = await stakePool.getShares.call(accounts[0]);
        const shares2 = await stakePool.getShares.call(accounts[2]);
        const shares3 = await stakePool.getShares.call(accounts[3]);
        const shares4 = await stakePool.getShares.call(accounts[4]);

        assert.equal(shares0.toNumber(), 50 * Math.pow(10, decimals), "Account 0 should have 50% shares");
        assert.equal(shares2.toNumber(), account2PurchaseShares, "Account 2 should have 10% shares");
        assert.equal(shares3.toNumber(), account3PurchaseShares, "Account 3 should have 20% shares");
        assert.equal(shares4.toNumber(), account4PurchaseShares, "Account 4 should have 20% shares");
    });

    // check there are no active orders and owner can make sell order
    it("Check there are no active orders and owner can make sell order", async () => {
        const activeOrders = await stakePool.getOrders.call();
        assert.equal(activeOrders.length, 0, "Active orders should be 0");
        
        const shares = 30 * Math.pow(10, decimals);

        await stakePool.sell(5000, shares, {from: accounts[0]});

        // check there is active order
        const activeOrdersAfter = await stakePool.getOrders.call();
        assert.equal(activeOrdersAfter.length, 1, "Active orders should be 1");

        // check shares of account 0
        const shares0 = await stakePool.getShares.call(accounts[0]);
        assert.equal(shares0.toNumber(), 20 * Math.pow(10, decimals), "Account 0 should have 20% shares");
    });

    // account 6 makes buy order
    it("Account 6 makes buy order and cancels it", async () => {
        // check there is active order
        const activeOrders = await stakePool.getOrders.call();
        assert.equal(activeOrders.length, 1, "Active orders should be 1");

        // check balance before buy
        const balanceBefore = await vestingToken.balanceOf.call(accounts[6]);

        // check contract balance
        const contractBalance = await vestingToken.balanceOf.call(stakePool.address);

        // shares to buy
        const shares = 10 * Math.pow(10, decimals);
        const pricePerShare = 10;

        // contract takes 10% tax +  pricePerShare * shares
        const totalPayment = shares * pricePerShare + (shares * pricePerShare * 0.1);

        // allowance for account 6
        await vestingToken.approve(stakePool.address, totalPayment, {from: accounts[6]});

        await stakePool.buy(10, shares, {from: accounts[6]});

        // check there are two active orders
        const activeOrdersAfter = await stakePool.getOrders.call();
        assert.equal(activeOrdersAfter.length, 2, "Active orders should be 2");


        // check balance after buy
        const balanceAfter = await vestingToken.balanceOf.call(accounts[6]);
        assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() - totalPayment, "Balance should be 1000 less");

        // check contract balance after buy
        const contractBalanceAfter = await vestingToken.balanceOf.call(stakePool.address);
        assert.equal(contractBalanceAfter.toNumber(), contractBalance.toNumber() + totalPayment, "Contract balance is not correct");

        // cancel order
        await stakePool.cancel({from: accounts[6]});

        // check contract balance after cancel
        const contractBalanceAfterCancel = await vestingToken.balanceOf.call(stakePool.address);
        assert.equal(contractBalanceAfterCancel.toNumber(), contractBalance.toNumber(), "Contract balance is not correct");

        // check account 6 shares
        const shares6 = await stakePool.getShares.call(accounts[6]);
        assert.equal(shares6.toNumber(), 0, "Account 6 should have 0% shares");

        // check account 6 balance
        const balance6 = await vestingToken.balanceOf.call(accounts[6]);
        assert.equal(balance6.toNumber(), balanceBefore.toNumber(), "Account 6 balance should be the same");

        // check there is one active order
        const activeOrdersAfterCancel = await stakePool.getOrders.call();
        assert.equal(activeOrdersAfterCancel.length, 1, "Active orders should be 1");
    });

    // account 6 makes a buy order and account 3 partially accepts it
    it("Account 6 makes a buy order and account 3 partially accepts it", async () => {
        // account 3 makes sell order
        const sharesSell = 20 * Math.pow(10, decimals);
        await stakePool.sell(50, sharesSell, {from: accounts[3]});

        // check account 3 shares
        const shares3 = await stakePool.getShares.call(accounts[3]);
        assert.equal(shares3.toNumber(), 0, "Account 3 should have 20% shares");

        // check balance before buy
        const balanceBefore = await vestingToken.balanceOf.call(accounts[6]);
        
        // shares to buy
        const shares = 10 * Math.pow(10, decimals);
        const pricePerShare = 10;

        // contract takes 10% tax +  pricePerShare * shares
        const totalPayment = shares * pricePerShare + (shares * pricePerShare * 0.1);

        // allowance for account 6
        await vestingToken.approve(stakePool.address, totalPayment, {from: accounts[6]});

        await stakePool.buy(10, shares, {from: accounts[6]});

        // check there are two active orders
        const activeOrdersAfter = await stakePool.getOrders.call();
        assert.equal(activeOrdersAfter.length, 3, "Active orders should be 3");

        // check balance after buy
        const balanceAfter = await vestingToken.balanceOf.call(accounts[6]);
        assert.equal(balanceAfter.toNumber(), balanceBefore.toNumber() - totalPayment, "Balance should be 1000 less");

        // account 3 accepts order
        const sharesBuy = 5 * Math.pow(10, decimals);
        
        // account 3 has an active sell order for 20% shares
        // account 3 tries to accepts 5% of shares
        // accept order
        try {
            await stakePool.accept(accounts[6], sharesBuy, {from: accounts[3], value: 10000000});
        } catch (error) {
            assert.equal(error.reason, "Insufficient shares", "Expected error not received")
        }

        // account 3 cancels order
        await stakePool.cancel({from: accounts[3]});

        // check account 0 balance before buy
        const balance0Before = await vestingToken.balanceOf.call(accounts[0]);
        // check account 3 balance before buy
        const balance3Before = await vestingToken.balanceOf.call(accounts[3]);

        // account 3 accepts order
        await stakePool.accept(accounts[6], sharesBuy, {from: accounts[3], value: 10000000});

        // owner should get 10% tax
        const balance0After = await vestingToken.balanceOf.call(accounts[0]);
        assert.equal(balance0After.toNumber(), balance0Before.toNumber() + (sharesBuy * pricePerShare * 0.1), "Balance should be 1000 less");

        // check account 3 shares
        const shares3After = await stakePool.getShares.call(accounts[3]);
        assert.equal(shares3After.toNumber(), sharesSell - sharesBuy, "Account 3 should have 15% shares");

        // check account 3 balance after buy
        const balance3After = await vestingToken.balanceOf.call(accounts[3]);
        assert.equal(balance3After.toNumber(), balance3Before.toNumber() + (sharesBuy * pricePerShare), "Balance should be 1000 less");

        // check account 6 shares
        const shares6 = await stakePool.getShares.call(accounts[6]);
        assert.equal(shares6.toNumber(), sharesBuy, "Account 6 should have 5% shares");

        // check there is one active order
        const activeOrdersAfterCancel = await stakePool.getOrders.call();
        assert.equal(activeOrdersAfterCancel.length, 2, "Active orders should be 1");

        // account 6 cancels order
        await stakePool.cancel({from: accounts[6]});

        // check account 6 shares
        const shares6After = await stakePool.getShares.call(accounts[6]);
        assert.equal(shares6After.toNumber(), sharesBuy, "Account 6 should have 0% shares");

        // check account 6 balance
        const balance6 = await vestingToken.balanceOf.call(accounts[6]);
        assert.equal(balance6.toNumber(), balanceBefore.toNumber() - totalPayment/2, "Account 6 balance should be the same");
    });

});
