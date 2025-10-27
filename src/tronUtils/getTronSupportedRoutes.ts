import { getStacksToken } from "../stacksUtils/contractHelpers"
import { requestAPI } from "../utils/apiHelpers"
import { BigNumber } from "../utils/BigNumber"
import { isNotNull } from "../utils/typeHelpers"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { StacksContractAddress } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { TronSupportedRoute } from "./types"

type NetworkType = "mainnet" | "testnet"

export async function getTronSupportedRoutes(
sdkContext: SDKGlobalContext, 
toChain: KnownChainId.TronChain,
): Promise<TronSupportedRoute[]> {
  return getTronSupportedRoutesByNetwork(sdkContext, toChain === KnownChainId.Tron.Mainnet ? "mainnet" : "testnet")
}

async function getTronSupportedRoutesByNetwork(
  sdkContext: SDKGlobalContext,
  network: NetworkType,
): Promise<TronSupportedRoute[]> {
  const cacheKey = network
  if (
    sdkContext.tron.routesConfigCache != null &&
    sdkContext.tron.routesConfigCache.get(cacheKey) != null
  ) {
    return sdkContext.tron.routesConfigCache.get(cacheKey)!
  }

  const promise = _getTronSupportedRoutes(sdkContext, network).catch(err => {
    const cachedPromise = sdkContext.tron.routesConfigCache?.get(cacheKey)
    if (promise === cachedPromise) {
      sdkContext.tron.routesConfigCache?.delete(cacheKey)
    }
    throw err
  })
  sdkContext.tron.routesConfigCache?.set(cacheKey, promise)
  return promise
}

async function _getTronSupportedRoutes(
  sdkContext: SDKGlobalContext,
  network: NetworkType,
): Promise<TronSupportedRoute[]> {
  const stacksChain =
    network === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet

  const resp = await requestAPI<{ routes: SupportedTronBridgeRoute[] }>(
    sdkContext,
    {
      method: "GET",
      path: "/2024-10-01/tron/supported-routes",
      query: {
        network,
      },
    },
  )

  const routes = await Promise.all(
    resp.routes.map(async (route): Promise<null | TronSupportedRoute> => {
      const tronToken = KnownTokenId.createTronToken(route.tokenAddress)
      const stacksToken = await getStacksToken(
        sdkContext,
        stacksChain,
        route.stacksTokenContractAddress,
      )

      if (stacksToken == null) return null
      if (!KnownTokenId.isTronToken(tronToken)) return null

      return {
        tronToken,
        tronTokenAddress: route.tokenAddress,
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

interface SupportedTronBridgeRoute {
  tokenAddress: string
  stacksTokenContractAddress: StacksContractAddress
  proxyStacksTokenContractAddress: null | StacksContractAddress
  pegOutFeeRate: `${number}`
  pegOutMinFeeAmount: null | `${number}`
  pegOutMinAmount: null | `${number}`
  pegOutMaxAmount: null | `${number}`
} 