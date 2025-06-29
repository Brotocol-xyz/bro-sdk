import { getOutputDustThreshold } from "@c4/btc-utils"
import { Transaction } from "@scure/btc-signer"
import { bitcoinToSatoshi, createTransaction } from "../bitcoinHelpers"
import { createInstantSwapTx } from "../bitcoinUtils/apiHelpers/createInstantSwapTx"
import { InstantSwapOrder } from "../bitcoinUtils/apiHelpers/InstantSwapOrder"
import { EstimateBitcoinTransactionOutput } from "../bitcoinUtils/broadcastBitcoinTransaction"
import { BitcoinAddress } from "../bitcoinUtils/btcAddresses"
import { getPlaceholderUTXO } from "../bitcoinUtils/selectUTXOs"
import { SignPsbtInput_SigHash } from "../bitcoinUtils/types"
import { KnownRoute_FromRunes_ToBitcoin } from "../lowlevelUnstableInfos"
import { parseRuneId } from "../runesHelpers"
import { toSDKNumberOrUndefined } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { CreateBridgeOrderResult } from "../stacksUtils/createBridgeOrderFromBitcoin"
import { range } from "../utils/arrayHelpers"
import { max } from "../utils/bigintHelpers"
import { BigNumber } from "../utils/BigNumber"
import { checkPSBTMatches } from "../utils/bitcoinTransactionCheckHelpers"
import { KnownRoute_FromRunes_ToRunes } from "../utils/buildSupportedRoutes"
import {
  BroSDKErrorBase,
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { decodeHex, encodeHex } from "../utils/hexHelpers"
import { entries } from "../utils/objectHelper"
import { Edict } from "../utils/RunesProtocol/RunesProtocol.types"
import { SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public } from "../utils/SwapRouteHelpers"
import {
  _knownChainIdToErrorMessagePart,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import { TransferProphet } from "../utils/types/TransferProphet"
import { getMetaPegInAddress } from "./btcAddresses"
import {
  prepareRunesTransaction,
  PrepareRunesTransactionInput,
} from "./prepareRunesTransaction"
import { runesTokenToId } from "./tokenAddresses"
import {
  BridgeFromRunesInput_sendTransactionFn,
  BridgeFromRunesInput_signPsbtFn,
  RunesUTXOSpendable,
} from "./types"

export interface BroadcastRunesInstantSwapTransactionResponse {
  txid: string
  tx: Uint8Array
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}
export async function broadcastRunesInstantSwapTransaction(
  sdkContext: SDKGlobalContext,
  info: Omit<ConstructRunesInstantSwapTransactionInput, "orderData"> & {
    sendTransaction: BridgeFromRunesInput_sendTransactionFn
  },
  order: {
    orderData: CreateBridgeOrderResult
    swapRoute: SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public
  },
): Promise<BroadcastRunesInstantSwapTransactionResponse> {
  const pegInAddress = getMetaPegInAddress(info.fromChain, info.toChain)
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

  const psbtInfo = await constructRunesInstantSwapTransaction(sdkContext, {
    ...info,
    toChain: info.toChain as any,
    toToken: info.toToken as any,
    orderData: order.orderData.data,
  })

  const revealOutput = psbtInfo.revealOutput

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
      index: psbtInfo.revealOutput.index,
      amount: psbtInfo.revealOutput.satsAmount,
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

type ConstructRunesInstantSwapTransactionInput = (
  | KnownRoute_FromRunes_ToBitcoin
  | KnownRoute_FromRunes_ToRunes
) &
  PrepareTransactionCommonInput & {
    toAddressScriptPubKey: Uint8Array
    signPsbt: BridgeFromRunesInput_signPsbtFn
    swapRoute: SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public
  }
async function constructRunesInstantSwapTransaction(
  sdkContext: SDKGlobalContext,
  info: ConstructRunesInstantSwapTransactionInput,
): Promise<{
  tx: Transaction
  revealOutput: {
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

  const recipients = txOptions.recipients.concat(
    txOptions.changeAmount > 0n
      ? [
          {
            addressScriptPubKey: info.networkFeeChangeAddressScriptPubKey,
            satsAmount: txOptions.changeAmount,
          },
        ]
      : [],
  )

  const userInputCount = txOptions.inputs.length - 1
  const getSighashType = (idx: number): undefined | SignPsbtInput_SigHash => {
    if (idx > userInputCount - 1) return
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
    recipients,
    txOptions.opReturnScripts ?? [],
  )

  return {
    tx,
    revealOutput: txOptions.revealOutput,
    extraOutputs: txOptions.appendOutputs,
    signPsbt: async psbt => {
      return await info.signPsbt({
        psbt,
        signRunesInputs: range(0, info.inputRuneUTXOs.length).flatMap(idx => {
          const sighashType = getSighashType(idx)
          return sighashType == null ? [] : [[idx, sighashType]]
        }),
        signBitcoinInputs: range(
          info.inputRuneUTXOs.length,
          tx.inputsLength,
        ).flatMap(idx => {
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

type EstimateRunesInstantSwapTransactionInput =
  PrepareTransactionCommonInput & {
    orderData: Uint8Array
    swapRoute:
      | undefined
      | SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public
  }
export async function estimateRunesInstantSwapTransaction(
  sdkContext: SDKGlobalContext,
  info: EstimateRunesInstantSwapTransactionInput,
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

type PrepareTransactionCommonInput = Omit<
  PrepareRunesTransactionInput,
  | "fromChain"
  | "fromToken"
  | "toChain"
  | "toToken"
  | "pegInAddress"
  | "hardLinkageOutput"
> &
  KnownRoute_FromRunes_ToBitcoin
async function prepareTransactionCommon(
  sdkContext: SDKGlobalContext,
  info: PrepareTransactionCommonInput,
): ReturnType<typeof prepareRunesTransaction> {
  return await prepareRunesTransaction(sdkContext, "bridgeFromRunes", {
    ...info,
    pegInAddress: null,
    hardLinkageOutput: null,
  })
}

export type Runes2BitcoinInstantSwapTransactionParams = Pick<
  ConstructRunesInstantSwapTransactionInput,
  | "runesChangeAddress"
  | "runesChangeAddressScriptPubKey"
  | "pinnedInputs"
  | "appendInputs"
  | "pinnedOutputs"
  | "appendOutputs"
  | "buildRunestone"
  | "signPsbt"
>
export async function getRunes2BitcoinInstantSwapTransactionParams(
  sdkContext: SDKGlobalContext,
  info: {
    methodName: string
    transferProphet: TransferProphet
    swapRoute: SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public
    fromChain: KnownChainId.RunesChain
    fromToken: KnownTokenId.RunesToken
    fromAddress: string
    fromAddressScriptPubKey: Uint8Array
    fromAmount: BigNumber
    toChain: KnownChainId.BitcoinChain
    toToken: KnownTokenId.BitcoinToken
    toAddress: string
    toAddressScriptPubKey: Uint8Array
    inputRuneUTXOs: RunesUTXOSpendable[]
    extraOutputs: {
      address: BitcoinAddress
      satsAmount: bigint
    }[]
    signPsbt: BridgeFromRunesInput_signPsbtFn
  },
): Promise<{
  params: Runes2BitcoinInstantSwapTransactionParams
  transformResponse: (
    resp: BroadcastRunesInstantSwapTransactionResponse,
  ) => Promise<BroadcastRunesInstantSwapTransactionResponse>
}> {
  const fromRuneId = await runesTokenToId(
    sdkContext,
    info.fromChain,
    info.fromToken,
  )
  if (fromRuneId == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const fromRuneIdStr =
    `${Number(fromRuneId.id.blockHeight)}:${Number(fromRuneId.id.txIndex)}` as const
  const fromRuneUTXO = info.inputRuneUTXOs.find(u =>
    u.runes.some(r => r.runeId === fromRuneIdStr),
  )
  const fromRuneInfo = fromRuneUTXO?.runes.find(r => r.runeId === fromRuneIdStr)
  if (fromRuneInfo == null) {
    throw new InvalidMethodParametersError(
      [
        `${info.methodName} (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "inputRuneUTXOs",
          expected: `contains rune ${fromRuneIdStr}`,
          received: `does not contain`,
        },
      ],
    )
  }

  const marketMakerPlaceholderUTXO = getPlaceholderUTXO({
    network: info.fromChain,
    amount: 330n,
  })

  const bitcoinFeeAmount = BigNumber.sum(
    info.transferProphet.fees
      .filter(
        (f): f is typeof f & { type: "fixed" } =>
          f.type === "fixed" && f.token === KnownTokenId.Bitcoin.BTC,
      )
      .map(f => f.amount),
  )

  const transformResponse = async (
    resp: BroadcastRunesInstantSwapTransactionResponse,
  ): Promise<BroadcastRunesInstantSwapTransactionResponse> => {
    return resp
  }

  const signPsbt: BridgeFromRunesInput_signPsbtFn = async (...args) => {
    const [txInfo] = args

    const tx = Transaction.fromPSBT(txInfo.psbt, {
      allowUnknownInputs: true,
      allowUnknownOutputs: true,
    })

    const checkRes = checkPSBTMatches({
      tx,
      inputTokens: txInfo.selectedUTXOs.map((u, idx) => {
        // skip market maker placeholder inputs
        if (u.txId === marketMakerPlaceholderUTXO.txId) return null

        const inputRuneUTXO = info.inputRuneUTXOs.find(
          iu => iu.txId === u.txId && iu.index === u.index,
        )

        return {
          ...u,
          runes:
            inputRuneUTXO == null
              ? []
              : inputRuneUTXO.runes.map(r => ({
                  runeId: r.runeId,
                  amount: r.runeAmount,
                })),
        }
      }),
      expectedInOutFlow: [
        // user runes balance decreased, and paid network fee in bitcoin
        {
          address: {
            address: info.fromAddress,
            scriptPubKey: info.fromAddressScriptPubKey,
          },
          runes: [
            {
              runeId: fromRuneIdStr,
              amount: -BigNumber.toBigInt(
                { roundingMode: BigNumber.roundDown },
                BigNumber.rightMoveDecimals(
                  fromRuneInfo.runeDivisibility,
                  info.fromAmount,
                ),
              ),
            },
          ],
          // TODO: check user's bitcoin address paid network fee
        },
        // TODO: check user bitcoin balance increased
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
   *   * USER runes input // for swap
   *   * ...USER runes input
   *   * USER bitcoin input // for network fee
   *   * ...USER bitcoin input
   *   * MARKET MAKER bitcoin input PLACEHOLDER
   * outputs:
   *   * USER runes change // if runestone invalid, the first output position can insure user still have the runes funds
   *   * peg-in order data // this is the proof of user intent
   *   * MARKET MAKER receive rune tokens PLACEHOLDER // a.k.a. peg-in token amount output
   *   * MARKET MAKER bitcoin change PLACEHOLDER + bridge fee
   *   * USER receive bitcoin output
   *   * ...extra outputs (optional)
   *   * USER bitcoin change (optional)
   *   * runestone
   */
  const params: Runes2BitcoinInstantSwapTransactionParams = {
    runesChangeAddress: info.fromAddress,
    runesChangeAddressScriptPubKey: info.fromAddressScriptPubKey,
    pinnedInputs: [],
    appendInputs: [
      // market maker bitcoin input placeholder
      {
        ...marketMakerPlaceholderUTXO,
        amount: bitcoinToSatoshi(info.swapRoute.minimumAmountsToReceive),
      },
    ],
    pinnedOutputs: [],
    appendOutputs: [
      // market maker receive rune tokens output placeholder
      {
        address: {
          address: marketMakerPlaceholderUTXO.address,
          scriptPubKey: marketMakerPlaceholderUTXO.scriptPubKey,
        },
        satsAmount: marketMakerPlaceholderUTXO.amount,
      },
      // market maker bitcoin change output placeholder + bridge fee
      {
        address: {
          address: marketMakerPlaceholderUTXO.address,
          scriptPubKey: marketMakerPlaceholderUTXO.scriptPubKey,
        },
        satsAmount: max([
          marketMakerPlaceholderUTXO.amount,
          bitcoinToSatoshi(bitcoinFeeAmount),
        ]),
      },
      // user receive bitcoin output
      {
        address: {
          address: info.toAddress,
          scriptPubKey: info.toAddressScriptPubKey,
        },
        satsAmount: bitcoinToSatoshi(info.swapRoute.minimumAmountsToReceive),
      },
      // extra outputs
      ...(info.extraOutputs ?? []),
    ],
    buildRunestone: info => {
      return {
        ...info.originalRunestone,
        edicts: entries(info.runeRawAmountsInTotal).flatMap(
          ([runeId, runeRawAmount]): Edict[] => {
            if (runeRawAmount == null || runeRawAmount === 0n) return []

            // balance will be sent to the pointer output
            if (info.sendingRuneInfo.id !== runeId) return []

            return [
              // runes change will be sent to the pointer output
              {
                id: parseRuneId(runeId),
                amount: info.runeRawAmountToPegIn,
                output: BigInt(info.appendOutputsStartIndex),
              },
            ]
          },
        ),
      }
    },
    signPsbt,
  }

  return {
    params,
    transformResponse,
  }
}

export type Runes2RunesInstantSwapTransactionParams = Pick<
  ConstructRunesInstantSwapTransactionInput,
  | "runesChangeAddress"
  | "runesChangeAddressScriptPubKey"
  | "pinnedInputs"
  | "appendInputs"
  | "pinnedOutputs"
  | "appendOutputs"
  | "buildRunestone"
  | "signPsbt"
>
export async function getRunes2RunesInstantSwapTransactionParams(
  sdkContext: SDKGlobalContext,
  info: {
    methodName: string
    transferProphet: TransferProphet
    swapRoute: SwapRouteViaInstantSwap_WithMinimumAmountsToReceive_Public
    fromChain: KnownChainId.RunesChain
    fromToken: KnownTokenId.RunesToken
    fromAddress: string
    fromAddressScriptPubKey: Uint8Array
    fromAmount: BigNumber
    toChain: KnownChainId.RunesChain
    toToken: KnownTokenId.RunesToken
    toAddress: string
    toAddressScriptPubKey: Uint8Array
    inputRuneUTXOs: RunesUTXOSpendable[]
    extraOutputs: {
      address: BitcoinAddress
      satsAmount: bigint
    }[]
    signPsbt: BridgeFromRunesInput_signPsbtFn
  },
): Promise<{
  params: Runes2RunesInstantSwapTransactionParams
  transformResponse: (
    resp: BroadcastRunesInstantSwapTransactionResponse,
  ) => Promise<BroadcastRunesInstantSwapTransactionResponse>
}> {
  const fromRuneId = await runesTokenToId(
    sdkContext,
    info.fromChain,
    info.fromToken,
  )
  if (fromRuneId == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const fromRuneIdStr =
    `${Number(fromRuneId.id.blockHeight)}:${Number(fromRuneId.id.txIndex)}` as const
  const fromRuneUTXO = info.inputRuneUTXOs.find(u =>
    u.runes.some(r => r.runeId === fromRuneIdStr),
  )
  const fromRuneInfo = fromRuneUTXO?.runes.find(r => r.runeId === fromRuneIdStr)

  if (fromRuneInfo == null) {
    throw new InvalidMethodParametersError(
      [
        `${info.methodName} (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "inputRuneUTXOs",
          expected: `contains rune ${fromRuneIdStr}`,
          received: `does not contain`,
        },
      ],
    )
  }

  const marketMakerPlaceholderUTXO = getPlaceholderUTXO({
    network: info.fromChain,
    amount: 330n,
  })

  const bitcoinFeeAmount = BigNumber.sum(
    info.transferProphet.fees
      .filter(
        (f): f is typeof f & { type: "fixed" } =>
          f.type === "fixed" && f.token === KnownTokenId.Bitcoin.BTC,
      )
      .map(f => f.amount),
  )

  const transformResponse = async (
    resp: BroadcastRunesInstantSwapTransactionResponse,
  ): Promise<BroadcastRunesInstantSwapTransactionResponse> => {
    return {
      ...resp,
      extraOutputs: resp.extraOutputs.slice(1),
    }
  }

  const signPsbt: BridgeFromRunesInput_signPsbtFn = async (...args) => {
    const [txInfo] = args

    const tx = Transaction.fromPSBT(txInfo.psbt, {
      allowUnknownInputs: true,
      allowUnknownOutputs: true,
    })

    const checkRes = checkPSBTMatches({
      tx,
      inputTokens: txInfo.selectedUTXOs.map(u => {
        // skip market maker placeholder inputs
        if (u.txId === marketMakerPlaceholderUTXO.txId) return null

        const inputRuneUTXO = info.inputRuneUTXOs.find(
          iu => iu.txId === u.txId && iu.index === u.index,
        )
        return {
          ...u,
          runes:
            inputRuneUTXO == null
              ? []
              : inputRuneUTXO.runes.map(r => ({
                  runeId: r.runeId,
                  amount: r.runeAmount,
                })),
        }
      }),
      expectedInOutFlow: [
        // user runes balance decreased, and paid network fee in bitcoin
        {
          address: {
            address: info.fromAddress,
            scriptPubKey: info.fromAddressScriptPubKey,
          },
          runes: [
            {
              runeId: fromRuneIdStr,
              amount: -BigNumber.toBigInt(
                { roundingMode: BigNumber.roundDown },
                BigNumber.rightMoveDecimals(
                  fromRuneInfo.runeDivisibility,
                  info.fromAmount,
                ),
              ),
            },
          ],
          // TODO: check user's bitcoin address paid network fee
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
   *   * USER runes input // for swap
   *   * ...USER runes input
   *   * USER bitcoin input // for network fee
   *   * ...USER bitcoin input
   *   * MARKET MAKER runes input PLACEHOLDER
   * outputs:
   *   * MARKET MAKER runes change PLACEHOLDER + receive rune tokens
   *   * peg-in order data // this is the proof of user intent
   *   * MARKET MAKER receive bridge fee output
   *   * USER receive rune tokens
   *   * ...extra outputs (optional)
   *   * USER bitcoin change (optional)
   *   * runestone
   */
  const params: Runes2RunesInstantSwapTransactionParams = {
    runesChangeAddress: marketMakerPlaceholderUTXO.address,
    runesChangeAddressScriptPubKey: marketMakerPlaceholderUTXO.scriptPubKey,
    pinnedInputs: [],
    appendInputs: [
      // market maker runes input placeholder
      marketMakerPlaceholderUTXO,
    ],
    pinnedOutputs: [],
    appendOutputs: [
      // market maker receive bridge fee output
      {
        address: {
          address: marketMakerPlaceholderUTXO.address,
          scriptPubKey: marketMakerPlaceholderUTXO.scriptPubKey,
        },
        satsAmount: max([
          marketMakerPlaceholderUTXO.amount,
          bitcoinToSatoshi(bitcoinFeeAmount),
        ]),
      },
      // user receive rune tokens output
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
      ...(info.extraOutputs ?? []),
    ],
    buildRunestone: info => {
      const userRunesChangeOutputIndex = info.appendOutputsStartIndex + 1

      return {
        ...info.originalRunestone,
        edicts: entries(info.runeRawAmountsInTotal).flatMap(
          ([runeId, runeRawAmount]): Edict[] => {
            if (runeRawAmount == null || runeRawAmount === 0n) return []

            if (info.sendingRuneInfo.id !== runeId) {
              return [
                {
                  id: parseRuneId(runeId),
                  amount: runeRawAmount,
                  output: BigInt(userRunesChangeOutputIndex),
                },
              ]
            }

            const changeAmount = runeRawAmount - info.runeRawAmountToPegIn
            if (changeAmount === 0n) return []

            return [
              // runeRawAmountToPegIn will be sent to the pointer output
              {
                id: parseRuneId(runeId),
                amount: changeAmount,
                output: BigInt(userRunesChangeOutputIndex),
              },
            ]
          },
        ),
      }
    },
    signPsbt,
  }

  return {
    params,
    transformResponse,
  }
}
