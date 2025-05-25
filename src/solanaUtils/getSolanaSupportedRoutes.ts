import { getStacksToken } from "../stacksUtils/contractHelpers"
import { requestAPI } from "../utils/apiHelpers"
import { BigNumber } from "../utils/BigNumber"
import { isNotNull } from "../utils/typeHelpers"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { StacksContractAddress } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { SolanaSupportedRoute } from "./types"

type NetworkType = "mainnet" | "testnet"

export async function getSolanaSupportedRoutes(
  sdkContext: SDKGlobalContext,
  toChain: KnownChainId.SolanaChain,
): Promise<SolanaSupportedRoute[]> {
  return getSolanaSupportedRoutesByNetwork(sdkContext, toChain === KnownChainId.Solana.Mainnet ? "mainnet" : "testnet")
}

async function getSolanaSupportedRoutesByNetwork(
  sdkContext: SDKGlobalContext,
  network: NetworkType,
): Promise<SolanaSupportedRoute[]> {
  const cacheKey = network
  if (
    sdkContext.solana.routesConfigCache != null &&
    sdkContext.solana.routesConfigCache.get(cacheKey) != null
  ) {
    return sdkContext.solana.routesConfigCache.get(cacheKey)!
  }

  const promise = _getSolanaSupportedRoutes(sdkContext, network).catch(err => {
    const cachedPromise = sdkContext.solana.routesConfigCache?.get(cacheKey)
    if (promise === cachedPromise) {
      sdkContext.solana.routesConfigCache?.delete(cacheKey)
    }
    throw err
  })
  sdkContext.solana.routesConfigCache?.set(cacheKey, promise)
  return promise
}

async function _getSolanaSupportedRoutes(
  sdkContext: SDKGlobalContext,
  network: NetworkType,
): Promise<SolanaSupportedRoute[]> {
  const stacksChain =
    network === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet

  const resp = await requestAPI<{ routes: SupportedSolanaBridgeRoute[] }>(
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

  return routes.filter(isNotNull)
}

interface SupportedSolanaBridgeRoute {
  tokenAddress: `0x${string}`
  stacksTokenContractAddress: StacksContractAddress
  proxyStacksTokenContractAddress: null | StacksContractAddress
  pegOutFeeRate: `${number}`
  pegOutMinFeeAmount: null | `${number}`
  pegOutMinAmount: null | `${number}`
  pegOutMaxAmount: null | `${number}`
} 