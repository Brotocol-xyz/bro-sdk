import { getStacks2BtcFeeInfo } from "../bitcoinUtils/peggingHelpers"
import {
  getSolana2StacksFeeInfo,
  getStacks2SolanaFeeInfo,
  isSupportedSolanaRoute,
} from "../solanaUtils/peggingHelpers"
import { getStacks2MetaFeeInfo } from "../metaUtils/peggingHelpers"
import { getStacks2EvmFeeInfo } from "../evmUtils/peggingHelpers"
import { BigNumber } from "../utils/BigNumber"
import { getAndCheckTransitStacksTokens } from "../utils/SwapRouteHelpers"
import {
  checkRouteValid,
  KnownRoute,
  KnownRoute_FromSolana_ToBitcoin,
  KnownRoute_FromSolana_ToBRC20,
  KnownRoute_FromSolana_ToEVM,
  KnownRoute_FromSolana_ToRunes,
  KnownRoute_FromSolana_ToSolana,
  KnownRoute_FromSolana_ToStacks,
  KnownRoute_FromSolana_ToTron,
  KnownRoute_FromStacks_ToBRC20,
  KnownRoute_FromStacks_ToRunes,
} from "../utils/buildSupportedRoutes"
import { UnsupportedBridgeRouteError } from "../utils/errors"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  PublicTransferProphetAggregated,
  transformToPublicTransferProphet,
  transformToPublicTransferProphetAggregated2,
} from "../utils/types/TransferProphet"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { ChainId, SDKNumber, TokenId } from "./types"
import { SDKGlobalContext } from "./types.internal"

export interface BridgeInfoFromSolanaInput {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
  toToken: TokenId
  amount: SDKNumber
}

export interface BridgeInfoFromSolanaOutput
  extends PublicTransferProphetAggregated {}

export async function bridgeInfoFromSolana(
  ctx: SDKGlobalContext,
  info: BridgeInfoFromSolanaInput,
): Promise<BridgeInfoFromSolanaOutput> {
  const route = await checkRouteValid(ctx, isSupportedSolanaRoute, info)

  if (KnownChainId.isSolanaChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeInfoFromSolana_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeInfoFromSolana_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeInfoFromSolana_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeInfoFromSolana_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeInfoFromSolana_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeInfoFromSolana_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeInfoFromSolana_toTron(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else {
      checkNever(route.toChain)
    }
  } else {
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.StacksChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BitcoinChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BRC20Chain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.RunesChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.TronChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    checkNever(route)
  }

  throw new UnsupportedBridgeRouteError(
    info.fromChain,
    info.toChain,
    info.fromToken,
    info.toToken,
  )
}

async function bridgeInfoFromSolana_toStacks(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToStacks,
): Promise<BridgeInfoFromSolanaOutput> {
  const step1 = await getSolana2StacksFeeInfo(ctx, info)
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

async function bridgeInfoFromSolana_toBitcoin(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToBitcoin,
): Promise<BridgeInfoFromSolanaOutput> {
  const transitStacksChain = KnownChainId.isSolanaChain(info.fromChain)
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

  const step1Route: KnownRoute = {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: transitStacksChain,
    toToken: firstStepToStacksToken,
  }
  const step2Route: KnownRoute = {
    fromChain: transitStacksChain,
    fromToken: lastStepFromStacksToken,
    toChain: info.toChain,
    toToken: info.toToken,
  }

  const [step1, step2] = await Promise.all([
    getSolana2StacksFeeInfo(ctx, step1Route),
    getStacks2BtcFeeInfo(ctx, step2Route, {
      initialRoute: step1Route,
      swapRoute: null,
    }),
  ])
  if (step1 == null || step2 == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return transformToPublicTransferProphetAggregated2(
    [step1Route, step2Route],
    [step1, step2],
    BigNumber.from(info.amount),
    BigNumber.ONE,
  )
}

async function bridgeInfoFromSolana_toEVM(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToEVM,
): Promise<BridgeInfoFromSolanaOutput> {
  const transitStacksChain = KnownChainId.isSolanaChain(info.fromChain)
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

  const step1Route: KnownRoute = {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: transitStacksChain,
    toToken: firstStepToStacksToken,
  }
  const step2Route: KnownRoute = {
    fromChain: transitStacksChain,
    fromToken: lastStepFromStacksToken,
    toChain: info.toChain,
    toToken: info.toToken,
  }

  const [step1, step2] = await Promise.all([
    getSolana2StacksFeeInfo(ctx, step1Route),
    getStacks2EvmFeeInfo(ctx, step2Route, {
      initialRoute: step1Route,
      toDexAggregator: false,
    }),
  ])
  if (step1 == null || step2 == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return transformToPublicTransferProphetAggregated2(
    [step1Route, step2Route],
    [step1, step2],
    BigNumber.from(info.amount),
    BigNumber.ONE,
  )
}

async function bridgeInfoFromSolana_toMeta(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromSolana_ToBRC20 | KnownRoute_FromSolana_ToRunes),
): Promise<BridgeInfoFromSolanaOutput> {
  const transitStacksChain = KnownChainId.isSolanaChain(info.fromChain)
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

  const step1Route: KnownRoute = {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: transitStacksChain,
    toToken: firstStepToStacksToken,
  }
  const step2Route:
    | KnownRoute_FromStacks_ToBRC20
    | KnownRoute_FromStacks_ToRunes = {
    fromChain: transitStacksChain,
    fromToken: lastStepFromStacksToken,
    toChain: info.toChain as any,
    toToken: info.toToken as any,
  }

  const [step1, step2] = await Promise.all([
    getSolana2StacksFeeInfo(ctx, step1Route),
    getStacks2MetaFeeInfo(ctx, step2Route, {
      initialRoute: step1Route,
      swapRoute: null,
    }),
  ])
  if (step1 == null || step2 == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return transformToPublicTransferProphetAggregated2(
    [step1Route, step2Route],
    [step1, step2],
    BigNumber.from(info.amount),
    BigNumber.ONE,
  )
}

async function bridgeInfoFromSolana_toSolana(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToSolana,
): Promise<BridgeInfoFromSolanaOutput> {
  const transitStacksChain = KnownChainId.isSolanaChain(info.fromChain)
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

  const step1Route: KnownRoute = {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: transitStacksChain,
    toToken: firstStepToStacksToken,
  }
  const step2Route: KnownRoute = {
    fromChain: transitStacksChain,
    fromToken: lastStepFromStacksToken,
    toChain: info.toChain,
    toToken: info.toToken,
  }

  const [step1, step2] = await Promise.all([
    getSolana2StacksFeeInfo(ctx, step1Route),
    getStacks2SolanaFeeInfo(ctx, step2Route, {
      initialRoute: step1Route,
    }),
  ])
  if (step1 == null || step2 == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return transformToPublicTransferProphetAggregated2(
    [step1Route, step2Route],
    [step1, step2],
    BigNumber.from(info.amount),
    BigNumber.ONE,
  )
}

async function bridgeInfoFromSolana_toTron(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToTron,
): Promise<BridgeInfoFromSolanaOutput> {
  throw new Error("WIP")
} 