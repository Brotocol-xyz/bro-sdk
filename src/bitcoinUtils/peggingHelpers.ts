import { getEVMSupportedRoutes } from "../evmUtils/apiHelpers/getEVMSupportedRoutes"
import { getBRC20SupportedRoutes } from "../metaUtils/apiHelpers/getBRC20SupportedRoutes"
import { getRunesSupportedRoutes } from "../metaUtils/apiHelpers/getRunesSupportedRoutes"
import { StacksContractName } from "../stacksUtils/stxContractAddresses"
import {
  executeReadonlyCallBro,
  getStacksContractCallInfo,
  getStacksTokenContractInfo,
  numberFromStacksContractNumber,
} from "../stacksUtils/contractHelpers"
import { BigNumber } from "../utils/BigNumber"
import {
  IsSupportedFn,
  KnownRoute_FromBitcoin_ToStacks,
  KnownRoute_FromStacks_ToBitcoin,
  KnownRoute_ToStacks,
} from "../utils/buildSupportedRoutes"
import { props } from "../utils/promiseHelpers"
import {
  getAndCheckTransitStacksTokens,
  getSpecialFeeDetailsForSwapRoute,
  SpecialFeeDetailsForSwapRoute,
  SwapRoute,
} from "../utils/SwapRouteHelpers"
import { checkNever, isNotNull } from "../utils/typeHelpers"
import {
  _allNoLongerSupportedEVMChains,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import {
  TransferProphet,
  TransferProphet_Fee_Fixed,
  TransferProphet_Fee_Rate,
} from "../utils/types/TransferProphet"
import {
  SDKGlobalContext,
  withGlobalContextCache,
} from "../sdkUtils/types.internal"
import { getBTCPegInAddress } from "./btcAddresses"
import { getTronSupportedRoutes } from "../tronUtils/getTronSupportedRoutes"
import { getSolanaSupportedRoutes } from "../solanaUtils/getSolanaSupportedRoutes"

export const getBtc2StacksFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromBitcoin_ToStacks,
  options: {
    swapRoute: null | Pick<SwapRoute, "via">
  },
): Promise<undefined | TransferProphet> => {
  return withGlobalContextCache(
    ctx.btc.feeRateCache,
    `${withGlobalContextCache.cacheKeyFromRoute(route)}:${options.swapRoute?.via ?? ""}`,
    () => _getBtc2StacksFeeInfo(ctx, route, options),
  )
}
const _getBtc2StacksFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromBitcoin_ToStacks,
  options: {
    swapRoute: null | Pick<SwapRoute, "via">
  },
): Promise<undefined | TransferProphet> => {
  const stacksBaseContractCallInfo = getStacksContractCallInfo(
    route.toChain,
    StacksContractName.BTCPegInEndpoint,
  )
  const stacksSwapContractCallInfo = getStacksContractCallInfo(
    route.toChain,
    StacksContractName.BTCPegInEndpointSwap,
  )
  const stacksAggContractCallInfo = getStacksContractCallInfo(
    route.toChain,
    StacksContractName.BTCPegInEndpointAggregator,
  )
  if (
    stacksBaseContractCallInfo == null ||
    stacksSwapContractCallInfo == null ||
    stacksAggContractCallInfo == null
  ) {
    return
  }

  // prettier-ignore
  const contractCallInfo =
    options.swapRoute?.via === 'ALEX' ? stacksSwapContractCallInfo :
    options.swapRoute?.via === 'evmDexAggregator' ? stacksAggContractCallInfo :
    options.swapRoute == null ? stacksBaseContractCallInfo :
    (checkNever(options.swapRoute.via), stacksBaseContractCallInfo)

  const resp = await props({
    isPaused: executeReadonlyCallBro(
      contractCallInfo.contractName,
      "is-peg-in-paused",
      {},
      contractCallInfo.executeOptions,
    ),
    feeRate: executeReadonlyCallBro(
      contractCallInfo.contractName,
      "get-peg-in-fee",
      {},
      contractCallInfo.executeOptions,
    ).then(numberFromStacksContractNumber),
    minFeeAmount: executeReadonlyCallBro(
      contractCallInfo.contractName,
      "get-peg-in-min-fee",
      {},
      contractCallInfo.executeOptions,
    ).then(numberFromStacksContractNumber),
  }).then(
    resp => {
      if (ctx.debugLog) {
        console.log("[getBtc2StacksFeeInfo]", route, resp)
      }
      return resp
    },
    err => {
      if (ctx.debugLog) {
        console.log("[getBtc2StacksFeeInfo]", route, err)
      }
      throw err
    },
  )

  return {
    isPaused: resp.isPaused,
    bridgeToken: route.fromToken,
    fees: [
      {
        type: "rate",
        token: route.fromToken,
        rate: resp.feeRate,
        minimumAmount: resp.minFeeAmount,
      },
    ],
    minBridgeAmount: BigNumber.isZero(resp.minFeeAmount)
      ? null
      : resp.minFeeAmount,
    maxBridgeAmount: null,
  }
}

