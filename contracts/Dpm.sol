// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./SpeculationPool.sol";

contract Dpm {
    // Owner of Dpm platform
    address public immutable owner;

    // Array of speculation pool addresses
    address[] public speculationPools;

    // Event
    event SpeculationPoolCreated(
        address indexed _poolAddress,
        address indexed _poolCreator
    );

    constructor() {
        owner = msg.sender;
    }

    /**
     * Create new speculation pool for certain asset
     * @param poolName_ String representation of the speculation pool name
     * @param speculationDuration_ Time (in seconds) of how long the speculation period should last
     * @param chainlinkPriceFeed_ Address of Chainlink price feed address of a certain asset
     * @return _speculationPoolAddress Address of the newly created speculation pool
     */
    function createSpeculationPool(
        string memory poolName_,
        uint256 speculationDuration_,
        address chainlinkPriceFeed_
    ) external returns (address _speculationPoolAddress) {
        _speculationPoolAddress = address(
            new SpeculationPool(
                msg.sender,
                poolName_,
                speculationDuration_,
                chainlinkPriceFeed_
            )
        );

        speculationPools.push(_speculationPoolAddress);

        emit SpeculationPoolCreated(_speculationPoolAddress, msg.sender);
    }
}
