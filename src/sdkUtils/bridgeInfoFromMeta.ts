import { getStacks2BtcFeeInfo } from "../bitcoinUtils/peggingHelpers"
import { getStacks2EvmFeeInfo } from "../evmUtils/peggingHelpers"
import {
  getMeta2StacksFeeInfo,
  getStacks2MetaFeeInfo,
  isSupportedBRC20Route,
  isSupportedRunesRoute,
} from "../metaUtils/peggingHelpers"
import { getStacks2SolanaFeeInfo } from "../solanaUtils/peggingHelpers"
import { BigNumber } from "../utils/BigNumber"
import {
  getAndCheckTransitStacksTokens,
  SwapRoute_WithExchangeRate_Public,
} from "../utils/SwapRouteHelpers"
import { hasAny, last } from "../utils/arrayHelpers"
import {
  checkRouteValid,
  KnownRoute,
  KnownRoute_FromBRC20_ToBitcoin,
  KnownRoute_FromBRC20_ToBRC20,
  KnownRoute_FromBRC20_ToEVM,
  KnownRoute_FromBRC20_ToRunes,
  KnownRoute_FromBRC20_ToSolana,
  KnownRoute_FromBRC20_ToStacks,
  KnownRoute_FromBRC20_ToTron,
  KnownRoute_FromRunes_ToBitcoin,
  KnownRoute_FromRunes_ToBRC20,
  KnownRoute_FromRunes_ToEVM,
  KnownRoute_FromRunes_ToRunes,
  KnownRoute_FromRunes_ToSolana,
  KnownRoute_FromRunes_ToStacks,
  KnownRoute_FromRunes_ToTron,
  KnownRoute_ToStacks,
} from "../utils/buildSupportedRoutes"
import { UnsupportedBridgeRouteError } from "../utils/errors"
import { assertExclude, checkNever, isNotNull } from "../utils/typeHelpers"
import {
  PublicTransferProphetAggregated,
  TransferProphet,
  transformToPublicTransferProphet,
  transformToPublicTransferProphetAggregated,
} from "../utils/types/TransferProphet"
import {
  getChainIdNetworkType,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import { constructDexAggregatorIntermediaryInfo } from "./bridgeInfoFromBitcoin"
import { ChainId, SDKNumber, TokenId } from "./types"
import { SDKGlobalContext } from "./types.internal"

export {
  BridgeInfoFromMetaInput as BridgeInfoFromBRC20Input,
  BridgeInfoFromMetaOutput as BridgeInfoFromBRC20Output,
  BridgeInfoFromMetaInput as BridgeInfoFromRunesInput,
  BridgeInfoFromMetaOutput as BridgeInfoFromRunesOutput,
}

export interface BridgeInfoFromMetaInput {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
  toToken: TokenId
  amount: SDKNumber
  swapRoute?: SwapRoute_WithExchangeRate_Public
}

export interface BridgeInfoFromMetaOutput
  extends PublicTransferProphetAggregated {}

export const bridgeInfoFromBRC20 = async (
  ctx: SDKGlobalContext,
  info: BridgeInfoFromMetaInput,
): Promise<BridgeInfoFromMetaOutput> => {
  const route = await checkRouteValid(ctx, isSupportedBRC20Route, info)

  if (KnownChainId.isBRC20Chain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeInfoFromMeta_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toTron(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else {
      checkNever(route.toChain)
    }
  } else {
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.StacksChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BitcoinChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.RunesChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.SolanaChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.TronChain>())
    checkNever(route)
  }

  throw new UnsupportedBridgeRouteError(
    info.fromChain,
    info.toChain,
    info.fromToken,
    info.toToken,
  )
}

export const bridgeInfoFromRunes = async (
  ctx: SDKGlobalContext,
  info: BridgeInfoFromMetaInput,
): Promise<BridgeInfoFromMetaOutput> => {
  const route = await checkRouteValid(ctx, isSupportedRunesRoute, info)

  if (KnownChainId.isRunesChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeInfoFromMeta_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeInfoFromMeta_toTron(ctx, {
          ...info,
          fromChain: route.fromChain as KnownChainId.BRC20Chain,
          fromToken: route.fromToken as KnownTokenId.BRC20Token,
          toChain: route.toChain,
          toToken: route.toToken,
        })
      }
    } else {
      checkNever(route.toChain)
    }
  } else {
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.StacksChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BitcoinChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BRC20Chain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.SolanaChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.TronChain>())
    checkNever(route)
  }

  throw new UnsupportedBridgeRouteError(
    info.fromChain,
    info.toChain,
    info.fromToken,
    info.toToken,
  )
}

