import { getEVMSupportedRoutesByChainType } from "../evmUtils/apiHelpers/getEVMSupportedRoutes"
import { getBRC20SupportedRoutes } from "../metaUtils/apiHelpers/getBRC20SupportedRoutes"
import { getRunesSupportedRoutes } from "../metaUtils/apiHelpers/getRunesSupportedRoutes"
import { getTronSupportedRoutes } from "../tronUtils/getTronSupportedRoutes"
import { getSolanaSupportedRoutes } from "../solanaUtils/getSolanaSupportedRoutes"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { KnownRoute } from "./buildSupportedRoutes"
import { KnownChainId, KnownTokenId } from "./types/knownIds"

export async function detectPossibleRoutes(
  ctx: SDKGlobalContext,
  conditions: {
    networkType: "mainnet" | "testnet"
    swapEnabled: boolean
  },
): Promise<KnownRoute[]> {
  type FetchedRoute = {
    baseStacksChain: KnownChainId.StacksChain
    baseStacksToken: KnownTokenId.StacksToken
    pairedTokenChain: KnownChainId.KnownChain
    pairedToken: KnownTokenId.KnownToken
  }

  const { networkType, swapEnabled } = conditions

  if (ctx.routes.detectedCache.get(networkType) != null) {
    return ctx.routes.detectedCache.get(networkType)!
  }

  const [evmRoutes, brc20Routes, runesRoutes, tronRoutes, solanaRoutes] = await Promise.all([
    getEVMSupportedRoutesByChainType(ctx, networkType).then(routes =>
      routes.map(
        r =>
          ({
            baseStacksChain: r.stacksChain,
            baseStacksToken: r.stacksToken,
            pairedTokenChain: r.evmChain,
            pairedToken: r.evmToken,
          }) satisfies FetchedRoute,
      ),
    ),
    getBRC20SupportedRoutes(
      ctx,
      networkType === "mainnet"
        ? KnownChainId.BRC20.Mainnet
        : KnownChainId.BRC20.Testnet,
    ).then(routes =>
      routes.map(
        r =>
          ({
            baseStacksChain: r.stacksChain,
            baseStacksToken: r.stacksToken,
            pairedTokenChain: r.brc20Chain,
            pairedToken: r.brc20Token,
          }) satisfies FetchedRoute,
      ),
    ),
    getRunesSupportedRoutes(
      ctx,
      networkType === "mainnet"
        ? KnownChainId.Runes.Mainnet
        : KnownChainId.Runes.Testnet,
    ).then(routes =>
      routes.map(
        r =>
          ({
            baseStacksChain: r.stacksChain,
            baseStacksToken: r.stacksToken,
            pairedTokenChain: r.runesChain,
            pairedToken: r.runesToken,
          }) satisfies FetchedRoute,
      ),
    ),
    getTronSupportedRoutes(
      ctx,
      networkType === "mainnet"
        ? KnownChainId.Tron.Mainnet
        : KnownChainId.Tron.Testnet,
    ).then(routes =>
      routes.map(
        r =>
          ({
            baseStacksChain: r.stacksChain,
            baseStacksToken: r.stacksToken,
            pairedTokenChain: networkType === "mainnet" ? KnownChainId.Tron.Mainnet : KnownChainId.Tron.Testnet,
            pairedToken: r.tronToken,
          }) satisfies FetchedRoute,
      ),
    ),
    getSolanaSupportedRoutes(
      ctx,
      networkType === "mainnet"
        ? KnownChainId.Solana.Mainnet
        : KnownChainId.Solana.Testnet,
    ).then(routes =>
      routes.map(
        r =>
          ({
            baseStacksChain: r.stacksChain,
            baseStacksToken: r.stacksToken,
            pairedTokenChain: networkType === "mainnet" ? KnownChainId.Solana.Mainnet : KnownChainId.Solana.Testnet,
            pairedToken: r.solanaToken,
          }) satisfies FetchedRoute,
      ),
    ),
  ])
  const bitcoinRoutes = (
    networkType === "mainnet"
      ? [
          {
            baseStacksChain: KnownChainId.Stacks.Mainnet,
            baseStacksToken: KnownTokenId.Stacks.aBTC,
            pairedTokenChain: KnownChainId.Bitcoin.Mainnet,
            pairedToken: KnownTokenId.Bitcoin.BTC,
          },
        ]
      : [
          {
            baseStacksChain: KnownChainId.Stacks.Testnet,
            baseStacksToken: KnownTokenId.Stacks.aBTC,
            pairedTokenChain: KnownChainId.Bitcoin.Testnet,
            pairedToken: KnownTokenId.Bitcoin.BTC,
          },
        ]
  ) satisfies FetchedRoute[]

  const allRoutes = [
    ...evmRoutes,
    ...bitcoinRoutes,
    ...brc20Routes,
    ...runesRoutes,
    ...tronRoutes,
    ...solanaRoutes,
  ]

  const result: KnownRoute[] = []

  // Stacks > *
  allRoutes.forEach(route => {
    result.push({
      fromChain: route.baseStacksChain,
      fromToken: route.baseStacksToken,
      toChain: route.pairedTokenChain,
      toToken: route.pairedToken,
    } as KnownRoute)
  })

  // evm > *
  for (const routeFrom of evmRoutes) {
    result.push({
      fromChain: routeFrom.pairedTokenChain,
      fromToken: routeFrom.pairedToken,
      toChain: routeFrom.baseStacksChain,
      toToken: routeFrom.baseStacksToken,
    })

    for (const routeTo of allRoutes) {
      const isSameRoute =
        routeFrom.pairedTokenChain === routeTo.pairedTokenChain &&
        routeFrom.pairedToken === routeTo.pairedToken
      const isSameBaseStacksToken =
        routeFrom.baseStacksChain === routeTo.baseStacksChain &&
        routeFrom.baseStacksToken === routeTo.baseStacksToken
      if (isSameRoute) continue
      if (!swapEnabled && !isSameBaseStacksToken) continue
      result.push({
        fromChain: routeFrom.pairedTokenChain,
        fromToken: routeFrom.pairedToken,
        toChain: routeTo.pairedTokenChain,
        toToken: routeTo.pairedToken,
      } as KnownRoute)
    }
  }

  // bitcoin > *
  for (const routeFrom of bitcoinRoutes) {
    result.push({
      fromChain: routeFrom.pairedTokenChain,
      fromToken: routeFrom.pairedToken,
      toChain: routeFrom.baseStacksChain,
      toToken: routeFrom.baseStacksToken,
    })

    for (const routeTo of allRoutes) {
      const isSameRoute =
        routeFrom.pairedTokenChain === routeTo.pairedTokenChain &&
        routeFrom.pairedToken === routeTo.pairedToken
      const isSameBaseStacksToken =
        routeFrom.baseStacksChain === routeTo.baseStacksChain &&
        routeFrom.baseStacksToken === routeTo.baseStacksToken
      if (isSameRoute) continue
      if (!swapEnabled && !isSameBaseStacksToken) continue
      result.push({
        fromChain: routeFrom.pairedTokenChain,
        fromToken: routeFrom.pairedToken,
        toChain: routeTo.pairedTokenChain,
        toToken: routeTo.pairedToken,
      } as KnownRoute)
    }
  }

  // brc20 > *
  for (const routeFrom of brc20Routes) {
    result.push({
      fromChain: routeFrom.pairedTokenChain,
      fromToken: routeFrom.pairedToken,
      toChain: routeFrom.baseStacksChain,
      toToken: routeFrom.baseStacksToken,
    })

    for (const routeTo of allRoutes) {
      const isSameRoute =
        routeFrom.pairedTokenChain === routeTo.pairedTokenChain &&
        routeFrom.pairedToken === routeTo.pairedToken
      const isSameBaseStacksToken =
        routeFrom.baseStacksChain === routeTo.baseStacksChain &&
        routeFrom.baseStacksToken === routeTo.baseStacksToken
      if (isSameRoute) continue
      if (!swapEnabled && !isSameBaseStacksToken) continue
      result.push({
        fromChain: routeFrom.pairedTokenChain,
        fromToken: routeFrom.pairedToken,
        toChain: routeTo.pairedTokenChain,
        toToken: routeTo.pairedToken,
      } as KnownRoute)
    }
  }

  // runes > *
  for (const routeFrom of runesRoutes) {
    result.push({
      fromChain: routeFrom.pairedTokenChain,
      fromToken: routeFrom.pairedToken,
      toChain: routeFrom.baseStacksChain,
      toToken: routeFrom.baseStacksToken,
    })

    for (const routeTo of allRoutes) {
      const isSameRoute =
        routeFrom.pairedTokenChain === routeTo.pairedTokenChain &&
        routeFrom.pairedToken === routeTo.pairedToken
      const isSameBaseStacksToken =
        routeFrom.baseStacksChain === routeTo.baseStacksChain &&
        routeFrom.baseStacksToken === routeTo.baseStacksToken
      if (isSameRoute) continue
      if (!swapEnabled && !isSameBaseStacksToken) continue
      result.push({
        fromChain: routeFrom.pairedTokenChain,
        fromToken: routeFrom.pairedToken,
        toChain: routeTo.pairedTokenChain,
        toToken: routeTo.pairedToken,
      } as KnownRoute)
    }
  }

  // tron > *
  for (const routeFrom of tronRoutes) {
    result.push({
      fromChain: routeFrom.pairedTokenChain,
      fromToken: routeFrom.pairedToken,
      toChain: routeFrom.baseStacksChain,
      toToken: routeFrom.baseStacksToken,
    })

    for (const routeTo of allRoutes) {
      const isSameRoute =
        routeFrom.pairedTokenChain === routeTo.pairedTokenChain &&
        routeFrom.pairedToken === routeTo.pairedToken
      const isSameBaseStacksToken =
        routeFrom.baseStacksChain === routeTo.baseStacksChain &&
        routeFrom.baseStacksToken === routeTo.baseStacksToken
      if (isSameRoute) continue
      if (!swapEnabled && !isSameBaseStacksToken) continue
      result.push({
        fromChain: routeFrom.pairedTokenChain,
        fromToken: routeFrom.pairedToken,
        toChain: routeTo.pairedTokenChain,
        toToken: routeTo.pairedToken,
      } as KnownRoute)
    }
  }

  // solana > *
  for (const routeFrom of solanaRoutes) {
    result.push({
      fromChain: routeFrom.pairedTokenChain,
      fromToken: routeFrom.pairedToken,
      toChain: routeFrom.baseStacksChain,
      toToken: routeFrom.baseStacksToken,
    })

    for (const routeTo of allRoutes) {
      const isSameRoute =
        routeFrom.pairedTokenChain === routeTo.pairedTokenChain &&
        routeFrom.pairedToken === routeTo.pairedToken
      const isSameBaseStacksToken =
        routeFrom.baseStacksChain === routeTo.baseStacksChain &&
        routeFrom.baseStacksToken === routeTo.baseStacksToken
      if (isSameRoute) continue
      if (!swapEnabled && !isSameBaseStacksToken) continue
      result.push({
        fromChain: routeFrom.pairedTokenChain,
        fromToken: routeFrom.pairedToken,
        toChain: routeTo.pairedTokenChain,
        toToken: routeTo.pairedToken,
      } as KnownRoute)
    }
  }

  ctx.routes.detectedCache.set(networkType, result)
  return result
}
