import { Client } from "viem"
import { getBTCPegInAddress } from "./bitcoinUtils/btcAddresses"
import { isSupportedBitcoinRoute } from "./bitcoinUtils/peggingHelpers"
import { nativeCurrencyAddress } from "./evmUtils/addressHelpers"
import {
  defaultEvmClients,
  evmChainIdFromKnownChainId,
  evmChainIdToKnownChainId,
} from "./evmUtils/evmClients"
import { isSupportedEVMRoute } from "./evmUtils/peggingHelpers"
import {
  getEVMContractCallInfo,
  getEVMToken,
  getEVMTokenContractInfo,
} from "./evmUtils/contractHelpers"
import { getBRC20SupportedRoutes } from "./metaUtils/apiHelpers/getBRC20SupportedRoutes"
import { getRunesSupportedRoutes } from "./metaUtils/apiHelpers/getRunesSupportedRoutes"
import {
  isSupportedBRC20Route,
  isSupportedRunesRoute,
} from "./metaUtils/peggingHelpers"
import { isSupportedStacksRoute } from "./stacksUtils/peggingHelpers"
import {
  getStacksToken,
  getStacksTokenContractInfo,
} from "./stacksUtils/contractHelpers"
import { TooManyRequestsError } from "./utils/apiHelpers"
import {
  DefinedRoute,
  GetSupportedRoutesFn_Conditions,
  KnownRoute,
} from "./utils/buildSupportedRoutes"
import { detectPossibleRoutes } from "./utils/detectPossibleRoutes"
import { TooFrequentlyError } from "./utils/errors"
import {
  KnownChainId,
  KnownTokenId,
  getChainIdNetworkType,
} from "./utils/types/knownIds"
import {
  BridgeFromBitcoinInput,
  BridgeFromBitcoinOutput,
  bridgeFromBitcoin,
} from "./sdkUtils/bridgeFromBitcoin"
import {
  BridgeFromBRC20Input,
  BridgeFromBRC20Output,
  bridgeFromBRC20,
} from "./sdkUtils/bridgeFromBRC20"
import {
  BridgeFromEVMInput,
  BridgeFromEVMOutput,
  bridgeFromEVM,
} from "./sdkUtils/bridgeFromEVM"
import {
  BridgeFromRunesInput,
  BridgeFromRunesOutput,
  bridgeFromRunes,
} from "./sdkUtils/bridgeFromRunes"
import {
  BridgeFromStacksInput,
  BridgeFromStacksOutput,
  bridgeFromStacks,
} from "./sdkUtils/bridgeFromStacks"
import {
  BridgeInfoFromBitcoinInput,
  BridgeInfoFromBitcoinOutput,
  bridgeInfoFromBitcoin,
} from "./sdkUtils/bridgeInfoFromBitcoin"
import {
  BridgeInfoFromEVMInput,
  BridgeInfoFromEVMOutput,
  bridgeInfoFromEVM,
} from "./sdkUtils/bridgeInfoFromEVM"
import {
  BridgeInfoFromBRC20Input,
  BridgeInfoFromBRC20Output,
  BridgeInfoFromRunesInput,
  BridgeInfoFromRunesOutput,
  bridgeInfoFromBRC20,
  bridgeInfoFromRunes,
} from "./sdkUtils/bridgeInfoFromMeta"
import {
  BridgeInfoFromStacksInput,
  BridgeInfoFromStacksOutput,
  bridgeInfoFromStacks,
} from "./sdkUtils/bridgeInfoFromStacks"
import {
  EstimateBridgeTransactionFromBitcoinInput,
  EstimateBridgeTransactionFromBitcoinOutput,
  estimateBridgeTransactionFromBitcoin,
} from "./sdkUtils/estimateBridgeTransactionFromBitcoin"
import {
  EstimateBridgeTransactionFromBRC20Input,
  EstimateBridgeTransactionFromBRC20Output,
  estimateBridgeTransactionFromBRC20,
} from "./sdkUtils/estimateBridgeTransactionFromBRC20"
import {
  EstimateBridgeTransactionFromRunesInput,
  EstimateBridgeTransactionFromRunesOutput,
  estimateBridgeTransactionFromRunes,
} from "./sdkUtils/estimateBridgeTransactionFromRunes"
import {
  ClaimTimeLockedAssetsInput,
  ClaimTimeLockedAssetsOutput,
  GetTimeLockedAssetsInput,
  GetTimeLockedAssetsOutput,
  claimTimeLockedAssetsFromEVM,
  getTimeLockedAssetsFromEVM,
} from "./sdkUtils/timelockFromEVM"
import {
  ChainId,
  EVMAddress,
  EVMNativeCurrencyAddress,
  PublicEVMContractType,
  RuneIdCombined,
  StacksContractAddress,
  evmNativeCurrencyAddress,
} from "./sdkUtils/types"
import { SDKGlobalContext } from "./sdkUtils/types.internal"
import { DumpableCache, getCacheInside } from "./utils/DumpableCache"
import { isNotNull } from "./utils/typeHelpers"
import { SwapRoute } from "./utils/SwapRouteHelpers"
import {
  tronTokenToCorrespondingStacksToken,
  tronTokenFromCorrespondingStacksToken,
} from "./tronUtils/peggingHelpers"
import {
  solanaTokenToCorrespondingStacksToken,
  solanaTokenFromCorrespondingStacksToken,
} from "./solanaUtils/peggingHelpers"
import { isSupportedTronRoute } from "./tronUtils/peggingHelpers"
import { isSupportedSolanaRoute } from "./solanaUtils/peggingHelpers"
import { getSolanaSupportedRoutes } from "./solanaUtils/getSolanaSupportedRoutes"
import { SolanaSupportedRoute } from "./solanaUtils/types"
import { getTronSupportedRoutes } from "./tronUtils/getTronSupportedRoutes"
import { TronSupportedRoute } from "./tronUtils/types"
import {
  BridgeFromSolanaInput,
  BridgeFromSolanaOutput,
  bridgeFromSolana,
} from "./sdkUtils/bridgeFromSolana"
import {
  BridgeInfoFromSolanaInput,
  BridgeInfoFromSolanaOutput,
  bridgeInfoFromSolana,
} from "./sdkUtils/bridgeInfoFromSolana"

export {
  BridgeFromSolanaInput,
  BridgeFromSolanaOutput,
} from "./sdkUtils/bridgeFromSolana"

export {
  GetSupportedRoutesFn_Conditions,
  KnownRoute,
} from "./utils/buildSupportedRoutes"
export {
  BridgeFromBitcoinInput,
  BridgeFromBitcoinInput_signPsbtFn,
  BridgeFromBitcoinInput_reselectSpendableUTXOs,
  BridgeFromBitcoinOutput,
} from "./sdkUtils/bridgeFromBitcoin"
export {
  BridgeFromBRC20Input,
  BridgeFromBRC20Input_signPsbtFn,
  BridgeFromBRC20Input_reselectSpendableNetworkFeeUTXOs,
  BridgeFromBRC20Output,
} from "./sdkUtils/bridgeFromBRC20"
export {
  BridgeFromEVMInput,
  BridgeFromEVMOutput,
} from "./sdkUtils/bridgeFromEVM"
export {
  BridgeFromRunesInput,
  BridgeFromRunesInput_signPsbtFn,
  BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs,
  BridgeFromRunesOutput,
  RunesUTXOSpendable,
} from "./sdkUtils/bridgeFromRunes"
export {
  BridgeFromStacksInput,
  BridgeFromStacksInput_ContractCallOptions,
  BridgeFromStacksInput_sendTransactionFn,
  BridgeFromStacksOutput,
} from "./sdkUtils/bridgeFromStacks"
export {
  BridgeInfoFromBitcoinInput,
  BridgeInfoFromBitcoinOutput,
} from "./sdkUtils/bridgeInfoFromBitcoin"
export {
  BridgeInfoFromEVMInput,
  BridgeInfoFromEVMOutput,
} from "./sdkUtils/bridgeInfoFromEVM"
export {
  BridgeInfoFromBRC20Input,
  BridgeInfoFromBRC20Output,
  BridgeInfoFromRunesInput,
  BridgeInfoFromRunesOutput,
} from "./sdkUtils/bridgeInfoFromMeta"
export {
  BridgeInfoFromStacksInput,
  BridgeInfoFromStacksOutput,
} from "./sdkUtils/bridgeInfoFromStacks"
export {
  EstimateBridgeTransactionFromBitcoinInput,
  EstimateBridgeTransactionFromBitcoinOutput,
} from "./sdkUtils/estimateBridgeTransactionFromBitcoin"
export {
  EstimateBridgeTransactionFromBRC20Input,
  EstimateBridgeTransactionFromBRC20Output,
} from "./sdkUtils/estimateBridgeTransactionFromBRC20"
export {
  EstimateBridgeTransactionFromRunesInput,
  EstimateBridgeTransactionFromRunesOutput,
} from "./sdkUtils/estimateBridgeTransactionFromRunes"
export {
  ClaimTimeLockedAssetsInput,
  ClaimTimeLockedAssetsOutput,
  GetTimeLockedAssetsInput,
  GetTimeLockedAssetsOutput,
} from "./sdkUtils/timelockFromEVM"
export type { DumpableCache } from "./utils/DumpableCache"

