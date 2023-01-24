// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract DpmAssetPool {
    // Admin (Dpm contract)
    address public admin;

    // Deployer of pool
    address public deployer;

    // Name of pool
    string public poolName;

    // Boolean to determine if speculation ended or not
    bool public speculationEnded;

    /// Winning result
    /// @notice By default, result = 0 but result = 1 if asset price increased or
    /// stayed the same and result = 2 if asset price decreased by end of speculation period.
    uint256 public result;

    // Starting asset price
    int256 public startingAssetPrice;

    // Final asset price
    int256 public finalAssetPrice;

    // Block timestamp when speculation period starts
    uint256 public speculationStartTime;

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

    // Chainlink price feed for the specific asset
    AggregatorV3Interface internal chainlinkPriceFeed;

    // Mapping of address to speculator's info
    mapping(address => Speculator) public speculator;

    // Speculator's info
    struct Speculator {
        uint256 choice; // 1 = price increase or same & 2 = price decrease
        uint256 amountSpeculated; // ETH amount staked for speculation
        bool rewardsClaimed; // True or false depending on if rewards are claimed
    }

    // Event
    event SpeculationPeriodEnded(
        uint256 blockTimestamp,
        uint256 totalSpeculators,
        uint256 winningResult
    );

    constructor(
        address _deployer,
        string memory _poolName,
        uint256 _speculationDuration,
        address _chainlinkPriceFeed
    ) {
        admin = msg.sender;
        deployer = _deployer;
        poolName = _poolName;
        speculationStartTime = block.timestamp;
        speculationEndTime = block.timestamp + _speculationDuration;
        chainlinkPriceFeed = AggregatorV3Interface(_chainlinkPriceFeed);
        startingAssetPrice = getLatestAssetPrice();
    }

    /**
     * End speculation period and set final asset price (result)
     * @notice Only callable by admin contract which is the platform that manages all pools
     */
    function endSpeculation() external {
        require(msg.sender == admin, "Not admin");
        require(block.timestamp >= speculationEndTime, "Speculation ongoing");

        speculationEnded = true;
        finalAssetPrice = getLatestAssetPrice();

        finalAssetPrice >= startingAssetPrice ? result = 1 : result = 2;

        emit SpeculationPeriodEnded(
            block.timestamp,
            getTotalSpeculators(),
            result
        );
    }

    /**
     * Returns the latest price of asset
     * @return Scaled asset price
     */
    function getLatestAssetPrice() public view returns (int256) {
        (, int256 price, , , ) = chainlinkPriceFeed.latestRoundData();
        return price;
    }

    /**
     * Returns the total number of speculators for this pool
     * @return Total number of speculators that speculated in this pool
     */
    function getTotalSpeculators() public view returns (uint256) {
        return priceIncreaseSpeculators + priceDecreaseSpeculators;
    }

    /**
     * Checks if speculator already speculated in this pool
     * @param _speculator address of speculator
     * @return True or false depending of if speculator already speculated
     */
    function checkSpeculator(address _speculator) public view returns (bool) {
        return speculator[_speculator].amountSpeculated != 0;
    }

    /**
     * Speculate on asset price movement
     * @param _choice speculator's choice: 1 (price increase or same) or 2 (price decrease)
     */
    function speculate(uint256 _choice) external payable {
        require(!speculationEnded, "Speculation ended");
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
     */
    function claimRewards() external {
        Speculator storage _speculator = speculator[msg.sender];

        require(speculationEnded, "Speculation ongoing");
        require(!_speculator.rewardsClaimed, "Rewards already claimed");
        require(_speculator.choice == result, "Incorrect speculation");

        uint256 _speculatedAmount = _speculator.amountSpeculated;

        /**
         * @notice Rewards are calculated in a mathematical point of view of a
         * speculator winning their original speculation stake in addition to some
         * of the losing speculation stake (proportional to the winning speculator's
         * stake).
         *
         * Calculation of rewards:
         * rewards = amountSpeculated + [(amountSpeculated / totalSpeculatedAmount) * otherTotalSpeculatedAmount]
         */
        uint256 rewards;

        if (result == 1) {
            rewards =
                _speculatedAmount +
                ((_speculatedAmount * priceDecreaseEth) / priceIncreaseEth);
        } else {
            rewards =
                _speculatedAmount +
                ((_speculatedAmount * priceIncreaseEth) / priceDecreaseEth);
        }

        _speculator.rewardsClaimed = true;

        (bool sentRewards, ) = payable(msg.sender).call{value: rewards}("");
        require(sentRewards, "Failed to claim rewards");
    }
}
