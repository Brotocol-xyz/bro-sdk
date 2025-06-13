import { UTXOSpendable } from "../bitcoinHelpers"
import {
  BitcoinAddress,
  getBitcoinHardLinkageAddress,
} from "../bitcoinUtils/btcAddresses"
import { SDK_NAME } from "../bitcoinUtils/constants"
import { getMetaPegInAddress } from "../metaUtils/btcAddresses"
import { isSupportedBRC20Route } from "../metaUtils/peggingHelpers"
import {
  createBridgeOrder_MetaToBitcoin,
  createBridgeOrder_MetaToEVM,
  createBridgeOrder_MetaToMeta,
  createBridgeOrder_MetaToSolana,
  createBridgeOrder_MetaToStacks,
} from "../stacksUtils/createBridgeOrderFromMeta"
import { BigNumber } from "../utils/BigNumber"
import {
  checkRouteValid,
  KnownRoute_FromBRC20_ToBitcoin,
  KnownRoute_FromBRC20_ToBRC20,
  KnownRoute_FromBRC20_ToEVM,
  KnownRoute_FromBRC20_ToRunes,
  KnownRoute_FromBRC20_ToSolana,
  KnownRoute_FromBRC20_ToStacks,
  KnownRoute_FromBRC20_ToTron,
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
import {
  BridgeFromBRC20Input_reselectSpendableNetworkFeeUTXOs,
  getBridgeFeeOutput,
  prepareBRC20Transaction,
  PrepareBRC20TransactionInput,
} from "./bridgeFromBRC20"
import {
  ChainId,
  isEVMAddress,
  SDKNumber,
  TokenId,
  toSDKNumberOrUndefined,
} from "./types"
import { SDKGlobalContext } from "./types.internal"

export interface EstimateBridgeTransactionFromBRC20Input {
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

  inputInscriptionUTXO: UTXOSpendable
  swapRoute?: SwapRoute_WithMinimumAmountsToReceive_Public

  networkFeeRate: bigint
  networkFeeChangeAddress: string
  networkFeeChangeAddressScriptPubKey: Uint8Array
  reselectSpendableNetworkFeeUTXOs: BridgeFromBRC20Input_reselectSpendableNetworkFeeUTXOs

  extraOutputs?: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
}

export interface EstimateBridgeTransactionFromBRC20Output {
  fee: SDKNumber
  estimatedVSize: SDKNumber
  revealTransactionSatoshiAmount?: SDKNumber
}

export async function estimateBridgeTransactionFromBRC20(
  ctx: SDKGlobalContext,
  info: EstimateBridgeTransactionFromBRC20Input,
): Promise<EstimateBridgeTransactionFromBRC20Output> {
  const route = await checkRouteValid(ctx, isSupportedBRC20Route, info)

  if (KnownChainId.isBRC20Chain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.toToken) &&
        KnownTokenId.isBRC20Token(route.fromToken)
      ) {
        return estimateFromBRC20_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.toToken) &&
        KnownTokenId.isBRC20Token(route.fromToken)
      ) {
        return estimateFromBRC20_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.toToken) &&
        KnownTokenId.isBRC20Token(route.fromToken)
      ) {
        return estimateFromBRC20_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.toToken) &&
        KnownTokenId.isBRC20Token(route.fromToken)
      ) {
        return estimateFromBRC20_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.toToken) &&
        KnownTokenId.isBRC20Token(route.fromToken)
      ) {
        return estimateFromBRC20_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.toToken) &&
        KnownTokenId.isBRC20Token(route.fromToken)
      ) {
        return estimateFromBRC20_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isTronToken(route.toToken) &&
        KnownTokenId.isBRC20Token(route.fromToken)
      ) {
        return estimateFromBRC20_toTron(ctx, {
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

async function estimateFromBRC20_toStacks(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToStacks,
): Promise<EstimateBridgeTransactionFromBRC20Output> {
  const createdOrder = await createBridgeOrder_MetaToStacks(sdkContext, {
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return estimateBRC20Transaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromBRC20_toEVM(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToEVM,
): Promise<EstimateBridgeTransactionFromBRC20Output> {
  const createdOrder = !isEVMAddress(info.toAddress)
    ? null
    : await createBridgeOrder_MetaToEVM(sdkContext, {
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return estimateBRC20Transaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromBRC20_toBitcoin(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToBitcoin,
): Promise<EstimateBridgeTransactionFromBRC20Output> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `estimateBridgeTransactionFromBRC20 (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
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

  const createdOrder = await createBridgeOrder_MetaToBitcoin(sdkContext, {
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return estimateBRC20Transaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromBRC20_toMeta(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBRC20_ToBRC20 | KnownRoute_FromBRC20_ToRunes),
): Promise<EstimateBridgeTransactionFromBRC20Output> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `estimateBridgeTransactionFromBRC20 (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
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

  const createdOrder = await createBridgeOrder_MetaToMeta(sdkContext, {
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return estimateBRC20Transaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromBRC20_toSolana(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToSolana,
): Promise<EstimateBridgeTransactionFromBRC20Output> {
  const createdOrder = await createBridgeOrder_MetaToSolana(sdkContext, {
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return estimateBRC20Transaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromBRC20_toTron(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToTron,
): Promise<EstimateBridgeTransactionFromBRC20Output> {
  throw new Error("WIP")
}

type EstimateBRC20TransactionInput = Omit<
  PrepareBRC20TransactionInput,
  "hardLinkageOutput" | "pegInAddress"
> & {
  withHardLinkageOutput: boolean
  orderData: Uint8Array
}
async function estimateBRC20Transaction(
  sdkContext: SDKGlobalContext,
  info: EstimateBRC20TransactionInput,
): Promise<EstimateBridgeTransactionFromBRC20Output> {
  const pegInAddress = getMetaPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const resp = await prepareBRC20Transaction(sdkContext, {
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