export interface BroSDKOptions {
  debugLog?: boolean
  __experimental?: {
    backendAPI?: {
      runtimeEnv?: "prod" | "dev"
    }
    btc?: {
      ignoreValidateResult?: boolean
    }
    brc20?: {
      ignoreValidateResult?: boolean
    }
    runes?: {
      ignoreValidateResult?: boolean
    }
    evm?: {
      onChainConfigCachePrepared?: (cache: DumpableCache) => void
    }
  }
  evm?: {
    /**
     * @default true
     */
    cacheOnChainConfig?: boolean

    /**
     * You can assign your custom viem clients here
     *
     * @default undefined
     */
    viemClients?: Record<KnownChainId.EVMChain, Client>
  }
}

let defaultConfig: BroSDKOptions = {
  evm: {
    cacheOnChainConfig: true,
  },
}

export class BroSDK {
  static defaultConfig(options: BroSDKOptions): void {
    defaultConfig = options
  }

  private sdkContext: SDKGlobalContext

  constructor(options: BroSDKOptions = {}) {
    const cacheEVMOnChainConfig =
      options.evm?.cacheOnChainConfig ?? defaultConfig.evm?.cacheOnChainConfig

    let onChainConfigCache:
      | undefined
      | SDKGlobalContext["evm"]["onChainConfigCache"]
    if (cacheEVMOnChainConfig) {
      const onChainConfigDumpableCache = new DumpableCache()
      options.__experimental?.evm?.onChainConfigCachePrepared?.(
        onChainConfigDumpableCache,
      )
      onChainConfigCache = getCacheInside(onChainConfigDumpableCache)
    }

    this.sdkContext = {
      debugLog: options.debugLog ?? false,
      routes: {
        detectedCache: new Map(),
      },
      backendAPI: {
        ...options.__experimental?.backendAPI,
        runtimeEnv: options.__experimental?.backendAPI?.runtimeEnv ?? "prod",
      },
      stacks: {
        tokensCache: new Map(),
      },
      btc: {
        ignoreValidateResult:
          options.__experimental?.btc?.ignoreValidateResult ?? false,
        feeRateCache: new Map(),
      },
      brc20: {
        ignoreValidateResult:
          options.__experimental?.brc20?.ignoreValidateResult ?? false,
        routesConfigCache: new Map(),
        feeRateCache: new Map(),
      },
      runes: {
        ignoreValidateResult:
          options.__experimental?.runes?.ignoreValidateResult ?? false,
        routesConfigCache: new Map(),
        feeRateCache: new Map(),
      },
      evm: {
        routesConfigCache: new Map(),
        feeRateCache: new Map(),
        onChainConfigCache,
        viemClients: {
          ...defaultEvmClients,
          ...options.evm?.viemClients,
        },
      },
      tron: {
        routesConfigCache: new Map(),
      },
      solana: {
        routesConfigCache: new Map(),
      },
    }
  }

  /**
   * @deprecated Use `getPossibleRoutes` instead
   */
  async getSupportedRoutes(
    conditions?: GetSupportedRoutesFn_Conditions,
  ): Promise<KnownRoute[]> {
    return this.getPossibleRoutes(conditions)
  }

  /**
   * This function roughly returns a list of possible routes supported by the
   * SDK. It aggregates the results from different blockchain networks (Stacks,
   * EVM, Bitcoin).
   *
   * @param conditions - An optional object containing the conditions for filtering the possible routes:
   * - `fromChain?: ChainId` - The ID of the source blockchain (optional).
   * - `toChain?: ChainId` - The ID of the destination blockchain (optional).
   * - `fromToken?: TokenId` - The ID of the token being transferred from the source blockchain (optional).
   * - `toToken?: TokenId` - The ID of the token expected on the destination blockchain (optional).
   * - `includeUnpredictableSwapPossibilities?: boolean` - Whether to include
   *    routes that require token swaps to complete. Note that the ability to perform these swaps
   *    cannot be determined at this point, so enabling this option may return routes that cannot
   *    actually be completed (optional).
   *
   * @returns A promise that resolves with an array of `KnownRoute` objects, each representing a supported
   * token transfer route between blockchains.
   */
  async getPossibleRoutes(
    conditions?: GetSupportedRoutesFn_Conditions,
  ): Promise<KnownRoute[]> {
    const specifiedChain = conditions?.fromChain ?? conditions?.toChain

    if (specifiedChain != null && !KnownChainId.isKnownChain(specifiedChain)) {
      return []
    }

    const networkType =
      specifiedChain == null ? null : getChainIdNetworkType(specifiedChain)

    let resultRoutesPromise: Promise<KnownRoute[]>
    if (networkType == null) {
      resultRoutesPromise = Promise.all([
        detectPossibleRoutes(this.sdkContext, {
          networkType: "mainnet",
          swapEnabled:
            conditions?.includeUnpredictableSwapPossibilities ?? false,
        }),
        detectPossibleRoutes(this.sdkContext, {
          networkType: "testnet",
          swapEnabled:
            conditions?.includeUnpredictableSwapPossibilities ?? false,
        }),
      ]).then(res => res.flat().filter(isNotNull))
    } else {
      resultRoutesPromise = detectPossibleRoutes(this.sdkContext, {
        networkType,
        swapEnabled: conditions?.includeUnpredictableSwapPossibilities ?? false,
      })
    }

    const resultRoutes = await resultRoutesPromise
    const routeConditions = {
      fromChain: conditions?.fromChain,
      fromToken: conditions?.fromToken,
      toChain: conditions?.toChain,
      toToken: conditions?.toToken,
    }
    if (Object.values(routeConditions).filter(isNotNull).length === 0) {
      return resultRoutes
    }

    return resultRoutes.filter(
      r =>
        (routeConditions.fromChain == null ||
          r.fromChain === routeConditions.fromChain) &&
        (routeConditions.fromToken == null ||
          r.fromToken === routeConditions.fromToken) &&
        (routeConditions.toChain == null ||
          r.toChain === routeConditions.toChain) &&
        (routeConditions.toToken == null ||
          r.toToken === routeConditions.toToken),
    )
  }

  /**
   * Determines whether a given route (from one blockchain/token to another) is supported by the SDK.
   * This function evaluates cross-chain compatibility for all supported networks (EVM, Stacks, Bitcoin, BRC20, Runes)
   * by delegating to specialized validators per source chain type. It checks that the route is logically valid,
   * not deprecated, and exists in the bridge configuration which is dynamically fetched.
   *
   * @param route - The route to validate, containing:
   * - `fromChain`: the origin blockchain (`ChainId`)
   * - `fromToken`: the token to bridge from (`TokenId`)
   * - `toChain`: the destination blockchain (`ChainId`)
   * - `toToken`: the token to receive on the destination (`TokenId`)
   * - `swapRoute?` – (optional) An optional swap configuration that may be present in the route object.
   *
   * @returns A promise that resolves to `true` if the route is supported for bridging,
   * or `false` if the route is invalid, unsupported, or incomplete.
   */
  async isSupportedRoute(
    route: DefinedRoute & { swapRoute?: SwapRoute },
  ): Promise<boolean> {
    const checkingResult = await Promise.all([
      isSupportedEVMRoute(this.sdkContext, route),
      isSupportedStacksRoute(this.sdkContext, route),
      isSupportedBitcoinRoute(this.sdkContext, route),
      isSupportedBRC20Route(this.sdkContext, route),
      isSupportedRunesRoute(this.sdkContext, route),
      isSupportedTronRoute(this.sdkContext, route),
      isSupportedSolanaRoute(this.sdkContext, route),
    ])

    return checkingResult.some(r => r)
  }

