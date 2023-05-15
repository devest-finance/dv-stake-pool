const DvStakePool = artifacts.require("DvStakePool");
const DvStakePoolFactory = artifacts.require("DvStakePoolFactory");

const ERC20 = artifacts.require("ERC20PresetFixedSupply");

var devestDAOAddress = null;
var exampleModelAddress = null;

contract('Testing Deployments', (accounts) => {

    it('Verify root (DeVest) DAO was deployed', async () => {
        const dvStakePoolFactory = await DvStakePoolFactory.deployed();
        const devestDAOAddress = await dvStakePoolFactory.getRoyalty.call();

        const devestDAO = await DvStakePool.at(devestDAOAddress[1]);
        const symbol = await devestDAO.symbol.call();

        assert.equal(symbol, "% DeVest DAO", "Failed to issue DeVest DAO Contract");
    });

    it('Deploy DvStakePool as DAO (Token)', async () => {
        const modelOneFactory = await DvStakePoolFactory.deployed();
        const erc20Token = await ERC20.deployed();

        const exampleOneContract = await modelOneFactory.issue(erc20Token.address, "Example", "EXP", { value: 100000000 });
        exampleModelAddress = exampleOneContract.logs[0].args[1];

        const devestDAO = await DvStakePool.at(exampleModelAddress);
        const symbol = await devestDAO.symbol.call();

        assert.equal(symbol, "% EXP", "Failed to issue Example Contract");
    });

    it('Check DvStakeToken', async () => {
        const devestOne = await DvStakePool.at(exampleModelAddress);

        // check if variables set
        const name = await devestOne.name.call();
        assert(name, "Example", "Invalid name on TST");

        await devestOne.initialize(3000000000, 10, 2, { from: accounts[0] });

        const value = (await devestOne.reservesShares.call()).toNumber();
        assert.equal(value, 10000, "Invalid price on initialized tangible");
    });

    it('Check DvStakeToken Detach', async () => {
        const stakePoolFactory = await DvStakePoolFactory.deployed();
        const erc20Token = await ERC20.deployed();

        // devest shares
        const devestDAOAddress = await stakePoolFactory.getRoyalty.call();
        const DeVestDAO = await DvStakePool.at(devestDAOAddress[1]);

        // issue new product
        const exampleOneContract = await stakePoolFactory.issue(erc20Token.address, "Example", "EXP", { from: accounts[0], value: 100000000 });
        exampleModelAddress = exampleOneContract.logs[0].args[1];
        const subjectContract = await DvStakePool.at(exampleModelAddress);
        await subjectContract.initialize(1000000000, 10, 0, { from: accounts[0] });

        const balanceBefore = await web3.eth.getBalance(DeVestDAO.address);
        assert.equal(balanceBefore, 20000000, "Invalid balance on DeVest before DAO");

        /*
        // check if royalty are paid
        await subjectContract.transfer(accounts[1], 50, { from: accounts[0], value: 100000000 });
        const balance = await web3.eth.getBalance(DeVestDAO.address);
        assert.equal(balance, 30000000, "Transfer royalties failed");

        // detach from factory
        await stakePoolFactory.detach(subjectContract.address);

        // check if royalty are paid
        await subjectContract.transfer(accounts[1], 50, { from: accounts[0], value: 100000000 });
        const balanceDetached = await web3.eth.getBalance(DeVestDAO.address);
        assert.equal(balanceDetached, 30000000, "Transfer royalties failed");
        */
    });

});