async function bridgeInfoFromMeta_toStacks(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromMetaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBRC20_ToStacks | KnownRoute_FromRunes_ToStacks),
): Promise<BridgeInfoFromMetaOutput> {
  if (info.swapRoute == null || info.swapRoute.via === "ALEX") {
    const step1 = await getMeta2StacksFeeInfo(ctx, info, {
      swapRoute: info.swapRoute ?? null,
    })
    if (step1 == null) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
      )
    }

    return {
      ...transformToPublicTransferProphet(info, info.amount, step1),
      transferProphets: [],
    }
  }

  if (info.swapRoute.via === "evmDexAggregator") {
    const transitStacksChainId = info.toChain

    const headAndTailStacksTokens = await getAndCheckTransitStacksTokens(
      ctx,
      info,
    )
    if (headAndTailStacksTokens == null) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
        info.swapRoute,
      )
    }

    const { firstStepToStacksToken, lastStepFromStacksToken } =
      headAndTailStacksTokens

    const intermediaryInfo = await constructDexAggregatorIntermediaryInfo(
      ctx,
      info.swapRoute,
      {
        transitStacksChainId,
        firstStepToStacksToken,
        lastStepFromStacksToken,
      },
    )
    if (intermediaryInfo == null) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
        info.swapRoute,
      )
    }

    const metaPegInRoute = {
      fromChain: info.fromChain as KnownChainId.BRC20Chain,
      fromToken: info.fromToken as KnownTokenId.BRC20Token,
      toChain: transitStacksChainId,
      toToken: firstStepToStacksToken,
    } satisfies KnownRoute
    const routes = [
      metaPegInRoute,
      ...intermediaryInfo.routes,
    ] as const satisfies KnownRoute[]

    const steps = await Promise.all([
      getMeta2StacksFeeInfo(ctx, routes[0], {
        swapRoute: info.swapRoute ?? null,
      }),
      ...intermediaryInfo.steps,
    ])
    const nonNullableSteps = steps.filter(isNotNull)
    if (nonNullableSteps.length !== steps.length) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
      )
    }

    return transformToPublicTransferProphetAggregated(
      routes,
      nonNullableSteps as any,
      BigNumber.from(info.amount),
      [
        BigNumber.ONE,
        BigNumber.from(info.swapRoute?.composedExchangeRate ?? BigNumber.ONE),
      ],
    )
  }

  checkNever(info.swapRoute)
  throw new UnsupportedBridgeRouteError(
    info.fromChain,
    info.toChain,
    info.fromToken,
    info.toToken,
  )
}

