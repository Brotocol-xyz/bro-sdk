import { getTronSupportedRoutes } from "./getTronSupportedRoutes"
import { getEVMSupportedRoutes } from "../evmUtils/apiHelpers/getEVMSupportedRoutes"
import { getBRC20SupportedRoutes } from "../metaUtils/apiHelpers/getBRC20SupportedRoutes"
import { getRunesSupportedRoutes } from "../metaUtils/apiHelpers/getRunesSupportedRoutes"
import { getSolanaSupportedRoutes } from "../solanaUtils/getSolanaSupportedRoutes"
import { IsSupportedFn } from "../utils/buildSupportedRoutes"
import { checkNever } from "../utils/typeHelpers"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import {
  _allNoLongerSupportedEVMChains,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import { getAndCheckTransitStacksTokens } from "../utils/SwapRouteHelpers"

export const isSupportedTronRoute: IsSupportedFn = async (ctx, route) => {
  const { fromChain, toChain, fromToken, toToken } = route

  if (fromChain === toChain && fromToken === toToken) {
    return false
  }

  if (!KnownChainId.isKnownChain(toChain)) return false

  if (
    (KnownChainId.isEVMChain(fromChain) &&
      _allNoLongerSupportedEVMChains.includes(fromChain)) ||
    (KnownChainId.isEVMChain(toChain) &&
      _allNoLongerSupportedEVMChains.includes(toChain))
  ) {
    return false
  }

  if (
    !KnownChainId.isTronChain(fromChain) ||
    !KnownTokenId.isTronToken(fromToken)
  ) {
    return false
  }

  const headAndTailStacksTokens = await getAndCheckTransitStacksTokens(ctx, {
    ...route,
    fromChain,
    fromToken,
    toChain: toChain as any,
    toToken: toToken as any,
  })
  if (headAndTailStacksTokens == null) return false
  const { firstStepToStacksToken, lastStepFromStacksToken } =
    headAndTailStacksTokens

  // tron -> stacks
  if (KnownChainId.isStacksChain(toChain)) {
    if (!KnownTokenId.isStacksToken(toToken)) return false

    const tronRoutes = await getTronSupportedRoutes(ctx, fromChain)
    return tronRoutes.some(
      route => route.tronToken === fromToken && route.stacksToken === toToken,
    )
  }

  // tron -> evm
  if (KnownChainId.isEVMChain(toChain)) {
    if (!KnownTokenId.isEVMToken(toToken)) return false

    const fromRoutes = await getTronSupportedRoutes(ctx, fromChain)
    const toRoutes = await getEVMSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.some(
        route =>
          route.tronToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) &&
      toRoutes.some(
        route =>
          route.evmToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      )
    )
  }

  // tron -> btc
  if (KnownChainId.isBitcoinChain(toChain)) {
    if (!KnownTokenId.isBitcoinToken(toToken)) return false

    return toToken === KnownTokenId.Bitcoin.BTC
  }

  // tron -> brc20
  if (KnownChainId.isBRC20Chain(toChain)) {
    if (!KnownTokenId.isBRC20Token(toToken)) return false

    const fromRoutes = await getTronSupportedRoutes(ctx, fromChain)
    const toRoutes = await getBRC20SupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.tronToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.brc20Token === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // tron -> runes
  if (KnownChainId.isRunesChain(toChain)) {
    if (!KnownTokenId.isRunesToken(toToken)) return false

    const fromRoutes = await getTronSupportedRoutes(ctx, fromChain)
    const toRoutes = await getRunesSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.tronToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.runesToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // tron -> tron
  if (KnownChainId.isTronChain(toChain)) {
    if (!KnownTokenId.isTronToken(toToken)) return false

    const tronRoutes = await getTronSupportedRoutes(ctx, fromChain)

    return (
      tronRoutes.find(
        route =>
          route.tronToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      tronRoutes.find(
        route =>
          route.tronToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // tron -> solana
  if (KnownChainId.isSolanaChain(toChain)) {
    if (!KnownTokenId.isSolanaToken(toToken)) return false

    const fromRoutes = await getTronSupportedRoutes(ctx, fromChain)
    const toRoutes = await getSolanaSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.tronToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.solanaToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  checkNever(toChain)
  return false
}

export async function tronTokenToCorrespondingStacksToken(
  sdkContext: SDKGlobalContext,
  fromChain: KnownChainId.TronChain,
  fromTronToken: KnownTokenId.TronToken,
): Promise<undefined | KnownTokenId.StacksToken> {
  const supportedRoutes = await getTronSupportedRoutes(sdkContext, fromChain)
  return supportedRoutes.find(route => route.tronToken === fromTronToken)?.stacksToken
}

export async function tronTokenFromCorrespondingStacksToken(
  sdkContext: SDKGlobalContext,
  toChain: KnownChainId.TronChain,
  fromStacksToken: KnownTokenId.StacksToken,
): Promise<KnownTokenId.TronToken[]> {
  const supportedRoutes = await getTronSupportedRoutes(sdkContext, toChain)
  return supportedRoutes.reduce(
    (acc, route) =>
      route.stacksToken === fromStacksToken ? [...acc, route.tronToken] : acc,
    [] as KnownTokenId.TronToken[],
  )
} 