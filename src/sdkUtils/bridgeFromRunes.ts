import { getOutputDustThreshold } from "@c4/btc-utils"
import * as btc from "@scure/btc-signer"
import { equalBytes } from "@scure/btc-signer/utils"
import { broadcastRevealableTransaction } from "../bitcoinUtils/apiHelpers/broadcastRevealableTransaction"
import { createBitcoinPegInRecipients } from "../bitcoinUtils/apiHelpers/createBitcoinPegInRecipients"
import { createRevealTx } from "../bitcoinUtils/apiHelpers/createRevealTx"
import {
  UTXOSpendable,
  addressToScriptPubKey,
  bitcoinToSatoshi,
} from "../bitcoinUtils/bitcoinHelpers"
import {
  BitcoinAddress,
  getBitcoinHardLinkageAddress,
} from "../bitcoinUtils/btcAddresses"
import {
  BITCOIN_OUTPUT_MINIMUM_AMOUNT,
  SDK_NAME,
} from "../bitcoinUtils/constants"
import { createTransaction } from "../bitcoinUtils/createTransaction"
import {
  BitcoinTransactionPrepareResult,
  prepareTransaction,
} from "../bitcoinUtils/prepareTransaction"
import { getMetaPegInAddress } from "../metaUtils/btcAddresses"
import { isSupportedRunesRoute } from "../metaUtils/peggingHelpers"
import { runesTokenToId } from "../metaUtils/tokenAddresses"
import { getStacksTokenContractInfo } from "../stacksUtils/contractHelpers"
import { CreateBridgeOrderResult } from "../stacksUtils/createBridgeOrderFromBitcoin"
import {
  createBridgeOrder_MetaToBitcoin,
  createBridgeOrder_MetaToEVM,
  createBridgeOrder_MetaToMeta,
  createBridgeOrder_MetaToStacks,
  createBridgeOrder_MetaToSolana,
  createBridgeOrder_MetaToTron,
} from "../stacksUtils/createBridgeOrderFromMeta"
import { validateBridgeOrderFromMeta } from "../stacksUtils/validateBridgeOrderFromMeta"
import { range } from "../utils/arrayHelpers"
import { BigNumber } from "../utils/BigNumber"
import {
  KnownRoute_FromRunes,
  KnownRoute_FromRunes_ToBRC20,
  KnownRoute_FromRunes_ToBitcoin,
  KnownRoute_FromRunes_ToEVM,
  KnownRoute_FromRunes_ToRunes,
  KnownRoute_FromRunes_ToStacks,
  KnownRoute_FromRunes_ToSolana,
  KnownRoute_FromRunes_ToTron,
  checkRouteValid,
} from "../utils/buildSupportedRoutes"
import {
  BridgeValidateFailedError,
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { decodeHex } from "../utils/hexHelpers"
import { toBitcoinOpReturnScript } from "../utils/RunesProtocol/RunesBitcoinScript"
import {
  SwapRouteViaALEX,
  SwapRouteViaALEX_WithMinimumAmountsToReceive_Public,
  SwapRouteViaEVMDexAggregator,
  SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public,
  SwapRoute_WithMinimumAmountsToReceive_Public,
} from "../utils/SwapRouteHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  KnownChainId,
  KnownTokenId,
  _knownChainIdToErrorMessagePart,
  getChainIdNetworkType,
} from "../utils/types/knownIds"
import {
  ReselectSpendableUTXOsFn_Public,
  reselectSpendableUTXOsFactory,
} from "./bridgeFromBitcoin"
import { getBridgeFeeOutput } from "./bridgeFromBRC20"
import {
  ChainId,
  RuneIdCombined,
  SDKNumber,
  TokenId,
  isEVMAddress,
} from "./types"
import { SDKGlobalContext } from "./types.internal"

export type BridgeFromRunesInput_signPsbtFn = (tx: {
  psbt: Uint8Array
  signBitcoinInputs: number[]
  signRunesInputs: number[]
}) => Promise<{ psbt: Uint8Array }>

export type BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs =
  ReselectSpendableUTXOsFn_Public

