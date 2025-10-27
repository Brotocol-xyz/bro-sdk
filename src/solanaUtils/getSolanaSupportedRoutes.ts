import { getStacksToken } from "../stacksUtils/contractHelpers"
import { requestAPI } from "../utils/apiHelpers"
import { BigNumber } from "../utils/BigNumber"
import { isNotNull } from "../utils/typeHelpers"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { StacksContractAddress } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { SolanaSupportedRoute, SolanaSupportedRoutesAndConfig, SolanaConfig } from "./types"

type NetworkType = "mainnet" | "testnet"

async function _getSolanaSupportedRoutesAndConfig(
  sdkContext: SDKGlobalContext,
  network: NetworkType
): Promise<SolanaSupportedRoutesAndConfig> {
  const stacksChain =
    network === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet

  const resp = await requestAPI<{ routes: SupportedSolanaBridgeRoute[], solanaConfig: SolanaConfig }>(
    sdkContext,
    {
      method: "GET",
      path: "/2024-10-01/solana/supported-routes",
      query: {
        network,
      },
    },
  )

  const routes = await Promise.all(
    resp.routes.map(async (route): Promise<null | SolanaSupportedRoute> => {
      const solanaToken = KnownTokenId.createSolanaToken(route.tokenAddress)
      const stacksToken = await getStacksToken(
        sdkContext,
        stacksChain,
        route.stacksTokenContractAddress,
      )

      if (stacksToken == null) return null
      if (!KnownTokenId.isSolanaToken(solanaToken)) return null

      return {
        solanaToken,
        solanaTokenAddress: route.tokenAddress,
        stacksChain,
        stacksToken,
        proxyStacksTokenContractAddress: route.proxyStacksTokenContractAddress,
        pegOutFeeRate: BigNumber.from(route.pegOutFeeRate),
        pegOutMinFeeAmount:
          route.pegOutMinFeeAmount == null
            ? null
            : BigNumber.from(route.pegOutMinFeeAmount),
        pegOutMinAmount:
          route.pegOutMinAmount == null
            ? null
            : BigNumber.from(route.pegOutMinAmount),
        pegOutMaxAmount:
          route.pegOutMaxAmount == null
            ? null
            : BigNumber.from(route.pegOutMaxAmount),
      }
    }),
  )

  return {
    routes: routes.filter(isNotNull),
    solanaConfig: resp.solanaConfig
  }
}

export async function getSolanaSupportedRoutesAndConfigByNetwork(
  sdkContext: SDKGlobalContext,
  network: "mainnet" | "testnet"
): Promise<SolanaSupportedRoutesAndConfig> {
  const cacheKey = network;
  if (
    sdkContext.solana.routesConfigCache != null &&
    sdkContext.solana.routesConfigCache.get(cacheKey) != null
  ) {
    return sdkContext.solana.routesConfigCache.get(cacheKey)!;
  }

  const promise = _getSolanaSupportedRoutesAndConfig(sdkContext, network).catch(err => {
    const cachedPromise = sdkContext.solana.routesConfigCache?.get(cacheKey);
    if (promise === cachedPromise) {
      sdkContext.solana.routesConfigCache?.delete(cacheKey);
    }
    throw err;
  });
  sdkContext.solana.routesConfigCache?.set(cacheKey, promise);
  return promise;
}

// Backward compatible function
export async function getSolanaSupportedRoutesByNetwork(
  sdkContext: SDKGlobalContext,
  network: "mainnet" | "testnet"
): Promise<SolanaSupportedRoute[]> {
  const result = await getSolanaSupportedRoutesAndConfigByNetwork(sdkContext, network);
  return result.routes;
}

export async function getSolanaSupportedRoutes(
  sdkContext: SDKGlobalContext,
  chainId: KnownChainId.SolanaChain
): Promise<SolanaSupportedRoute[]> {
  const network = chainId === KnownChainId.Solana.Mainnet ? "mainnet" : "testnet";
  return getSolanaSupportedRoutesByNetwork(sdkContext, network);
}

/**
 * Get Solana configuration for a specific network
 * @param sdkContext The SDK context
 * @param network The network to get configuration for
 * @returns The Solana configuration
 */
export async function getSolanaConfigsByNetwork(
  sdkContext: SDKGlobalContext,
  network: "mainnet" | "testnet"
): Promise<SolanaConfig> {
  const result = await getSolanaSupportedRoutesAndConfigByNetwork(sdkContext, network);
  return result.solanaConfig;
}

/**
 * Get Solana configuration for a specific chain ID
 * @param sdkContext The SDK context
 * @param chainId The chain ID to get configuration for
 * @returns The Solana configuration
 */
export async function getSolanaConfigs(
  sdkContext: SDKGlobalContext,
  chainId: KnownChainId.SolanaChain
): Promise<SolanaConfig> {
  const network = chainId === KnownChainId.Solana.Mainnet ? "mainnet" : "testnet";
  return getSolanaConfigsByNetwork(sdkContext, network);
}

interface SupportedSolanaBridgeRoute {
  tokenAddress: string
  stacksTokenContractAddress: StacksContractAddress
  proxyStacksTokenContractAddress: null | StacksContractAddress
  pegOutFeeRate: `${number}`
  pegOutMinFeeAmount: null | `${number}`
  pegOutMinAmount: null | `${number}`
  pegOutMaxAmount: null | `${number}`
} 