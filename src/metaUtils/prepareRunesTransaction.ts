import { getOutputDustThreshold } from "@c4/btc-utils"
import * as btc from "@scure/btc-signer"
import { createBitcoinPegInRecipients } from "../bitcoinUtils/apiHelpers/createBitcoinPegInRecipients"
import { bitcoinToSatoshi, UTXOSpendable } from "../bitcoinUtils/bitcoinHelpers"
import { BitcoinAddress } from "../bitcoinUtils/btcAddresses"
import { BITCOIN_OUTPUT_MINIMUM_AMOUNT, SDK_NAME } from "../constants"
import {
  BitcoinTransactionPrepareResult,
  prepareTransaction,
} from "../bitcoinUtils/prepareTransaction"
import { reselectSpendableUTXOsFactory_public } from "../bitcoinUtils/selectUTXOs"
import { RuneIdCombined, SDKNumber } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { BigNumber } from "../utils/BigNumber"
import { KnownRoute_FromRunes } from "../utils/buildSupportedRoutes"
import {
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { toBitcoinOpReturnScript } from "../utils/RunesProtocol/RunesBitcoinScript"
import {
  _knownChainIdToErrorMessagePart,
  getChainIdNetworkType,
} from "../utils/types/knownIds"
import { runesTokenToId } from "./tokenAddresses"
import {
  BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs,
  RunesUTXOSpendable,
} from "./types"
import { Runestone } from "../utils/RunesProtocol/RunesProtocol.types"

export type BuildRunestoneFn = (info: {
  sendingRuneInfo: {
    id: RuneIdCombined
    divisibility: number
  }
  runeRawAmountToPegIn: bigint
  runeRawAmountsInTotal: Partial<Record<RuneIdCombined, bigint>>
  runesChangeOutputIndex: number
  appendOutputsStartIndex: number
  originalRunestone: Runestone
}) => Runestone

export type PrepareRunesTransactionInput = KnownRoute_FromRunes & {
  fromAddress: string
  fromAddressScriptPubKey: Uint8Array
  toAddress: string
  toAddressScriptPubKey: undefined | Uint8Array
  amount: SDKNumber
  inputRuneUTXOs: RunesUTXOSpendable[]

  runesChangeAddress: string
  runesChangeAddressScriptPubKey: Uint8Array

  networkFeeRate: bigint
  networkFeeChangeAddress: string
  networkFeeChangeAddressScriptPubKey: Uint8Array
  reselectSpendableNetworkFeeUTXOs: BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs

  orderData: Uint8Array
  pegInAddress: null | BitcoinAddress
  bridgeFeeOutput: null | {
    address: string
    scriptPubKey: Uint8Array
    satsAmount: BigNumber
  }
  hardLinkageOutput: null | BitcoinAddress

  pinnedInputs: UTXOSpendable[]
  appendInputs: UTXOSpendable[]
  pinnedOutputs: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
  appendOutputs: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]

  buildRunestone?: BuildRunestoneFn
}