async function bridgeInfoFromMeta_toEVM(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromMetaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBRC20_ToEVM | KnownRoute_FromRunes_ToEVM),
): Promise<BridgeInfoFromMetaOutput> {
  const transitStacksChainId =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet

  const headAndTailStacksTokens = await getAndCheckTransitStacksTokens(
    ctx,
    info,
  )
  if (headAndTailStacksTokens == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const { firstStepToStacksToken, lastStepFromStacksToken } =
    headAndTailStacksTokens

  let routes: (undefined | KnownRoute)[]
  let steps: (undefined | TransferProphet)[]
  let exchangeRates: BigNumber[]
  if (info.swapRoute == null || info.swapRoute.via === "ALEX") {
    const _routes = [
      {
        fromChain: info.fromChain as KnownChainId.BRC20Chain,
        fromToken: info.fromToken as KnownTokenId.BRC20Token,
        toChain: transitStacksChainId,
        toToken: firstStepToStacksToken,
      },
      {
        fromChain: transitStacksChainId,
        fromToken: lastStepFromStacksToken,
        toChain: info.toChain,
        toToken: info.toToken,
      },
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getMeta2StacksFeeInfo(ctx, _routes[0], {
        swapRoute: info.swapRoute ?? null,
      }),
      getStacks2EvmFeeInfo(ctx, _routes[1], {
        initialRoute: _routes[0],
        toDexAggregator: false,
      }),
    ])

    routes = _routes
    steps = _steps
    exchangeRates = [
      BigNumber.from(info.swapRoute?.composedExchangeRate ?? BigNumber.ONE),
    ]
  } else if (info.swapRoute.via === "evmDexAggregator") {
    const intermediaryInfo = await constructDexAggregatorIntermediaryInfo(
      ctx,
      info.swapRoute,
      {
        transitStacksChainId,
        firstStepToStacksToken,
        lastStepFromStacksToken,
      },
    )
    if (intermediaryInfo == null) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
        info.swapRoute,
      )
    }

    const metaPegInRoute = {
      fromChain: info.fromChain as KnownChainId.BRC20Chain,
      fromToken: info.fromToken as KnownTokenId.BRC20Token,
      toChain: transitStacksChainId,
      toToken: firstStepToStacksToken,
    } satisfies KnownRoute
    const evmPegOutRoute = {
      fromChain: transitStacksChainId,
      fromToken: lastStepFromStacksToken,
      toChain: info.toChain,
      toToken: info.toToken,
    } satisfies KnownRoute
    const _routes = [
      // meta peg in agg
      metaPegInRoute,
      ...intermediaryInfo.routes,
      // evm peg out
      evmPegOutRoute,
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getMeta2StacksFeeInfo(ctx, metaPegInRoute, {
        swapRoute: info.swapRoute ?? null,
      }),
      ...intermediaryInfo.steps,
      getStacks2EvmFeeInfo(ctx, evmPegOutRoute, {
        initialRoute: last(intermediaryInfo.routes) as KnownRoute_ToStacks,
        toDexAggregator: false,
      }),
    ])

    routes = _routes
    steps = _steps
    exchangeRates = [
      BigNumber.ONE,
      BigNumber.from(info.swapRoute?.composedExchangeRate ?? BigNumber.ONE),
      BigNumber.ONE,
    ]
  } else {
    checkNever(info.swapRoute)
    routes = []
    steps = []
    exchangeRates = []
  }

  const nonNullableRoutes = routes.filter(isNotNull)
  const nonNullableSteps = steps.filter(isNotNull)
  if (
    nonNullableSteps == null ||
    !hasAny(nonNullableSteps) ||
    nonNullableSteps.length !== steps?.length ||
    nonNullableRoutes == null ||
    !hasAny(nonNullableRoutes) ||
    nonNullableRoutes.length !== routes?.length ||
    !hasAny(exchangeRates)
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return transformToPublicTransferProphetAggregated(
    nonNullableRoutes,
    nonNullableSteps,
    BigNumber.from(info.amount),
    exchangeRates,
  )
}

