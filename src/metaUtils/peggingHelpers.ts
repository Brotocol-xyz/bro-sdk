import { getEVMSupportedRoutes } from "../evmUtils/apiHelpers/getEVMSupportedRoutes"
import { StacksContractName } from "../stacksUtils/stxContractAddresses"
import {
  executeReadonlyCallBro,
  getStacksContractCallInfo,
  numberFromStacksContractNumber,
} from "../stacksUtils/contractHelpers"
import { BigNumber } from "../utils/BigNumber"
import {
  getAndCheckTransitStacksTokens,
  getSpecialFeeDetailsForSwapRoute,
  SwapRoute,
} from "../utils/SwapRouteHelpers"
import {
  IsSupportedFn,
  KnownRoute_FromBRC20_ToStacks,
  KnownRoute_FromRunes_ToStacks,
  KnownRoute_FromStacks_ToBRC20,
  KnownRoute_FromStacks_ToRunes,
  KnownRoute_ToStacks,
} from "../utils/buildSupportedRoutes"
import { props } from "../utils/promiseHelpers"
import { checkNever, isNotNull } from "../utils/typeHelpers"
import {
  TransferProphet,
  TransferProphet_Fee_Fixed,
  TransferProphet_Fee_Rate,
} from "../utils/types/TransferProphet"
import {
  _allNoLongerSupportedEVMChains,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import {
  SDKGlobalContext,
  withGlobalContextCache,
} from "../sdkUtils/types.internal"
import { getBRC20SupportedRoutes } from "./apiHelpers/getBRC20SupportedRoutes"
import { getRunesSupportedRoutes } from "./apiHelpers/getRunesSupportedRoutes"
import { getMetaPegInAddress } from "./btcAddresses"
import { getTronSupportedRoutes } from "../tronUtils/getTronSupportedRoutes"
import { getSolanaSupportedRoutes } from "../solanaUtils/getSolanaSupportedRoutes"

export async function metaTokenFromCorrespondingStacksToken(
  ctx: SDKGlobalContext,
  chain: KnownChainId.BRC20Chain | KnownChainId.RunesChain,
  stacksToken: KnownTokenId.StacksToken,
): Promise<undefined | KnownTokenId.BRC20Token | KnownTokenId.RunesToken> {
  if (KnownChainId.isBRC20Chain(chain)) {
    const routes = await getBRC20SupportedRoutes(ctx, chain)
    return routes.find(r => r.stacksToken === stacksToken)?.brc20Token
  } else if (KnownChainId.isRunesChain(chain)) {
    const routes = await getRunesSupportedRoutes(ctx, chain)
    return routes.find(r => r.stacksToken === stacksToken)?.runesToken
  } else {
    checkNever(chain)
    return
  }
}

export async function metaTokenToCorrespondingStacksToken(
  ctx: SDKGlobalContext,
  route:
    | { chain: KnownChainId.BRC20Chain; token: KnownTokenId.BRC20Token }
    | { chain: KnownChainId.RunesChain; token: KnownTokenId.RunesToken },
): Promise<undefined | KnownTokenId.StacksToken> {
  if (KnownChainId.isBRC20Chain(route.chain)) {
    const routes = await getBRC20SupportedRoutes(ctx, route.chain)
    return routes.find(r => r.brc20Token === route.token)?.stacksToken
  } else if (KnownChainId.isRunesChain(route.chain)) {
    const routes = await getRunesSupportedRoutes(ctx, route.chain)
    return routes.find(r => r.runesToken === route.token)?.stacksToken
  } else {
    checkNever(route.chain)
    return
  }
}

export const getMeta2StacksFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromBRC20_ToStacks | KnownRoute_FromRunes_ToStacks,
  options: {
    swapRoute: null | Pick<SwapRoute, "via">
  },
): Promise<undefined | TransferProphet> => {
  return withGlobalContextCache(
    ctx.brc20.feeRateCache,
    `${withGlobalContextCache.cacheKeyFromRoute(route)}:${options.swapRoute?.via ?? ""}`,
    () => _getMeta2StacksFeeInfo(ctx, route, options),
  )
}
const _getMeta2StacksFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromBRC20_ToStacks | KnownRoute_FromRunes_ToStacks,
  options: {
    swapRoute: null | Pick<SwapRoute, "via">
  },
): Promise<undefined | TransferProphet> => {
  if (options.swapRoute != null) {
    return getMeta2StacksSwapFeeInfo(ctx, route, {
      swapRoute: options.swapRoute,
    })
  } else {
    return getMeta2StacksBaseFeeInfo(ctx, route)
  }
}