export type RunesUTXOSpendable = UTXOSpendable & {
  runes: {
    runeId: RuneIdCombined
    runeDivisibility: number
    runeAmount: bigint
  }[]
}

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
  sendTransaction: (tx: {
    hex: string
    pegInOrderOutput: {
      index: number
      amount: bigint
      orderData: Uint8Array
    }
  }) => Promise<{
    txid: string
  }>
}

export interface BridgeFromRunesOutput {
  txid: string
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
      [SDK_NAME, "bridgeFromRunes"],
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
        [SDK_NAME, "bridgeFromRunes"],
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
      assertExclude(route.toChain, assertExclude.i<KnownChainId.RunesChain>())
      checkNever(route)
    }
  } else {
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BitcoinChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.StacksChain>())
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
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      extraOutputs: info.extraOutputs ?? [],
      swapRoute: info.swapRoute,
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

  const createdOrder = !isEVMAddress(info.toAddress)
    ? null
    : await createBridgeOrder_MetaToEVM(sdkContext, {
        ...info,
        fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      extraOutputs: info.extraOutputs ?? [],
      swapRoute: info.swapRoute,
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
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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

  return broadcastRunesTransaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: true,
      bridgeFeeOutput,
      extraOutputs: info.extraOutputs ?? [],
      swapRoute: info.swapRoute,
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
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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

  return broadcastRunesTransaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: true,
      bridgeFeeOutput,
      extraOutputs: info.extraOutputs ?? [],
      swapRoute: info.swapRoute,
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

  const createdOrder = await createBridgeOrder_MetaToSolana(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      swapRoute: info.swapRoute,
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

  const createdOrder = await createBridgeOrder_MetaToTron(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      swapRoute: info.swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function broadcastRunesTransaction(
  sdkContext: SDKGlobalContext,
  info: Omit<
    ConstructRunesTransactionInput,
    "validateBridgeOrder" | "orderData" | "pegInAddress" | "hardLinkageOutput"
  > & {
    withHardLinkageOutput: boolean
    sendTransaction: BridgeFromRunesInput["sendTransaction"]
  },
  createdOrder: CreateBridgeOrderResult,
): Promise<{
  txid: string
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}> {
  const pegInAddress = getMetaPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const route: KnownRoute_FromRunes = {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: info.toChain as any,
    toToken: info.toToken as any,
  }

  const tx = await constructRunesTransaction(sdkContext, {
    ...info,
    ...route,
    validateBridgeOrder: async (btcTx, revealTx, extra) => {
      if (revealTx == null) {
        throw new UnsupportedBridgeRouteError(
          info.fromChain,
          info.toChain,
          info.fromToken,
          info.toToken,
        )
      }

      /**
       * due to contract limit, we are unable to validate this tx before the
       * commit tx be confirmed, so we will skip it and fix it in the future
       */
      void validateBridgeOrderFromMeta({
        chainId: info.fromChain,
        commitTx: btcTx,
        revealTx,
        terminatingStacksToken: createdOrder.tokenOutTrait,
        transferOutputIndex: extra.transferOutputIndex,
        bridgeFeeOutputIndex: extra.bridgeFeeOutputIndex,
        swapRoute: extra.swapRoute,
      })
    },
    orderData: createdOrder.data,
    pegInAddress,
    hardLinkageOutput: info.withHardLinkageOutput
      ? ((await getBitcoinHardLinkageAddress(info.fromChain, info.toChain)) ??
        null)
      : null,
  })

  const { txid: apiBroadcastedTxId } = await broadcastRevealableTransaction(
    sdkContext,
    {
      fromChain: info.fromChain,
      transactionHex: `0x${tx.hex}`,
      orderData: createdOrder.data,
      orderOutputIndex: tx.revealOutput.index,
      orderOutputSatsAmount: tx.revealOutput.satsAmount,
      pegInAddress: pegInAddress,
    },
  )

  const { txid: delegateBroadcastedTxId } = await info.sendTransaction({
    hex: tx.hex,
    pegInOrderOutput: {
      index: tx.revealOutput.index,
      amount: tx.revealOutput.satsAmount,
      orderData: createdOrder.data,
    },
  })

  if (apiBroadcastedTxId !== delegateBroadcastedTxId) {
    console.warn(
      "[bro-sdk] Transaction id broadcasted by API and delegatee are different:",
      `API: ${apiBroadcastedTxId}, `,
      `Delegatee: ${delegateBroadcastedTxId}`,
    )
  }

  return {
    txid: delegateBroadcastedTxId,
    extraOutputs: tx.extraOutputs,
  }
}

type ConstructRunesTransactionInput = PrepareRunesTransactionInput & {
  swapRoute:
    | undefined
    | SwapRouteViaALEX_WithMinimumAmountsToReceive_Public
    | SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public
  signPsbt: BridgeFromRunesInput["signPsbt"]
  pegInAddress: BitcoinAddress
  validateBridgeOrder: (
    pegInTx: Uint8Array,
    revealTx: undefined | Uint8Array,
    info: {
      transferOutputIndex: number
      bridgeFeeOutputIndex: undefined | number
      swapRoute: undefined | SwapRouteViaALEX | SwapRouteViaEVMDexAggregator
    },
  ) => Promise<void>
}
async function constructRunesTransaction(
  sdkContext: SDKGlobalContext,
  info: ConstructRunesTransactionInput,
): Promise<{
  hex: string
  revealOutput: {
    index: number
    satsAmount: bigint
  }
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}> {
  const txOptions = await prepareRunesTransaction(
    sdkContext,
    "bridgeFromRunes",
    info,
  )

  const recipients =
    txOptions.changeAmount > 0n
      ? txOptions.recipients.concat({
          addressScriptPubKey: info.networkFeeChangeAddressScriptPubKey,
          satsAmount: txOptions.changeAmount,
        })
      : txOptions.recipients

  const tx = createTransaction(
    txOptions.inputs,
    recipients,
    txOptions.opReturnScripts ?? [],
  )

  const { psbt } = await info.signPsbt({
    psbt: tx.toPSBT(),
    signRunesInputs: range(0, info.inputRuneUTXOs.length),
    signBitcoinInputs: range(info.inputRuneUTXOs.length, tx.inputsLength),
  })

  const signedTx = btc.Transaction.fromPSBT(psbt, {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
  })
  if (!signedTx.isFinal) {
    signedTx.finalize()
  }

  const revealTx = await createRevealTx(sdkContext, {
    fromChain: info.fromChain,
    txId: signedTx.id,
    vout: txOptions.revealOutput.index,
    satsAmount: txOptions.revealOutput.satsAmount,
    orderData: info.orderData,
    pegInAddress: info.pegInAddress,
  })

  await info
    .validateBridgeOrder(signedTx.extract(), decodeHex(revealTx.txHex), {
      transferOutputIndex: txOptions.transferOutput.index,
      bridgeFeeOutputIndex: txOptions.bridgeFeeOutput?.index,
      swapRoute: info.swapRoute,
    })
    .catch(err => {
      if (sdkContext.brc20.ignoreValidateResult) {
        console.error(
          "Bridge tx validation failed, but ignoreValidateResult is true, so we ignore the error",
          err,
        )
      } else {
        throw new BridgeValidateFailedError(err)
      }
    })

  return {
    hex: signedTx.hex,
    revealOutput: txOptions.revealOutput,
    extraOutputs: txOptions.extraOutputs,
  }
}

export type PrepareRunesTransactionInput = KnownRoute_FromRunes & {
  fromAddressScriptPubKey: BridgeFromRunesInput["fromAddressScriptPubKey"]
  fromAddress: BridgeFromRunesInput["fromAddress"]
  toAddress: BridgeFromRunesInput["toAddress"]
  amount: BridgeFromRunesInput["amount"]
  inputRuneUTXOs: BridgeFromRunesInput["inputRuneUTXOs"]

  networkFeeRate: BridgeFromRunesInput["networkFeeRate"]
  networkFeeChangeAddress: string
  networkFeeChangeAddressScriptPubKey: Uint8Array
  reselectSpendableNetworkFeeUTXOs: BridgeFromRunesInput["reselectSpendableNetworkFeeUTXOs"]

  pegInAddress: BitcoinAddress
  orderData: Uint8Array
  bridgeFeeOutput: null | {
    address: string
    scriptPubKey: Uint8Array
    satsAmount: BigNumber
  }
  hardLinkageOutput: null | BitcoinAddress
  extraOutputs: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
}
/**
 * Bitcoin Tx Structure:
 *
 * * Inputs: ...
 * * Outputs:
 *   * Runes change
 *   * Peg-in order data
 *   * Bridge fee (optional)
 *   * Hard linkage (optional)
 *   * Peg-in Rune tokens
 *   * ...extra outputs
 *   * BTC change (optional)
 *   * Runestone
 *
 * (with bridge fee example tx) https://mempool.space/testnet/tx/db5518a5e785c55a8b53ca6c8e7a2c21cb11913addd972fe9de4322dfcbaf723
 * (with hard linkage example tx) https://mempool.space/tx/f1ac518ab087924d17dffcc9cefb4d0d59ba15c04b75be567e1edf59bc0d7bf1#vout=2
 */
export async function prepareRunesTransaction(
  sdkContext: SDKGlobalContext,
  methodName: string,
  info: PrepareRunesTransactionInput,
): Promise<
  BitcoinTransactionPrepareResult & {
    bitcoinNetwork: typeof btc.NETWORK
    transferOutput: {
      index: number
    }
    revealOutput: {
      index: number
      satsAmount: bigint
    }
    bridgeFeeOutput?: {
      index: number
      satsAmount: bigint
    }
    hardLinkageOutput?: {
      index: number
      satsAmount: bigint
    }
    extraOutputs: {
      index: number
      satsAmount: bigint
    }[]
  }
> {
  const bitcoinNetwork =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? btc.NETWORK
      : btc.TEST_NETWORK

  const runeId = await runesTokenToId(
    sdkContext,
    info.fromChain,
    info.fromToken,
  )
  if (runeId == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const runeIdCombined: RuneIdCombined = `${Number(runeId.id.blockHeight)}:${Number(runeId.id.txIndex)}`
  const runeDivisibilityAry = info.inputRuneUTXOs.flatMap(u =>
    u.runes.flatMap(rune =>
      rune.runeId === runeIdCombined ? [rune.runeDivisibility] : [],
    ),
  )
  const runeDivisibility = runeDivisibilityAry[0]
  if (runeDivisibility == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `${methodName} (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "inputRuneUTXOs",
          expected: `contains rune with id ${runeIdCombined}`,
          received: "undefined",
        },
      ],
    )
  }

  const runeRawAmountToPegIn = BigNumber.toBigInt(
    { roundingMode: BigNumber.roundUp },
    BigNumber.rightMoveDecimals(runeDivisibility, info.amount),
  )
  const runeAmountsInTotal = sumRuneUTXOs(info.inputRuneUTXOs)
  const runeRawAmountToSend = runeAmountsInTotal[runeIdCombined] ?? 0n

  if (runeRawAmountToSend < runeRawAmountToPegIn) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `${methodName} (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "inputRuneUTXOs",
          expected: `contains enough rune with id ${runeIdCombined}`,
          received: String(runeAmountsInTotal[runeIdCombined] ?? 0n),
        },
      ],
    )
  }

  const pegInOrderRecipient = await createBitcoinPegInRecipients(sdkContext, {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: info.toChain,
    toToken: info.toToken,
    fromAddress: {
      address: info.fromAddress,
      scriptPubKey: info.fromAddressScriptPubKey,
    },
    toAddress: info.toAddress,
    orderData: info.orderData,
    feeRate: info.networkFeeRate,
  })

  const runesChangeCausedOffset = 1
  const pegInOrderDataCausedOffset = runesChangeCausedOffset + 1
  const bridgeFeeCausedOffset =
    pegInOrderDataCausedOffset + (info.bridgeFeeOutput == null ? 0 : 1)
  const hardLinkageCausedOffset =
    bridgeFeeCausedOffset + (info.hardLinkageOutput == null ? 0 : 1)
  const pegInRuneTokensCausedOffset = hardLinkageCausedOffset + 1
  const extraOutputsStartOffset = pegInRuneTokensCausedOffset

  const runesOpReturnScript = toBitcoinOpReturnScript({
    edicts: [
      {
        id: runeId.id,
        amount: runeRawAmountToPegIn,
        output: BigInt(pegInRuneTokensCausedOffset - 1),
      },
    ],
    // collect all remaining runes to the change address output
    pointer: 0n,
  })

  const result = await prepareTransaction({
    pinnedUTXOs: info.inputRuneUTXOs,
    recipients: [
      // runes change
      {
        addressScriptPubKey: info.fromAddressScriptPubKey,
        satsAmount: BigNumber.toBigInt(
          { roundingMode: BigNumber.roundUp },
          getOutputDustThreshold({
            scriptPubKey: info.fromAddressScriptPubKey,
          }),
        ),
      },
      // peg in order data
      {
        addressScriptPubKey: pegInOrderRecipient.scriptPubKey,
        satsAmount: pegInOrderRecipient.satsAmount,
      },
      // bridge fee
      ...(info.bridgeFeeOutput == null
        ? []
        : [
            {
              addressScriptPubKey: info.pegInAddress.scriptPubKey,
              satsAmount: BigNumber.toBigInt(
                { roundingMode: BigNumber.roundUp },
                info.bridgeFeeOutput.satsAmount,
              ),
            },
          ]),
      // hard linkage
      ...(info.hardLinkageOutput == null
        ? []
        : [
            {
              addressScriptPubKey: info.hardLinkageOutput.scriptPubKey,
              satsAmount: BITCOIN_OUTPUT_MINIMUM_AMOUNT,
            },
          ]),
      // peg in rune tokens
      {
        addressScriptPubKey: info.pegInAddress.scriptPubKey,
        satsAmount: BigNumber.toBigInt(
          { roundingMode: BigNumber.roundUp },
          getOutputDustThreshold({
            scriptPubKey: info.pegInAddress.scriptPubKey,
          }),
        ),
      },
      ...info.extraOutputs.map(o => ({
        addressScriptPubKey: o.address.scriptPubKey,
        satsAmount: o.satsAmount,
      })),
    ],
    changeAddressScriptPubKey: info.networkFeeChangeAddressScriptPubKey,
    feeRate: info.networkFeeRate,
    opReturnScripts: [runesOpReturnScript],
    reselectSpendableUTXOs: reselectSpendableUTXOsFactory(
      info.reselectSpendableNetworkFeeUTXOs,
    ),
  })

  return {
    ...result,
    bitcoinNetwork,
    transferOutput: {
      index: pegInRuneTokensCausedOffset - 1,
    },
    revealOutput: {
      index: pegInOrderDataCausedOffset - 1,
      satsAmount: pegInOrderRecipient.satsAmount,
    },
    bridgeFeeOutput:
      info.bridgeFeeOutput == null
        ? undefined
        : {
            index: bridgeFeeCausedOffset - 1,
            satsAmount: bitcoinToSatoshi(
              BigNumber.toString(info.bridgeFeeOutput.satsAmount),
            ),
          },
    hardLinkageOutput:
      info.hardLinkageOutput == null
        ? undefined
        : {
            index: hardLinkageCausedOffset - 1,
            satsAmount: BITCOIN_OUTPUT_MINIMUM_AMOUNT,
          },
    extraOutputs: info.extraOutputs.map((o, i) => ({
      index: extraOutputsStartOffset + i,
      satsAmount: o.satsAmount,
    })),
  }
}

const sumRuneUTXOs = (
  runeUTXOs: RunesUTXOSpendable[],
): Partial<Record<RuneIdCombined, bigint>> => {
  return runeUTXOs.reduce(
    (acc, runeUTXO) => {
      runeUTXO.runes.forEach(rune => {
        acc[rune.runeId] = (acc[rune.runeId] ?? 0n) + rune.runeAmount
      })
      return acc
    },
    {} as Record<RuneIdCombined, bigint>,
  )
}