async function bridgeInfoFromMeta_toBitcoin(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromMetaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBRC20_ToBitcoin | KnownRoute_FromRunes_ToBitcoin),
): Promise<BridgeInfoFromMetaOutput> {
  const transitStacksChainId =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet

  const headAndTailStacksTokens = await getAndCheckTransitStacksTokens(
    ctx,
    info,
  )
  if (headAndTailStacksTokens == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const { firstStepToStacksToken, lastStepFromStacksToken } =
    headAndTailStacksTokens

  let routes: (undefined | KnownRoute)[]
  let steps: (undefined | TransferProphet)[]
  let exchangeRates: BigNumber[]
  if (info.swapRoute == null || info.swapRoute.via === "ALEX") {
    const _routes = [
      {
        fromChain: info.fromChain as KnownChainId.BRC20Chain,
        fromToken: info.fromToken as KnownTokenId.BRC20Token,
        toChain: transitStacksChainId,
        toToken: firstStepToStacksToken,
      },
      {
        fromChain: transitStacksChainId,
        fromToken: lastStepFromStacksToken,
        toChain: info.toChain,
        toToken: info.toToken,
      },
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getMeta2StacksFeeInfo(ctx, _routes[0], {
        swapRoute: info.swapRoute ?? null,
      }),
      getStacks2BtcFeeInfo(ctx, _routes[1], {
        swapRoute: info.swapRoute ?? null,
        initialRoute: _routes[0],
      }),
    ])

    routes = _routes
    steps = _steps
    exchangeRates = [
      BigNumber.from(info.swapRoute?.composedExchangeRate ?? BigNumber.ONE),
    ]
  } else if (info.swapRoute.via === "evmDexAggregator") {
    const intermediaryInfo = await constructDexAggregatorIntermediaryInfo(
      ctx,
      info.swapRoute,
      {
        transitStacksChainId,
        firstStepToStacksToken,
        lastStepFromStacksToken,
      },
    )
    if (intermediaryInfo == null) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
        info.swapRoute,
      )
    }

    const metaPegInRoute = {
      fromChain: info.fromChain as KnownChainId.BRC20Chain,
      fromToken: info.fromToken as KnownTokenId.BRC20Token,
      toChain: transitStacksChainId,
      toToken: firstStepToStacksToken,
    } satisfies KnownRoute
    const btcPegOutRoute = {
      fromChain: transitStacksChainId,
      fromToken: lastStepFromStacksToken,
      toChain: info.toChain,
      toToken: info.toToken,
    } satisfies KnownRoute
    const _routes = [
      // meta peg in agg
      metaPegInRoute,
      ...intermediaryInfo.routes,
      // evm peg out
      btcPegOutRoute,
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getMeta2StacksFeeInfo(ctx, metaPegInRoute, {
        swapRoute: info.swapRoute ?? null,
      }),
      ...intermediaryInfo.steps,
      getStacks2BtcFeeInfo(ctx, btcPegOutRoute, {
        initialRoute: last(intermediaryInfo.routes) as KnownRoute_ToStacks,
        swapRoute: null,
      }),
    ])

    routes = _routes
    steps = _steps
    exchangeRates = [
      BigNumber.ONE,
      BigNumber.from(info.swapRoute?.composedExchangeRate ?? BigNumber.ONE),
      BigNumber.ONE,
    ]
  } else {
    checkNever(info.swapRoute)
    routes = []
    steps = []
    exchangeRates = []
  }

  const nonNullableRoutes = routes.filter(isNotNull)
  const nonNullableSteps = steps.filter(isNotNull)
  if (
    nonNullableSteps == null ||
    !hasAny(nonNullableSteps) ||
    nonNullableSteps.length !== steps?.length ||
    nonNullableRoutes == null ||
    !hasAny(nonNullableRoutes) ||
    nonNullableRoutes.length !== routes?.length ||
    !hasAny(exchangeRates)
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return transformToPublicTransferProphetAggregated(
    nonNullableRoutes,
    nonNullableSteps,
    BigNumber.from(info.amount),
    exchangeRates,
  )
}

