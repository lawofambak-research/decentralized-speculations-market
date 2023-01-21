// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract pEthUsdPool {
    // Deployer of pool
    address public deployer;

    // Name of pool
    string public poolName;

    // Boolean to determine if speculation period ended or not
    bool public speculationPeriodEnded;

    // Total number of speculators that think price is going to increase
    uint256 public priceIncreaseSpeculators;

    // Total number of speculators that think price is going to decrease
    uint256 public priceDecreaseSpeculators;

    // Chainlink price feed address for the specific asset
    AggregatorV3Interface internal chainlinkPriceFeed;

    // Mapping of address to speculator's info
    mapping(address => Speculator) public speculator;

    // Speculator's info
    struct Speculator {
        uint256 choice; // 0 = price decrease & 1 = price decrease
        uint256 amountSpeculated; // ETH amount staked for speculation
    }

    constructor(
        address _deployer,
        string memory _poolName,
        address _chainlinkPriceFeed
    ) {
        deployer = _deployer;
        poolName = _poolName;
        speculationPeriodEnded = false;
        chainlinkPriceFeed = AggregatorV3Interface(_chainlinkPriceFeed);
    }

    /**
     * Returns the latest price of asset
     */
    function getLatestAssetPrice() public view returns (int256) {
        (, int256 price, , , ) = chainlinkPriceFeed.latestRoundData();
        return price;
    }

    /**
     * Returns the total number of speculators for this pool
     */
    function getTotalSpeculators() public view returns (uint256) {
        return priceIncreaseSpeculators + priceDecreaseSpeculators;
    }

    /**
     * Speculate on asset price movement
     * @param _choice speculator's choice: 0 (price decrease) or 1 (price increase)
     */
    function speculate(uint256 _choice) external {}
}
