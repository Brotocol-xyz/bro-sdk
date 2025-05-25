import { getSolanaSupportedRoutes } from "./getSolanaSupportedRoutes"
import { getEVMSupportedRoutes } from "../evmUtils/apiHelpers/getEVMSupportedRoutes"
import { getBRC20SupportedRoutes } from "../metaUtils/apiHelpers/getBRC20SupportedRoutes"
import { getRunesSupportedRoutes } from "../metaUtils/apiHelpers/getRunesSupportedRoutes"
import { getTronSupportedRoutes } from "../tronUtils/getTronSupportedRoutes"
import { IsSupportedFn } from "../utils/buildSupportedRoutes"
import { checkNever } from "../utils/typeHelpers"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import {
  _allNoLongerSupportedEVMChains,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import { getAndCheckTransitStacksTokens } from "../utils/SwapRouteHelpers"

export const isSupportedSolanaRoute: IsSupportedFn = async (ctx, route) => {
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
    !KnownChainId.isSolanaChain(fromChain) ||
    !KnownTokenId.isSolanaToken(fromToken)
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

  // solana -> stacks
  if (KnownChainId.isStacksChain(toChain)) {
    if (!KnownTokenId.isStacksToken(toToken)) return false

    const solanaRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    return solanaRoutes.some(
      route => route.solanaToken === fromToken && route.stacksToken === toToken,
    )
  }

  // solana -> evm
  if (KnownChainId.isEVMChain(toChain)) {
    if (!KnownTokenId.isEVMToken(toToken)) return false

    const fromRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    const toRoutes = await getEVMSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.some(
        route =>
          route.solanaToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) &&
      toRoutes.some(
        route =>
          route.evmToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      )
    )
  }

  // solana -> btc
  if (KnownChainId.isBitcoinChain(toChain)) {
    if (!KnownTokenId.isBitcoinToken(toToken)) return false

    return toToken === KnownTokenId.Bitcoin.BTC
  }

  // solana -> brc20
  if (KnownChainId.isBRC20Chain(toChain)) {
    if (!KnownTokenId.isBRC20Token(toToken)) return false

    const fromRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    const toRoutes = await getBRC20SupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.solanaToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.brc20Token === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // solana -> runes
  if (KnownChainId.isRunesChain(toChain)) {
    if (!KnownTokenId.isRunesToken(toToken)) return false

    const fromRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    const toRoutes = await getRunesSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.solanaToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.runesToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // solana -> tron
  if (KnownChainId.isTronChain(toChain)) {
    if (!KnownTokenId.isTronToken(toToken)) return false

    const fromRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    const toRoutes = await getTronSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.solanaToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.tronToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // solana -> solana
  if (KnownChainId.isSolanaChain(toChain)) {
    if (!KnownTokenId.isSolanaToken(toToken)) return false

    const solanaRoutes = await getSolanaSupportedRoutes(ctx, fromChain)

    return (
      solanaRoutes.find(
        route =>
          route.solanaToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      solanaRoutes.find(
        route =>
          route.solanaToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  checkNever(toChain)
  return false
}

export async function solanaTokenToCorrespondingStacksToken(
  sdkContext: SDKGlobalContext,
  fromChain: KnownChainId.SolanaChain,
  fromSolanaToken: KnownTokenId.SolanaToken,
): Promise<undefined | KnownTokenId.StacksToken> {
  const supportedRoutes = await getSolanaSupportedRoutes(sdkContext, fromChain)
  return supportedRoutes.find(route => route.solanaToken === fromSolanaToken)?.stacksToken
}

export async function solanaTokenFromCorrespondingStacksToken(
  sdkContext: SDKGlobalContext,
  toChain: KnownChainId.SolanaChain,
  fromStacksToken: KnownTokenId.StacksToken,
): Promise<KnownTokenId.SolanaToken[]> {
  const supportedRoutes = await getSolanaSupportedRoutes(sdkContext, toChain)
  return supportedRoutes.reduce(
    (acc, route) =>
      route.stacksToken === fromStacksToken ? [...acc, route.solanaToken] : acc,
    [] as KnownTokenId.SolanaToken[],
  )
} 