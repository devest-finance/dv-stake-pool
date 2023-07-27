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


    before(async () => {
        vestingToken = await ERC20.deployed();
        factory = await DvStakePoolFactory.deployed();
        await AccountHelper.setupAccountFunds(accounts, vestingToken, 40000000000);
        stakePool = await AccountHelper.createTangible(factory, vestingToken.address, "Example Pool", "EXP", 5000, 10, 0,  accounts[0]);
        
        // initialaze stake pool - 10% tax
        await stakePool.intialize(100, 0, {from: accounts[0]});

        // new erc20 token
        token1 = await AccountHelper.createERCToken("ERC20 Token #1", "TK1", 1000000000000, accounts[0], accounts[0]);
        token2 = await AccountHelper.createERCToken("ERC20 Token #2", "TK2", 1000000000000, accounts[0], accounts[0]);
        token3 = await AccountHelper.createERCToken("ERC20 Token #3", "TK3", 1000000000000, accounts[0], accounts[0]);

        // setup account founds for all tokens
        await AccountHelper.setupAccountFunds(accounts, token1, 40000000000);
        await AccountHelper.setupAccountFunds(accounts, token2, 40000000000);
        await AccountHelper.setupAccountFunds(accounts, token3, 40000000000);

    });

    // 

});
