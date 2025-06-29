import * as btc from "@scure/btc-signer"
import { equalBytes } from "@scure/btc-signer/utils"
import { addressToScriptPubKey } from "../bitcoinUtils/bitcoinHelpers"
import { BitcoinAddress } from "../bitcoinUtils/btcAddresses"
import { SDK_NAME } from "../constants"
import {
  broadcastRunesInstantSwapTransaction,
  getRunes2BitcoinInstantSwapTransactionParams,
  getRunes2RunesInstantSwapTransactionParams,
} from "../metaUtils/broadcastRunesInstantSwapTransaction"
import { broadcastRunesTransaction } from "../metaUtils/broadcastRunesTransaction"
import { getMetaPegInAddress } from "../metaUtils/btcAddresses"
import {
  getInstantSwapFeeInfo,
  isSupportedRunesRoute,
} from "../metaUtils/peggingHelpers"
import {
  BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs,
  BridgeFromRunesInput_sendTransactionFn,
  BridgeFromRunesInput_signPsbtFn,
  RunesUTXOSpendable,
} from "../metaUtils/types"
import { getStacksTokenContractInfo } from "../stacksUtils/contractHelpers"
import {
  createBridgeOrder_MetaToBitcoin,
  createBridgeOrder_MetaToEVM,
  createBridgeOrder_MetaToMeta,
  createBridgeOrder_MetaToSolana,
  createBridgeOrder_MetaToStacks,
  createBridgeOrder_MetaToTron,
} from "../stacksUtils/createBridgeOrderFromMeta"
import { BigNumber } from "../utils/BigNumber"
import {
  KnownRoute_FromRunes_ToBRC20,
  KnownRoute_FromRunes_ToBitcoin,
  KnownRoute_FromRunes_ToEVM,
  KnownRoute_FromRunes_ToRunes,
  KnownRoute_FromRunes_ToSolana,
  KnownRoute_FromRunes_ToStacks,
  KnownRoute_FromRunes_ToTron,
  checkRouteValid,
} from "../utils/buildSupportedRoutes"
import {
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { SwapRoute_WithMinimumAmountsToReceive_Public } from "../utils/SwapRouteHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  KnownChainId,
  KnownTokenId,
  _knownChainIdToErrorMessagePart,
} from "../utils/types/knownIds"
import { getBridgeFeeOutput } from "./bridgeFromBRC20"
import { ChainId, SDKNumber, TokenId, isEVMAddress } from "./types"
import { SDKGlobalContext } from "./types.internal"

export interface BridgeFromRunesInput {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
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

  signPsbt: BridgeFromRunesInput_signPsbtFn
  sendTransaction: BridgeFromRunesInput_sendTransactionFn
}

export interface BridgeFromRunesOutput {
  txid: string
  tx: Uint8Array
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}