  /**
   * This function retrieves the Stacks contract address (principal) associated with a known Stacks token ID used by the SDK.
   *
   * @param chain - The ID of the Stacks blockchain.
   * @param token - The specific token ID for which the contract address is to be retrieved.
   *
   * @returns A promise that resolves with the contract address associated with the specified token,
   * or `undefined` if the chain is not a Stacks chain or if the contract address cannot be retrieved.
   */
  stacksAddressFromStacksToken(
    chain: ChainId,
    token: KnownTokenId.StacksToken,
  ): Promise<undefined | StacksContractAddress> {
    return stacksAddressFromStacksToken(this.sdkContext, chain, token)
  }
  /**
   * This function maps a given Stacks contract address to its corresponding known token ID.
   * Always use this function to retrieve the current `KnownTokenId.StacksToken` for a contract at runtime.
   *
   * Token IDs are dynamically resolved and may change as supported tokens are updated — do not hardcode or cache these values.
   *
   * @param chain - The ID of the Stacks blockchain.
   * @param address - The contract address on the Stacks blockchain.
   *
   * @returns A promise that resolves with the known token ID corresponding to the provided
   * contract address, or `undefined` if the chain is not a Stacks chain or if the token is not
   * supported by Brotocol.
   */
  stacksAddressToStacksToken(
    chain: ChainId,
    address: StacksContractAddress,
  ): Promise<undefined | KnownTokenId.StacksToken> {
    return stacksAddressToStacksToken(this.sdkContext, chain, address)
  }

  /**
   * This function provides detailed information about token transfers from the Stacks network to other supported
   * blockchain networks, including Bitcoin and EVM-compatible chains. It verifies the validity of the transfer
   * route and retrieves bridge information based on the destination chain and tokens.
   *
   * @param input - An object containing the input parameters required for retrieving bridge information:
   * - `fromChain: ChainId` - The ID of the source blockchain (Stacks in this case).
   * - `toChain: ChainId` - The ID of the destination blockchain (Bitcoin, EVM-compatible chains, etc.).
   * - `fromToken: TokenId` - The token being transferred from the Stacks network.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `amount: SDKNumber` - The amount of tokens involved in the transfer.
   *
   * @returns A promise that resolves with an object containing detailed information about the token transfer, including:
   * - `fromChain: KnownChainId.KnownChain` - The source blockchain.
   * - `fromToken: KnownTokenId.KnownToken` - The token being transferred from the Stacks network.
   * - `toChain: KnownChainId.KnownChain` - The destination blockchain.
   * - `toToken: KnownTokenId.KnownToken` - The token expected on the destination chain.
   * - `fromAmount: SDKNumber` - The amount of tokens being transferred.
   * - `toAmount: SDKNumber` - The amount of tokens expected on the destination chain after the transfer.
   * - `feeAmount: SDKNumber` - The fee amount deducted during the transfer.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains or tokens is unsupported.
   */
  bridgeInfoFromStacks(
    input: BridgeInfoFromStacksInput,
  ): Promise<BridgeInfoFromStacksOutput> {
    return bridgeInfoFromStacks(this.sdkContext, input)
  }

  /**
   * This function facilitates the transfer of tokens from the Stacks network to other supported blockchain
   * networks, including Bitcoin and EVM-compatible chains. It validates the route and calls the appropriate
   * bridging function based on the destination chain and tokens involved.
   *
   * @param input -  An object containing the input parameters required for the bridging operation:
   * - `fromChain: ChainId` - The ID of the source blockchain.
   * - `toChain: ChainId` - The ID of the destination blockchain (Bitcoin, EVM, etc.).
   * - `fromToken: TokenId` - The token being transferred from the source chain.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `fromAddress: string` - The sender's address on the source chain.
   * - `toAddress: string` - The recipient's address on the destination blockchain.
   * - `amount: SDKNumber` - The amount of tokens to transfer.
   * - `sendTransaction` - // Implementation for sending transaction from Stacks mainnet.
   *
   * @returns A promise that resolves with the transaction ID (`txid`) of the bridging operation.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains or tokens is unsupported.
   */
  bridgeFromStacks(
    input: BridgeFromStacksInput,
  ): Promise<BridgeFromStacksOutput> {
    return bridgeFromStacks(this.sdkContext, input)
  }

  /**
   * This function retrieves the contract address of a specific type of contract
   * (e.g., a bridge endpoint) on a given EVM-compatible blockchain.
   *
   * @param chain - The ID of the EVM-compatible blockchain where the contract is deployed.
   * @param contractType - The type of contract (e.g., `PublicEVMContractType.BridgeEndpoint`)
   * for which the address is to be retrieved.
   *
   * @returns A promise that resolves with the contract address of the specified type, or
   * `undefined` if the chain is not EVM-compatible or if the address cannot be retrieved.
   */
  async getEVMContractAddress(
    chain: ChainId,
    contractType: PublicEVMContractType,
  ): Promise<undefined | EVMAddress> {
    if (!KnownChainId.isEVMChain(chain)) return

    const info = await getEVMContractCallInfo(this.sdkContext, chain)
    if (contractType === PublicEVMContractType.BridgeEndpoint) {
      return info?.bridgeEndpointContractAddress
    }
    return
  }

  /**
   * This function retrieves the numeric EVM chain ID (`chainId`) associated with a known EVM-compatible chain in the SDK.
   * This chain ID serves as the identifier for chains within smart contracts.
   *
   * @param chain - A known EVM-compatible chain identifier (`KnownChainId.EVMChain`).
   *
   * @returns A promise that resolves with the numeric `chainId` (as a `bigint`) corresponding to the specified
   * EVM-compatible chain. Returns `undefined` if the chain ID is not available or not supported.
   */
  async evmChainIdFromKnownChainId(
    chain: KnownChainId.EVMChain,
  ): Promise<undefined | bigint> {
    return evmChainIdFromKnownChainId(chain)
  }

  /**
   * This function maps a numeric chain ID (`chainId`) to its corresponding known chain identifier (`KnownChainId.EVMChain`) used in the SDK.
   *
   * @param chainId - The numeric chain ID (as a `bigint`) of an EVM-compatible blockchain.
   *
   * @returns A promise that resolves with the corresponding known EVM chain ID (`KnownChainId.EVMChain`),
   * or `undefined` if the chain ID is not recognized or not supported.
   */
  async evmChainIdToKnownChainId(
    chainId: bigint,
  ): Promise<undefined | KnownChainId.EVMChain> {
    return evmChainIdToKnownChainId(chainId)
  }

  /**
   * This function retrieves the contract address of a specific token on a given EVM-compatible blockchain.
   *
   * @param chain - The ID of the EVM-compatible blockchain where the token contract is deployed.
   * @param token - The specific token ID for which the contract address is to be retrieved.
   *
   * @returns A promise that resolves with the contract address of the token, or `undefined` if the
   * chain is not EVM-compatible or if the contract address cannot be retrieved.
   */
  async evmAddressFromEVMToken(
    chain: ChainId,
    token: KnownTokenId.EVMToken,
  ): Promise<undefined | EVMAddress | EVMNativeCurrencyAddress> {
    if (!KnownChainId.isEVMChain(chain)) return
    const info = await getEVMTokenContractInfo(this.sdkContext, chain, token)
    return info?.tokenContractAddress
  }

  /**
   * This function maps a given contract address on an EVM-compatible blockchain to its corresponding known token ID.
   *
   * Always use this function to retrieve an `EVMToken` ID at runtime.
   * Do not hardcode or cache token IDs, as supported tokens may change dynamically.
   *
   * @param chain - The ID of the EVM-compatible blockchain where the contract is deployed.
   * @param address - The contract address on the EVM-compatible blockchain.
   *
   * @returns A promise that resolves with the known token ID corresponding to the provided contract
   * address, or `undefined` if the token ID cannot be found or if the chain is not EVM-compatible.
   */
  async evmAddressToEVMToken(
    chain: ChainId,
    address: EVMAddress | EVMNativeCurrencyAddress,
  ): Promise<undefined | KnownTokenId.EVMToken> {
    if (!KnownChainId.isEVMChain(chain)) return
    if (address === evmNativeCurrencyAddress) {
      address = nativeCurrencyAddress
    }
    return getEVMToken(this.sdkContext, chain, address)
  }

