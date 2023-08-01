const AccountHelper = require("./helpers/Helper");

const ERC20 = artifacts.require("ERC20PresetFixedSupply");
const DvStakePoolFactory = artifacts.require("DvStakePoolFactory");
const DvStakePool = artifacts.require("DvStakePool");

contract('Functions accessability', (accounts) => {

    let vestingToken;
    let factory;
    let stakePool
    let token1;
    let token2;
    let token3;


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

    // check if functions are accessible while in created state (initialization should be the only one available)
    it('Check functions accessibility before initialization', async () => {
        // check that initilizePrisale is not callable
        try {
            const price = 10;
            const start = new Date();
            start.setHours(start.getHours() - 10);
            const end = new Date(start);
            end.setHours(start.getHours() + 20);
            await stakePool.initializePresale(100, 0, price, parseInt(start.getTime() / 1000), parseInt(end.getTime() / 1000),  { from: accounts[0] });
            assert(false, "Initialize presale should not be callable");
        }
        catch (e) {
            assert.equal(e.message, 'VM Exception while processing transaction: revert This function is not available for this contract', "Invalid error message");
        }

        // check that purchase is not callable
        try {
            // allowence for account 0
            await vestingToken.approve(stakePool.address, Math.floor(100 * 10 * 1.1), { from: accounts[0] });
            await stakePool.purchase(100, { from: accounts[0], value: 10000000 });
            assert(false, "Purchase should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }
        
        // try calling buy
        try {
            await stakePool.buy(100, 100, { from: accounts[2] });
            assert(false, "Buy should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // try calling sell
        try {
            await stakePool.sell(100, 100, { from: accounts[0] });
            assert(false, "Sell should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // try calling addAsset with account that is not owner
        try {
            // allowance for token1 to stakePool contract for account[2]
            await token1.approve(stakePool.address, 100, { from: accounts[2] });
            await stakePool.addAsset(token1.address, 100, { from: accounts[2] });
            assert(false, "Add asset should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Owner: caller is not the owner", "Invalid error message");
        }

        // allowence for account 0
        await token1.approve(stakePool.address, Math.floor(100 * 1.1), { from: accounts[0] });
        // add asset with owner
        await stakePool.addAsset(token1.address, 100, { from: accounts[0] });

        // get balances of assets in pool
        const balances = await stakePool.getAssetBalance.call();
        assert.equal(balances.length, 1, "Invalid number of assets");
        assert.equal(balances[0].balance, 100, "Invalid amount of asset");


        // allowence for account 0
        await token1.approve(stakePool.address, Math.floor(100 * 1.1), { from: accounts[0] });
        await stakePool.addAsset(token1.address, 100, { from: accounts[0] });
    
        // check balance after adding same asset
        const balancesAfter = await stakePool.getAssetBalance.call();
        assert.equal(balancesAfter.length, 1, "Invalid number of assets");
        assert.equal(balancesAfter[0].balance, 200, "Invalid amount of asset");


        // add same asset as vesting asset
        try {
            await stakePool.addAsset(vestingToken.address, 100, { from: accounts[0] });
            assert(false, "Add asset should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Vesting token cannot be added as Asset", "Invalid error message");
        }

        // try calling initilize with account that is not owner
        try {
            await stakePool.initialize(100, 0, { from: accounts[2] });
            assert(false, "Initialize should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Owner: caller is not the owner", "Invalid error message");
        }

        // allowence for account 0
        await token2.approve(stakePool.address, Math.floor(100 * 1.1), { from: accounts[0] });
        // add different asset
        await stakePool.addAsset(token2.address, 100, { from: accounts[0] });

        // check balance after adding different asset
        const balancesAfter2 = await stakePool.getAssetBalance.call();
        assert.equal(balancesAfter2.length, 2, "Invalid number of assets");
        assert.equal(balancesAfter2[0].balance, 200, "Invalid amount of asset");
        assert.equal(balancesAfter2[1].balance, 100, "Invalid amount of asset");

        // try calling withdraw
        try {
            await stakePool.withdraw({ from: accounts[0] });
            assert(false, "Withdraw should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

    });

    // check if functions are accessible while in initialized state
    it('Check functions accessibility after initialization', async () => {

        // initilize with account that is owner
        await stakePool.initialize(100, 0, { from: accounts[0] });

        // try calling initilize again
        try {
            await stakePool.initialize(100, 0, { from: accounts[0] });
            assert(false, "Initialize should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // try calling addAsset after initialization
        try {
            await stakePool.addAsset(vestingToken.address, 100, { from: accounts[0] });
            assert(false, "Add asset should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // allowence for account 2
        await vestingToken.approve(stakePool.address, Math.floor(100 * 100 * 1.1), { from: accounts[2] });
        // buy should be callable after initialization
        await stakePool.buy(100, 100, { from: accounts[2] });

        // sell should be callable after initialization
        await stakePool.sell(100, 100, { from: accounts[0] });
    
        // cancel should be callable after initialization
        await stakePool.cancel({ from: accounts[0] });

        // transfet should be callable after initialization
        await stakePool.transfer(accounts[7], 10, { from: accounts[0], value: 10000000 });

        // sell should be callable after initialization
        await stakePool.sell(100, 90, { from: accounts[0] });

        // allowence for account 2
        await vestingToken.approve(stakePool.address, Math.floor(100 * 100 * 1.1), { from: accounts[2] });
        // accept should be callable after initialization
        await stakePool.accept(accounts[0], 50, { from: accounts[2], value: 10000000 });

        // check account 2 balance
        const balance = (await stakePool.balanceOf.call(accounts[2])).toNumber();
        assert.equal(balance, 50, "Invalid amount of shares");

        // transfer should be callable after initialization
        await stakePool.transfer(accounts[3], balance, { from: accounts[2], value: 10000000 });

        // try calling withdraw
        try {
            await stakePool.withdraw({ from: accounts[2] });
            assert(false, "Withdraw should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }


    });

    // check if functions are accessible after termination
    it('Check functions accessibility after termination', async () => {

        // try calling terminate with account that is not owner
        try {
            await stakePool.terminate({ from: accounts[2] });
            assert(false, "Terminate should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Owner: caller is not the owner", "Invalid error message");
        }

        // terminate with account that is owner
        await stakePool.terminate({ from: accounts[0] });

        // try calling terminate again
        try {
            await stakePool.terminate({ from: accounts[0] });
            assert(false, "Terminate should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }
        
        // try calling sell after termination
        try {
            await stakePool.sell(100, 100, { from: accounts[0] });
            assert(false, "Sell should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // try calling buy after termination
        try {
            await stakePool.buy(100, 100, { from: accounts[3] });
            assert(false, "Buy should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // cancel should be callable after termination
        await stakePool.cancel({ from: accounts[0] });

        // try calling transfer after termination
        await stakePool.transfer(accounts[7], 10, { from: accounts[0], value: 10000000 });

        // try calling addAsset after termination
        try {
            await stakePool.addAsset(vestingToken.address, 100, { from: accounts[0] });
            assert(false, "Add asset should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "Not available in current state", "Invalid error message");
        }

        // check account 3 balance
        const balanceToken1 = (await token1.balanceOf.call(accounts[3])).toNumber();
        const balanceToken2 = (await token2.balanceOf.call(accounts[3])).toNumber();

        // withdraw should be callable after termination
        await stakePool.withdraw({ from: accounts[3] });

        // try calling withdraw again
        try {
            await stakePool.withdraw({ from: accounts[3] });
            assert(false, "Withdraw should not be callable");
        }
        catch (e) {
            assert.equal(e.reason, "No shares available", "Invalid error message");
        }

        // check if assets are withdrawn
        const balancesAfter = await stakePool.getAssetBalance.call();
        assert.equal(balancesAfter.length, 2, "Invalid number of assets");
        assert.equal(balancesAfter[0].balance, 100, "Invalid amount of asset");
        assert.equal(balancesAfter[1].balance, 50, "Invalid amount of asset");

        // check that account 3 has recived token1 and token2
        const balanceAfter = (await token1.balanceOf.call(accounts[3])).toNumber();
        assert.equal(balanceAfter, balanceToken1 + 100, "Invalid amount of asset");

        const balanceAfter2 = (await token2.balanceOf.call(accounts[3])).toNumber();
        assert.equal(balanceAfter2, balanceToken2 + 50, "Invalid amount of asset");

    });

});