async function bridgeInfoFromMeta_toMeta(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromMetaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (
      | KnownRoute_FromBRC20_ToBRC20
      | KnownRoute_FromBRC20_ToRunes
      | KnownRoute_FromRunes_ToBRC20
      | KnownRoute_FromRunes_ToRunes
    ),
): Promise<BridgeInfoFromMetaOutput> {
  const transitStacksChainId =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet

  const headAndTailStacksTokens = await getAndCheckTransitStacksTokens(
    ctx,
    info,
  )
  if (headAndTailStacksTokens == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const { firstStepToStacksToken, lastStepFromStacksToken } =
    headAndTailStacksTokens

  let routes: (undefined | KnownRoute)[]
  let steps: (undefined | TransferProphet)[]
  let exchangeRates: BigNumber[]
  if (info.swapRoute == null || info.swapRoute.via === "ALEX") {
    const _routes = [
      {
        fromChain: info.fromChain as KnownChainId.BRC20Chain,
        fromToken: info.fromToken as KnownTokenId.BRC20Token,
        toChain: transitStacksChainId,
        toToken: firstStepToStacksToken,
      },
      {
        fromChain: transitStacksChainId,
        fromToken: lastStepFromStacksToken,
        toChain: info.toChain as KnownChainId.BRC20Chain,
        toToken: info.toToken as KnownTokenId.BRC20Token,
      },
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getMeta2StacksFeeInfo(ctx, _routes[0], {
        swapRoute: info.swapRoute ?? null,
      }),
      getStacks2MetaFeeInfo(ctx, _routes[1], {
        swapRoute: info.swapRoute ?? null,
        initialRoute: _routes[0],
      }),
    ])

    routes = _routes
    steps = _steps
    exchangeRates = [
      BigNumber.from(info.swapRoute?.composedExchangeRate ?? BigNumber.ONE),
    ]
  } else if (info.swapRoute.via === "evmDexAggregator") {
    const intermediaryInfo = await constructDexAggregatorIntermediaryInfo(
      ctx,
      info.swapRoute,
      {
        transitStacksChainId,
        firstStepToStacksToken,
        lastStepFromStacksToken,
      },
    )
    if (intermediaryInfo == null) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
        info.swapRoute,
      )
    }

    const metaPegInRoute = {
      fromChain: info.fromChain as KnownChainId.BRC20Chain,
      fromToken: info.fromToken as KnownTokenId.BRC20Token,
      toChain: transitStacksChainId,
      toToken: firstStepToStacksToken,
    } satisfies KnownRoute
    const metaPegOutRoute = {
      fromChain: transitStacksChainId,
      fromToken: lastStepFromStacksToken,
      toChain: info.toChain as KnownChainId.BRC20Chain,
      toToken: info.toToken as KnownTokenId.BRC20Token,
    } satisfies KnownRoute
    const _routes = [
      // meta peg in agg
      metaPegInRoute,
      ...intermediaryInfo.routes,
      // evm peg out
      metaPegOutRoute,
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getMeta2StacksFeeInfo(ctx, metaPegInRoute, {
        swapRoute: info.swapRoute ?? null,
      }),
      ...intermediaryInfo.steps,
      getStacks2MetaFeeInfo(ctx, metaPegOutRoute, {
        initialRoute: last(intermediaryInfo.routes) as KnownRoute_ToStacks,
        swapRoute: null,
      }),
    ])

    routes = _routes
    steps = _steps
    exchangeRates = [
      BigNumber.ONE,
      BigNumber.from(info.swapRoute?.composedExchangeRate ?? BigNumber.ONE),
      BigNumber.ONE,
    ]
  } else {
    checkNever(info.swapRoute)
    routes = []
    steps = []
    exchangeRates = []
  }

  const nonNullableRoutes = routes.filter(isNotNull)
  const nonNullableSteps = steps.filter(isNotNull)
  if (
    nonNullableSteps == null ||
    !hasAny(nonNullableSteps) ||
    nonNullableSteps.length !== steps?.length ||
    nonNullableRoutes == null ||
    !hasAny(nonNullableRoutes) ||
    nonNullableRoutes.length !== routes?.length ||
    !hasAny(exchangeRates)
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return transformToPublicTransferProphetAggregated(
    nonNullableRoutes,
    nonNullableSteps,
    BigNumber.from(info.amount),
    exchangeRates,
  )
}