  /**
   * This function provides detailed information about token transfers from an EVM-compatible blockchain to other supported
   * blockchain networks, including Stacks, Bitcoin, and other EVM-compatible chains. It verifies the validity of the transfer
   * route and retrieves bridge information based on the destination chain and tokens.
   *
   * @param input - An object containing the input parameters required for retrieving bridge information:
   * - `fromChain: ChainId` - The ID of the source blockchain (Stacks in this case).
   * - `toChain: ChainId` - The ID of the destination blockchain (Bitcoin, EVM-compatible chains, etc.).
   * - `fromToken: TokenId` - The token being transferred from the Stacks network.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `amount: SDKNumber` - The amount of tokens involved in the transfer.
   *
   * @returns A promise that resolves with an object containing detailed information about the token transfer, including:
   * - `fromChain: KnownChainId.KnownChain` - The source blockchain.
   * - `fromToken: KnownTokenId.KnownToken` - The token being transferred from the Stacks network.
   * - `toChain: KnownChainId.KnownChain` - The destination blockchain.
   * - `toToken: KnownTokenId.KnownToken` - The token expected on the destination chain.
   * - `fromAmount: SDKNumber` - The amount of tokens being transferred.
   * - `toAmount: SDKNumber` - The amount of tokens expected on the destination chain after the transfer.
   * - `feeAmount: SDKNumber` - The fee amount deducted during the transfer.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains or tokens is unsupported.
   */
  bridgeInfoFromEVM(
    input: BridgeInfoFromEVMInput,
  ): Promise<BridgeInfoFromEVMOutput> {
    return bridgeInfoFromEVM(this.sdkContext, input)
  }

  /**
   * This function facilitates the transfer of tokens from an EVM-compatible blockchain to other supported
   * blockchain networks, including Stacks, Bitcoin, and other EVM-compatible chains. It validates the
   * route and calls the appropriate bridging function based on the destination chain and tokens involved.
   *
   * @param input - An object containing the input parameters required for the bridging operation:
   * - `fromChain: ChainId` - The ID of the source blockchain (an EVM-compatible chain in this case).
   * - `toChain: ChainId` - The ID of the destination blockchain (Stacks, Bitcoin, or another EVM-compatible chain).
   * - `fromToken: TokenId` - The token being transferred from the EVM-compatible blockchain.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `fromAddress: string` - The sender's address on the source chain.
   * - `toAddress: string` - The recipient's address on the destination blockchain.
   * - `toAddressScriptPubKey?: Uint8Array` - The script public key for the `toAddress`, required when the destination is a Bitcoin chain.
   * - `amount: SDKNumber` - The amount of tokens to transfer.
   * - `sendTransaction` - // Implementation for sending transaction from EVM chain.
   *
   * @returns A promise that resolves with the transaction hash (`txHash`) of the bridging operation.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains or tokens is unsupported.
   */
  bridgeFromEVM(input: BridgeFromEVMInput): Promise<BridgeFromEVMOutput> {
    return bridgeFromEVM(this.sdkContext, input)
  }

  /**
   * This function retrieves a list of time-locked assets for a given wallet address across multiple EVM-compatible
   * blockchain networks. It queries smart contracts to find and return information about the assets that are
   * currently locked in time-based agreements.
   *
   * @param input - An object containing the input parameters required for retrieving time-locked assets:
   * - `walletAddress: EVMAddress` - The address of the wallet for which to retrieve the time-locked assets.
   * - `chains: KnownChainId.EVMChain[]` - An array of EVM-compatible blockchains to query for locked assets.
   *
   * @returns A promise that resolves with an object containing a list of time-locked assets:
   * - `assets: TimeLockedAsset[]` - An array of objects, each representing a time-locked asset, including:
   *   - `id: string` - The unique identifier of the time-locked agreement.
   *   - `chain: KnownChainId.EVMChain` - The blockchain where the asset is locked.
   *   - `token: KnownTokenId.EVMToken` - The token that is locked.
   *   - `amount: SDKNumber` - The amount of the token that is locked.
   *   - `releaseTime: Date` - The time when the asset is scheduled to be released.
   *
   * @throws UnsupportedChainError - If any of the provided EVM chains is unsupported or invalid.
   */
  getTimeLockedAssetsFromEVM(
    input: GetTimeLockedAssetsInput,
  ): Promise<GetTimeLockedAssetsOutput> {
    return getTimeLockedAssetsFromEVM(this.sdkContext, input)
  }

  /**
   * This function facilitates the claiming of time-locked assets on EVM-compatible chains. It uses smart
   * contract functions to execute the release of locked assets based on predefined conditions.
   *
   * @param input - An object containing the input parameters required for claiming time-locked assets:
   * - `chain: KnownChainId.EVMChain` - The ID of the EVM-compatible blockchain where the assets are locked.
   * - `lockedAssetIds: string[]` - An array of IDs representing the locked assets to be claimed.
   * - `sendTransaction` - // Implementation for sending transaction from EVM chain.
   *
   * @returns A promise that resolves with the transaction hash (`txHash`) of the claiming operation, or `undefined` if the operation fails.
   * @throws UnsupportedChainError - If the provided EVM chain is unsupported or invalid.
   */
  claimTimeLockedAssetsFromEVM(
    input: ClaimTimeLockedAssetsInput,
  ): Promise<undefined | ClaimTimeLockedAssetsOutput> {
    return claimTimeLockedAssetsFromEVM(this.sdkContext, input)
  }

  /**
   * Retrieves the BTC Peg-In address and its corresponding ScriptPubKey for a given Bitcoin source
   * chain (mainnet or testnet) and a specified destination chain.
   * This address is used to initiate a transfer (peg-in) from the Bitcoin network into the Brotocol.
   *
   * @param fromChain - The source Bitcoin chain (`Mainnet` or `Testnet`).
   * @param toChain - The destination chain (must be a known chain, although it is not used in address generation).
   *
   * @returns A promise that resolves with an object containing:
   * - `address`: the BTC Peg-In address to which the user should send BTC.
   * - `scriptPubKey`: the ScriptPubKey representation of the address.
   * Returns `undefined` if the provided chain is invalid or unsupported.
   */
  async bitcoinReceiverAddress(
    fromChain: ChainId,
    toChain: ChainId,
  ): Promise<undefined | { address: string; scriptPubKey: Uint8Array }> {
    if (!KnownChainId.isBitcoinChain(fromChain)) return
    if (!KnownChainId.isKnownChain(toChain)) return
    return getBTCPegInAddress(fromChain, toChain)
  }

