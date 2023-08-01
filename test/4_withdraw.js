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

    });

    // can not withdraw if not in terminated state
    it("should not allow to withdraw if not in terminated state", async () => {
        try {
            await stakePool.withdraw({ from: accounts[0] });
        } catch (error) {
            assert.equal(error.reason, "Not available in current state", "Withdraw is available in trading state");
        }
    });


    it("should not allow to terminate if not owner", async () => {
        try {
            await stakePool.terminate({ from: accounts[2] });
        } catch (error) {
            assert.equal(error.reason, "Owner: caller is not the owner", "Terminate is available for non-owner");
        }
    });

    // add assets to pool
    it("Adding assets to pool", async () => {
        const amount1 = 100 * 10 ** decimals;
        const amount2 = 50 * 10 ** decimals;
        const amount3 = 1000 * 10 ** decimals;

        // allowance for acocunt 0
        await token1.approve(stakePool.address, amount1, { from: accounts[0] });
        await token2.approve(stakePool.address, amount2, { from: accounts[0] });
        await token3.approve(stakePool.address, amount3, { from: accounts[0] });

        await stakePool.addAsset(token1.address, amount1, { from: accounts[0] });
        await stakePool.addAsset(token2.address, amount2, { from: accounts[0] });
        await stakePool.addAsset(token3.address, amount3, { from: accounts[0] });

        // initialaze stake pool - 0% tax
        // initilize with account that is owner
        await stakePool.initialize(0, decimals, { from: accounts[0] });
    });

    // make sell order
    it("Selling shares", async () => {
        const price = 10;
        const amount = 100 * 10 ** decimals;
        await stakePool.sell(price, amount, { from: accounts[0] });
        
        // check shares
        const shares = await stakePool.balanceOf(accounts[0]);
        assert.equal(shares, 0, "Shares are not equal");

    });

    // account 2,3,4,5 accepts sell order
    it("Accepting sell order", async () => {
        const price = 10;
        const amount2 = 10 * 10 ** decimals;
        const amount3 = 20 * 10 ** decimals;
        const amount4 = 30 * 10 ** decimals;
        const amount5 = 10 * 10 ** decimals;

        // allowance for accounts 2,3,4,5
        await vestingToken.approve(stakePool.address, amount2 * price, { from: accounts[2] });
        await vestingToken.approve(stakePool.address, amount3 * price, { from: accounts[3] });
        await vestingToken.approve(stakePool.address, amount4 * price, { from: accounts[4] });
        await vestingToken.approve(stakePool.address, amount5 * price, { from: accounts[5] });

        await stakePool.accept(accounts[0], amount2, { from: accounts[2], value: 10000000 });
        await stakePool.accept(accounts[0], amount3, { from: accounts[3], value: 10000000 });
        await stakePool.accept(accounts[0], amount4, { from: accounts[4], value: 10000000 });
        await stakePool.accept(accounts[0], amount5, { from: accounts[5], value: 10000000 });

        // check shares
        const shares = await stakePool.balanceOf(accounts[0]);
        assert.equal(shares, 0, "Shares are not equal");

        // check shares of accounts 2,3,4,5
        const shares2 = await stakePool.balanceOf(accounts[2]);
        const shares3 = await stakePool.balanceOf(accounts[3]);
        const shares4 = await stakePool.balanceOf(accounts[4]);
        const shares5 = await stakePool.balanceOf(accounts[5]);

        assert.equal(shares2, amount2, "Shares are not equal");
        assert.equal(shares3, amount3, "Shares are not equal");
        assert.equal(shares4, amount4, "Shares are not equal");
        assert.equal(shares5, amount5, "Shares are not equal");
    });

    // account 3 makes a buy order
    it("Buying shares", async () => {
        const price = 10;
        const amount = 10 * 10 ** decimals;

        // check contract balance before buy
        const balanceBefore = (await vestingToken.balanceOf(stakePool.address)).toNumber();

        // allowance for account 3
        await vestingToken.approve(stakePool.address, amount * price, { from: accounts[3] });
        await stakePool.buy(price, amount, { from: accounts[3] });
        
        // check shares
        const shares = (await stakePool.balanceOf(accounts[3])).toNumber();
        assert.equal(shares, 20 * Math.pow(10, decimals), "Shares are not equal");

        // check contract balance after buy
        const balance = await vestingToken.balanceOf(stakePool.address);
        assert.equal(balance, balanceBefore + price * amount, "Shares are not equal");
    });

    // account 7 partially accepts buy order of account 3
    it("Partially accepting buy order", async () => {
        const price = 10;
        const amount = 5 * 10 ** decimals;

        // accept buy order
        await stakePool.accept(accounts[3], amount, { from: accounts[4], value: 10000000 });
        
        // check shares
        const shares = (await stakePool.balanceOf(accounts[3])).toNumber();
        assert.equal(shares, 25 * Math.pow(10, decimals), "Shares are not equal");
    });


    // check orders
    it("Checking orders", async () => {
        const orders = await stakePool.getOrders();
        assert.equal(orders.length, 2, "Orders are not equal");
        
        // get info about orders
        const order1 = await stakePool.orders(orders[0]);
        const order2 = await stakePool.orders(orders[1]);

        assert.equal(order1[0], 0, "Index is not right");
        assert.equal(order1[1], 10, "Price is not right");
        assert.equal(order1[2], 30 * Math.pow(10, decimals), "Order filled amount is not equal");
        assert.equal(order1[3], 0, "Escrow is not right");
        assert.equal(order1[4], false, "Order type is not equal");

        assert.equal(order2[0], 1, "Index is not right");
        assert.equal(order2[1], 10, "Price is not right");
        assert.equal(order2[2], 5 * Math.pow(10, decimals), "Order filled amount is not equal");
        assert.equal(order2[3], order2[1] * order2[2], "Escrow is not right");
        assert.equal(order2[4], true, "Order type is not equal");

    });

    // terminate pool
    it("Terminating pool", async () => {
        await stakePool.terminate({ from: accounts[0] });
    });

    // withdraw everything
    it("Withdrawing everything", async () => {

        // cancel order
        await stakePool.cancel({ from: accounts[0] });

        const _accounts = [accounts[0], accounts[2], accounts[3], accounts[4], accounts[5]]

        for(let account of _accounts) {

            const balanceBefore = (await vestingToken.balanceOf(account)).toNumber();

            // check shares
            const shares = (await stakePool.balanceOf(account)).toNumber();
        
            // check owner tokens
            const balance1 = (await token1.balanceOf(account)).toNumber();
            const balance2 = (await token2.balanceOf(account)).toNumber();
            const balance3 = (await token3.balanceOf(account)).toNumber();

            // check how many tokens are in the pool
            const poolBalance1 = (await stakePool.assets.call(0)).amount;
            const poolBalance2 = (await stakePool.assets.call(1)).amount;
            const poolBalance3 = (await stakePool.assets.call(2)).amount;
                    
            // check balance of tokens in the pool
            const poolBalance1Before = (await token1.balanceOf(stakePool.address)).toNumber();
            const poolBalance2Before = (await token2.balanceOf(stakePool.address)).toNumber();
            const poolBalance3Before = (await token3.balanceOf(stakePool.address)).toNumber();


            // withdraw
            await stakePool.withdraw({ from: account });
            const balance = (await vestingToken.balanceOf(account)).toNumber();
            assert.equal(balance, balanceBefore, "Balance is not equal");


            // check how many tokens are in the pool after withdraw - should be reduced by amount of shares
            const poolBalance1After = await token1.balanceOf(stakePool.address);
            const poolBalance2After = await token2.balanceOf(stakePool.address);
            const poolBalance3After = await token3.balanceOf(stakePool.address);

            // get total shares
            const totalShares = (await stakePool.totalSupply()).toNumber();

            // check that pool has less tokens
            assert.equal(poolBalance1After, poolBalance1Before - poolBalance1 * shares / totalShares, "Balance is not equal");
            assert.equal(poolBalance2After, poolBalance2Before - poolBalance2 * shares / totalShares, "Balance is not equal");
            assert.equal(poolBalance3After, poolBalance3Before - poolBalance3 * shares / totalShares, "Balance is not equal");

            // check that owner got all tokens
            const balance1After = (await token1.balanceOf(account)).toNumber();
            const balance2After = (await token2.balanceOf(account)).toNumber();
            const balance3After = (await token3.balanceOf(account)).toNumber();

            assert.equal(balance1After, balance1 + poolBalance1 * shares / totalShares, "Balance is not equal");
            assert.equal(balance2After, balance2 + poolBalance2 * shares / totalShares, "Balance is not equal");
            assert.equal(balance3After, balance3 + poolBalance3 * shares / totalShares, "Balance is not equal");

            // account 0 should not have any shares
            const sharesAfter = (await stakePool.balanceOf(account)).toNumber();
            assert.equal(sharesAfter, 0, "Shares are not equal");
        }
    });


    // check that there are no assets in the pool
    it("Checking assets", async () => {
        const assets = await stakePool.getAssetBalance();
        for(let asset of assets) {
            assert.equal(asset.balance, 0, "Amount is not equal");
        }
    });

    // check that there is one order and escrow left in the pool
    it("Checking orders", async () => {
        const orders = await stakePool.getOrders();
        assert.equal(orders.length, 1, "Orders are not equal");
    
        // get contract balance
        const balance = (await vestingToken.balanceOf(stakePool.address)).toNumber();
        const price = 10;
        assert.equal(balance, 5 * price * Math.pow(10, decimals), "Balance is not equal");
    });

    // account 3 canacels buy order
    it("Canceling buy order", async () => {
        await stakePool.cancel({ from: accounts[3] });
        // check that there are no orders left
        const orders = await stakePool.getOrders();
        assert.equal(orders.length, 0, "Orders are not equal");

        // check that contract balance is 0
        const balance = (await vestingToken.balanceOf(stakePool.address)).toNumber();
        assert.equal(balance, 0, "Balance is not equal");
    });


});
