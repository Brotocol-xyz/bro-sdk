import { getOutputDustThreshold } from "@c4/btc-utils"
import { Transaction } from "@scure/btc-signer"
import { toSDKNumberOrUndefined } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { CreateBridgeOrderResult } from "../stacksUtils/createBridgeOrderFromBitcoin"
import { range } from "../utils/arrayHelpers"
import { max } from "../utils/bigintHelpers"
import { BigNumber } from "../utils/BigNumber"
import { checkPSBTMatches } from "../utils/bitcoinTransactionCheckHelpers"
import { KnownRoute_FromBitcoin_ToRunes } from "../utils/buildSupportedRoutes"
import { makeBytes } from "../utils/byteHelpers"
import { BroSDKErrorBase, UnsupportedBridgeRouteError } from "../utils/errors"
import { decodeHex, encodeHex } from "../utils/hexHelpers"
import { Result } from "../utils/Result"
import { SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public } from "../utils/SwapRouteHelpers"
import { isNotNull } from "../utils/typeHelpers"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { TransferProphet } from "../utils/types/TransferProphet"
import { createInstantSwapTx } from "./apiHelpers/createInstantSwapTx"
import { InstantSwapOrder } from "./apiHelpers/InstantSwapOrder"
import { bitcoinToSatoshi } from "./bitcoinHelpers"
import { EstimateBitcoinTransactionOutput } from "./broadcastBitcoinTransaction"
import { BitcoinAddress, getBTCPegInAddress } from "./btcAddresses"
import { createTransaction } from "./createTransaction"
import {
  prepareBitcoinTransaction,
  PrepareBitcoinTransactionInput,
} from "./prepareBitcoinTransaction"
import { getPlaceholderUTXO } from "./selectUTXOs"
import {
  BridgeFromBitcoinInput_sendTransactionFn,
  BridgeFromBitcoinInput_signPsbtFn,
  SignPsbtInput_SigHash,
} from "./types"