  /**
   * This function provides detailed information about token transfers from the Bitcoin network to other supported
   * blockchain networks, including Stacks and EVM-compatible chains. It verifies the validity of the transfer route
   * and retrieves bridge information based on the destination chain.
   *
   * @param input - An object containing the input parameters required for retrieving bridge information:
   * - `fromChain: ChainId` - The ID of the source blockchain.
   * - `toChain: ChainId` - The ID of the destination blockchain (Stacks, EVM, etc.).
   * - `amount: SDKNumber` - The amount of tokens involved in the transfer.
   *
   * @returns A promise that resolves with an object containing detailed information about the token transfer, including:
   * - `fromChain: KnownChainId.KnownChain` - The source blockchain.
   * - `fromToken: KnownTokenId.KnownToken` - The token being transferred from the Bitcoin network.
   * - `toChain: KnownChainId.KnownChain` - The destination blockchain.
   * - `toToken: KnownTokenId.KnownToken` - The token expected on the destination chain.
   * - `fromAmount: SDKNumber` - The amount of tokens being transferred.
   * - `toAmount: SDKNumber` - The amount of tokens expected on the destination chain after the transfer.
   * - `feeAmount: SDKNumber` - The fee amount deducted during the transfer.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains is unsupported.
   */
  bridgeInfoFromBitcoin(
    input: BridgeInfoFromBitcoinInput,
  ): Promise<BridgeInfoFromBitcoinOutput> {
    return bridgeInfoFromBitcoin(this.sdkContext, input).catch(err => {
      if (err instanceof TooManyRequestsError) {
        throw new TooFrequentlyError(
          ["bridgeInfoFromBitcoin"],
          err.retryAfter,
          {
            cause: err,
          },
        )
      }
      throw err
    })
  }
  /**
   * This function estimates the transaction fee and vSize for move or swap tokens from the Bitcoin network
   * to other supported blockchain networks, including Stacks and EVM-compatible chains.
   *
   * @param input - An object containing the input parameters required for estimating the transaction:
   * - `fromChain: ChainId` - The ID of the source blockchain (Bitcoin in this case).
   * - `toChain: ChainId` - The ID of the destination blockchain (Stacks, EVM-compatible chains, etc.).
   * - `fromToken: TokenId` - The token being transferred from the Bitcoin network.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `fromAddress: string` - The source address on the Bitcoin network.
   * - `fromAddressScriptPubKey: Uint8Array` - The script public key of the source address.
   * - `toAddress: string` - The destination address on the target blockchain.
   * - `amount: SDKNumber` - The amount of tokens to be transferred.
   * - `networkFeeRate: bigint` - The fee rate for the Bitcoin network.
   * - `reselectSpendableUTXOs` - // Implementation for reselect UTXOs.
   *
   * @returns A promise that resolves with an object containing the estimated transaction details:
   * - `fee: SDKNumber` - The estimated transaction fee.
   * - `estimatedVSize: SDKNumber` - The estimated vSize of the transaction.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains or tokens is unsupported.
   */
  estimateBridgeTransactionFromBitcoin(
    input: EstimateBridgeTransactionFromBitcoinInput,
  ): Promise<EstimateBridgeTransactionFromBitcoinOutput> {
    return estimateBridgeTransactionFromBitcoin(this.sdkContext, input).catch(
      err => {
        if (err instanceof TooManyRequestsError) {
          throw new TooFrequentlyError(
            ["estimateBridgeTransactionFromBitcoin"],
            err.retryAfter,
            {
              cause: err,
            },
          )
        }
        throw err
      },
    )
  }
  /**
   * This function facilitates the transfer of tokens from the Bitcoin network to other supported
   * blockchain networks. It checks the validity of the route and then calls the appropriate
   * bridging function based on the destination chain.
   *
   * @param input - An object containing the input parameters required for the bridging operation:
   * - `fromChain: ChainId` - The ID of the source blockchain.
   * - `toChain: ChainId` - The ID of the destination blockchain (Stacks, EVM, etc.).
   * - `fromToken: TokenId` - The token being transferred from the Bitcoin network.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `fromAddress: string` - The source address on the Bitcoin network.
   * - `fromAddressScriptPubKey: Uint8Array` - The script public key corresponding to the `fromAddress`.
   * - `toAddress: string` - The recipient's address on the destination blockchain.
   * - `amount: SDKNumber` - The amount of tokens to transfer.
   * - `networkFeeRate: bigint` - The network fee rate to be used for the transaction.
   * - `reselectSpendableUTXOs: ReselectSpendableUTXOsFn`.
   * - `signPsbt: BridgeFromBitcoinInput_signPsbtFn`.
   *
   * @returns A promise that resolves with the transaction ID (`tx`) of the bridging operation.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains or tokens is unsupported.
   */
  bridgeFromBitcoin(
    input: BridgeFromBitcoinInput,
  ): Promise<BridgeFromBitcoinOutput> {
    return bridgeFromBitcoin(this.sdkContext, input).catch(err => {
      if (err instanceof TooManyRequestsError) {
        throw new TooFrequentlyError(["bridgeFromBitcoin"], err.retryAfter, {
          cause: err,
        })
      }
      throw err
    })
  }

