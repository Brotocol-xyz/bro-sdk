import {
  estimateBitcoinInstantSwapTransaction,
  getBitcoin2RunesInstantSwapTransactionParams,
} from "../bitcoinUtils/broadcastBitcoinInstantSwapTransaction"
import {
  estimateBitcoinTransaction,
  EstimateBitcoinTransactionOutput,
} from "../bitcoinUtils/broadcastBitcoinTransaction"
import { BitcoinAddress } from "../bitcoinUtils/btcAddresses"
import {
  getInstantSwapFeeInfo,
  isSupportedBitcoinRoute,
} from "../bitcoinUtils/peggingHelpers"
import { BridgeFromBitcoinInput_reselectSpendableUTXOs } from "../bitcoinUtils/types"
import { SDK_NAME } from "../constants"
import {
  createBridgeOrder_BitcoinToEVM,
  createBridgeOrder_BitcoinToMeta,
  createBridgeOrder_BitcoinToSolana,
  createBridgeOrder_BitcoinToStacks,
} from "../stacksUtils/createBridgeOrderFromBitcoin"
import { BigNumber } from "../utils/BigNumber"
import {
  checkRouteValid,
  KnownRoute_FromBitcoin_ToBRC20,
  KnownRoute_FromBitcoin_ToEVM,
  KnownRoute_FromBitcoin_ToRunes,
  KnownRoute_FromBitcoin_ToSolana,
  KnownRoute_FromBitcoin_ToStacks,
  KnownRoute_FromBitcoin_ToTron,
} from "../utils/buildSupportedRoutes"
import {
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { SwapRoute_WithMinimumAmountsToReceive_Public } from "../utils/SwapRouteHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  _knownChainIdToErrorMessagePart,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import { ChainId, isEVMAddress, SDKNumber, TokenId } from "./types"
import { SDKGlobalContext } from "./types.internal"

export interface EstimateBridgeTransactionFromBitcoinInput {
  fromChain: ChainId
  fromToken: TokenId
  toChain: ChainId
  toToken: TokenId

  fromAddress: string
  fromAddressScriptPubKey: Uint8Array
  toAddress: string
  /**
   * **Required** when `toChain` is one of bitcoin chains
   */
  toAddressScriptPubKey?: Uint8Array

  amount: SDKNumber
  swapRoute?: SwapRoute_WithMinimumAmountsToReceive_Public
  networkFeeRate: bigint
  reselectSpendableUTXOs: BridgeFromBitcoinInput_reselectSpendableUTXOs

  extraOutputs?: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
}

export interface EstimateBridgeTransactionFromBitcoinOutput
  extends EstimateBitcoinTransactionOutput {}

export async function estimateBridgeTransactionFromBitcoin(
  ctx: SDKGlobalContext,
  info: EstimateBridgeTransactionFromBitcoinInput,
): Promise<EstimateBridgeTransactionFromBitcoinOutput> {
  const route = await checkRouteValid(ctx, isSupportedBitcoinRoute, info)

  if (KnownChainId.isBitcoinChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return estimateFromBitcoin_toStacks(ctx, {
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
        return estimateFromBitcoin_toEVM(ctx, {
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
        return estimateFromBitcoin_toMeta(ctx, {
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
        return estimateFromBitcoin_toMeta(ctx, {
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
        return estimateFromBitcoin_toSolana(ctx, {
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
        return estimateFromBitcoin_toTron(ctx, {
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
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.StacksChain>())
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

async function estimateFromBitcoin_toStacks(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToStacks,
): Promise<EstimateBridgeTransactionFromBitcoinOutput> {
  if (info.swapRoute?.via === "instantSwap") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  const createdOrder = await createBridgeOrder_BitcoinToStacks(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toStacksAddress: info.toAddress,
    swap:
      info.swapRoute == null
        ? undefined
        : {
            ...info.swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              info.swapRoute.minimumAmountsToReceive,
            ),
          },
  })
  if (createdOrder == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return estimateBitcoinTransaction(sdkContext, {
    ...info,
    toAddressScriptPubKey: undefined,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    extraOutputs: info.extraOutputs ?? [],
    swapRoute: info.swapRoute ?? undefined,
  })
}

async function estimateFromBitcoin_toEVM(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToEVM,
): Promise<EstimateBridgeTransactionFromBitcoinOutput> {
  if (info.swapRoute?.via === "instantSwap") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  const createdOrder = !isEVMAddress(info.toAddress)
    ? null
    : await createBridgeOrder_BitcoinToEVM(sdkContext, {
        ...info,
        fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
        fromAmount: BigNumber.from(info.amount),
        toEVMAddress: info.toAddress,
        swap:
          info.swapRoute == null
            ? undefined
            : {
                ...info.swapRoute,
                minimumAmountsToReceive: BigNumber.from(
                  info.swapRoute.minimumAmountsToReceive,
                ),
              },
      })
  if (createdOrder == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return estimateBitcoinTransaction(sdkContext, {
    ...info,
    toAddressScriptPubKey: undefined,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    extraOutputs: info.extraOutputs ?? [],
    swapRoute: info.swapRoute ?? undefined,
  })
}

async function estimateFromBitcoin_toMeta(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBitcoin_ToBRC20 | KnownRoute_FromBitcoin_ToRunes),
): Promise<EstimateBridgeTransactionFromBitcoinOutput> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `estimateBridgeTransactionFromBitcoin (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "toAddressScriptPubKey",
          expected: "Uint8Array",
          received: "undefined",
        },
      ],
    )
  }

  const createdOrder = await createBridgeOrder_BitcoinToMeta(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toBitcoinScriptPubKey: info.toAddressScriptPubKey,
    swap:
      info.swapRoute == null
        ? undefined
        : {
            ...info.swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              info.swapRoute.minimumAmountsToReceive,
            ),
          },
  })
  if (createdOrder == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  if (info.swapRoute?.via === "instantSwap") {
    if (
      KnownChainId.isRunesChain(info.toChain) &&
      KnownTokenId.isRunesToken(info.toToken)
    ) {
      const instantSwapFee = await getInstantSwapFeeInfo(sdkContext, {
        fromChain: info.fromChain,
        fromToken: info.fromToken,
        toChain: info.toChain,
        toToken: info.toToken,
      })
      if (instantSwapFee == null) {
        throw new UnsupportedBridgeRouteError(
          info.fromChain,
          info.toChain,
          info.fromToken,
          info.toToken,
        )
      }

      const { params } = await getBitcoin2RunesInstantSwapTransactionParams(
        sdkContext,
        {
          methodName: "estimateBridgeTransactionFromBitcoin",
          transferProphet: instantSwapFee,
          fromChain: info.fromChain,
          fromAddress: info.fromAddress,
          fromAddressScriptPubKey: info.fromAddressScriptPubKey,
          fromAmount: BigNumber.from(info.amount),
          toChain: info.toChain,
          toToken: info.toToken,
          toAddress: info.toAddress,
          toAddressScriptPubKey: info.toAddressScriptPubKey,
          extraOutputs: info.extraOutputs ?? [],
          signPsbt: async ({ psbt }) => ({ psbt }),
        },
      )

      return estimateBitcoinInstantSwapTransaction(sdkContext, {
        ...info,
        toChain: info.toChain,
        toToken: info.toToken,
        toAddressScriptPubKey: info.toAddressScriptPubKey,
        orderData: createdOrder.data,
        swapRoute: info.swapRoute,
        ...params,
      })
    }
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  return estimateBitcoinTransaction(sdkContext, {
    ...info,
    toAddressScriptPubKey: info.toAddressScriptPubKey,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    extraOutputs: info.extraOutputs ?? [],
    swapRoute: info.swapRoute ?? undefined,
  })
}

async function estimateFromBitcoin_toSolana(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToSolana,
): Promise<EstimateBridgeTransactionFromBitcoinOutput> {
  if (info.swapRoute?.via === "instantSwap") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  const createdOrder = await createBridgeOrder_BitcoinToSolana(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toSolanaAddress: info.toAddress,
    swap:
      info.swapRoute == null
        ? undefined
        : {
            ...info.swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              info.swapRoute.minimumAmountsToReceive,
            ),
          },
  })
  if (createdOrder == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return estimateBitcoinTransaction(sdkContext, {
    ...info,
    toAddressScriptPubKey: info.toAddressScriptPubKey,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    extraOutputs: info.extraOutputs ?? [],
    swapRoute: info.swapRoute ?? undefined,
  })
}

async function estimateFromBitcoin_toTron(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToTron,
): Promise<EstimateBridgeTransactionFromBitcoinOutput> {
  throw new Error("WIP")
}
