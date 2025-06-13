import {
  BitcoinAddress,
  getBitcoinHardLinkageAddress,
} from "../bitcoinUtils/btcAddresses"
import { SDK_NAME } from "../bitcoinUtils/constants"
import { getMetaPegInAddress } from "../metaUtils/btcAddresses"
import { isSupportedRunesRoute } from "../metaUtils/peggingHelpers"
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
  KnownRoute_FromRunes_ToBitcoin,
  KnownRoute_FromRunes_ToBRC20,
  KnownRoute_FromRunes_ToEVM,
  KnownRoute_FromRunes_ToRunes,
  KnownRoute_FromRunes_ToSolana,
  KnownRoute_FromRunes_ToStacks,
  KnownRoute_FromRunes_ToTron,
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
import { getBridgeFeeOutput } from "./bridgeFromBRC20"
import {
  BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs,
  prepareRunesTransaction,
  PrepareRunesTransactionInput,
  RunesUTXOSpendable,
} from "./bridgeFromRunes"
import {
  ChainId,
  isEVMAddress,
  SDKNumber,
  TokenId,
  toSDKNumberOrUndefined,
} from "./types"
import { SDKGlobalContext } from "./types.internal"

export interface EstimateBridgeTransactionFromRunesInput {
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
  inputRuneUTXOs: RunesUTXOSpendable[]
  swapRoute?: SwapRoute_WithMinimumAmountsToReceive_Public

  networkFeeRate: bigint
  networkFeeChangeAddress: string
  networkFeeChangeAddressScriptPubKey: Uint8Array
  reselectSpendableNetworkFeeUTXOs: BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs

  extraOutputs?: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
}

export interface EstimateBridgeTransactionFromRunesOutput {
  fee: SDKNumber
  estimatedVSize: SDKNumber
  revealTransactionSatoshiAmount?: SDKNumber
}

export async function estimateBridgeTransactionFromRunes(
  ctx: SDKGlobalContext,
  info: EstimateBridgeTransactionFromRunesInput,
): Promise<EstimateBridgeTransactionFromRunesOutput> {
  const route = await checkRouteValid(ctx, isSupportedRunesRoute, info)

  if (KnownChainId.isRunesChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.toToken) &&
        KnownTokenId.isRunesToken(route.fromToken)
      ) {
        return estimateFromRunes_toStacks(ctx, {
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
        KnownTokenId.isRunesToken(route.fromToken)
      ) {
        return estimateFromRunes_toEVM(ctx, {
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
        KnownTokenId.isRunesToken(route.fromToken)
      ) {
        return estimateFromRunes_toBitcoin(ctx, {
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
        KnownTokenId.isRunesToken(route.fromToken)
      ) {
        return estimateFromRunes_toMeta(ctx, {
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
        KnownTokenId.isRunesToken(route.fromToken)
      ) {
        return estimateFromRunes_toMeta(ctx, {
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
        KnownTokenId.isRunesToken(route.fromToken)
      ) {
        return estimateFromRunes_toSolana(ctx, {
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
        KnownTokenId.isRunesToken(route.fromToken)
      ) {
        return estimateFromRunes_toTron(ctx, {
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

async function estimateFromRunes_toStacks(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToStacks,
): Promise<EstimateBridgeTransactionFromRunesOutput> {
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

  return estimateRunesTransaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromRunes_toEVM(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToEVM,
): Promise<EstimateBridgeTransactionFromRunesOutput> {
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

  return estimateRunesTransaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromRunes_toBitcoin(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToBitcoin,
): Promise<EstimateBridgeTransactionFromRunesOutput> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `estimateBridgeTransactionFromRunes (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
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

  return estimateRunesTransaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromRunes_toMeta(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromRunes_ToBRC20 | KnownRoute_FromRunes_ToRunes),
): Promise<EstimateBridgeTransactionFromRunesOutput> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `estimateBridgeTransactionFromRunes (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
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

  return estimateRunesTransaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromRunes_toSolana(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToSolana,
): Promise<EstimateBridgeTransactionFromRunesOutput> {
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

  return estimateRunesTransaction(sdkContext, {
    ...info,
    orderData: createdOrder.data,
    withHardLinkageOutput: true,
    bridgeFeeOutput,
    extraOutputs: info.extraOutputs ?? [],
  })
}

async function estimateFromRunes_toTron(
  sdkContext: SDKGlobalContext,
  info: Omit<
    EstimateBridgeTransactionFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToTron,
): Promise<EstimateBridgeTransactionFromRunesOutput> {
  throw new Error("WIP")
}

type EstimateRunesTransactionInput = Omit<
  PrepareRunesTransactionInput,
  "hardLinkageOutput" | "pegInAddress"
> & {
  withHardLinkageOutput: boolean
  orderData: Uint8Array
}
async function estimateRunesTransaction(
  sdkContext: SDKGlobalContext,
  info: EstimateRunesTransactionInput,
): Promise<EstimateBridgeTransactionFromRunesOutput> {
  const pegInAddress = getMetaPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const resp = await prepareRunesTransaction(
    sdkContext,
    "estimateBridgeTransactionFromRunes",
    {
      ...info,
      fromChain: info.fromChain,
      fromToken: info.fromToken,
      toChain: info.toChain as any,
      toToken: info.toToken as any,
      pegInAddress,
      hardLinkageOutput:
        (await getBitcoinHardLinkageAddress(info.fromChain, info.toChain)) ??
        null,
    },
  )

  return {
    fee: toSDKNumberOrUndefined(resp.fee),
    estimatedVSize: toSDKNumberOrUndefined(resp.estimatedVSize),
    revealTransactionSatoshiAmount: toSDKNumberOrUndefined(
      resp.revealOutput.satsAmount,
    ),
  }
}
