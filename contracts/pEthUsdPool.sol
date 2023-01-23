// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract pEthUsdPool {
    // Deployer of pool
    address public deployer;

    // Name of pool
    string public poolName;

    // Starting ETH price
    int256 public startingAssetPrice;

    // Block timestamp when speculation period ends
    uint256 public speculationEndTime;

    // Total number of speculators that think price is going to increase
    uint256 public priceIncreaseSpeculators;

    // Total number of speculators that think price is going to decrease
    uint256 public priceDecreaseSpeculators;

    // Total amount of ETH speculated for price increasing
    uint256 public priceIncreaseEth;

    // Total amount of ETH speculated for price decrease
    uint256 public priceDecreaseEth;

    // Chainlink price feed address for the specific asset
    AggregatorV3Interface internal chainlinkPriceFeed;

    // Mapping of address to speculator's info
    mapping(address => Speculator) public speculator;

    // Speculator's info
    struct Speculator {
        uint256 choice; // 1 = price increase & 2 = price decrease
        uint256 amountSpeculated; // ETH amount staked for speculation
    }

    constructor(
        address _deployer,
        string memory _poolName,
        uint256 _speculationDuration,
        address _chainlinkPriceFeed
    ) {
        deployer = _deployer;
        poolName = _poolName;
        speculationEndTime = block.timestamp + _speculationDuration;
        chainlinkPriceFeed = AggregatorV3Interface(_chainlinkPriceFeed);
        setStartingAssetPrice();
    }

    /**
     * Returns the latest price of asset
     */
    function getLatestAssetPrice() public view returns (int256) {
        (, int256 price, , , ) = chainlinkPriceFeed.latestRoundData();
        return price;
    }

    /**
     * Internal function to set the starting price of asset
     */
    function setStartingAssetPrice() private returns (int256) {
        (, int256 price, , , ) = chainlinkPriceFeed.latestRoundData();
        startingAssetPrice = price;
        return startingAssetPrice;
    }

    /**
     * Returns the total number of speculators for this pool
     */
    function getTotalSpeculators() public view returns (uint256) {
        return priceIncreaseSpeculators + priceDecreaseSpeculators;
    }

    /**
     * Returns a boolean to check if speculator already speculated
     * @param _speculator address of speculator
     */
    function checkSpeculator(address _speculator) public view returns (bool) {
        return speculator[_speculator].amountSpeculated != 0;
    }

    /**
     * Speculate on asset price movement
     * @param _choice speculator's choice: 1 (price increase) or 2 (price decrease)
     */
    function speculate(uint256 _choice) external payable {
        require(!checkSpeculator(msg.sender), "Already speculated");
        require(_choice == 1 || _choice == 2, "Invalid choice");
        require(msg.value > 0, "ETH amount != 0");

        speculator[msg.sender].choice = _choice;
        speculator[msg.sender].amountSpeculated = msg.value;

        if (_choice == 1) {
            priceIncreaseSpeculators++;
            priceIncreaseEth += msg.value;
        } else {
            priceDecreaseSpeculators++;
            priceDecreaseEth += msg.value;
        }
    }

    /**
     * Allow winning speculators to claim rewards proportional to amount speculated
     *
     */
    function claimRewards() external {}
}
