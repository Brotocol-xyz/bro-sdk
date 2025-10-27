import * as btc from "@scure/btc-signer"
import { BITCOIN_OUTPUT_MINIMUM_AMOUNT } from "../constants"
import { SDKNumber } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { KnownRoute_FromBitcoin } from "../utils/buildSupportedRoutes"
import { KnownChainId } from "../utils/types/knownIds"
import { createBitcoinPegInRecipients } from "./apiHelpers/createBitcoinPegInRecipients"
import { bitcoinToSatoshi, UTXOSpendable } from "./bitcoinHelpers"
import { BitcoinAddress } from "./btcAddresses"
import {
  BitcoinTransactionPrepareResult,
  prepareTransaction,
} from "./prepareTransaction"
import { reselectSpendableUTXOsFactory_public } from "./selectUTXOs"
import { BridgeFromBitcoinInput_reselectSpendableUTXOs } from "./types"

export type PrepareBitcoinTransactionInput = KnownRoute_FromBitcoin & {
  fromAddress: string
  fromAddressScriptPubKey: Uint8Array
  toAddress: string
  toAddressScriptPubKey: undefined | Uint8Array
  amount: SDKNumber

  networkFeeRate: bigint
  reselectSpendableUTXOs: BridgeFromBitcoinInput_reselectSpendableUTXOs

  orderData: Uint8Array
  pegInAddress: null | BitcoinAddress
  hardLinkageOutput: null | BitcoinAddress
  opReturnScripts?: null | Uint8Array[]

  pinnedInputs: UTXOSpendable[]
  pinnedOutputs: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
  appendOutputs: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
}

/**
 * Bitcoin Tx Structure:
 *
 * * Inputs: ...
 * * Outputs:
 *    * Order data
 *    * Send to ALEX
 *    * Hard linkage (optional)
 *    * Bitcoin Changes
 */
export async function prepareBitcoinTransaction(
  sdkContext: Pick<SDKGlobalContext, "backendAPI">,
  info: PrepareBitcoinTransactionInput,
): Promise<
  BitcoinTransactionPrepareResult & {
    bitcoinNetwork: typeof btc.NETWORK
    revealOutput: {
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
    info.fromChain === KnownChainId.Bitcoin.Mainnet
      ? btc.NETWORK
      : btc.TEST_NETWORK

  const recipient = await createBitcoinPegInRecipients(sdkContext, {
    fromChain: info.fromChain,
    toChain: info.toChain,
    fromToken: info.fromToken,
    toToken: info.toToken,
    fromAddress: {
      address: info.fromAddress,
      scriptPubKey: info.fromAddressScriptPubKey,
    },
    toAddress: info.toAddress,
    orderData: info.orderData,
    feeRate: info.networkFeeRate,
  })

  const result = await prepareTransaction({
    pinnedUTXOs: info.pinnedInputs,
    recipients: [
      ...info.pinnedOutputs.map(o => ({
        addressScriptPubKey: o.address.scriptPubKey,
        satsAmount: o.satsAmount,
      })),
      {
        addressScriptPubKey: recipient.scriptPubKey,
        satsAmount: recipient.satsAmount,
      },
      ...(info.pegInAddress == null
        ? []
        : [
            {
              addressScriptPubKey: info.pegInAddress.scriptPubKey,
              satsAmount: bitcoinToSatoshi(info.amount),
            },
          ]),
      ...(info.hardLinkageOutput == null
        ? []
        : [
            {
              addressScriptPubKey: info.hardLinkageOutput.scriptPubKey,
              satsAmount: BITCOIN_OUTPUT_MINIMUM_AMOUNT,
            },
          ]),
      ...info.appendOutputs.map(o => ({
        addressScriptPubKey: o.address.scriptPubKey,
        satsAmount: o.satsAmount,
      })),
    ],
    opReturnScripts: info.opReturnScripts ?? [],
    changeAddressScriptPubKey: info.fromAddressScriptPubKey,
    feeRate: info.networkFeeRate,
    reselectSpendableUTXOs: reselectSpendableUTXOsFactory_public(
      info.reselectSpendableUTXOs,
    ),
  })

  const pinnedOutputsCausedOffset = info.pinnedOutputs.length
  const pegInOrderDataCausedOffset = pinnedOutputsCausedOffset + 1
  const pegInBitcoinTokenCausedOffset = pegInOrderDataCausedOffset + 1
  const hardLinkageCausedOffset =
    pegInBitcoinTokenCausedOffset + (info.hardLinkageOutput == null ? 0 : 1)
  const extraOutputsStartOffset = hardLinkageCausedOffset

  return {
    ...result,
    bitcoinNetwork,
    revealOutput: {
      index: pegInOrderDataCausedOffset - 1,
      satsAmount: recipient.satsAmount,
    },
    hardLinkageOutput:
      hardLinkageCausedOffset == null
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
      index: extraOutputsStartOffset + i,
      satsAmount: o.satsAmount,
    })),
  }
}
