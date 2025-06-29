import * as btc from "@scure/btc-signer"
import { hasAny } from "../utils/arrayHelpers"
import { UTXOSpendable } from "./bitcoinHelpers"

export interface Recipient {
  addressScriptPubKey: Uint8Array
  satsAmount: bigint
}

export type InputUTXO = UTXOSpendable & {
  sighashType?: btc.SigHash
}

export function createTransaction(
  inputUTXOs: Array<InputUTXO>,
  recipients: Array<Recipient>,
  opReturnScripts: Uint8Array[],
  options?: {
    enableRBF?: boolean
  },
): btc.Transaction {
  const tx = new btc.Transaction({
    allowUnknownOutputs: true,
    allowLegacyWitnessUtxo: true,
  })

  inputUTXOs.forEach(utxo => {
    tx.addInput({
      txid: utxo.txId,
      index: utxo.index,
      witnessUtxo:
        utxo.scriptPubKey == null
          ? undefined
          : {
              script: utxo.scriptPubKey,
              amount: utxo.amount,
            },
      tapInternalKey:
        "tapInternalKey" in utxo ? utxo.tapInternalKey : undefined,
      redeemScript: "redeemScript" in utxo ? utxo.redeemScript : undefined,
      sighashType: "sighashType" in utxo ? utxo.sighashType : undefined,
      // Enable RBF
      sequence: options?.enableRBF ? btc.DEFAULT_SEQUENCE - 2 : undefined,
    })
  })

  recipients.forEach(recipient => {
    tx.addOutput({
      script: recipient.addressScriptPubKey,
      amount: recipient.satsAmount,
    })
  })

  if (hasAny(opReturnScripts)) {
    opReturnScripts.forEach(script => {
      tx.addOutput({ script, amount: 0n })
    })
  }

  return tx
}