export const getStacks2BtcFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromStacks_ToBitcoin,
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
    ctx.btc.feeRateCache,
    [
      withGlobalContextCache.cacheKeyFromRoute(route),
      options.initialRoute == null
        ? ""
        : withGlobalContextCache.cacheKeyFromRoute(options.initialRoute),
      options.swapRoute == null ? "" : options.swapRoute.via,
    ].join("#"),
    () => _getStacks2BtcFeeInfo(ctx, route, options),
  )
}
const _getStacks2BtcFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromStacks_ToBitcoin,
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
  const stacksContractCallInfo = getStacksContractCallInfo(
    route.fromChain,
    StacksContractName.BTCPegOutEndpoint,
  )
  const btcPegInSwapContractCallInfo = getStacksContractCallInfo(
    route.fromChain,
    StacksContractName.BTCPegInEndpointSwap,
  )
  const metaPegInSwapContractCallInfo = getStacksContractCallInfo(
    route.fromChain,
    StacksContractName.MetaPegInEndpointSwap,
  )
  if (
    stacksContractCallInfo == null ||
    btcPegInSwapContractCallInfo == null ||
    metaPegInSwapContractCallInfo == null
  ) {
    return
  }

  const specialFeeInfo = await getSpecialFeeDetailsForSwapRoute(ctx, route, {
    initialRoute: options.initialRoute,
    swapRoute: options.swapRoute,
  })

  if (ctx.debugLog) {
    console.log("[getStacks2BtcFeeInfo/specialFeeInfo]", route, specialFeeInfo)
  }

  const feeDetails: SpecialFeeDetailsForSwapRoute =
    specialFeeInfo ??
    (await props({
      feeRate: executeReadonlyCallBro(
        stacksContractCallInfo.contractName,
        "get-peg-out-fee",
        {},
        stacksContractCallInfo.executeOptions,
      ).then(numberFromStacksContractNumber),
      minFeeAmount: executeReadonlyCallBro(
        stacksContractCallInfo.contractName,
        "get-peg-out-min-fee",
        {},
        stacksContractCallInfo.executeOptions,
      ).then(numberFromStacksContractNumber),
    }))

  const resp = await props({
    ...feeDetails,
    isPaused: executeReadonlyCallBro(
      stacksContractCallInfo.contractName,
      "is-peg-out-paused",
      {},
      stacksContractCallInfo.executeOptions,
    ),
  }).then(
    resp => {
      if (ctx.debugLog) {
        console.log("[getStacks2BtcFeeInfo]", route, resp)
      }
      return resp
    },
    err => {
      if (ctx.debugLog) {
        console.log("[getStacks2BtcFeeInfo]", route, err)
      }
      throw err
    },
  )

  return {
    isPaused: resp.isPaused,
    bridgeToken: route.fromToken,
    fees: [
      {
        type: "rate",
        token: route.fromToken,
        rate: resp.feeRate,
        minimumAmount: resp.minFeeAmount,
      } satisfies TransferProphet_Fee_Rate,
      feeDetails.gasFee == null
        ? null
        : ({
            type: "fixed",
            token: feeDetails.gasFee.token,
            amount: feeDetails.gasFee.amount,
          } satisfies TransferProphet_Fee_Fixed),
    ].filter(isNotNull),
    minBridgeAmount: BigNumber.isZero(resp.minFeeAmount)
      ? null
      : resp.minFeeAmount,
    maxBridgeAmount: null,
  }
}

