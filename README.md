# Decentralized Speculations Market

## General Overview

This is a proof of concept for a decentralized speculations market. It will essentially serve as a marketplace that allows users to create their own speculation pools for certain crypto assets. These speculation pools will serve as a platform for other users to speculate on asset price movements within a specified time period.

## Motivation

In crypto, there are a large group of people that tend to speculate on various token prices increasing or decreasing. As the industry is relatively young, new projects and protocols are being built every single day. There are going to be people who believe in a certain project and people who do not. Just as with any other asset class, there should be a way for people to participate in asset price speculation. Whether people may be speculating on certain crypto tokens with their friends or with strangers from all around the world, this proof of concept serves as a platform for people to speculate on various crypto tokens in a purely decentralized way without a central authority controlling the platform and its functionalities.

## Smart Contracts

### Dpm.sol

This smart contract serves as the main platform for users to create their own speculation pools. It contains one function for users to create their own speculation pools and an array containing all created speculation pools. All speculation pools being created rely on a valid Chainlink price feed address to determine the price of the asset being speculated on.

### SpeculationPool.sol

This smart contract serves as the unique pool where users can speculate on the price of various crypto assets. There are two choices a speculator can make: price increase or no price change **AND** price decrease. Additionally, the smart contract contains functions for users to claim rewards and end the speculation period. Winning speculators can claim rewards proportional to their speculated amount in addition to their initial speculated amount. Also, anybody can end the speculation period for a certain pool which sets the final price of an asset to be compared to the starting price. For speculating, there is a 0.01% fee which is added to contract's balance to serve as an incentive for people to end the speculation period as quickly as possible so they can receive all the fees from speculators. Lastly, there are various state variables that describe the specific speculation pool such as the pool name, starting/ending asset price, starting/ending speculation time, and etc.

**Note:** Ending the speculation period as quickly as possible is very crucial for this type of speculating system to work. This is the reason why a fee is introduced when users are speculating so there is an incentive for people to end the speculation period right when the speculation period is supposed to end. However, this type of incentive was not throughly researched and should be improved on.

> For example, if there are very little speculators or a small speculated amount for a certain pool, the gas fees could potentially be higher than the fees received when ending the speculation which can cause users to lose ETH when ending the speculation period.

## Testing

To test functionalities of the smart contracts, run

```
npx hardhat test
```

**Note:** These unit tests were done with the Mainnet forking feature of Hardhat. Unfortunately, testing the Chainlink price feed does not work with the Mainnet forking feature so that specific part (asset price updating after a certain passage of time) was not tested.
