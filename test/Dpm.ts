import { expect } from "chai";
import { ethers } from "hardhat";
import { Dpm } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// Chainlink ETH/USD price feed (Mainnet)
const ETH_USD_PRICE_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
// Invalid Mainnet Chainlink price feed address (Goerli ETH/USD address)
const INVALID_PRICE_FEED = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e";

// Seconds in a day
const SECONDS_IN_A_DAY = 86400;

describe("Dpm platform", () => {
    let dpmContract: Dpm;
    let deployer: SignerWithAddress;
    let bob: SignerWithAddress;
    let alice: SignerWithAddress;

    beforeEach(async () => {
        [deployer, bob, alice] = await ethers.getSigners();
        const dpmContractFactory = await ethers.getContractFactory("Dpm");
        dpmContract = await dpmContractFactory.connect(deployer).deploy();
        await dpmContract.deployed();
    });

    it("Owner correctly initialized", async () => {
        const ownerAddress = await dpmContract.owner();
        expect(ownerAddress).to.eq(deployer.address);
    });

    it("User should be able to create speculation pool", async () => {
        // Testing with an invalid Chainlink Price Feed address
        await expect(dpmContract.connect(bob).createSpeculationPool("Wrong Pool", SECONDS_IN_A_DAY, INVALID_PRICE_FEED)).to.be.reverted;

        // Testing with correct Chainlink Price Feed address for Mainnet
        const newPoolCreationTx = await dpmContract.connect(bob).createSpeculationPool("ETH/USD Pool", SECONDS_IN_A_DAY, ETH_USD_PRICE_FEED);

        const newPoolAddress = await dpmContract.speculationPools(0);

        await expect(newPoolCreationTx)
        .to.emit(dpmContract, "SpeculationPoolCreated")
        .withArgs(newPoolAddress, bob.address);
    });
});