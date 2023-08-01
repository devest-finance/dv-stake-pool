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

    it("Add assets and terminate", async () => {
        const amount1 = 100 * 10 ** decimals;
        const amount2 = 50 * 10 ** decimals;
        const amount3 = 1000 * 10 ** decimals;

        // check balance of tokens before
        const balance1 = (await token1.balanceOf(accounts[0])).toNumber();
        const balance2 = (await token2.balanceOf(accounts[0])).toNumber();
        const balance3 = (await token3.balanceOf(accounts[0])).toNumber();

        // allowance for acocunt 0
        await token1.approve(stakePool.address, amount1, { from: accounts[0] });
        await token2.approve(stakePool.address, amount2, { from: accounts[0] });
        await token3.approve(stakePool.address, amount3, { from: accounts[0] });

        await stakePool.addAsset(token1.address, amount1, { from: accounts[0] });
        await stakePool.addAsset(token2.address, amount2, { from: accounts[0] });
        await stakePool.addAsset(token3.address, amount3, { from: accounts[0] });

        await stakePool.terminate({from: accounts[0]});

        // check balance of tokens after
        const balance1After = (await token1.balanceOf(accounts[0])).toNumber();
        const balance2After = (await token2.balanceOf(accounts[0])).toNumber();
        const balance3After = (await token3.balanceOf(accounts[0])).toNumber();
        
        assert.equal(balance1After, balance1, "Balance of token 1 is not correct");
        assert.equal(balance2After, balance2, "Balance of token 2 is not correct");
        assert.equal(balance3After, balance3, "Balance of token 3 is not correct");
    });

});
