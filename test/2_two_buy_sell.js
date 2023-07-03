const AccountHelper = require("./helpers/Helper");

const ERC20 = artifacts.require("ERC20PresetFixedSupply");
const DvStakePoolFactory = artifacts.require("DvStakePoolFactory");
const DvStakePool = artifacts.require("DvStakePool");

var exampleModelAddress = null;

contract('Buy and Sell', (accounts) => {

    let erc20Token;
    let modelTowFactory;
    let modelTwoInstance;

    let secondToken;
    let thirdToken;

    before(async () => {
        erc20Token = await ERC20.deployed();
        modelTowFactory = await DvStakePoolFactory.deployed();
        await AccountHelper.setupAccountFunds(accounts, erc20Token, 40000000000);
        modelTwoInstance = await AccountHelper.createTangible(modelTowFactory, erc20Token.address,
            "Example", "EXP", 5000, 10, 0,  accounts[0]);
        exampleModelAddress = modelTwoInstance.address;
    });

    it('Issue 2 Asset tokens', async () => {
        secondToken = await AccountHelper.createERCToken("ERC20 Token #1", "TK1",
            1000000000, "0xECF5A576A949aEE5915Afb60E0e62D09825Cd61B", accounts[0]);
        thirdToken = await AccountHelper.createERCToken("ERC20 Token #2", "TK2",
            1000000000, "0xECF5A576A949aEE5915Afb60E0e62D09825Cd61B", accounts[0]);

        // Get balances of first and second account after the transactions.
        const accountBalance1 = (await secondToken.balanceOf.call(accounts[0])).toNumber();
        const accountBalance2 = (await thirdToken.balanceOf.call(accounts[0])).toNumber();

        assert.equal(accountBalance1, 1000000000, "Token balance invalid");
        assert.equal(accountBalance2, 1000000000, "Token balance invalid");

        await secondToken.approve(modelTwoInstance.address, 10000, { from: accounts[0] });
        await thirdToken.approve(modelTwoInstance.address, 10000, { from: accounts[0] });

        await modelTwoInstance.addAsset(secondToken.address, 10000, { from: accounts[0] });
        await modelTwoInstance.addAsset(thirdToken.address, 10000, { from: accounts[0] });

        const asset = await modelTwoInstance.assets.call(1);
        assert.equal(asset.amount.toNumber(), 10000, "Invalid amount of Tokens");

        // initalize
        await modelTwoInstance.initialize(5000, 10, 0,{ from: accounts[0] });
    });


    it('Single Purchase', async () => {
        const rSharesB = (await modelTwoInstance.reservesShares.call()).toNumber();
        const rTokensB = (await modelTwoInstance.reservesTokens.call()).toNumber();

        // approve and purchase
        let _amountOut = (rSharesB * 500) / (rTokensB + 500);
        await erc20Token.approve(modelTwoInstance.address, 600, { from: accounts[2] });
        await modelTwoInstance.buy(500, 9, { from: accounts[2], value: 10000000 });

        const rShares = (await modelTwoInstance.reservesShares.call()).toNumber();
        const rTokens = (await modelTwoInstance.reservesTokens.call()).toNumber();
        const balance = (await modelTwoInstance.balanceOf.call(accounts[2])).toNumber();

        assert.equal(rShares, 91, "Invalid shares reserves after purchase");
        assert.equal(rTokens, 5500, "Invalid token reserves after purchase");
        assert.equal(balance, 9, "Buyer received invalid amount of shares");
    });

    it('Single Sale', async () => {
        const rSharesB = (await modelTwoInstance.reservesShares.call()).toNumber();
        const rTokensB = (await modelTwoInstance.reservesTokens.call()).toNumber();
        const balanceTokenBefore = (await erc20Token.balanceOf.call(accounts[2])).toNumber();

        // approve and purchase
        let _amountOut = (rTokensB * 9) / (rSharesB + 9);
        await modelTwoInstance.sell(9, 495, { from: accounts[2], value: 10000000 });

        const rShares = (await modelTwoInstance.reservesShares.call()).toNumber();
        const rTokens = (await modelTwoInstance.reservesTokens.call()).toNumber();
        const balance = (await modelTwoInstance.balanceOf.call(accounts[2])).toNumber();
        const balanceTokenAfter = (await erc20Token.balanceOf.call(accounts[2])).toNumber();

        assert.equal(rShares, 100, "Invalid shares reserves after purchase");
        assert.equal(rTokens, 5005, "Invalid token reserves after purchase");
        assert.equal(balance, 0, "Buyer received invalid amount of shares");
        assert.equal(balanceTokenAfter, balanceTokenBefore + 495, "Balance of tokens returned to buyer");
    });

    it('Multiple Purchase', async () => {
        const rSharesB = (await modelTwoInstance.reservesShares.call()).toNumber();
        const rTokensB = (await modelTwoInstance.reservesTokens.call()).toNumber();

        // approve and purchase
        await erc20Token.approve(modelTwoInstance.address, 2000, { from: accounts[2] });
        await erc20Token.approve(modelTwoInstance.address, 2000, { from: accounts[3] });
        let _amountOut = (rSharesB * 300) / (rTokensB + 300);
        await modelTwoInstance.buy(300, 5, { from: accounts[2], value: 10000000 });
        await modelTwoInstance.buy(300, 4, { from: accounts[3], value: 10000000 });

        const balance2 = (await modelTwoInstance.balanceOf.call(accounts[2])).toNumber();
        const balance3 = (await modelTwoInstance.balanceOf.call(accounts[3])).toNumber();
        assert.equal(balance2, balance3, "Invalid shares after Purchase");
    });

    it("Owner cannot sell or buy", async () => {
        try {
            await modelTwoInstance.sell(1, 495, { from: accounts[0], value: 10000000 });
            assert.fail("Owner can sell");
        } catch (e) {
            assert.ok(/revert/.test(e.message));
        }

        try {
            await modelTwoInstance.buy(2, 4, { from: accounts[0], value: 10000000 });
            assert.fail("Owner can buy");
        } catch (e) {
            assert.ok(/revert/.test(e.message));
        }
    });

    it('Terminate', async () => {
        const rSharesB = (await modelTwoInstance.reservesShares.call()).toNumber();
        const rTokensB = (await modelTwoInstance.reservesTokens.call()).toNumber();

        // remove all balances of owner
        const balanceManager = (await erc20Token.balanceOf.call(accounts[0])).toNumber();
        await erc20Token.transfer(accounts[4], balanceManager, { from: accounts[0] });

        const balanceManagerTK1 = (await secondToken.balanceOf.call(accounts[0])).toNumber();
        await secondToken.transfer(accounts[4], balanceManagerTK1, { from: accounts[0] });

        const balanceManagerTK2 = (await thirdToken.balanceOf.call(accounts[0])).toNumber();
        await thirdToken.transfer(accounts[4], balanceManagerTK2, { from: accounts[0] });

        // terminate
        await modelTwoInstance.terminate({ from: accounts[0] });
        console.log("");
    });

    it("Withdraw for all shareholders", async () => {
        // owner
        await modelTwoInstance.withdraw({ from: accounts[0], value: 10000000 });
        const balanceManager = (await erc20Token.balanceOf.call(accounts[0])).toNumber();
        const balanceManagerTK1 = (await secondToken.balanceOf.call(accounts[0])).toNumber();
        const balanceManagerTK2 = (await thirdToken.balanceOf.call(accounts[0])).toNumber();

        // shareholder 2
        await modelTwoInstance.withdraw({ from: accounts[2], value: 10000000 });
        const balanceHolder2 = (await erc20Token.balanceOf.call(accounts[2])).toNumber();
        const balanceHolder2TK1 = (await secondToken.balanceOf.call(accounts[2])).toNumber();
        const balanceHolder2TK2 = (await thirdToken.balanceOf.call(accounts[2])).toNumber();

        // shareholder 3
        await modelTwoInstance.withdraw({ from: accounts[3], value: 10000000 });
        const balanceHolder3 = (await erc20Token.balanceOf.call(accounts[3])).toNumber();
        const balanceHolder3TK1 = (await secondToken.balanceOf.call(accounts[3])).toNumber();
        const balanceHolder3TK2 = (await thirdToken.balanceOf.call(accounts[3])).toNumber();

        const tokens = balanceManager;
        const tk1 = balanceManagerTK1 + balanceHolder2TK1 + balanceHolder3TK1;
        const tk2 = balanceManagerTK2 + balanceHolder2TK2 + balanceHolder3TK2;

        assert.equal(tk1, 1000, "Invalid shares after Disburse");
        assert.equal(tk2, 1000, "Invalid shares after Disburse");
    })

    it('Check if fees been collected in DeVest DAO', async () => {
        const modelOneFactory = await DvStakePoolFactory.deployed();
        //const balance = await web3.eth.getBalance(await modelOneFactory.root.call());
        //assert.equal(balance, 0, "No Fees been paid to DAO");
    });


});
