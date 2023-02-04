import { expect } from "chai";
import { ethers } from "hardhat";
import { Dpm, SpeculationPool } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

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
    let john: SignerWithAddress;
    let speculationPoolContract: SpeculationPool;

    beforeEach(async () => {
        [deployer, bob, alice, mark, john] = await ethers.getSigners();

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

    it("Speculation period should end correctly", async () => {
        // Check internal time
        const latestTime = await time.latest();
        const startTime = await speculationPoolContract.speculationStartTime();
        expect(startTime).to.eq(ethers.BigNumber.from(latestTime));

        // Make Alice speculate with choice 2 (price decrease) and 1 ETH
        await speculationPoolContract.connect(alice).speculate(2, { value: ethers.utils.parseEther("1")});

        // Make Mark speculate with choice 1 (price increase) and 2 ETH
        await speculationPoolContract.connect(mark).speculate(1, { value: ethers.utils.parseEther("2")});

        // Advance time
        // * Chainlink price feed is not going to update as it does not update with mainnet forking *
        // ! Need to learn how to use mocks !
        await time.increase(SECONDS_IN_A_DAY);

        const endTime = await speculationPoolContract.speculationEndTime();
        expect(endTime).to.eq(ethers.BigNumber.from(startTime).add(ethers.BigNumber.from(SECONDS_IN_A_DAY)));

        const bobEthBalanceBefore = await ethers.provider.getBalance(bob.address);
        
        // Make Bob end speculation and check for event being emitted
        await expect(speculationPoolContract.connect(bob).endSpeculation())
            .to.emit(speculationPoolContract, "SpeculationPeriodEnded");

        // Compare Bob's ETH balance to check if he received fees
        const bobEthBalanceAfter = await ethers.provider.getBalance(bob.address);
        expect(bobEthBalanceAfter).to.be.above(bobEthBalanceBefore);
        
        // Check that Bob cannot end speculation again
        await expect(speculationPoolContract.connect(bob).endSpeculation()).to.be.revertedWith("Speculation already ended");

        // Check the result (result should be 1 since the Chainlink price feed did not change)
        const result = await speculationPoolContract.result();
        expect(result).to.eq(ethers.BigNumber.from(1));

        // Check speculationEnded state variable
        const speculationEnded = await speculationPoolContract.speculationEnded();
        expect(speculationEnded).to.eq(true);
    });

    it("User should be able to claim rewards", async () => {
        // Make Alice speculate with choice 2 (price decrease) and 1 ETH
        await speculationPoolContract.connect(alice).speculate(2, { value: ethers.utils.parseEther("1")});

        // Make John speculate with choice 1 (price increase) and 1 ETH
        await speculationPoolContract.connect(john).speculate(1, { value: ethers.utils.parseEther("1")});

        // Make Mark speculate with choice 1 (price increase) and 2 ETH
        await speculationPoolContract.connect(mark).speculate(1, { value: ethers.utils.parseEther("2")});

        // Users should not be able to claim rewards if speculation period did not end
        await expect(speculationPoolContract.connect(mark).claimRewards()).to.be.revertedWith("Speculation ongoing");
        await expect(speculationPoolContract.connect(john).claimRewards()).to.be.revertedWith("Speculation ongoing");

        // Advance time
        await time.increase(SECONDS_IN_A_DAY);

        // Make Bob end speculation
        // Winning result should be 1 since Chainlink price feed does not update
        await speculationPoolContract.connect(bob).endSpeculation();

        // Alice should not be able to claim rewards
        await expect(speculationPoolContract.connect(alice).claimRewards()).to.be.revertedWith("Incorrect speculation");

        const markEthBalanceBefore = await ethers.provider.getBalance(mark.address);
        const johnEthBalanceBefore = await ethers.provider.getBalance(john.address);

        // Mark and John should be able to claim rewards
        await speculationPoolContract.connect(mark).claimRewards();
        await speculationPoolContract.connect(john).claimRewards();

        await expect(speculationPoolContract.connect(mark).claimRewards()).to.be.revertedWith("Rewards already claimed");
        await expect(speculationPoolContract.connect(john).claimRewards()).to.be.revertedWith("Rewards already claimed");

        // Compare Mark's and John's ETH balance to check if they claimed rewards
        const markEthBalanceAfter = await ethers.provider.getBalance(mark.address);
        const johnEthBalanceAfter = await ethers.provider.getBalance(john.address);
        expect(markEthBalanceAfter).to.be.above(markEthBalanceBefore);
        expect(johnEthBalanceAfter).to.be.above(johnEthBalanceBefore);

        // Total amount of ETH rewards Mark should receive excluding gas fees (not scaled)
        let calculatedMarkRewards = 1.998 + ((1.998 * 0.999) / 2.997);
        calculatedMarkRewards = calculatedMarkRewards * 10**18;
        // Includes gas fees
        const markRewards = markEthBalanceAfter.sub(markEthBalanceBefore);
        // Testing with a delta of 0.001 ETH
        expect(markRewards).to.be.closeTo(ethers.BigNumber.from(BigInt(calculatedMarkRewards)), ethers.BigNumber.from(1000000000000000n));

        // Total amount of ETH rewards John should receive excluding gas fees (not scaled)
        let calculatedJohnRewards = 0.999 + ((0.999 * 0.999) / 2.997);
        calculatedJohnRewards = calculatedJohnRewards * 10**18;
        // Includes gas fees
        const johnRewards = johnEthBalanceAfter.sub(johnEthBalanceBefore);
        // Testing with a delta of 0.001 ETH
        expect(johnRewards).to.be.closeTo(ethers.BigNumber.from(BigInt(calculatedJohnRewards)), ethers.BigNumber.from(1000000000000000n));

        // Speculation pool contract ETH balance should be 0 after all rewards all claimed
        expect(await ethers.provider.getBalance(speculationPoolContract.address)).to.eq(ethers.BigNumber.from(0));
    });
});