  /**
   * This function provides detailed information about token transfers from BRC-20 compatible chains to other supported
   * blockchain networks, including Stacks, EVM-compatible chains, Bitcoin and Runes. It verifies the
   * validity of the transfer route and retrieves bridge information, including intermediary steps and fees.
   *
   * @param input - An object containing the input parameters required to retrieve bridge information:
   * - `fromChain: ChainId` – The source blockchain (must be a BRC-20-compatible chain).
   * - `toChain: ChainId` – The destination blockchain.
   * - `fromToken: TokenId` – The token being bridged from the source chain.
   * - `toToken: TokenId` – The token expected on the destination chain.
   * - `amount: SDKNumber` – The amount of tokens to bridge.
   * - `swapRoute?: SwapRoute_WithExchangeRate_Public` – Optional: a route to perform token swaps during the bridge.
   *
   * @returns A promise that resolves with detailed bridge information:
   * - `fromChain`, `toChain`, `fromToken`, `toToken` – Source and destination details.
   * - `fromAmount`, `toAmount` – Input and estimated output amounts.
   * - `fees` – A list of estimated fees applied to the bridge (fixed or rate-based).
   * - `isPaused`, `minBridgeAmount`, `maxBridgeAmount` – Status and constraints of the bridge route.
   * - `transferProphets` – A list of step-by-step bridge operations, including intermediary chains or swaps when applicable.
   *
   * @throws UnsupportedBridgeRouteError – If the route between the source and destination is not supported.
   */
  bridgeInfoFromBRC20(
    input: BridgeInfoFromBRC20Input,
  ): Promise<BridgeInfoFromBRC20Output> {
    return bridgeInfoFromBRC20(this.sdkContext, input).catch(err => {
      if (err instanceof TooManyRequestsError) {
        throw new TooFrequentlyError(["bridgeInfoFromBRC20"], err.retryAfter, {
          cause: err,
        })
      }
      throw err
    })
  }
  /**
   * This function estimates the transaction fee and vSize for transferring or swapping BRC-20 tokens
   * from a Bitcoin-based network to other supported blockchains, including Stacks, EVM-compatible chains,
   * Runes, or the Bitcoin network itself.
   *
   * @param input - An object containing the input parameters required for the transaction estimation:
   * - `fromChain: ChainId` - The ID of the source chain (must be a BRC-20 compatible chain).
   * - `fromToken: TokenId` - The token being bridged from the BRC-20 chain.
   * - `toChain: ChainId` - The ID of the target chain.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `fromAddress: string` - The sender's Bitcoin address.
   * - `fromAddressScriptPubKey: Uint8Array` - The script public key corresponding to the `fromAddress`.
   * - `toAddress: string` - The recipient's address on the destination chain.
   * - `toAddressScriptPubKey?: Uint8Array` - Required when bridging to a Bitcoin-based chain.
   * - `inputInscriptionUTXO: UTXOSpendable` - The UTXO containing the BRC-20 inscription to be bridged.
   * - `swapRoute?: SwapRoute_WithMinimumAmountsToReceive_Public` - Optional swap route if a token swap is involved before bridging.
   * - `networkFeeRate: bigint` - The desired network fee rate.
   * - `reselectSpendableNetworkFeeUTXOs: BridgeFromBRC20Input_reselectSpendableNetworkFeeUTXOs` - Function to reselect additional UTXOs for covering network fees.
   *
   * @returns A promise that resolves with estimated transaction parameters:
   * - `fee: SDKNumber` - The estimated total fee in satoshis.
   * - `estimatedVSize: SDKNumber` - The estimated virtual size of the transaction in vBytes.
   * - `revealTransactionSatoshiAmount?: SDKNumber` - Optional, the amount of satoshis used in the reveal transaction output.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains or tokens is not supported.
   * @throws InvalidMethodParametersError - If any required parameters are missing or invalid for the selected route.
   */
  estimateBridgeTransactionFromBRC20(
    input: EstimateBridgeTransactionFromBRC20Input,
  ): Promise<EstimateBridgeTransactionFromBRC20Output> {
    return estimateBridgeTransactionFromBRC20(this.sdkContext, input).catch(
      err => {
        if (err instanceof TooManyRequestsError) {
          throw new TooFrequentlyError(
            ["estimateBridgeTransactionFromBRC20"],
            err.retryAfter,
            {
              cause: err,
            },
          )
        }
        throw err
      },
    )
  }
  /**
   * This function facilitates the transfer of BRC-20 tokens from a BRC20-compatible network to other supported
   * blockchain networks such as Stacks, EVM-compatible, Bitcoin, or Runes chains.
   * It validates the provided route and delegates to the appropriate bridging logic depending on the destination.
   *
   * @param input - An object containing the input parameters required for the bridging operation:
   * - `fromChain: ChainId` - The ID of the source blockchain (must be a BRC20-compatible chain).
   * - `toChain: ChainId` - The ID of the destination blockchain (Stacks, EVM, Bitcoin, Runes, or another BRC20 chain).
   * - `fromToken: TokenId` - The BRC-20 token being transferred.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `fromAddress: string` - The sender's Bitcoin address.
   * - `fromAddressScriptPubKey: Uint8Array` - The script public key corresponding to the `fromAddress`.
   * - `toAddress: string` - The recipient's address on the destination blockchain.
   * - `toAddressScriptPubKey?: Uint8Array` - Required when the destination chain is Bitcoin, BRC20 or Runes.
   * - `inputInscriptionUTXO: UTXOSpendable` - The inscription UTXO holding the BRC-20 token to bridge.
   * - `networkFeeRate: bigint` - The fee rate for Bitcoin transaction construction.
   * - `swapRoute?: SwapRoute_WithMinimumAmountsToReceive_Public` - Optional swap configuration for token conversion.
   * Functions to be provided by the developer:
   * - `reselectSpendableNetworkFeeUTXOs: BridgeFromBRC20Input_reselectSpendableNetworkFeeUTXOs` - Function to fetch additional UTXOs for network fee.
   * - `signPsbt: BridgeFromBRC20Input_signPsbtFn` - Function to sign the PSBT (Partially Signed Bitcoin Transaction).
   * - `sendTransaction` - Function used to broadcast the final signed transaction.
   *
   * @returns A promise that resolves with the Bitcoin transaction ID (`txid`) of the bridging operation.
   *
   * @throws `TooManyRequestsError` - is received from the backend API.
   * @throws `UnsupportedBridgeRouteError` - If the combination of `fromChain`, `toChain`, `fromToken`, and `toToken` is unsupported.
   * @throws `InvalidMethodParametersError` - If required parameters are missing.
   * @throws `BridgeValidateFailedError` - If the bridge order validation fails.
   */
  bridgeFromBRC20(input: BridgeFromBRC20Input): Promise<BridgeFromBRC20Output> {
    return bridgeFromBRC20(this.sdkContext, input).catch(err => {
      if (err instanceof TooManyRequestsError) {
        throw new TooFrequentlyError(["bridgeFromBRC20"], err.retryAfter, {
          cause: err,
        })
      }
      throw err
    })
  }
  /**
   * Retrieves the BRC20 tick (e.g., "ordi", "pepe") associated with a known BRC20 token ID
   * on a specific BRC20-compatible blockchain in the SDK.
   * Internally, this function looks up the list of supported BRC20 tokens on the given chain
   * and returns the `brc20Tick` value corresponding to the provided `KnownTokenId.BRC20Token`.
   *
   * @param chain - The blockchain network (must be a valid BRC20 chain, like `brc20-mainnet` or `brc20-testnet`).
   * @param token - The known BRC20 token identifier (must follow the `brc20-<tick>` format).
   *
   * @returns A promise that resolves with the corresponding BRC20 tick string, or `undefined`
   * if the token is not found or the chain is not supported.
   */
  brc20TickFromBRC20Token(
    chain: ChainId,
    token: KnownTokenId.BRC20Token,
  ): Promise<undefined | string> {
    return brc20TickFromBRC20Token(this.sdkContext, chain, token)
  }
  /**
   * Retrieves the `KnownTokenId.BRC20Token` corresponding to a given BRC20 tick
   * on a specific BRC20-compatible blockchain.
   * This function performs a case-insensitive match of the provided tick against
   * the list of supported BRC20 tokens on the given chain.
   *
   * Always use this function to obtain a BRC20 token ID at runtime.
   * Do not construct TokenId values manually, as supported tokens may change dynamically.
   *
   * @param chain - The blockchain network to search in (must be a BRC20-compatible chain such as `brc20-mainnet` or `brc20-testnet`).
   * @param tick - The BRC20 tick (e.g., "ordi", "pepe") to look up.
   *
   * @returns A promise that resolves with the associated `KnownTokenId.BRC20Token`,
   * or `undefined` if no match is found or the chain is not supported.
   *
   * @remarks Developers should always use this function to obtain a BRC20 token ID at runtime.
   * Never construct `TokenId` values manually, as the supported token list may change dynamically.
   */
  brc20TickToBRC20Token(
    chain: ChainId,
    tick: string,
  ): Promise<undefined | KnownTokenId.BRC20Token> {
    return brc20TickToBRC20Token(this.sdkContext, chain, tick)
  }
  /**
   * This function provides detailed information about bridging a token from the Runes protocol to other supported
   * blockchain networks including Stacks, EVM, Bitcoin or BRC-20. It validates the compatibility
   * of the route and determines fees, transfer amount, and route steps required to complete the bridge.
   *
   * @param input - An object containing the input parameters required to retrieve bridge information:
   * - `fromChain: ChainId` – The source blockchain (must be a Runes-compatible chain).
   * - `toChain: ChainId` – The destination blockchain.
   * - `fromToken: TokenId` – The token being bridged from the source chain.
   * - `toToken: TokenId` – The token expected on the destination chain.
   * - `amount: SDKNumber` – The amount of tokens to bridge.
   * - `swapRoute?: SwapRoute_WithExchangeRate_Public` – Optional: a route to perform token swaps during the bridge.
   *
   * @returns A promise that resolves with detailed bridge information:
   * - `fromChain`, `toChain`, `fromToken`, `toToken` – Source and destination details.
   * - `fromAmount`, `toAmount` – Input and estimated output amounts.
   * - `fees` – A list of estimated fees applied to the bridge (fixed or rate-based).
   * - `isPaused`, `minBridgeAmount`, `maxBridgeAmount` – Status and constraints of the bridge route.
   * - `transferProphets` – A list of step-by-step bridge operations, including intermediary chains or swaps when applicable.
   *
   * @throws UnsupportedBridgeRouteError – If the route between the source and destination is not supported.
   */
  bridgeInfoFromRunes(
    input: BridgeInfoFromRunesInput,
  ): Promise<BridgeInfoFromRunesOutput> {
    return bridgeInfoFromRunes(this.sdkContext, input).catch(err => {
      if (err instanceof TooManyRequestsError) {
        throw new TooFrequentlyError(["bridgeInfoFromRunes"], err.retryAfter, {
          cause: err,
        })
      }
      throw err
    })
  }
  /**
   * This function estimates the transaction fee and vSize for bridging Rune tokens from the Runes protocol
   * to other supported blockchain networks such as Stacks, EVM-compatible chains, or BRC-20 destination.
   *
   * @param input - An object containing the input parameters required for estimating the transaction:
   * - `fromChain: ChainId` - The ID of the source blockchain (a Runes-compatible Bitcoin chain).
   * - `toChain: ChainId` - The ID of the destination blockchain.
   * - `fromToken: TokenId` - The Rune token being transferred from the source.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `fromAddress: string` - The source Bitcoin address that holds the Rune token.
   * - `fromAddressScriptPubKey: Uint8Array` - The script public key corresponding to the source address.
   * - `toAddress: string` - The destination address on the target blockchain.
   * - `toAddressScriptPubKey?: Uint8Array` - The script public key for the destination address, required when the destination is a Bitcoin-based chain.
   * - `amount: SDKNumber` - The amount of Rune tokens to transfer.
   * - `inputRuneUTXOs: RunesUTXOSpendable[]` - The list of Rune UTXOs used as inputs.
   * - `networkFeeRate: bigint` - The fee rate to use for Bitcoin transaction construction.
   * - `swapRoute?: SwapRoute_WithMinimumAmountsToReceive_Public` - Optional swap route to use in case token conversion is needed.
   * - `reselectSpendableNetworkFeeUTXOs: BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs` - A function to reselect network fee UTXOs when needed.
   *
   * @returns A promise that resolves with an object containing estimated transaction data:
   * - `fee: SDKNumber` - The estimated total fee in satoshis for the bridging operation.
   * - `estimatedVSize: SDKNumber` - The estimated vSize of the transaction in bytes.
   * - `revealTransactionSatoshiAmount?: SDKNumber` - (Optional) The satoshi amount associated with the reveal transaction used to complete the bridge.
   *
   * @throws UnsupportedBridgeRouteError - If the route between the source and destination tokens or chains is not supported.
   * @throws InvalidMethodParametersError - If required parameters are missing.
   */
  estimateBridgeTransactionFromRunes(
    input: EstimateBridgeTransactionFromRunesInput,
  ): Promise<EstimateBridgeTransactionFromRunesOutput> {
    return estimateBridgeTransactionFromRunes(this.sdkContext, input).catch(
      err => {
        if (err instanceof TooManyRequestsError) {
          throw new TooFrequentlyError(
            ["estimateBridgeTransactionFromRunes"],
            err.retryAfter,
            {
              cause: err,
            },
          )
        }
        throw err
      },
    )
  }
  /**
   * This function facilitates the transfer of tokens from the Runes protocol to other supported
   * blockchain networks. It validates the route using internal logic and delegates the transaction
   * construction and broadcasting based on the destination chain.
   *
   * @param input - An object containing the input parameters required for the bridging operation:
   * - `fromChain: ChainId` - The ID of the source blockchain (must be a Runes chain).
   * - `toChain: ChainId` - The ID of the destination blockchain (Stacks, EVM, Bitcoin or BRC20).
   * - `fromToken: TokenId` - The token being transferred from the Runes chain.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `fromAddress: string` - The sender's address on the Runes chain.
   * - `fromAddressScriptPubKey: Uint8Array` - The script public key for `fromAddress`.
   * - `toAddress: string` - The recipient's address on the destination blockchain.
   * - `toAddressScriptPubKey?: Uint8Array` - Required when the destination chain is Bitcoin or BRC20.
   * - `amount: SDKNumber` - The amount of tokens to transfer.
   * - `inputRuneUTXOs: RunesUTXOSpendable[]` - UTXOs containing the Runes to be spent.
   * - `networkFeeRate: bigint` - The Bitcoin network fee rate to be used for the transaction.
   * - `swapRoute?: SwapRoute_WithMinimumAmountsToReceive_Public` - Optional swap route for token conversion before bridging.
   * Functions to be provided by the developer:
   * - `reselectSpendableNetworkFeeUTXOs: BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs` - Callback to reselect UTXOs for network fee.
   * - `signPsbt` - Callback function to sign the PSBT (Partially Signed Bitcoin Transaction).
   * - `sendTransaction` - Callback function to broadcast the signed transaction.
   *
   * @returns A promise that resolves with the transaction ID (`txid`) of the bridging operation.
   *
   * @throws UnsupportedBridgeRouteError - If the route is not supported.
   * @throws InvalidMethodParametersError - If required parameters are missing or invalid.
   * @throws TooFrequentlyError - If the operation is rate-limited due to excessive requests.
   */
  bridgeFromRunes(input: BridgeFromRunesInput): Promise<BridgeFromRunesOutput> {
    return bridgeFromRunes(this.sdkContext, input).catch(err => {
      if (err instanceof TooManyRequestsError) {
        throw new TooFrequentlyError(["bridgeFromRunes"], err.retryAfter, {
          cause: err,
        })
      }
      throw err
    })
  }
  /**
   * Retrieves the `RuneIdCombined` associated with a known Runes token on a specific Runes-compatible blockchain.
   * Internally, this function queries the list of supported Runes tokens for the specified chain,
   * and looks up the `runesId` that corresponds to the provided `KnownTokenId.RunesToken`.
   *
   * @param chain - The Runes-compatible blockchain (`runes-mainnet` or `runes-testnet`) to search in.
   * @param token - The known Runes token ID (must follow the `runes-<id>` format).
   *
   * @returns A promise that resolves with the corresponding `RuneIdCombined` if found,
   * or `undefined` if the token is not supported or the chain is invalid.
   */
  runesIdFromRunesToken(
    chain: ChainId,
    token: KnownTokenId.RunesToken,
  ): Promise<undefined | RuneIdCombined> {
    return runesIdFromRunesToken(this.sdkContext, chain, token)
  }
  /**
   * Retrieves the `KnownTokenId.RunesToken` associated with a given `RuneIdCombined`
   * on a specific Runes-compatible blockchain.
   * This function queries the list of supported Runes tokens for the specified chain,
   * and returns the known Runes token ID mapped to the provided `runesId`.
   *
   * Always use this function to retrieve a `RunesToken` ID at runtime.
   * Do not hardcode or cache token IDs, as supported tokens may change dynamically.
   *
   * @param chain - The Runes-compatible blockchain (`runes-mainnet` or `runes-testnet`) to search in.
   * @param id - The `RuneIdCombined` representing the unique Runes asset identifier.
   *
   * @returns A promise that resolves with the corresponding `KnownTokenId.RunesToken`,
   * or `undefined` if the ID is not recognized or the chain is not supported.
   */
  runesIdToRunesToken(
    chain: ChainId,
    id: RuneIdCombined,
  ): Promise<undefined | KnownTokenId.RunesToken> {
    return runesIdToRunesToken(this.sdkContext, chain, id)
  }