async function bridgeInfoFromMeta_toSolana(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromMetaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBRC20_ToSolana | KnownRoute_FromRunes_ToSolana),
): Promise<BridgeInfoFromMetaOutput> {
  const transitStacksChainId =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet

  const headAndTailStacksTokens = await getAndCheckTransitStacksTokens(
    ctx,
    info,
  )
  if (headAndTailStacksTokens == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const { firstStepToStacksToken, lastStepFromStacksToken } =
    headAndTailStacksTokens

  let routes: (undefined | KnownRoute)[]
  let steps: (undefined | TransferProphet)[]
  let exchangeRates: BigNumber[]
  if (info.swapRoute == null || info.swapRoute.via === "ALEX") {
    const _routes = [
      {
        fromChain: info.fromChain as KnownChainId.BRC20Chain,
        fromToken: info.fromToken as KnownTokenId.BRC20Token,
        toChain: transitStacksChainId,
        toToken: firstStepToStacksToken,
      },
      {
        fromChain: transitStacksChainId,
        fromToken: lastStepFromStacksToken,
        toChain: info.toChain,
        toToken: info.toToken,
      },
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getMeta2StacksFeeInfo(ctx, _routes[0], {
        swapRoute: info.swapRoute ?? null,
      }),
      getStacks2SolanaFeeInfo(ctx, _routes[1], {
        initialRoute: _routes[0],
      }),
    ])

    routes = _routes
    steps = _steps
    exchangeRates = [
      BigNumber.from(info.swapRoute?.composedExchangeRate ?? BigNumber.ONE),
    ]
  } else if (info.swapRoute.via === "evmDexAggregator") {
    const intermediaryInfo = await constructDexAggregatorIntermediaryInfo(
      ctx,
      info.swapRoute,
      {
        transitStacksChainId,
        firstStepToStacksToken,
        lastStepFromStacksToken,
      },
    )
    if (intermediaryInfo == null) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
        info.swapRoute,
      )
    }

    const metaPegInRoute = {
      fromChain: info.fromChain as KnownChainId.BRC20Chain,
      fromToken: info.fromToken as KnownTokenId.BRC20Token,
      toChain: transitStacksChainId,
      toToken: firstStepToStacksToken,
    } satisfies KnownRoute
    const solanaPegOutRoute = {
      fromChain: transitStacksChainId,
      fromToken: lastStepFromStacksToken,
      toChain: info.toChain,
      toToken: info.toToken,
    } satisfies KnownRoute
    const _routes = [
      // meta peg in agg
      metaPegInRoute,
      ...intermediaryInfo.routes,
      // solana peg out
      solanaPegOutRoute,
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getMeta2StacksFeeInfo(ctx, metaPegInRoute, {
        swapRoute: info.swapRoute ?? null,
      }),
      ...intermediaryInfo.steps,
      getStacks2SolanaFeeInfo(ctx, solanaPegOutRoute, {
        initialRoute: last(intermediaryInfo.routes) as KnownRoute_ToStacks,
      }),
    ])

    routes = _routes
    steps = _steps
    exchangeRates = [
      BigNumber.ONE,
      BigNumber.from(info.swapRoute?.composedExchangeRate ?? BigNumber.ONE),
      BigNumber.ONE,
    ]
  } else {
    checkNever(info.swapRoute)
    routes = []
    steps = []
    exchangeRates = []
  }

  const nonNullableRoutes = routes.filter(isNotNull)
  const nonNullableSteps = steps.filter(isNotNull)
  if (
    nonNullableSteps == null ||
    !hasAny(nonNullableSteps) ||
    nonNullableSteps.length !== steps?.length ||
    nonNullableRoutes == null ||
    !hasAny(nonNullableRoutes) ||
    nonNullableRoutes.length !== routes?.length ||
    !hasAny(exchangeRates)
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return transformToPublicTransferProphetAggregated(
    nonNullableRoutes,
    nonNullableSteps,
    BigNumber.from(info.amount),
    exchangeRates,
  )
}

async function bridgeInfoFromMeta_toTron(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromMetaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBRC20_ToTron | KnownRoute_FromRunes_ToTron),
): Promise<BridgeInfoFromMetaOutput> {
  throw new Error("WIP")
}
