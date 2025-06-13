import { Client } from "viem"
import { EVMOnChainConfigByEVMChain } from "../evmUtils/apiHelpers/getEVMOnChainConfig"
import { EVMSupportedRoute } from "../evmUtils/apiHelpers/getEVMSupportedRoutes"
import type { BRC20SupportedRoute } from "../metaUtils/apiHelpers/getBRC20SupportedRoutes"
import type { RunesSupportedRoute } from "../metaUtils/apiHelpers/getRunesSupportedRoutes"
import { SolanaSupportedRoutesAndConfig, TokenConfigAccount } from "../solanaUtils/types"
import { StacksTokenInfo } from "../stacksUtils/apiHelpers/getAllStacksTokens"
import { TronSupportedRoute } from "../tronUtils/types"
import { DefinedRoute, KnownRoute } from "../utils/buildSupportedRoutes"
import { pMemoizeImpl } from "../utils/pMemoize"
import { GeneralCacheInterface } from "../utils/types/GeneralCacheInterface"
import { KnownChainId } from "../utils/types/knownIds"
import { TransferProphet } from "../utils/types/TransferProphet"

export interface SDKGlobalContextCache<K, V>
  extends GeneralCacheInterface<K, V> {}

export function withGlobalContextCache<K, V>(
  cache: undefined | SDKGlobalContextCache<K, Promise<V>>,
  cacheKey: K,
  promiseFactory: () => Promise<V>,
): Promise<V> {
  if (cache == null) return promiseFactory()
  return pMemoizeImpl(cache, cacheKey, promiseFactory)
}
export namespace withGlobalContextCache {
  export const cacheKeyFromRoute = (route: DefinedRoute): string => {
    return `${route.fromChain}:${route.fromToken}:${route.toChain}:${route.toToken}`
  }
}

export interface SDKGlobalContext {
  debugLog: boolean
  routes: {
    detectedCache: SDKGlobalContextCache<"mainnet" | "testnet", KnownRoute[]>
  }
  backendAPI: {
    runtimeEnv: "prod" | "dev" | "beta" | "next" | "preview" | "local"
  }
  stacks: {
    tokensCache?: SDKGlobalContextCache<
      KnownChainId.StacksChain,
      Promise<StacksTokenInfo[]>
    >
  }
  btc: {
    ignoreValidateResult?: boolean
    feeRateCache?: SDKGlobalContextCache<
      string,
      Promise<undefined | TransferProphet>
    >
  }
  brc20: {
    ignoreValidateResult?: boolean
    feeRateCache?: SDKGlobalContextCache<
      string,
      Promise<undefined | TransferProphet>
    >
    routesConfigCache?: SDKGlobalContextCache<
      KnownChainId.BRC20Chain,
      Promise<BRC20SupportedRoute[]>
    >
  }
  runes: {
    ignoreValidateResult?: boolean
    feeRateCache?: SDKGlobalContextCache<
      string,
      Promise<undefined | TransferProphet>
    >
    routesConfigCache?: SDKGlobalContextCache<
      KnownChainId.RunesChain,
      Promise<RunesSupportedRoute[]>
    >
  }
  evm: {
    enableMulticall?: boolean
    feeRateCache?: SDKGlobalContextCache<
      string,
      Promise<undefined | TransferProphet>
    >
    routesConfigCache?: SDKGlobalContextCache<
      "mainnet" | "testnet",
      Promise<EVMSupportedRoute[]>
    >
    onChainConfigCache?: SDKGlobalContextCache<
      "mainnet" | "testnet",
      Promise<EVMOnChainConfigByEVMChain>
    >
    viemClients: Partial<Record<KnownChainId.EVMChain, Client>>
  }
  tron: {
    routesConfigCache?: SDKGlobalContextCache<
      "mainnet" | "testnet",
      Promise<TronSupportedRoute[]>
    >
  }
  solana: {
    routesConfigCache?: SDKGlobalContextCache<
      "mainnet" | "testnet",
      Promise<SolanaSupportedRoutesAndConfig>
    >
    feeRateCache?: SDKGlobalContextCache<
      string,
      Promise<undefined | TransferProphet>
    >
    tokenConfigCache?: SDKGlobalContextCache<
      string,
      Promise<TokenConfigAccount>
    >
  }
}
