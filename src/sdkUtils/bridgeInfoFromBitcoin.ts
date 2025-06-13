import {
  getBtc2StacksFeeInfo,
  isSupportedBitcoinRoute,
} from "../bitcoinUtils/peggingHelpers"
import {
  evmTokenFromCorrespondingStacksToken,
  getEvm2StacksFeeInfo,
  getStacks2EvmFeeInfo,
} from "../evmUtils/peggingHelpers"
import {
  getStacks2SolanaFeeInfo,
} from "../solanaUtils/peggingHelpers"
import { getStacks2MetaFeeInfo } from "../metaUtils/peggingHelpers"
import { StacksContractName } from "../stacksUtils/stxContractAddresses"
import {
  executeReadonlyCallBro,
  getStacksContractCallInfo,
  numberFromStacksContractNumber,
} from "../stacksUtils/contractHelpers"
import { BigNumber } from "../utils/BigNumber"
import {
  getAndCheckTransitStacksTokens,
  SwapRoute_WithExchangeRate_Public,
  SwapRouteViaEVMDexAggregator_WithExchangeRate_Public,
} from "../utils/SwapRouteHelpers"
import { hasAny, last } from "../utils/arrayHelpers"
import {
  checkRouteValid,
  KnownRoute,
  KnownRoute_FromBitcoin_ToBRC20,
  KnownRoute_FromBitcoin_ToEVM,
  KnownRoute_FromBitcoin_ToRunes,
  KnownRoute_FromBitcoin_ToSolana,
  KnownRoute_FromBitcoin_ToStacks,
  KnownRoute_FromBitcoin_ToTron,
  KnownRoute_ToStacks,
} from "../utils/buildSupportedRoutes"
import { UnsupportedBridgeRouteError } from "../utils/errors"
import { props } from "../utils/promiseHelpers"
import { assertExclude, checkNever, isNotNull } from "../utils/typeHelpers"
import {
  PublicTransferProphetAggregated,
  TransferProphet,
  transformToPublicTransferProphet,
  transformToPublicTransferProphetAggregated,
} from "../utils/types/TransferProphet"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { ChainId, SDKNumber, TokenId } from "./types"
import { SDKGlobalContext } from "./types.internal"

export interface BridgeInfoFromBitcoinInput {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
  toToken: TokenId
  amount: SDKNumber
  swapRoute?: SwapRoute_WithExchangeRate_Public
}

export interface BridgeInfoFromBitcoinOutput
  extends PublicTransferProphetAggregated {}

export const bridgeInfoFromBitcoin = async (
  ctx: SDKGlobalContext,
  info: BridgeInfoFromBitcoinInput,
): Promise<BridgeInfoFromBitcoinOutput> => {
  const route = await checkRouteValid(ctx, isSupportedBitcoinRoute, info)

  if (KnownChainId.isBitcoinChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeInfoFromBitcoin_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeInfoFromBitcoin_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeInfoFromBitcoin_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeInfoFromBitcoin_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeInfoFromBitcoin_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeInfoFromBitcoin_toTron(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else {
      assertExclude(route.toChain, assertExclude.i<KnownChainId.BitcoinChain>())
      checkNever(route)
    }
  } else {
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.StacksChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BRC20Chain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.RunesChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.TronChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.SolanaChain>())
    checkNever(route)
  }

  throw new UnsupportedBridgeRouteError(
    info.fromChain,
    info.toChain,
    info.fromToken,
    info.toToken,
  )
}

