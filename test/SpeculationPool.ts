import { expect } from "chai";
import { ethers } from "hardhat";
import { Dpm, SpeculationPool } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// Chainlink ETH/USD price feed (Mainnet)
const ETH_USD_PRICE_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

// Seconds in a day
const SECONDS_IN_A_DAY = 86400;

describe("Speculation Pool", () => {
    let dpmContract: Dpm;
    let deployer: SignerWithAddress;
    let bob: SignerWithAddress;
    let alice: SignerWithAddress;
    let mark: SignerWithAddress;
    let speculationPoolContract: SpeculationPool;

    beforeEach(async () => {
        [deployer, bob, alice, mark] = await ethers.getSigners();
        const dpmContractFactory = await ethers.getContractFactory("Dpm");
        dpmContract = await dpmContractFactory.connect(deployer).deploy();
        await dpmContract.deployed();

        // Create speculation pool
        await dpmContract.connect(bob).createSpeculationPool("ETH/USD Pool", SECONDS_IN_A_DAY, ETH_USD_PRICE_FEED);
        const speculationPoolAddress = await dpmContract.speculationPools(0);
        const speculationPoolContractFactory = await ethers.getContractFactory("SpeculationPool");
        speculationPoolContract = speculationPoolContractFactory.attach(speculationPoolAddress);
    });

    it("State variables should be correctly initialized", async () => {
        const poolDeployer = await speculationPoolContract.deployer();
        expect(poolDeployer).to.eq(bob.address);

        const poolName = await speculationPoolContract.poolName();
        expect(poolName).to.eq("ETH/USD Pool");

        const speculationEnded = await speculationPoolContract.speculationEnded();
        expect(speculationEnded).to.eq(false);

        const result = await speculationPoolContract.result();
        expect(result).to.eq(ethers.BigNumber.from(0));

        // ETH price is ~$1635 at the block number 16515045
        const startingAssetPrice = await speculationPoolContract.startingAssetPrice();
        expect(startingAssetPrice).to.be.within(ethers.BigNumber.from(1635e8), ethers.BigNumber.from(1636e8));

        const finalAssetPrice = await speculationPoolContract.finalAssetPrice();
        expect(finalAssetPrice).to.eq(ethers.BigNumber.from(0));

        // Speculation start time to be within 01/29/23 @1pm and 1:30pm (Los Angeles, Time) which is the approximate time range of block number 16515045
        const speculationStartTime = await speculationPoolContract.speculationStartTime();
        expect(speculationStartTime).to.be.within(ethers.BigNumber.from(1675026000), ethers.BigNumber.from(1675027800));

        const speculationEndTime = await speculationPoolContract.speculationEndTime();
        expect(speculationEndTime).to.eq(ethers.BigNumber.from(speculationStartTime).add(SECONDS_IN_A_DAY));

        const priceIncreaseSpeculators = await speculationPoolContract.priceIncreaseSpeculators();
        expect(priceIncreaseSpeculators).to.eq(ethers.BigNumber.from(0));

        const priceDecreaseSpeculators = await speculationPoolContract.priceDecreaseSpeculators();
        expect(priceDecreaseSpeculators).to.eq(ethers.BigNumber.from(0));

        const priceIncreaseEth = await speculationPoolContract.priceIncreaseEth();
        expect(priceIncreaseEth).to.eq(ethers.BigNumber.from(0));

        const priceDecreaseEth = await speculationPoolContract.priceDecreaseEth();
        expect(priceDecreaseEth).to.eq(ethers.BigNumber.from(0));
    });

    it("View functions should work correctly", async () => {
        const latestAssetPrice = await speculationPoolContract.getLatestAssetPrice();
        expect(latestAssetPrice).to.be.within(ethers.BigNumber.from(1635e8), ethers.BigNumber.from(1636e8));

        let totalSpeculators = await speculationPoolContract.getTotalSpeculators();
        expect(totalSpeculators).to.eq(ethers.BigNumber.from(0));

        let totalSpeculatedEth = await speculationPoolContract.getTotalSpeculatedEth();
        expect(totalSpeculatedEth).to.eq(ethers.BigNumber.from(0));

        let bobSpeculated = await speculationPoolContract.checkSpeculator(bob.address);
        expect(bobSpeculated).to.eq(false);

        // Make Bob speculate
        await speculationPoolContract.connect(bob).speculate(1, { value: ethers.utils.parseEther("1")});

        bobSpeculated = await speculationPoolContract.checkSpeculator(bob.address);
        expect(bobSpeculated).to.eq(true);

        totalSpeculators = await speculationPoolContract.getTotalSpeculators();
        expect(totalSpeculators).to.eq(ethers.BigNumber.from(1));

        totalSpeculatedEth = await speculationPoolContract.getTotalSpeculatedEth();
        // Speculated amount (1 ETH) with 0.01% fee is 0.999e18
        expect(totalSpeculatedEth).to.eq(ethers.BigNumber.from(999000000000000000n));
    });

    it("User should be able to speculate", async () => {
        // Make Alice speculate an incorrect choice
        await expect(speculationPoolContract.connect(alice).speculate(3)).to.be.revertedWith("Invalid choice");

        // Make Alice speculate with correct choice but not ETH amount
        await expect(speculationPoolContract.connect(alice).speculate(2)).to.be.rejectedWith("ETH amount != 0");

        // Make Alice speculate correctly
        await speculationPoolContract.connect(alice).speculate(2, { value: ethers.utils.parseEther("1")});

        const aliceSpeculated = await speculationPoolContract.checkSpeculator(alice.address);
        expect(aliceSpeculated).to.eq(true);

        // Check if Alice cannot speculate again
        await expect(speculationPoolContract.connect(alice).speculate(1, { value: ethers.utils.parseEther("2")})).to.be.revertedWith("Already speculated");

        // Check if mapping of Alice's address is correctly populated
        const aliceChoice = (await speculationPoolContract.speculator(alice.address)).choice;
        expect(aliceChoice).to.eq(ethers.BigNumber.from(2));

        const aliceAmountSpeculated = (await speculationPoolContract.speculator(alice.address)).amountSpeculated;
        expect(aliceAmountSpeculated).to.eq(ethers.BigNumber.from(999000000000000000n));

        const aliceRewardsClaimed = (await speculationPoolContract.speculator(alice.address)).rewardsClaimed;
        expect(aliceRewardsClaimed).to.eq(false);

        // Check if state variables are updated
        let totalSpeculatedEth = await speculationPoolContract.getTotalSpeculatedEth();
        // Speculated amount (1 ETH) with 0.01% fee is 0.999e18
        expect(totalSpeculatedEth).to.eq(ethers.BigNumber.from(999000000000000000n));

        let totalSpeculators = await speculationPoolContract.getTotalSpeculators();
        expect(totalSpeculators).to.eq(ethers.BigNumber.from(1));

        // Make another user (Mark) speculate
        await speculationPoolContract.connect(mark).speculate(1, { value: ethers.utils.parseEther("2")});

        const markSpeculated = await speculationPoolContract.checkSpeculator(mark.address);
        expect(markSpeculated).to.eq(true);

        // Check if mapping of Mark's address is correctly populated
        const markChoice = (await speculationPoolContract.speculator(mark.address)).choice;
        expect(markChoice).to.eq(ethers.BigNumber.from(1));

        const markAmountSpeculated = (await speculationPoolContract.speculator(mark.address)).amountSpeculated;
        // Speculated amount (2 ETH) with 0.01% fee is 1.998e18
        expect(markAmountSpeculated).to.eq(ethers.BigNumber.from(1998000000000000000n));

        const markRewardsClaimed = (await speculationPoolContract.speculator(mark.address)).rewardsClaimed;
        expect(markRewardsClaimed).to.eq(false);

        // Check if state variables are updated
        totalSpeculatedEth = await speculationPoolContract.getTotalSpeculatedEth();
        expect(totalSpeculatedEth).to.eq(ethers.BigNumber.from(999000000000000000n).add(1998000000000000000n));

        totalSpeculators = await speculationPoolContract.getTotalSpeculators();
        expect(totalSpeculators).to.eq(ethers.BigNumber.from(2));
    });
});