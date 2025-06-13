import { getEVMSupportedRoutes } from "../evmUtils/apiHelpers/getEVMSupportedRoutes"
import { getBRC20SupportedRoutes } from "../metaUtils/apiHelpers/getBRC20SupportedRoutes"
import { getRunesSupportedRoutes } from "../metaUtils/apiHelpers/getRunesSupportedRoutes"
import { getSolanaSupportedRoutes } from "../solanaUtils/getSolanaSupportedRoutes"
import { getTronSupportedRoutes } from "../tronUtils/getTronSupportedRoutes"
import { IsSupportedFn } from "../utils/buildSupportedRoutes"
import { checkNever } from "../utils/typeHelpers"
import {
  _allNoLongerSupportedEVMChains,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"

export const isSupportedStacksRoute: IsSupportedFn = async (ctx, route) => {
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
    !KnownChainId.isStacksChain(fromChain) ||
    !KnownTokenId.isStacksToken(fromToken)
  ) {
    return false
  }

  // stacks -> stacks
  if (KnownChainId.isStacksChain(toChain)) {
    return false
  }

  // stacks -> evm
  if (KnownChainId.isEVMChain(toChain)) {
    if (!KnownTokenId.isEVMToken(toToken)) return false

    const supportedRoutes = await getEVMSupportedRoutes(ctx, toChain)

    return supportedRoutes.some(
      route => route.stacksToken === fromToken && route.evmToken === toToken,
    )
  }

  // stacks -> btc
  if (KnownChainId.isBitcoinChain(toChain)) {
    if (!KnownTokenId.isBitcoinToken(toToken)) return false

    return (
      fromToken === KnownTokenId.Stacks.aBTC &&
      toToken === KnownTokenId.Bitcoin.BTC
    )
  }

  // stacks -> brc20
  if (KnownChainId.isBRC20Chain(toChain)) {
    if (!KnownTokenId.isBRC20Token(toToken)) return false

    const supportedRoutes = await getBRC20SupportedRoutes(ctx, toChain)

    return supportedRoutes.some(
      route => route.stacksToken === fromToken && route.brc20Token === toToken,
    )
  }

  // stacks -> runes
  if (KnownChainId.isRunesChain(toChain)) {
    if (!KnownTokenId.isRunesToken(toToken)) return false

    const supportedRoutes = await getRunesSupportedRoutes(ctx, toChain)

    return supportedRoutes.some(
      route => route.stacksToken === fromToken && route.runesToken === toToken,
    )
  }

  // stacks -> tron
  if (KnownChainId.isTronChain(toChain)) {
    if (!KnownTokenId.isTronToken(toToken)) return false

    const supportedRoutes = await getTronSupportedRoutes(ctx, toChain)

    return supportedRoutes.some(
      route => route.stacksToken === fromToken && route.tronToken === toToken,
    )
  }

  // stacks -> solana
  if (KnownChainId.isSolanaChain(toChain)) {
    if (!KnownTokenId.isSolanaToken(toToken)) return false

    const supportedRoutes = await getSolanaSupportedRoutes(ctx, toChain)

    return supportedRoutes.some(
      route => route.stacksToken === fromToken && route.solanaToken === toToken,
    )
  }

  checkNever(toChain)
  return false
}
