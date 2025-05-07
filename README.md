# BroSDK

`@brotocol-xyz/bro-sdk` is a TypeScript SDK designed to integrate with Brotocol's on-chain and off-chain infrastructure. It is web3 library-agnostic, meaning you can use your preferred library to send and broadcast transactions while the SDK handles the rest.

🐙 **Brotocol isn't just a bridge—it's the liquidity layer for Bitcoin and the essential connector for Bitcoin DeFi** 🐙

## Table of Contents

- [BroSDK](#brosdk)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Supported Chains](#supported-chains)
      - [Mainnet Chains](#mainnet-chains)
      - [Testnet Chains](#testnet-chains)
      - [Helpers](#helpers)
    - [Supported Tokens](#supported-tokens)
      - [Retrieve a `TokenId`](#retrieve-a-tokenid)
    - [Available Routes](#available-routes)
    - [Basic Operations](#basic-operations)
      - [`bridgeInfoFrom` methods](#bridgeinfofrom-methods)
      - [`estimateBridgeTransactionFrom` methods](#estimatebridgetransactionfrom-methods)
      - [`bridgeFrom` methods](#bridgefrom-methods)
  - [License](#license)

## Features

- Asset transfers between Bitcoin, Stacks, and EVM-compatible blockchains
- Support for Runes and BRC20 metaprotocols
- Cross-chain swaps and DEX aggregator integrations
- Flexible design, allowing integration with any Bitcoin and web3 library

## Installation

With [pnpm](https://pnpm.io/):

```bash
pnpm install @brotocol-xyz/bro-sdk
```

## Usage

The [`BroSDK`](https://releases-latest.xlink-sdk.pages.dev/classes/index.BroSDK) class provides the core functions of the library. To create an instance:

```ts
import { BroSDK } from "@brotocol-xyz/bro-sdk";
const sdk = new BroSDK();
```

For the full API reference, including a full list of available methods and their usage, visit the [SDK Documentation](https://releases-latest.xlink-sdk.pages.dev).

### Supported Chains

#### Mainnet Chains

- **Bitcoin**, **Runes** & **BRC20**
- **Stacks**
- **EVM**: Ethereum, BSC, CoreDAO, Bsquared, BOB, Bitlayer, Lorenzo, Merlin, AILayer, Mode, XLayer, Arbitrum, Aurora, Manta, Linea, Base

#### Testnet Chains

- **Bitcoin**, **Runes** & **BRC20**
- **Stacks**
- **EVM**: Sepolia, BSC Testnet, CoreDAO Testnet, Blife Testnet, Bitboy Testnet, Bera Testnet

#### Helpers

The [`KnownChainId`](https://releases-latest.xlink-sdk.pages.dev/modules/index.KnownChainId) namespace defines types and utility functions for all supported mainnet and testnet networks.

Usage example:

```ts
import { KnownChainId } from "@brotocol-xyz/bro-sdk";

// Bitcoin
const bitcoinChainId = KnownChainId.Bitcoin.Mainnet; 
const bitcoinTestnetChainId = KnownChainId.Bitcoin.Testnet;

// EVM
const ethereumChainId = KnownChainId.EVM.Ethereum; 
const ethereumTestnetChainId = KnownChainId.EVM.Sepolia;

// Utility function usage example
KnownChainId.isEVMTestnetChain(KnownChainId.EVM.Sepolia); // Returns true
KnownChainId.isEVMMainnetChain(KnownChainId.EVM.Sepolia); // Returns false
```

> [!NOTE]
> Runes and BRC20 metaprotocols are treated as distinct chains within the SDK, even though they share Bitcoin as the underlying blockchain.

<!-- 
Decided to remove the table as it seemed a little bulky for the README. But left it here for future reference.

#### Available chains

| Namespace | Mainnet                                                                                                                                                       | Testnet                                                                                   |
| :---------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------: |
| Bitcoin | `Mainnet`                                                                                                                                                     | `Testnet`                                                                                 |
| Runes | `Mainnet`                                                                                                                                                     | `Testnet`                                                                                 |
| BRC20 | `Mainnet`                                                                                                                                                     | `Testnet`                                                                                 |
| Stacks  | `Mainnet`                                                                                                                                                     | `Testnet`                                                                                 |
| EVM     | `Ethereum`, `BSC`, `CoreDAO`, `Bsquared`, `BOB`, `Bitlayer`, `Lorenzo`, `Merlin`, `AILayer`, `Mode`, `XLayer`, `Arbitrum`, `Aurora`, `Manta`, `Linea`, `Base` | `Sepolia`, `BSCTestnet`, `CoreDAOTestnet`, `BlifeTestnet`, `BitboyTestnet`, `BeraTestnet` | -->

### Supported Tokens

Token support is **dynamic**, meaning new tokens can be added without requiring SDK updates. Instead of relying on a static list, the SDK provides methods to fetch supported tokens at runtime. Tokens are represented using the `TokenId` type — this is how the library internally handles and identifies tokens.

Also, check the [`KnownTokenId`](https://releases-latest.xlink-sdk.pages.dev/modules/index.KnownTokenId) namespace to see types and utility functions for all supported tokens.

#### Retrieve a `TokenId`

```ts
// For BRC20 provide the tick symbol
const brc20Token = await sdk.brc20TickToBRC20Token(KnownChainId.BRC20.Mainnet, "alex$");

// For Runes provide the runes ID
const runesToken = await sdk.runesIdToRunesToken(KnownChainId.Runes.Mainnet, "500:20");

// For Stacks provide the contract address
const stacksToken = await sdk.stacksAddressToStacksToken(KnownChainId.Stacks.Mainnet,
  { deployerAddress: "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK", contractName: "token-abtc" },
);

// For EVM tokens provide the contract address
const evmToken = await sdk.evmAddressToEVMToken(KnownChainId.EVM.Ethereum, "0x31761a152F1e96F966C041291644129144233b0B");
```

If a token is **unsupported**, these functions return `Promise<undefined>`.

> [!NOTE]
> Some Stacks and EVM tokens are still statically defined in `KnownTokenId.Stacks` and `KnownTokenId.EVM` for backward compatibility, but future additions will also be dynamically handled.

> [!WARNING]
>
> `TokenId` values **might change in future updates** (no backward compatibility guaranteed). To ensure validity, always get fresh `TokenId`s at runtime using SDK methods—never cache them or construct them manually.

### Available Routes

```ts
// Get all Brotocol available routes 
const allRoutes = await sdk.getPossibleRoutes();

// Get routes filtered by source chain
const routesBySourceChain = await sdk.getPossibleRoutes({
  fromChain: KnownChainId.BRC20.Mainnet,
});

// Get routes filtered by source and target chain
const routesBySourceAndTargetChain = await sdk.getPossibleRoutes({
  fromChain: KnownChainId.BRC20.Mainnet,
  toChain: KnownChainId.EVM.Ethereum,
});

// Check if a specific token pair is supported for at least one route
const isSupported = await sdk.isSupportedRoute({
  fromChain: KnownChainId.BRC20.Mainnet,
  toChain: KnownChainId.EVM.Ethereum,
  fromToken: brc20Token as KnownTokenId.BRC20Token,
  toToken: evmToken as KnownTokenId.EVMToken,
});

// If the token pair is supported, get available routes for that pair
if (isSupported) {
  const routesByPair = await sdk.getPossibleRoutes({
    fromChain: KnownChainId.BRC20.Mainnet,
    toChain: KnownChainId.EVM.Ethereum,
    fromToken: brc20Token as KnownTokenId.BRC20Token,
    toToken: evmToken as KnownTokenId.EVMToken,
  });
}
```

### Basic Operations

The SDK provides three main methods for handling cross-chain asset transfers.

- [`bridgeInfoFrom<Chain>`](#bridgeinfofrom-methods)
- [`estimateBridgeTransactionFrom<Chain>`](#estimatebridgetransactionfrom-methods)
- [`bridgeFrom<Chain>`](#bridgefrom-methods)

#### `bridgeInfoFrom` methods

Retrieve data to perform a cross-chain transfer:

- Validate whether the route is supported (throws an error if not).
- Retrieve Brotocol fee values and the exact amount that will arrive on destination chain.

> [!NOTE]
> These methods do not check the bridge's min/max amount limits. These checks are enforced on-chain, and the transaction will revert if the amount conditions are not met.

```ts
import { toSDKNumberOrUndefined } from "@brotocol-xyz/bro-sdk";

// Retrieve bridge info to perform a transfer from Stacks to EVM
const bridgeInfo = await sdk.bridgeInfoFromStacks({
  fromChain: KnownChainId.Stacks.Mainnet,
  toChain: KnownChainId.EVM.Ethereum,
  fromToken: stacksToken as KnownTokenId.StacksToken,
  toToken: evmToken as KnownTokenId.EVMToken,
  amount: toSDKNumberOrUndefined(100_000_000), // Assume 6 decimals
});
```

#### `estimateBridgeTransactionFrom` methods

Estimate the transaction fee and virtual size (vbytes) for bridging from Bitcoin-based networks (Bitcoin, Runes, BRC20). Fees are calculated as:

```any
fee = virtualSize [vbytes] × networkFeeRate [sat/vbyte]
```

`networkFeeRate` is provided by dev. Typical fee rates range from 1–100 sat/vbyte, depending on network congestion and desired confirmation speed. See this [reference](https://learnmeabitcoin.com/technical/transaction/size/) for more on transaction size.

**Why is this important?** Miners prioritize transactions with higher fees per vbyte. Accurately estimating the transaction virtual size allows to set an appropriate fee, so the transaction is confirmed in a timely manner.

See the [Bridge From Bitcoin](examples/code-snippets/bridgeFrom/Bitcoin.ts) file for usage example.

#### `bridgeFrom` methods

Once the route is validated, the cross-chain transfer can be initiated. These methods **construct and submit** the transaction on the source chain.

> [!IMPORTANT]
> The SDK does not broadcast transactions—it provides the data required to sign and send them. The `sendTransaction` function parameter must be implemented by the developer using their preferred web3 library. The SDK provides the necessary arguments, including contract addresses, function to call and call data.

Examples on how to use the `bridgeFrom` methods can be found in the [examples folder](examples/code-snippets/bridgeFrom/).

## License

This project is licensed under the terms of the [MIT license](LICENSE).