const getMeta2StacksBaseFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromBRC20_ToStacks | KnownRoute_FromRunes_ToStacks,
): Promise<undefined | TransferProphet> => {
  const filteredRoutes = KnownChainId.isBRC20Chain(route.fromChain)
    ? await getBRC20SupportedRoutes(ctx, route.fromChain).then(routes =>
        routes.filter(
          _route =>
            _route.brc20Token === route.fromToken &&
            _route.stacksToken === route.toToken,
        ),
      )
    : await getRunesSupportedRoutes(ctx, route.fromChain).then(routes =>
        routes.filter(
          _route =>
            _route.runesToken === route.fromToken &&
            _route.stacksToken === route.toToken,
        ),
      )
  const filteredRoute = filteredRoutes[0]
  if (filteredRoute == null) return

  if (ctx.debugLog) {
    console.log("[getMeta2StacksBaseFeeInfo]", route, filteredRoute)
  }

  return {
    isPaused: filteredRoute.pegInPaused,
    bridgeToken: route.fromToken,
    fees: [
      {
        type: "rate" as const,
        token: route.fromToken,
        rate: filteredRoute.pegInFeeRate,
        minimumAmount: BigNumber.ZERO,
      },
      filteredRoute.pegInFeeBitcoinAmount == null
        ? null
        : {
            type: "fixed" as const,
            token: KnownTokenId.Bitcoin.BTC,
            amount: filteredRoute.pegInFeeBitcoinAmount,
          },
    ].filter(isNotNull),
    minBridgeAmount: BigNumber.ZERO,
    maxBridgeAmount: null,
  }
}

const getMeta2StacksSwapFeeInfo = async (
  ctx: SDKGlobalContext,
  route1: KnownRoute_FromBRC20_ToStacks | KnownRoute_FromRunes_ToStacks,
  options: {
    swapRoute: Pick<SwapRoute, "via">
  },
): Promise<undefined | TransferProphet> => {
  const stacksSwapContractCallInfo = getStacksContractCallInfo(
    route1.toChain,
    StacksContractName.MetaPegInEndpointSwap,
  )
  const stacksAggContractCallInfo = getStacksContractCallInfo(
    route1.toChain,
    StacksContractName.MetaPegInEndpointAggregator,
  )
  if (stacksSwapContractCallInfo == null || stacksAggContractCallInfo == null) {
    return
  }

  // prettier-ignore
  const contractCallInfo =
    options.swapRoute.via === 'ALEX' ? stacksSwapContractCallInfo :
    options.swapRoute.via === 'evmDexAggregator' ? stacksAggContractCallInfo :
    (checkNever(options.swapRoute.via), null)
  if (contractCallInfo == null) return

  const resp = await props({
    isPaused: executeReadonlyCallBro(
      contractCallInfo.contractName,
      "is-paused",
      {},
      contractCallInfo.executeOptions,
    ),
    fixedBtcFee: executeReadonlyCallBro(
      contractCallInfo.contractName,
      "get-peg-in-fee",
      {},
      contractCallInfo.executeOptions,
    ).then(numberFromStacksContractNumber),
  }).then(
    resp => {
      if (ctx.debugLog) {
        console.log("[getMeta2StacksSwapFeeInfo]", route1, resp)
      }
      return resp
    },
    err => {
      if (ctx.debugLog) {
        console.log("[getMeta2StacksSwapFeeInfo]", route1, err)
      }
      throw err
    },
  )

  return {
    isPaused: resp.isPaused,
    bridgeToken: route1.fromToken,
    fees: [
      {
        type: "fixed" as const,
        token: KnownTokenId.Bitcoin.BTC,
        amount: resp.fixedBtcFee,
      },
    ],
    minBridgeAmount: BigNumber.ZERO,
    maxBridgeAmount: null,
  }
}

