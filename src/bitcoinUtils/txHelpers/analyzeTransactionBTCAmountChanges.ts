import { Transaction } from "@scure/btc-signer"
import { range, uniqBy } from "../../utils/arrayHelpers"
import { encodeHex } from "../../utils/hexHelpers"
import { BitcoinAddress } from "../btcAddresses"

export function analyzeTransactionBTCAmountChanges(
  addresses: BitcoinAddress[],
  tx: Transaction,
): {
  address: BitcoinAddress
  satsAmount: bigint
}[] {
  const inputs: Record<string, bigint> = {}
  const outputs: Record<string, bigint> = {}

  range(0, tx.inputsLength).forEach(i => {
    const input = tx.getInput(i)!
    const inputAddrHex = encodeHex(
      input.witnessUtxo?.script ?? new Uint8Array(),
    )
    inputs[inputAddrHex] =
      (inputs[inputAddrHex] ?? 0n) + (input.witnessUtxo?.amount ?? 0n)
  })

  range(0, tx.outputsLength).forEach(i => {
    const output = tx.getOutput(i)!
    const outputAddrHex = encodeHex(output.script ?? new Uint8Array())
    outputs[outputAddrHex] =
      (outputs[outputAddrHex] ?? 0n) + (output.amount ?? 0n)
  })

  return uniqBy(a => a.address, addresses).flatMap(address => {
    const addressHex = encodeHex(address.scriptPubKey)

    const inputAmount = inputs[addressHex] ?? 0n
    const outputAmount = outputs[addressHex] ?? 0n
    const amountChange = outputAmount - inputAmount

    if (amountChange === 0n) return []

    return [{ address, satsAmount: amountChange }]
  })
}
