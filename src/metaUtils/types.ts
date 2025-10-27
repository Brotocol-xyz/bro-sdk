import { UTXOBasic, UTXOSpendable } from "../bitcoinUtils/bitcoinHelpers"
import { ReselectSpendableUTXOsFn_Public } from "../bitcoinUtils/selectUTXOs"
import { SignPsbtInput } from "../bitcoinUtils/types"
import { RuneIdCombined } from "../sdkUtils/types"

export type BridgeFromRunesInput_signPsbtFn = (tx: {
  psbt: Uint8Array
  signBitcoinInputs: SignPsbtInput[]
  signRunesInputs: SignPsbtInput[]
  selectedUTXOs: UTXOBasic[]
}) => Promise<{ psbt: Uint8Array }>

export type BridgeFromRunesInput_sendTransactionFn = (tx: {
  hex: string
  pegInOrderOutput: {
    index: number
    amount: bigint
    orderData: Uint8Array
  }
}) => Promise<{
  txid: string
}>

export type BridgeFromRunesInput_reselectSpendableNetworkFeeUTXOs =
  ReselectSpendableUTXOsFn_Public

export type RunesUTXOSpendable = UTXOSpendable & {
  runes: {
    runeId: RuneIdCombined
    runeDivisibility: number
    runeAmount: bigint
  }[]
}
