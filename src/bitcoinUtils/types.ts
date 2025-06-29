import { SigHash } from "@scure/btc-signer"
import { ReselectSpendableUTXOsFn_Public } from "./selectUTXOs"
import { UTXOBasic } from "./bitcoinHelpers"

/**
 * https://btcinformation.org/en/developer-guide#signature-hash-types
 */
export enum SignPsbtInput_SigHash {
  DEFAULT = SigHash.DEFAULT,
  ALL = SigHash.ALL,
  NONE = SigHash.NONE,
  SINGLE = SigHash.SINGLE,
  DEFAULT_ANYONECANPAY = SigHash.DEFAULT_ANYONECANPAY,
  ALL_ANYONECANPAY = SigHash.ALL_ANYONECANPAY,
  NONE_ANYONECANPAY = SigHash.NONE_ANYONECANPAY,
  SINGLE_ANYONECANPAY = SigHash.SINGLE_ANYONECANPAY,
}

export type SignPsbtInput = [inputIndex: number, sigHash: SignPsbtInput_SigHash]

export type BridgeFromBitcoinInput_signPsbtFn = (tx: {
  psbt: Uint8Array
  signInputs: SignPsbtInput[]
  selectedUTXOs: UTXOBasic[]
}) => Promise<{ psbt: Uint8Array }>

export type BridgeFromBitcoinInput_reselectSpendableUTXOs =
  ReselectSpendableUTXOsFn_Public

export type BridgeFromBitcoinInput_sendTransactionFn = (tx: {
  hex: string
  pegInOrderOutput: {
    index: number
    amount: bigint
    orderData: Uint8Array
  }
}) => Promise<{
  txid: string
}>
