import { getStacks2BtcFeeInfo } from "../bitcoinUtils/peggingHelpers"
import {
  evmTokenToCorrespondingStacksToken,
  getEvm2StacksFeeInfo,
  getStacks2EvmFeeInfo,
  isSupportedEVMRoute,
} from "../evmUtils/peggingHelpers"
import { getStacks2MetaFeeInfo } from "../metaUtils/peggingHelpers"
import { getStacks2SolanaFeeInfo } from "../solanaUtils/peggingHelpers"
import { BigNumber } from "../utils/BigNumber"
import { getAndCheckTransitStacksTokens } from "../utils/SwapRouteHelpers"
import {
  checkRouteValid,
  KnownRoute,
  KnownRoute_FromEVM_ToBitcoin,
  KnownRoute_FromEVM_ToBRC20,
  KnownRoute_FromEVM_ToEVM,
  KnownRoute_FromEVM_ToRunes,
  KnownRoute_FromEVM_ToSolana,
  KnownRoute_FromEVM_ToStacks,
  KnownRoute_FromEVM_ToTron,
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

export interface BridgeInfoFromEVMInput {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
  toToken: TokenId
  amount: SDKNumber
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BridgeInfoFromEVMOutput
  extends PublicTransferProphetAggregated {}

export async function bridgeInfoFromEVM(
  ctx: SDKGlobalContext,
  info: BridgeInfoFromEVMInput,
): Promise<BridgeInfoFromEVMOutput> {
  const route = await checkRouteValid(ctx, isSupportedEVMRoute, info)

  if (KnownChainId.isEVMChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeInfoFromEVM_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeInfoFromEVM_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeInfoFromEVM_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeInfoFromEVM_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeInfoFromEVM_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeInfoFromEVM_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeInfoFromEVM_toTron(ctx, {
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

async function bridgeInfoFromEVM_toStacks(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToStacks,
): Promise<BridgeInfoFromEVMOutput> {
  const step1 = await getEvm2StacksFeeInfo(ctx, info)
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

async function bridgeInfoFromEVM_toBitcoin(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToBitcoin,
): Promise<BridgeInfoFromEVMOutput> {
  const transitStacksChain = KnownChainId.isEVMMainnetChain(info.fromChain)
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
    getEvm2StacksFeeInfo(ctx, step1Route),
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

async function bridgeInfoFromEVM_toEVM(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToEVM,
): Promise<BridgeInfoFromEVMOutput> {
  const transitStacksChain = KnownChainId.isEVMMainnetChain(info.fromChain)
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
    getEvm2StacksFeeInfo(ctx, step1Route),
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

async function bridgeInfoFromEVM_toMeta(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromEVM_ToBRC20 | KnownRoute_FromEVM_ToRunes),
): Promise<BridgeInfoFromEVMOutput> {
  const transitStacksChain = KnownChainId.isEVMMainnetChain(info.fromChain)
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
    getEvm2StacksFeeInfo(ctx, step1Route),
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

async function bridgeInfoFromEVM_toSolana(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToSolana,
): Promise<BridgeInfoFromEVMOutput> {
  const transitStacksChain = KnownChainId.isEVMMainnetChain(info.fromChain)
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
    getEvm2StacksFeeInfo(ctx, step1Route),
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

async function bridgeInfoFromEVM_toTron(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToTron,
): Promise<BridgeInfoFromEVMOutput> {
  throw new Error("WIP")
}

export async function bridgeInfoFromEVM_toLaunchpad(
  ctx: SDKGlobalContext,
  info: {
    fromChain: KnownChainId.EVMChain
    fromToken: KnownTokenId.EVMToken
    launchId: SDKNumber
    amount: SDKNumber
  },
): Promise<BridgeInfoFromEVMOutput> {
  const toChain = KnownChainId.isEVMMainnetChain(info.fromChain)
    ? KnownChainId.Stacks.Mainnet
    : KnownChainId.Stacks.Testnet
  const toToken = await evmTokenToCorrespondingStacksToken(
    ctx,
    info.fromChain,
    info.fromToken,
  )

  if (toToken == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      toChain,
      info.fromToken,
    )
  }

  return bridgeInfoFromEVM_toStacks(ctx, {
    ...info,
    toChain,
    toToken,
  })
}