export const getStacks2MetaFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromStacks_ToBRC20 | KnownRoute_FromStacks_ToRunes,
  options: {
    /**
     * The entry route step that triggered the Stacks transaction.
     * It's crucial for correctly calculating fees in multi-step bridging
     * processes.
     *
     * Examples:
     *
     * * BTC > Runes (`via: ALEX`):
     *     1. btc > stacks (initialRoute)
     *     2. stacks > runes
     * * BTC > Runes (`via: evmDexAggregator`):
     *     1. btc > stacks (initialRoute as well, but not what we want)
     *     2. stacks > evm
     *     3. evm swap
     *     4. evm > stacks (initialRoute for this partition)
     *     5. stacks > runes
     */
    initialRoute: null | KnownRoute_ToStacks
    /**
     * the swap step between the previous route and the current one
     */
    swapRoute: null | Pick<SwapRoute, "via">
  },
): Promise<undefined | TransferProphet> => {
  return withGlobalContextCache(
    ctx.brc20.feeRateCache,
    [
      withGlobalContextCache.cacheKeyFromRoute(route),
      options.initialRoute == null
        ? ""
        : withGlobalContextCache.cacheKeyFromRoute(options.initialRoute),
      options.swapRoute == null ? "" : options.swapRoute.via,
    ].join("#"),
    () => _getStacks2MetaFeeInfo(ctx, route, options),
  )
}
const _getStacks2MetaFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromStacks_ToBRC20 | KnownRoute_FromStacks_ToRunes,
  options: {
    /**
     * The entry route step that triggered the Stacks transaction.
     * It's crucial for correctly calculating fees in multi-step bridging
     * processes.
     *
     * Examples:
     *
     * * BTC > Runes (`via: ALEX`):
     *     1. btc > stacks (initialRoute)
     *     2. stacks > runes
     * * BTC > Runes (`via: evmDexAggregator`):
     *     1. btc > stacks (initialRoute as well, but not what we want)
     *     2. stacks > evm
     *     3. evm swap
     *     4. evm > stacks (initialRoute for this partition)
     *     5. stacks > runes
     */
    initialRoute: null | KnownRoute_ToStacks
    /**
     * the swap step between the previous route and the current one
     */
    swapRoute: null | Pick<SwapRoute, "via">
  },
): Promise<undefined | TransferProphet> => {
  const filteredRoutes = KnownChainId.isBRC20Chain(route.toChain)
    ? await getBRC20SupportedRoutes(ctx, route.toChain).then(routes =>
        routes.filter(
          _route =>
            _route.stacksToken === route.fromToken &&
            _route.brc20Token === route.toToken,
        ),
      )
    : await getRunesSupportedRoutes(ctx, route.toChain).then(routes =>
        routes.filter(
          _route =>
            _route.stacksToken === route.fromToken &&
            _route.runesToken === route.toToken,
        ),
      )
  const filteredRoute = filteredRoutes[0]
  if (filteredRoute == null) return

  const specialFeeInfo = await getSpecialFeeDetailsForSwapRoute(ctx, route, {
    initialRoute: options.initialRoute,
    swapRoute: options.swapRoute,
  })
  if (ctx.debugLog) {
    console.log("[getStacks2MetaFeeInfo/specialFeeInfo]", route, specialFeeInfo)
  }

  const feeDetails =
    specialFeeInfo ??
    (await props({
      feeRate: filteredRoute.pegOutFeeRate,
      minFeeAmount: BigNumber.ZERO,
      gasFee:
        filteredRoute.pegOutFeeBitcoinAmount == null
          ? undefined
          : props({
              token: KnownTokenId.Stacks.aBTC,
              amount: filteredRoute.pegOutFeeBitcoinAmount,
            }),
    }))
  if (ctx.debugLog) {
    console.log("[getStacks2MetaFeeInfo]", route, feeDetails)
  }

  return {
    isPaused: filteredRoute.pegOutPaused,
    bridgeToken: route.fromToken,
    fees: [
      {
        type: "rate",
        token: route.fromToken,
        rate: feeDetails.feeRate,
        minimumAmount: feeDetails.minFeeAmount,
      } satisfies TransferProphet_Fee_Rate,
      feeDetails.gasFee == null
        ? null
        : ({
            type: "fixed",
            token: feeDetails.gasFee.token,
            amount: feeDetails.gasFee.amount,
          } satisfies TransferProphet_Fee_Fixed),
    ].filter(isNotNull),
    minBridgeAmount: BigNumber.ZERO,
    maxBridgeAmount: null,
  }
}