export const isSupportedBitcoinRoute: IsSupportedFn = async (ctx, route) => {
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
    !KnownChainId.isBitcoinChain(fromChain) ||
    !KnownTokenId.isBitcoinToken(fromToken)
  ) {
    return false
  }

  const pegInAddress = getBTCPegInAddress(fromChain, toChain)
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

  // btc -> stacks
  if (KnownChainId.isStacksChain(toChain)) {
    if (!KnownTokenId.isStacksToken(toToken)) return false

    if (fromToken !== KnownTokenId.Bitcoin.BTC) return false

    const stacksTokenContractInfo = await getStacksTokenContractInfo(
      ctx,
      toChain,
      toToken,
    )
    if (stacksTokenContractInfo == null) return false

    return toToken === KnownTokenId.Stacks.aBTC
  }

  // btc -> evm
  if (KnownChainId.isEVMChain(toChain)) {
    if (!KnownTokenId.isEVMToken(toToken)) return false

    const toRoutes = await getEVMSupportedRoutes(ctx, toChain)

    return (
      firstStepToStacksToken === KnownTokenId.Stacks.aBTC &&
      toRoutes.some(
        route =>
          route.evmToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      )
    )
  }

  if (KnownChainId.isTronChain(toChain)) {
    if (!KnownTokenId.isTronToken(toToken)) return false

    // TODO: implement tron support
    return false
  }

  // btc -> btc
  if (KnownChainId.isBitcoinChain(toChain)) {
    return false
  }

  // btc -> brc20
  if (KnownChainId.isBRC20Chain(toChain)) {
    if (!KnownTokenId.isBRC20Token(toToken)) return false

    const toRoutes = await getBRC20SupportedRoutes(ctx, toChain)

    return (
      firstStepToStacksToken === KnownTokenId.Stacks.aBTC &&
      toRoutes.some(
        route =>
          route.brc20Token === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      )
    )
  }

  // btc -> runes
  if (KnownChainId.isRunesChain(toChain)) {
    if (!KnownTokenId.isRunesToken(toToken)) return false

    const toRoutes = await getRunesSupportedRoutes(ctx, toChain)

    return (
      firstStepToStacksToken === KnownTokenId.Stacks.aBTC &&
      toRoutes.some(
        route =>
          route.runesToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      )
    )
  }

  // btc -> tron
  if (KnownChainId.isTronChain(toChain)) {
    if (!KnownTokenId.isTronToken(toToken)) return false

    const toRoutes = await getTronSupportedRoutes(ctx, toChain)

    return (
      firstStepToStacksToken === KnownTokenId.Stacks.aBTC &&
      toRoutes.some(
        route =>
          route.tronToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      )
    )
  }

  // btc -> solana
  if (KnownChainId.isSolanaChain(toChain)) {
    if (!KnownTokenId.isSolanaToken(toToken)) return false

    const toRoutes = await getSolanaSupportedRoutes(ctx, toChain)

    return (
      firstStepToStacksToken === KnownTokenId.Stacks.aBTC &&
      toRoutes.some(
        route =>
          route.solanaToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      )
    )
  }

  checkNever(toChain)
  return false
}
