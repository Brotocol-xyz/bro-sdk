import {
  BitcoinAddress,
  getBitcoinHardLinkageAddress,
  getBTCPegInAddress,
} from "../bitcoinUtils/btcAddresses"
import { SDK_NAME } from "../bitcoinUtils/constants"
import { isSupportedBitcoinRoute } from "../bitcoinUtils/peggingHelpers"
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
import {
  SwapRouteViaALEX_WithMinimumAmountsToReceive_Public,
  SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public,
} from "../utils/SwapRouteHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  _knownChainIdToErrorMessagePart,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import {
  BridgeFromBitcoinInput_reselectSpendableUTXOs,
  prepareBitcoinTransaction,
  PrepareBitcoinTransactionInput,
} from "./bridgeFromBitcoin"
import {
  ChainId,
  isEVMAddress,
  SDKNumber,
  TokenId,
  toSDKNumberOrUndefined,
} from "./types"
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
  swapRoute?:
    | SwapRouteViaALEX_WithMinimumAmountsToReceive_Public
    | SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public
  networkFeeRate: bigint
  reselectSpendableUTXOs: BridgeFromBitcoinInput_reselectSpendableUTXOs

  extraOutputs?: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
}

export interface EstimateBridgeTransactionFromBitcoinOutput {
  fee: SDKNumber
  estimatedVSize: SDKNumber
  revealTransactionSatoshiAmount?: SDKNumber
}

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
  const createdOrder = await createBridgeOrder_BitcoinToStacks(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    extraOutputs: info.extraOutputs ?? [],
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
  const createdOrder = !isEVMAddress(info.toAddress)
    ? null
    : await createBridgeOrder_BitcoinToEVM(sdkContext, {
        ...info,
        fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    extraOutputs: info.extraOutputs ?? [],
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

  return estimateBitcoinTransaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    extraOutputs: info.extraOutputs ?? [],
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
  const createdOrder = await createBridgeOrder_BitcoinToSolana(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    extraOutputs: info.extraOutputs ?? [],
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

type EstimateBitcoinTransactionInput = Omit<
  PrepareBitcoinTransactionInput,
  "hardLinkageOutput" | "pegInAddress"
> & {
  withHardLinkageOutput: boolean
  orderData: Uint8Array
}
async function estimateBitcoinTransaction(
  sdkContext: SDKGlobalContext,
  info: EstimateBitcoinTransactionInput,
): Promise<EstimateBridgeTransactionFromBitcoinOutput> {
  const pegInAddress = getBTCPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const resp = await prepareBitcoinTransaction(sdkContext, {
    ...info,
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: info.toChain as any,
    toToken: info.toToken as any,
    pegInAddress,
    hardLinkageOutput:
      (await getBitcoinHardLinkageAddress(info.fromChain, info.toChain)) ??
      null,
  })

  return {
    fee: toSDKNumberOrUndefined(resp.fee),
    estimatedVSize: toSDKNumberOrUndefined(resp.estimatedVSize),
    revealTransactionSatoshiAmount: toSDKNumberOrUndefined(
      resp.revealOutput.satsAmount,
    ),
  }
}
