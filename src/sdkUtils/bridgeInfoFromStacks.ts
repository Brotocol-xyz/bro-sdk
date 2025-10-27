import { getStacks2BtcFeeInfo } from "../bitcoinUtils/peggingHelpers"
import { getStacks2EvmFeeInfo } from "../evmUtils/peggingHelpers"
import { getStacks2MetaFeeInfo } from "../metaUtils/peggingHelpers"
import { getStacks2SolanaFeeInfo } from "../solanaUtils/peggingHelpers"
import { isSupportedStacksRoute } from "../stacksUtils/peggingHelpers"
import {
  checkRouteValid,
  KnownRoute_FromStacks_ToBitcoin,
  KnownRoute_FromStacks_ToBRC20,
  KnownRoute_FromStacks_ToEVM,
  KnownRoute_FromStacks_ToRunes,
  KnownRoute_FromStacks_ToSolana,
  KnownRoute_FromStacks_ToTron,
} from "../utils/buildSupportedRoutes"
import { UnsupportedBridgeRouteError } from "../utils/errors"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  PublicTransferProphetAggregated,
  transformToPublicTransferProphet,
} from "../utils/types/TransferProphet"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { ChainId, SDKNumber, TokenId } from "./types"
import { SDKGlobalContext } from "./types.internal"

export interface BridgeInfoFromStacksInput {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
  toToken: TokenId
  amount: SDKNumber
}

export interface BridgeInfoFromStacksOutput
  extends PublicTransferProphetAggregated {}

export async function bridgeInfoFromStacks(
  ctx: SDKGlobalContext,
  info: BridgeInfoFromStacksInput,
): Promise<BridgeInfoFromStacksOutput> {
  const route = await checkRouteValid(ctx, isSupportedStacksRoute, info)

  if (KnownChainId.isStacksChain(route.fromChain)) {
    if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeInfoFromStacks_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeInfoFromStacks_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeInfoFromStacks_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeInfoFromStacks_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeInfoFromStacks_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeInfoFromStacks_toTron(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else {
      assertExclude(route.toChain, assertExclude.i<KnownChainId.StacksChain>())
      checkNever(route)
    }
  } else {
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BitcoinChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BRC20Chain>())
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

async function bridgeInfoFromStacks_toBitcoin(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromStacks_ToBitcoin,
): Promise<BridgeInfoFromStacksOutput> {
  const step1 = await getStacks2BtcFeeInfo(ctx, info, {
    initialRoute: null,
    swapRoute: null,
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

async function bridgeInfoFromStacks_toEVM(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromStacks_ToEVM,
): Promise<BridgeInfoFromStacksOutput> {
  const step1 = await getStacks2EvmFeeInfo(ctx, info, {
    initialRoute: null,
    toDexAggregator: false,
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

async function bridgeInfoFromStacks_toMeta(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromStacks_ToBRC20 | KnownRoute_FromStacks_ToRunes),
): Promise<BridgeInfoFromStacksOutput> {
  const step1 = await getStacks2MetaFeeInfo(ctx, info, {
    initialRoute: null,
    swapRoute: null,
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

async function bridgeInfoFromStacks_toSolana(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromStacks_ToSolana,
): Promise<BridgeInfoFromStacksOutput> {
  const step1 = await getStacks2SolanaFeeInfo(ctx, info, {
    initialRoute: null,
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

async function bridgeInfoFromStacks_toTron(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeInfoFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromStacks_ToTron,
): Promise<BridgeInfoFromStacksOutput> {
  throw new Error("WIP")
}