export const isSupportedBRC20Route: IsSupportedFn = async (ctx, route) => {
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
    !KnownChainId.isBRC20Chain(fromChain) ||
    !KnownTokenId.isBRC20Token(fromToken)
  ) {
    return false
  }

  const pegInAddress = getMetaPegInAddress(fromChain, toChain)
  if (pegInAddress == null) return false

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

  // brc20 -> stacks
  if (KnownChainId.isStacksChain(toChain)) {
    if (!KnownTokenId.isStacksToken(toToken)) return false

    const brc20Routes = await getBRC20SupportedRoutes(ctx, fromChain)
    return brc20Routes.some(
      route => route.brc20Token === fromToken && route.stacksToken === toToken,
    )
  }

  // brc20 -> evm
  if (KnownChainId.isEVMChain(toChain)) {
    if (!KnownTokenId.isEVMToken(toToken)) return false

    const fromRoutes = await getBRC20SupportedRoutes(ctx, fromChain)
    const toRoutes = await getEVMSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.some(
        route =>
          route.brc20Token === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) &&
      toRoutes.some(
        route =>
          route.evmToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      )
    )
  }

  // brc20 -> btc
  if (KnownChainId.isBitcoinChain(toChain)) {
    if (!KnownTokenId.isBitcoinToken(toToken)) return false

    return toToken === KnownTokenId.Bitcoin.BTC
  }

  // brc20 -> brc20
  if (KnownChainId.isBRC20Chain(toChain)) {
    if (!KnownTokenId.isBRC20Token(toToken)) return false

    const brc20Routes = await getBRC20SupportedRoutes(ctx, toChain)

    return (
      brc20Routes.find(
        route =>
          route.brc20Token === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      brc20Routes.find(
        route =>
          route.brc20Token === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // brc20 -> runes
  if (KnownChainId.isRunesChain(toChain)) {
    if (!KnownTokenId.isRunesToken(toToken)) return false

    const fromRoutes = await getBRC20SupportedRoutes(ctx, fromChain)
    const toRoutes = await getRunesSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.brc20Token === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.runesToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // brc20 -> tron
  if (KnownChainId.isTronChain(toChain)) {
    if (!KnownTokenId.isTronToken(toToken)) return false

    const fromRoutes = await getBRC20SupportedRoutes(ctx, fromChain)
    const toRoutes = await getTronSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.brc20Token === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.tronToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // brc20 -> solana
  if (KnownChainId.isSolanaChain(toChain)) {
    if (!KnownTokenId.isSolanaToken(toToken)) return false

    const fromRoutes = await getBRC20SupportedRoutes(ctx, fromChain)
    const toRoutes = await getSolanaSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.brc20Token === fromToken &&
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

export const isSupportedRunesRoute: IsSupportedFn = async (ctx, route) => {
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
    !KnownChainId.isRunesChain(fromChain) ||
    !KnownTokenId.isRunesToken(fromToken)
  ) {
    return false
  }

  const pegInAddress = getMetaPegInAddress(fromChain, toChain)
  if (pegInAddress == null) return false

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

  // runes -> stacks
  if (KnownChainId.isStacksChain(toChain)) {
    if (!KnownTokenId.isStacksToken(toToken)) return false

    const runesRoutes = await getRunesSupportedRoutes(ctx, fromChain)
    return runesRoutes.some(
      route => route.runesToken === fromToken && route.stacksToken === toToken,
    )
  }

  // runes -> evm
  if (KnownChainId.isEVMChain(toChain)) {
    if (!KnownTokenId.isEVMToken(toToken)) return false

    const fromRoutes = await getRunesSupportedRoutes(ctx, fromChain)
    const toRoutes = await getEVMSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.some(
        route =>
          route.runesToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) &&
      toRoutes.some(
        route =>
          route.evmToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      )
    )
  }

  // runes -> btc
  if (KnownChainId.isBitcoinChain(toChain)) {
    if (!KnownTokenId.isBitcoinToken(toToken)) return false

    return toToken === KnownTokenId.Bitcoin.BTC
  }

  // runes -> brc20
  if (KnownChainId.isBRC20Chain(toChain)) {
    if (!KnownTokenId.isBRC20Token(toToken)) return false

    const fromRoutes = await getRunesSupportedRoutes(ctx, fromChain)
    const toRoutes = await getBRC20SupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.runesToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.brc20Token === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // runes -> runes
  if (KnownChainId.isRunesChain(toChain)) {
    if (!KnownTokenId.isRunesToken(toToken)) return false

    const runesRoutes = await getRunesSupportedRoutes(ctx, fromChain)

    return (
      runesRoutes.find(
        route =>
          route.runesToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      runesRoutes.find(
        route =>
          route.runesToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // runes -> tron
  if (KnownChainId.isTronChain(toChain)) {
    if (!KnownTokenId.isTronToken(toToken)) return false

    const fromRoutes = await getRunesSupportedRoutes(ctx, fromChain)
    const toRoutes = await getTronSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.runesToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.tronToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // runes -> solana
  if (KnownChainId.isSolanaChain(toChain)) {
    if (!KnownTokenId.isSolanaToken(toToken)) return false

    const fromRoutes = await getRunesSupportedRoutes(ctx, fromChain)
    const toRoutes = await getSolanaSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.runesToken === fromToken &&
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