  /**
   * This function retrieves the Stacks token ID corresponding to a given Tron token on a specific Tron chain.
   * It queries the list of supported Tron tokens for the specified chain and returns the corresponding Stacks token.
   *
   * @param chain - The Tron chain to search in (must be a Tron chain like `tron-mainnet` or `tron-testnet`).
   * @param token - The Tron token ID to look up.
   *
   * @returns A promise that resolves with the corresponding Stacks token ID if found,
   * or `undefined` if the token is not supported or the chain is invalid.
   */
  async tronTokenToStacksToken(
    chain: ChainId,
    token: KnownTokenId.TronToken,
  ): Promise<undefined | KnownTokenId.StacksToken> {
    if (!KnownChainId.isTronChain(chain)) return
    return tronTokenToCorrespondingStacksToken(this.sdkContext, chain, token)
  }

  /**
   * This function retrieves all Tron tokens corresponding to a given Stacks token on a specific Tron chain.
   * It queries the list of supported Tron tokens for the specified chain and returns all matching Tron tokens.
   *
   * @param chain - The Tron chain to search in (must be a Tron chain like `tron-mainnet` or `tron-testnet`).
   * @param token - The Stacks token ID to look up.
   *
   * @returns A promise that resolves with an array of corresponding Tron token IDs if found,
   * or an empty array if no matches are found or the chain is invalid.
   */
  async stacksTokenToTronTokens(
    chain: ChainId,
    token: KnownTokenId.StacksToken,
  ): Promise<KnownTokenId.TronToken[]> {
    if (!KnownChainId.isTronChain(chain)) return []
    return tronTokenFromCorrespondingStacksToken(this.sdkContext, chain, token)
  }

  /**
   * This function retrieves the Stacks token ID corresponding to a given Solana token on a specific Solana chain.
   * It queries the list of supported Solana tokens for the specified chain and returns the corresponding Stacks token.
   *
   * @param chain - The Solana chain to search in (must be a Solana chain like `solana-mainnet` or `solana-testnet`).
   * @param token - The Solana token ID to look up.
   *
   * @returns A promise that resolves with the corresponding Stacks token ID if found,
   * or `undefined` if the token is not supported or the chain is invalid.
   */
  async solanaTokenToStacksToken(
    chain: ChainId,
    token: KnownTokenId.SolanaToken,
  ): Promise<undefined | KnownTokenId.StacksToken> {
    if (!KnownChainId.isSolanaChain(chain)) return
    return solanaTokenToCorrespondingStacksToken(this.sdkContext, chain, token)
  }

  /**
   * This function retrieves all Solana tokens corresponding to a given Stacks token on a specific Solana chain.
   * It queries the list of supported Solana tokens for the specified chain and returns all matching Solana tokens.
   *
   * @param chain - The Solana chain to search in (must be a Solana chain like `solana-mainnet` or `solana-testnet`).
   * @param token - The Stacks token ID to look up.
   *
   * @returns A promise that resolves with an array of corresponding Solana token IDs if found,
   * or an empty array if no matches are found or the chain is invalid.
   */
  async stacksTokenToSolanaTokens(
    chain: ChainId,
    token: KnownTokenId.StacksToken,
  ): Promise<KnownTokenId.SolanaToken[]> {
    if (!KnownChainId.isSolanaChain(chain)) return []
    return solanaTokenFromCorrespondingStacksToken(this.sdkContext, chain, token)
  }

  /**
   * Retrieves the `KnownTokenId.SolanaToken` associated with a given Solana token address
   * on a specific Solana blockchain.
   * This function queries the list of supported Solana tokens for the specified chain,
   * and returns the known Solana token ID mapped to the provided token address.
   *
   * Always use this function to retrieve a `SolanaToken` ID at runtime.
   * Do not hardcode or cache token IDs, as supported tokens may change dynamically.
   *
   * @param chain - The Solana blockchain (`solana-mainnet` or `solana-testnet`) to search in.
   * @param address - The Solana token address to look up.
   *
   * @returns A promise that resolves with the corresponding `KnownTokenId.SolanaToken`,
   * or `undefined` if the address is not recognized or the chain is not supported.
   */
  async solanaTokenAddressToSolanaToken(
    chain: ChainId,
    address: string,
  ): Promise<undefined | KnownTokenId.SolanaToken> {
    if (!KnownChainId.isSolanaChain(chain)) return
    const routes = await getSolanaSupportedRoutes(this.sdkContext, chain)
    return routes.find((r: SolanaSupportedRoute) => r.solanaTokenAddress === address)?.solanaToken
  }