export interface BroadcastBitcoinInstantSwapTransactionResponse {
  txid: string
  tx: Uint8Array
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}
export async function broadcastBitcoinInstantSwapTransaction(
  sdkContext: SDKGlobalContext,
  info: Omit<ConstructBitcoinInstantSwapTransactionInput, "orderData"> & {
    sendTransaction: BridgeFromBitcoinInput_sendTransactionFn
  },
  order: {
    orderData: CreateBridgeOrderResult
    swapRoute: SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public
  },
): Promise<BroadcastBitcoinInstantSwapTransactionResponse> {
  const pegInAddress = getBTCPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const instantSwapOrder: InstantSwapOrder = {
    fromChain: info.fromChain,
    fromAddress: info.fromAddressScriptPubKey,
    fromTokenId: info.fromToken,
    fromAmount: BigNumber.from(info.amount),
    toChain: info.toChain,
    toAddress: info.toAddressScriptPubKey,
    toTokenId: info.toToken,
    toAmount: BigNumber.from(order.swapRoute.minimumAmountsToReceive),
  }

  const psbtInfo = await constructBitcoinInstantSwapTransaction(sdkContext, {
    ...info,
    toChain: info.toChain,
    toToken: info.toToken,
    orderData: order.orderData.data,
  })

  // should not happen
  const revealOutput = psbtInfo.revealOutput
  if (revealOutput == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const tx = await createInstantSwapTx(sdkContext, {
    fromChain: info.fromChain,
    instantSwapOrder,
    psbt: psbtInfo.tx.toPSBT(),
    finalizeJob: async info => {
      const { psbt: signedPsbt } = await psbtInfo.signPsbt(
        info.marketMakerSignedPSBT,
      )

      const tx = Transaction.fromPSBT(signedPsbt, {
        allowUnknownInputs: true,
        allowUnknownOutputs: true,
        allowUnknown: true,
      })
      tx.finalize()

      const txRaw = tx.extract()

      const { txid } = await info.sendFinalizeJobRequest({
        tx: txRaw,
        orderData: order.orderData.data,
        orderOutputIndex: revealOutput.index,
        orderOutputSatoshiAmount: revealOutput.satsAmount,
        revealToAddress: pegInAddress,
      })

      return { txid, tx: txRaw }
    },
  })
  const txHex = encodeHex(tx.tx)
  const apiBroadcastedTxId = tx.txid

  const { txid: delegateBroadcastedTxId } = await info.sendTransaction({
    hex: txHex,
    pegInOrderOutput: {
      index: revealOutput.index,
      amount: revealOutput.satsAmount,
      orderData: order.orderData.data,
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
    tx: decodeHex(txHex),
    extraOutputs: psbtInfo.extraOutputs,
  }
}

type ConstructBitcoinInstantSwapTransactionInput =
  PrepareTransactionCommonInput & {
    toAddressScriptPubKey: Uint8Array
    signPsbt: BridgeFromBitcoinInput_signPsbtFn
    swapRoute: SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public
  }
async function constructBitcoinInstantSwapTransaction(
  sdkContext: SDKGlobalContext,
  info: ConstructBitcoinInstantSwapTransactionInput,
): Promise<{
  tx: Transaction
  revealOutput?: {
    index: number
    satsAmount: bigint
  }
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
  signPsbt: (psbt: Uint8Array) => Promise<{ psbt: Uint8Array }>
}> {
  const txOptions = await prepareTransactionCommon(sdkContext, info)

  const getSighashType = (idx: number): undefined | SignPsbtInput_SigHash => {
    if (idx === 0) return
    return SignPsbtInput_SigHash.ALL
  }

  const tx = createTransaction(
    txOptions.inputs.map((i, idx) => {
      const sighashType = getSighashType(idx)
      return {
        ...i,
        sighashType: sighashType == null ? undefined : Number(sighashType),
      }
    }),
    txOptions.recipients.concat({
      addressScriptPubKey: info.fromAddressScriptPubKey,
      satsAmount: txOptions.changeAmount,
    }),
    txOptions.opReturnScripts ?? [],
  )

  return {
    tx,
    revealOutput: txOptions.revealOutput,
    extraOutputs: txOptions.appendOutputs,
    signPsbt: async psbt => {
      return await info.signPsbt({
        psbt,
        signInputs: range(0, tx.inputsLength).flatMap(idx => {
          const sighashType = getSighashType(idx)
          return sighashType == null ? [] : [[idx, sighashType]]
        }),
        selectedUTXOs: txOptions.inputs.map(i => ({
          txId: i.txId,
          index: i.index,
          amount: i.amount,
        })),
      })
    },
  }
}

type EstimateBitcoinInstantSwapTransactionInput =
  PrepareTransactionCommonInput & {
    orderData: Uint8Array
    swapRoute:
      | undefined
      | SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public
  }
export async function estimateBitcoinInstantSwapTransaction(
  sdkContext: SDKGlobalContext,
  info: EstimateBitcoinInstantSwapTransactionInput,
): Promise<EstimateBitcoinTransactionOutput> {
  const resp = await prepareTransactionCommon(sdkContext, info)

  return {
    fee: toSDKNumberOrUndefined(resp.fee),
    estimatedVSize: toSDKNumberOrUndefined(resp.estimatedVSize),
    revealTransactionSatoshiAmount: toSDKNumberOrUndefined(
      resp.revealOutput.satsAmount,
    ),
  }
}

type PrepareTransactionCommonInput = KnownRoute_FromBitcoin_ToRunes &
  Omit<
    PrepareBitcoinTransactionInput,
    | "fromChain"
    | "fromToken"
    | "toChain"
    | "toToken"
    | "pegInAddress"
    | "hardLinkageOutput"
  >
async function prepareTransactionCommon(
  sdkContext: SDKGlobalContext,
  info: PrepareTransactionCommonInput,
): ReturnType<typeof prepareBitcoinTransaction> {
  return await prepareBitcoinTransaction(sdkContext, {
    ...info,
    pegInAddress: null,
    hardLinkageOutput: null,
  })
}

export type Bitcoin2RunesInstantSwapTransactionParams = Pick<
  ConstructBitcoinInstantSwapTransactionInput,
  | "pinnedInputs"
  | "pinnedOutputs"
  | "appendOutputs"
  | "opReturnScripts"
  | "signPsbt"
>
export async function getBitcoin2RunesInstantSwapTransactionParams(
  sdkContext: SDKGlobalContext,
  info: {
    methodName: string
    transferProphet: TransferProphet
    fromChain: KnownChainId.BitcoinChain
    fromAddress: string
    fromAddressScriptPubKey: Uint8Array
    fromAmount: BigNumber
    toChain: KnownChainId.RunesChain
    toToken: KnownTokenId.RunesToken
    toAddress: string
    toAddressScriptPubKey: Uint8Array
    extraOutputs: {
      address: BitcoinAddress
      satsAmount: bigint
    }[]
    signPsbt: BridgeFromBitcoinInput_signPsbtFn
  },
): Promise<{
  params: Bitcoin2RunesInstantSwapTransactionParams
  transformResponse: (
    resp: BroadcastBitcoinInstantSwapTransactionResponse,
  ) => Promise<BroadcastBitcoinInstantSwapTransactionResponse>
}> {
  const marketMakerPlaceholderUTXO = getPlaceholderUTXO({
    network: info.fromChain,
    amount: 330n,
  })

  const signPsbt: BridgeFromBitcoinInput_signPsbtFn = async (...args) => {
    const [txInfo] = args

    const tx = Transaction.fromPSBT(txInfo.psbt, {
      allowUnknownInputs: true,
      allowUnknownOutputs: true,
    })

    const txFee = Result.maybeValue(Result.encase(() => tx.fee)) ?? 0n

    const fromBitcoinSatsAmount = bitcoinToSatoshi(info.fromAmount)

    const checkRes = checkPSBTMatches({
      tx,
      inputTokens: txInfo.selectedUTXOs.map((u, idx) => {
        // first input is market maker bitcoin input placeholder
        if (idx === 0) return null

        return { ...u, runes: [] }
      }),
      expectedInOutFlow: [
        // user bitcoin balance decreased, and paid network fee, bridge fee, etc.
        {
          address: {
            address: info.fromAddress,
            scriptPubKey: info.fromAddressScriptPubKey,
          },
          bitcoin: {
            // TODO: improve this, make it more accurate
            satsAmount: [
              -fromBitcoinSatsAmount -
                max([
                  fromBitcoinSatsAmount,
                  BigInt(Math.ceil(Number(txFee) * 1.5)),
                ]),
              -fromBitcoinSatsAmount,
            ],
          },
        },
        // TODO: check user runes balance increased
      ],
    })
    if (checkRes.type === "error") {
      throw new BroSDKErrorBase(checkRes.payload)
    }

    return await info.signPsbt(...args)
  }

  /**
   * Transaction Structure:
   *
   * inputs:
   *   * MARKET MAKER runes input PLACEHOLDER
   *   * USER bitcoin input
   *   * ...USER bitcoin input
   * outputs:
   *   * MARKET MAKER runes change PLACEHOLDER
   *   * peg-in order data // this is the proof of user intent
   *   * MARKET MAKER receive bitcoin output // a.k.a. peg-in amount
   *   * USER receive runes output
   *   * ...extra outputs (optional)
   *   * USER bitcoin change
   *   * runestone PLACEHOLDER
   */
  const params: Bitcoin2RunesInstantSwapTransactionParams = {
    pinnedInputs: [
      // market maker runes input placeholder
      marketMakerPlaceholderUTXO,
    ],
    pinnedOutputs: [
      // market maker runes change output placeholder
      {
        address: {
          address: marketMakerPlaceholderUTXO.address,
          scriptPubKey: marketMakerPlaceholderUTXO.scriptPubKey,
        },
        satsAmount: marketMakerPlaceholderUTXO.amount,
      },
    ],
    appendOutputs: [
      // MARKET MAKER receive bitcoin output
      {
        address: {
          address: marketMakerPlaceholderUTXO.address,
          scriptPubKey: marketMakerPlaceholderUTXO.scriptPubKey,
        },
        satsAmount: max([
          marketMakerPlaceholderUTXO.amount,
          bitcoinToSatoshi(info.fromAmount),
        ]),
      },
      // user receive runes output
      {
        address: {
          address: info.toAddress,
          scriptPubKey: info.toAddressScriptPubKey,
        },
        satsAmount: BigInt(
          getOutputDustThreshold({
            scriptPubKey: info.toAddressScriptPubKey,
          }),
        ),
      },
      // extra outputs
      ...info.extraOutputs,
    ],
    opReturnScripts: [
      // runestone placeholder output
      KnownChainId.isRunesChain(info.toChain)
        ? makeBytes(
            [
              0x6a /* OP_RETURN */,
              78 /* 80 (OP_RETURN max length) - OP_RETURN byte - OP_PUSHDATA byte */,
            ],
            80,
          )
        : null,
    ].filter(isNotNull),
    signPsbt,
  }

  const transformResponse = async (
    resp: BroadcastBitcoinInstantSwapTransactionResponse,
  ): Promise<BroadcastBitcoinInstantSwapTransactionResponse> => {
    return {
      ...resp,
      extraOutputs: resp.extraOutputs.slice(1),
    }
  }

  return {
    params,
    transformResponse,
  }
}