/**
 * Bitcoin Tx Structure by default:
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
    pinnedOutputs: {
      index: number
      satsAmount: bigint
    }[]
    appendOutputs: {
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
    u.runes.flatMap(r =>
      r.runeId === runeIdCombined ? [r.runeDivisibility] : [],
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
          received: "does not contain",
        },
      ],
    )
  }

  const runeRawAmountToPegIn = BigNumber.toBigInt(
    { roundingMode: BigNumber.roundUp },
    BigNumber.rightMoveDecimals(runeDivisibility, info.amount),
  )
  const runeRawAmountsInTotal = sumRuneUTXOs(info.inputRuneUTXOs)
  const runeRawAmountToSend = runeRawAmountsInTotal[runeIdCombined] ?? 0n

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
          received: String(runeRawAmountsInTotal[runeIdCombined] ?? 0n),
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

  const runesChangeOutputCount = 1
  const runesChangeCausedOffset = 0 + runesChangeOutputCount

  const pinnedOutputsCausedOffset =
    runesChangeCausedOffset + info.pinnedOutputs.length

  const pegInOrderDataOutputCount = 1
  const pegInOrderDataCausedOffset =
    pinnedOutputsCausedOffset + pegInOrderDataOutputCount

  const bridgeFeeOutputCount = info.bridgeFeeOutput == null ? 0 : 1
  const bridgeFeeCausedOffset =
    pegInOrderDataCausedOffset + bridgeFeeOutputCount

  const hardLinkageOutputCount = info.hardLinkageOutput == null ? 0 : 1
  const hardLinkageCausedOffset = bridgeFeeCausedOffset + hardLinkageOutputCount

  const pegInRuneTokensOutputCount = info.pegInAddress == null ? 0 : 1
  const pegInRuneTokensCausedOffset =
    hardLinkageCausedOffset + pegInRuneTokensOutputCount

  const appendOutputsStartOffset = pegInRuneTokensCausedOffset

  const runesChangeOutputIndex =
    runesChangeCausedOffset - runesChangeOutputCount
  const originalRunestone: Runestone = {
    edicts:
      info.pegInAddress == null
        ? []
        : [
            {
              id: runeId.id,
              amount: runeRawAmountToPegIn,
              output: BigInt(
                pegInRuneTokensCausedOffset - pegInRuneTokensOutputCount,
              ),
            },
          ],
    // collect all remaining runes to the change address output
    pointer: BigInt(runesChangeOutputIndex),
  }
  const buildRunestone = info.buildRunestone ?? (info => info.originalRunestone)
  const runesOpReturnScript = toBitcoinOpReturnScript(
    buildRunestone({
      sendingRuneInfo: {
        id: runeIdCombined,
        divisibility: runeDivisibility,
      },
      runeRawAmountToPegIn,
      runeRawAmountsInTotal,
      runesChangeOutputIndex,
      appendOutputsStartIndex: appendOutputsStartOffset,
      originalRunestone,
    }),
  )

  const result = await prepareTransaction({
    pinnedUTXOs: [
      ...info.appendInputs,
      ...info.pinnedInputs,
      ...info.inputRuneUTXOs,
    ],
    recipients: [
      // runes change
      {
        addressScriptPubKey: info.runesChangeAddressScriptPubKey,
        satsAmount: BigNumber.toBigInt(
          { roundingMode: BigNumber.roundUp },
          getOutputDustThreshold({
            scriptPubKey: info.runesChangeAddressScriptPubKey,
          }),
        ),
      },
      ...info.pinnedOutputs.map(o => ({
        addressScriptPubKey: o.address.scriptPubKey,
        satsAmount: o.satsAmount,
      })),
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
              addressScriptPubKey: info.bridgeFeeOutput.scriptPubKey,
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
      ...(info.pegInAddress == null
        ? []
        : [
            {
              addressScriptPubKey: info.pegInAddress.scriptPubKey,
              satsAmount: BigNumber.toBigInt(
                { roundingMode: BigNumber.roundUp },
                getOutputDustThreshold({
                  scriptPubKey: info.pegInAddress.scriptPubKey,
                }),
              ),
            },
          ]),
      ...info.appendOutputs.map(o => ({
        addressScriptPubKey: o.address.scriptPubKey,
        satsAmount: o.satsAmount,
      })),
    ],
    changeAddressScriptPubKey: info.networkFeeChangeAddressScriptPubKey,
    feeRate: info.networkFeeRate,
    opReturnScripts: [runesOpReturnScript],
    reselectSpendableUTXOs: reselectSpendableUTXOsFactory_public(
      info.reselectSpendableNetworkFeeUTXOs,
    ),
  })

  const inputs = [
    ...result.inputs.slice(info.appendInputs.length),
    ...result.inputs.slice(0, info.appendInputs.length),
  ]

  return {
    ...result,
    inputs,
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
    pinnedOutputs: info.pinnedOutputs.map((o, i) => ({
      index: i,
      satsAmount: o.satsAmount,
    })),
    appendOutputs: info.appendOutputs.map((o, i) => ({
      index: appendOutputsStartOffset + i,
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
