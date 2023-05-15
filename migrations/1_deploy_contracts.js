const DvStakePool = artifacts.require("DvStakePool");
const DvStakePoolFactory = artifacts.require("DvStakePoolFactory");
const ERC20PresetFixedSupply = artifacts.require("ERC20PresetFixedSupply");

module.exports = function(deployer) {
    if (deployer.network === 'development') {
        deployer.deploy(DvStakePoolFactory)
            .then(() => deployer.deploy(ERC20PresetFixedSupply, "ERC20 Token", "TKO", 1000000000000, "0xECF5A576A949aEE5915Afb60E0e62D09825Cd61B"))
            .then(() => ERC20PresetFixedSupply.deployed())
            .then(async _instance => {})
            .then(() => DvStakePoolFactory.deployed())
            .then(async _instance => {
                const devestDAOImp = await _instance.issue("0x0000000000000000000000000000000000000000", "DeVest DAO", "DeVest DAO");
                //await _instance.setRoot(devestDAOImp.logs[0].args[1], { from: "0xECF5A576A949aEE5915Afb60E0e62D09825Cd61B" });
                //await _instance.setRoyalty(100000000);
                const devestDAO = await DvStakePool.at(devestDAOImp.logs[0].args[1]);
                await devestDAO.initialize(10000000, 10, 2, { from: "0xECF5A576A949aEE5915Afb60E0e62D09825Cd61B" });

                await _instance.setRoyalty(10000000, 10000000);
                await _instance.setRecipient(devestDAOImp.logs[0].args[1]);
            })
    } else {
        deployer.deploy(DvStakePoolFactory)
            .then(() => DvStakePoolFactory.deployed())
            .then(async _instance => {

            });
    }
};