  /**
   * Retrieves the `KnownTokenId.TronToken` associated with a given Tron token address
   * on a specific Tron blockchain.
   * This function queries the list of supported Tron tokens for the specified chain,
   * and returns the known Tron token ID mapped to the provided token address.
   *
   * Always use this function to retrieve a `TronToken` ID at runtime.
   * Do not hardcode or cache token IDs, as supported tokens may change dynamically.
   *
   * @param chain - The Tron blockchain (`tron-mainnet` or `tron-testnet`) to search in.
   * @param address - The Tron token address to look up.
   *
   * @returns A promise that resolves with the corresponding `KnownTokenId.TronToken`,
   * or `undefined` if the address is not recognized or the chain is not supported.
   */
  async tronTokenAddressToTronToken(
    chain: ChainId,
    address: string,
  ): Promise<undefined | KnownTokenId.TronToken> {
    if (!KnownChainId.isTronChain(chain)) return
    const routes = await getTronSupportedRoutes(this.sdkContext, chain)
    return routes.find((r: TronSupportedRoute) => r.tronTokenAddress === address)?.tronToken
  }

  /**
   * Retrieves the Solana token address associated with a given `KnownTokenId.SolanaToken`
   * on a specific Solana blockchain.
   * This function queries the list of supported Solana tokens for the specified chain,
   * and returns the token address mapped to the provided Solana token ID.
   *
   * Always use this function to retrieve a Solana token address at runtime.
   * Do not hardcode or cache token addresses, as supported tokens may change dynamically.
   *
   * @param chain - The Solana blockchain (`solana-mainnet` or `solana-testnet`) to search in.
   * @param token - The Solana token ID to look up.
   *
   * @returns A promise that resolves with the corresponding Solana token address,
   * or `undefined` if the token is not recognized or the chain is not supported.
   */
  async solanaTokenToSolanaTokenAddress(
    chain: ChainId,
    token: KnownTokenId.SolanaToken,
  ): Promise<undefined | string> {
    if (!KnownChainId.isSolanaChain(chain)) return
    const routes = await getSolanaSupportedRoutes(this.sdkContext, chain)
    return routes.find((r: SolanaSupportedRoute) => r.solanaToken === token)?.solanaTokenAddress
  }

  /**
   * Retrieves the Tron token address associated with a given `KnownTokenId.TronToken`
   * on a specific Tron blockchain.
   * This function queries the list of supported Tron tokens for the specified chain,
   * and returns the token address mapped to the provided Tron token ID.
   *
   * Always use this function to retrieve a Tron token address at runtime.
   * Do not hardcode or cache token addresses, as supported tokens may change dynamically.
   *
   * @param chain - The Tron blockchain (`tron-mainnet` or `tron-testnet`) to search in.
   * @param token - The Tron token ID to look up.
   *
   * @returns A promise that resolves with the corresponding Tron token address,
   * or `undefined` if the token is not recognized or the chain is not supported.
   */
  async tronTokenToTronTokenAddress(
    chain: ChainId,
    token: KnownTokenId.TronToken,
  ): Promise<undefined | string> {
    if (!KnownChainId.isTronChain(chain)) return
    const routes = await getTronSupportedRoutes(this.sdkContext, chain)
    return routes.find((r: TronSupportedRoute) => r.tronToken === token)?.tronTokenAddress
  }

  /**
   * This function provides detailed information about token transfers from the Solana network to other supported
   * blockchain networks, including Stacks, EVM-compatible chains, Bitcoin, BRC-20, Runes, and other Solana chains.
   * It verifies the validity of the transfer route and retrieves bridge information based on the destination chain and tokens.
   *
   * @param input - An object containing the input parameters required for retrieving bridge information:
   * - `fromChain: ChainId` - The ID of the source blockchain (Solana in this case).
   * - `toChain: ChainId` - The ID of the destination blockchain (Stacks, EVM, Bitcoin, etc.).
   * - `fromToken: TokenId` - The token being transferred from the Solana network.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `amount: SDKNumber` - The amount of tokens involved in the transfer.
   *
   * @returns A promise that resolves with an object containing detailed information about the token transfer, including:
   * - `fromChain: KnownChainId.KnownChain` - The source blockchain.
   * - `fromToken: KnownTokenId.KnownToken` - The token being transferred from the Solana network.
   * - `toChain: KnownChainId.KnownChain` - The destination blockchain.
   * - `toToken: KnownTokenId.KnownToken` - The token expected on the destination chain.
   * - `fromAmount: SDKNumber` - The amount of tokens being transferred.
   * - `toAmount: SDKNumber` - The amount of tokens expected on the destination chain after the transfer.
   * - `feeAmount: SDKNumber` - The fee amount deducted during the transfer.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains or tokens is unsupported.
   */
  bridgeInfoFromSolana(
    input: BridgeInfoFromSolanaInput,
  ): Promise<BridgeInfoFromSolanaOutput> {
    return bridgeInfoFromSolana(this.sdkContext, input)
  }

  /**
   * This function facilitates the transfer of tokens from the Solana network to other supported
   * blockchain networks, including Stacks, EVM-compatible chains, Bitcoin, BRC-20, Runes, and other Solana chains.
   * It validates the route and calls the appropriate bridging function based on the destination chain and tokens involved.
   *
   * @param input - An object containing the input parameters required for the bridging operation:
   * - `fromChain: ChainId` - The ID of the source blockchain (Solana in this case).
   * - `toChain: ChainId` - The ID of the destination blockchain (Stacks, EVM, Bitcoin, etc.).
   * - `fromToken: TokenId` - The token being transferred from the Solana network.
   * - `toToken: TokenId` - The token expected on the destination chain.
   * - `fromAddress: string` - The sender's address on the Solana network.
   * - `toAddress: string` - The recipient's address on the destination blockchain.
   * - `toAddressScriptPubKey?: Uint8Array` - Required when the destination is a Bitcoin-based chain.
   * - `amount: SDKNumber` - The amount of tokens to transfer.
   * - `sendTransaction` - Function to send the transaction on the Solana network.
   *
   * @returns A promise that resolves with the transaction hash (`txHash`) of the bridging operation.
   *
   * @throws UnsupportedBridgeRouteError - If the provided route between the source and destination
   * chains or tokens is unsupported.
   * @throws InvalidMethodParametersError - If required parameters are missing or invalid.
   */
  bridgeFromSolana(
    input: BridgeFromSolanaInput,
  ): Promise<BridgeFromSolanaOutput> {
    return bridgeFromSolana(this.sdkContext, input)
  }
}

async function stacksAddressFromStacksToken(
  sdkContext: SDKGlobalContext,
  chain: ChainId,
  token: KnownTokenId.StacksToken,
): Promise<undefined | StacksContractAddress> {
  if (!KnownChainId.isStacksChain(chain)) return
  const info = await getStacksTokenContractInfo(sdkContext, chain, token)
  if (info == null) return
  return {
    deployerAddress: info.deployerAddress,
    contractName: info.contractName,
  }
}

async function stacksAddressToStacksToken(
  sdkContext: SDKGlobalContext,
  chain: ChainId,
  address: StacksContractAddress,
): Promise<undefined | KnownTokenId.StacksToken> {
  if (!KnownChainId.isStacksChain(chain)) return
  return getStacksToken(sdkContext, chain, address)
}

async function brc20TickFromBRC20Token(
  sdkContext: SDKGlobalContext,
  chain: ChainId,
  token: KnownTokenId.BRC20Token,
): Promise<undefined | string> {
  if (!KnownChainId.isBRC20Chain(chain)) return
  const routes = await getBRC20SupportedRoutes(sdkContext, chain)
  return routes.find(r => r.brc20Token === token)?.brc20Tick
}
async function brc20TickToBRC20Token(
  sdkContext: SDKGlobalContext,
  chain: ChainId,
  tick: string,
): Promise<undefined | KnownTokenId.BRC20Token> {
  if (!KnownChainId.isBRC20Chain(chain)) return
  const routes = await getBRC20SupportedRoutes(sdkContext, chain)
  return routes.find(r => r.brc20Tick.toLowerCase() === tick.toLowerCase())
    ?.brc20Token
}

async function runesIdFromRunesToken(
  sdkContext: SDKGlobalContext,
  chain: ChainId,
  token: KnownTokenId.RunesToken,
): Promise<undefined | RuneIdCombined> {
  if (!KnownChainId.isRunesChain(chain)) return
  const routes = await getRunesSupportedRoutes(sdkContext, chain)
  return routes.find(r => r.runesToken === token)?.runesId
}
async function runesIdToRunesToken(
  sdkContext: SDKGlobalContext,
  chain: ChainId,
  runesId: RuneIdCombined,
): Promise<undefined | KnownTokenId.RunesToken> {
  if (!KnownChainId.isRunesChain(chain)) return
  const routes = await getRunesSupportedRoutes(sdkContext, chain)
  return routes.find(r => r.runesId === runesId)?.runesToken
}