export async function bridgeFromRunes(
  ctx: SDKGlobalContext,
  info: BridgeFromRunesInput,
): Promise<BridgeFromRunesOutput> {
  const route = await checkRouteValid(ctx, isSupportedRunesRoute, info)

  if (
    !equalBytes(
      info.fromAddressScriptPubKey,
      addressToScriptPubKey(
        info.fromChain === KnownChainId.Runes.Mainnet
          ? btc.NETWORK
          : btc.TEST_NETWORK,
        info.fromAddress,
      ),
    )
  ) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromRunes (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "fromAddressScriptPubKey",
          expected: "the scriptPubKey of the fromAddress",
          received: "invalid scriptPubKey",
        },
      ],
    )
  }

  if (info.toAddressScriptPubKey != null) {
    if (
      !equalBytes(
        info.toAddressScriptPubKey,
        addressToScriptPubKey(
          info.fromChain === KnownChainId.Runes.Mainnet
            ? btc.NETWORK
            : btc.TEST_NETWORK,
          info.toAddress,
        ),
      )
    ) {
      throw new InvalidMethodParametersError(
        [
          SDK_NAME,
          `bridgeFromRunes (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
        ],
        [
          {
            name: "toAddressScriptPubKey",
            expected: "the scriptPubKey of the toAddress",
            received: "invalid scriptPubKey",
          },
        ],
      )
    }
  }

  if (KnownChainId.isRunesChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeFromRunes_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeFromRunes_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeFromRunes_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeFromRunes_toTron(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeFromRunes_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeFromRunes_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isRunesToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeFromRunes_toMeta(ctx, {
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

async function bridgeFromRunes_toStacks(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToStacks,
): Promise<BridgeFromRunesOutput> {
  const swapRoute = info.swapRoute

  if (swapRoute?.via === "instantSwap") {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromRunes (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "swapRoute.via",
          expected: "should not be `instantSwap`",
          received: "instantSwap",
        },
      ],
    )
  }

  const pegInAddress = getMetaPegInAddress(info.fromChain, info.toChain)
  const toTokenContractInfo = await getStacksTokenContractInfo(
    sdkContext,
    info.toChain,
    info.toToken,
  )
  if (pegInAddress == null || toTokenContractInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const createdOrder = await createBridgeOrder_MetaToStacks(sdkContext, {
    methodName: "bridgeFromRunes",
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toChain: info.toChain,
    toToken: info.toToken,
    toStacksAddress: info.toAddress,
    swap:
      swapRoute == null
        ? undefined
        : {
            ...swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              swapRoute.minimumAmountsToReceive,
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

  return broadcastRunesTransaction(
    sdkContext,
    {
      ...info,
      runesChangeAddress: info.fromAddress,
      runesChangeAddressScriptPubKey: info.fromAddressScriptPubKey,
      toAddressScriptPubKey: undefined,
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      extraOutputs: info.extraOutputs ?? [],
      swapRoute,
    },
    createdOrder,
  )
}

async function bridgeFromRunes_toEVM(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToEVM,
): Promise<BridgeFromRunesOutput> {
  const swapRoute = info.swapRoute

  if (swapRoute?.via === "instantSwap") {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromRunes (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "swapRoute.via",
          expected: "should not be `instantSwap`",
          received: "instantSwap",
        },
      ],
    )
  }

  const createdOrder = !isEVMAddress(info.toAddress)
    ? null
    : await createBridgeOrder_MetaToEVM(sdkContext, {
        ...info,
        methodName: "bridgeFromRunes",
        fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
        fromAmount: BigNumber.from(info.amount),
        toEVMAddress: info.toAddress,
        swap:
          swapRoute == null
            ? undefined
            : {
                ...swapRoute,
                minimumAmountsToReceive: BigNumber.from(
                  swapRoute.minimumAmountsToReceive,
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

  return broadcastRunesTransaction(
    sdkContext,
    {
      ...info,
      runesChangeAddress: info.fromAddress,
      runesChangeAddressScriptPubKey: info.fromAddressScriptPubKey,
      toAddressScriptPubKey: undefined,
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      extraOutputs: info.extraOutputs ?? [],
      swapRoute,
    },
    createdOrder,
  )
}

async function bridgeFromRunes_toBitcoin(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToBitcoin,
): Promise<BridgeFromRunesOutput> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromRunes (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
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

  const swapRoute = info.swapRoute

  const createdOrder = await createBridgeOrder_MetaToBitcoin(sdkContext, {
    ...info,
    methodName: "bridgeFromRunes",
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toBitcoinScriptPubKey: info.toAddressScriptPubKey,
    swap:
      swapRoute == null
        ? undefined
        : {
            ...swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              swapRoute.minimumAmountsToReceive,
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

  if (swapRoute?.via === "instantSwap") {
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

    const { params, transformResponse } =
      await getRunes2BitcoinInstantSwapTransactionParams(sdkContext, {
        methodName: "bridgeFromRunes",
        transferProphet: instantSwapFee,
        swapRoute,
        fromChain: info.fromChain,
        fromToken: info.fromToken,
        fromAddress: info.fromAddress,
        fromAddressScriptPubKey: info.fromAddressScriptPubKey,
        fromAmount: BigNumber.from(info.amount),
        toChain: info.toChain,
        toToken: info.toToken,
        toAddress: info.toAddress,
        toAddressScriptPubKey: info.toAddressScriptPubKey,
        inputRuneUTXOs: info.inputRuneUTXOs,
        extraOutputs: info.extraOutputs ?? [],
        signPsbt: info.signPsbt,
      })

    const resp = await broadcastRunesInstantSwapTransaction(
      sdkContext,
      {
        ...info,
        toAddressScriptPubKey: info.toAddressScriptPubKey,
        bridgeFeeOutput,
        swapRoute,
        ...params,
      },
      {
        orderData: createdOrder,
        swapRoute,
      },
    )

    return transformResponse(resp)
  }

  return broadcastRunesTransaction(
    sdkContext,
    {
      ...info,
      runesChangeAddress: info.fromAddress,
      runesChangeAddressScriptPubKey: info.fromAddressScriptPubKey,
      toAddressScriptPubKey: info.toAddressScriptPubKey,
      withHardLinkageOutput: true,
      bridgeFeeOutput,
      extraOutputs: info.extraOutputs ?? [],
      swapRoute,
    },
    createdOrder,
  )
}

async function bridgeFromRunes_toMeta(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromRunes_ToBRC20 | KnownRoute_FromRunes_ToRunes),
): Promise<BridgeFromRunesOutput> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromRunes (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
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

  const swapRoute = info.swapRoute

  const createdOrder = await createBridgeOrder_MetaToMeta(sdkContext, {
    ...info,
    methodName: "bridgeFromRunes",
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toBitcoinScriptPubKey: info.toAddressScriptPubKey,
    swap:
      swapRoute == null
        ? undefined
        : {
            ...swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              swapRoute.minimumAmountsToReceive,
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
  if (swapRoute?.via === "instantSwap") {
    // TODO: implement instantSwap for Runes>BRC20

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

      const { params, transformResponse } =
        await getRunes2RunesInstantSwapTransactionParams(sdkContext, {
          methodName: "bridgeFromRunes",
          transferProphet: instantSwapFee,
          swapRoute,
          fromChain: info.fromChain,
          fromToken: info.fromToken,
          fromAddress: info.fromAddress,
          fromAddressScriptPubKey: info.fromAddressScriptPubKey,
          fromAmount: BigNumber.from(info.amount),
          toChain: info.toChain,
          toToken: info.toToken,
          toAddress: info.toAddress,
          toAddressScriptPubKey: info.toAddressScriptPubKey,
          inputRuneUTXOs: info.inputRuneUTXOs,
          extraOutputs: info.extraOutputs ?? [],
          signPsbt: info.signPsbt,
        })

      const resp = await broadcastRunesInstantSwapTransaction(
        sdkContext,
        {
          ...info,
          toChain: info.toChain as any,
          toToken: info.toToken as any,
          toAddressScriptPubKey: info.toAddressScriptPubKey,
          bridgeFeeOutput,
          swapRoute,
          ...params,
        },
        {
          orderData: createdOrder,
          swapRoute,
        },
      )

      return transformResponse(resp)
    }

    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  return broadcastRunesTransaction(
    sdkContext,
    {
      ...info,
      runesChangeAddress: info.fromAddress,
      runesChangeAddressScriptPubKey: info.fromAddressScriptPubKey,
      toAddressScriptPubKey: info.toAddressScriptPubKey,
      withHardLinkageOutput: true,
      bridgeFeeOutput,
      swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromRunes_toSolana(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToSolana,
): Promise<BridgeFromRunesOutput> {
  const swapRoute = info.swapRoute

  if (swapRoute?.via === "instantSwap") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  const createdOrder = await createBridgeOrder_MetaToSolana(sdkContext, {
    ...info,
    methodName: "bridgeFromRunes",
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toSolanaAddress: info.toAddress,
    swap:
      swapRoute == null
        ? undefined
        : {
            ...swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              swapRoute.minimumAmountsToReceive,
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

  return broadcastRunesTransaction(
    sdkContext,
    {
      ...info,
      runesChangeAddress: info.fromAddress,
      runesChangeAddressScriptPubKey: info.fromAddressScriptPubKey,
      toAddressScriptPubKey: info.toAddressScriptPubKey,
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromRunes_toTron(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromRunesInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromRunes_ToTron,
): Promise<BridgeFromRunesOutput> {
  const swapRoute = info.swapRoute

  if (swapRoute?.via === "instantSwap") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  const createdOrder = await createBridgeOrder_MetaToTron(sdkContext, {
    ...info,
    methodName: "bridgeFromRunes",
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toTronAddress: info.toAddress,
    swap:
      swapRoute == null
        ? undefined
        : {
            ...swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              swapRoute.minimumAmountsToReceive,
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

  return broadcastRunesTransaction(
    sdkContext,
    {
      ...info,
      runesChangeAddress: info.fromAddress,
      runesChangeAddressScriptPubKey: info.fromAddressScriptPubKey,
      toAddressScriptPubKey: info.toAddressScriptPubKey,
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}