async function bridgeInfoFromBitcoin_toStacks(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToStacks,
): Promise<BridgeInfoFromBitcoinOutput> {
  if (info.swapRoute == null || info.swapRoute.via === "ALEX") {
    const step1 = await getBtc2StacksFeeInfo(ctx, info, {
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

    const btcPegInRoute = {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
      toChain: transitStacksChainId,
      toToken: firstStepToStacksToken,
    } satisfies KnownRoute
    const routes = [
      btcPegInRoute,
      ...intermediaryInfo.routes,
    ] as const satisfies KnownRoute[]

    const steps = await Promise.all([
      getBtc2StacksFeeInfo(ctx, routes[0], {
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

async function bridgeInfoFromBitcoin_toEVM(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToEVM,
): Promise<BridgeInfoFromBitcoinOutput> {
  const transitStacksChainId =
    info.fromChain === KnownChainId.Bitcoin.Mainnet
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
      info.swapRoute,
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
        fromChain: info.fromChain,
        fromToken: info.fromToken,
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
      getBtc2StacksFeeInfo(ctx, _routes[0], {
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

    const btcPegInRoute = {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
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
      // btc peg in agg
      btcPegInRoute,
      ...intermediaryInfo.routes,
      // evm peg out
      evmPegOutRoute,
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getBtc2StacksFeeInfo(ctx, btcPegInRoute, {
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

async function bridgeInfoFromBitcoin_toMeta(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBitcoin_ToBRC20 | KnownRoute_FromBitcoin_ToRunes),
): Promise<BridgeInfoFromBitcoinOutput> {
  const transitStacksChainId =
    info.fromChain === KnownChainId.Bitcoin.Mainnet
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
      info.swapRoute,
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
        fromChain: info.fromChain,
        fromToken: info.fromToken,
        toChain: transitStacksChainId,
        toToken: firstStepToStacksToken,
      },
      {
        fromChain: transitStacksChainId,
        fromToken: lastStepFromStacksToken,
        toChain: info.toChain as any,
        toToken: info.toToken as any,
      },
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getBtc2StacksFeeInfo(ctx, _routes[0], {
        swapRoute: info.swapRoute ?? null,
      }),
      getStacks2MetaFeeInfo(ctx, _routes[1], {
        initialRoute: _routes[0],
        swapRoute: info.swapRoute ?? null,
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

    const btcPegInRoute = {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
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
      // btc peg in agg
      btcPegInRoute,
      ...intermediaryInfo.routes,
      // meta peg out
      metaPegOutRoute,
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getBtc2StacksFeeInfo(ctx, btcPegInRoute, {
        swapRoute: info.swapRoute ?? null,
      }),
      ...intermediaryInfo.steps,
      getStacks2MetaFeeInfo(ctx, metaPegOutRoute as any, {
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

async function bridgeInfoFromBitcoin_toSolana(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToSolana,
): Promise<BridgeInfoFromBitcoinOutput> {
  const transitStacksChainId =
    info.fromChain === KnownChainId.Bitcoin.Mainnet
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
      info.swapRoute,
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
        fromChain: info.fromChain,
        fromToken: info.fromToken,
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
      getBtc2StacksFeeInfo(ctx, _routes[0], {
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

    const btcPegInRoute = {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
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
      // btc peg in agg
      btcPegInRoute,
      ...intermediaryInfo.routes,
      // solana peg out
      solanaPegOutRoute,
    ] as const satisfies KnownRoute[]

    const _steps = await Promise.all([
      getBtc2StacksFeeInfo(ctx, btcPegInRoute, {
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

async function bridgeInfoFromBitcoin_toTron(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToTron,
): Promise<BridgeInfoFromBitcoinOutput> {
  throw new Error("WIP")
}

export async function constructDexAggregatorIntermediaryInfo(
  ctx: SDKGlobalContext,
  swapRoute: SwapRouteViaEVMDexAggregator_WithExchangeRate_Public,
  info: {
    transitStacksChainId: KnownChainId.StacksChain
    firstStepToStacksToken: KnownTokenId.StacksToken
    lastStepFromStacksToken: KnownTokenId.StacksToken
  },
): Promise<null | {
  routes: readonly KnownRoute[]
  steps: Promise<undefined | TransferProphet>[]
}> {
  const {
    transitStacksChainId,
    firstStepToStacksToken,
    lastStepFromStacksToken,
  } = info

  const swapFromEVMTokenId = (
    await evmTokenFromCorrespondingStacksToken(
      ctx,
      swapRoute.evmChain,
      firstStepToStacksToken,
    )
  )[0]
  const swapToEVMTokenId = (
    await evmTokenFromCorrespondingStacksToken(
      ctx,
      swapRoute.evmChain,
      lastStepFromStacksToken,
    )
  )[0]
  if (swapFromEVMTokenId == null || swapToEVMTokenId == null) {
    return null
  }

  const routes = [
    // evm peg out agg
    {
      fromChain: transitStacksChainId,
      fromToken: firstStepToStacksToken,
      toChain: swapRoute.evmChain,
      toToken: swapFromEVMTokenId,
    },
    //
    // swap
    //
    // evm peg in
    {
      fromChain: swapRoute.evmChain,
      fromToken: swapToEVMTokenId,
      toChain: transitStacksChainId,
      toToken: lastStepFromStacksToken,
    },
  ] as const

  const steps = [
    // evm peg out agg
    getStacks2EvmFeeInfo(ctx, routes[0], {
      initialRoute: null,
      toDexAggregator: true,
    }),
    //
    // swap
    //
    // evm peg in
    getEvm2StacksFeeInfo(ctx, routes[1]),
  ]

  return {
    routes,
    steps,
  }
}

export async function bridgeInfoFromBitcoin_toLaunchpad(
  ctx: SDKGlobalContext,
  info: {
    fromChain: KnownChainId.BitcoinChain
    fromToken: KnownTokenId.BitcoinToken
    launchId: SDKNumber
    amount: SDKNumber
  },
): Promise<BridgeInfoFromBitcoinOutput> {
  const toChain =
    info.fromChain === KnownChainId.Bitcoin.Mainnet
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet
  const toToken = KnownTokenId.Stacks.aBTC

  const contractCallInfo = getStacksContractCallInfo(
    toChain,
    StacksContractName.BTCPegInEndpointLaunchpad,
  )
  if (contractCallInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      toChain,
      info.fromToken,
      toToken,
    )
  }

  const route: KnownRoute = {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain,
    toToken,
  }

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
  })

  const transferProphet: TransferProphet = {
    isPaused: resp.isPaused,
    bridgeToken: info.fromToken,
    fees: [
      {
        type: "rate",
        token: info.fromToken,
        rate: resp.feeRate,
        minimumAmount: resp.minFeeAmount,
      },
    ],
    minBridgeAmount: BigNumber.isZero(resp.minFeeAmount)
      ? null
      : resp.minFeeAmount,
    maxBridgeAmount: null,
  }

  return {
    ...transformToPublicTransferProphet(route, info.amount, transferProphet),
    transferProphets: [],
  }
}
