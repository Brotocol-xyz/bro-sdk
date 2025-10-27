import { Transaction } from "@scure/btc-signer"
import { UTXOBasic } from "../../bitcoinUtils/bitcoinHelpers"
import { BitcoinAddress } from "../../bitcoinUtils/btcAddresses"
import { RuneIdCombined } from "../../sdkUtils/types"
import { fromBitcoinTransaction } from "../../utils/RunesProtocol/RunesBitcoinScript"
import { range, uniq, uniqBy } from "../../utils/arrayHelpers"
import { encodeHex } from "../../utils/hexHelpers"
import { entries, keys } from "../../utils/objectHelper"

export function analyzeTransactionRunesAmountChanges(
  tx: Transaction,
  addresses: BitcoinAddress[],
  inputTokens: (UTXOBasic & {
    runes: { runeId: RuneIdCombined; amount: bigint }[]
  })[],
):
  | undefined
  | {
      address: BitcoinAddress
      runeId: RuneIdCombined
      amount: bigint
    }[] {
  const runestone = fromBitcoinTransaction(tx)
  if (runestone == null) return undefined
  if (runestone.type !== "ok") return undefined

  const txInputs = range(0, tx.inputsLength).map(i => tx.getInput(i)!)

  const runesInInTotal: Record<RuneIdCombined, bigint> = {}
  const runesIn: Record<string, Record<RuneIdCombined, bigint>> = {}
  const runesOutInTotal: Record<RuneIdCombined, bigint> = {}
  const runesOut: Record<string, Record<RuneIdCombined, bigint>> = {}

  // count input runes
  inputTokens.forEach(i => {
    const input = txInputs.find(input =>
      input.txid == null
        ? false
        : encodeHex(input.txid) === i.txId && input.index === i.index,
    )
    if (input == null) return

    const inputAddrHex = encodeHex(
      input.witnessUtxo?.script ?? new Uint8Array(),
    )

    runesIn[inputAddrHex] ??= {}
    i.runes.forEach(rune => {
      runesInInTotal[rune.runeId] =
        (runesInInTotal[rune.runeId] ?? 0n) + rune.amount

      runesIn[inputAddrHex][rune.runeId] ??= 0n
      runesIn[inputAddrHex][rune.runeId] += rune.amount
    })
  })

  // count output runes (excluding pointer output)
  runestone.payload.edicts.forEach(edict => {
    const output = tx.getOutput(Number(edict.output))
    if (output == null) return

    const outputAddrHex = encodeHex(output.script ?? new Uint8Array())
    const runeId: RuneIdCombined = `${Number(edict.id.blockHeight)}:${Number(edict.id.txIndex)}`

    runesOutInTotal[runeId] = (runesOutInTotal[runeId] ?? 0n) + edict.amount

    runesOut[outputAddrHex] ??= {}
    runesOut[outputAddrHex][runeId] ??= 0n
    runesOut[outputAddrHex][runeId] += edict.amount
  })

  // count pointer output runes
  const pointer = Number(runestone.payload.pointer ?? 0n)
  const pointerOutput = tx.getOutput(pointer)
  if (pointerOutput != null) {
    const outputAddrHex = encodeHex(pointerOutput.script ?? new Uint8Array())

    entries(runesInInTotal).forEach(([runeId, amount]) => {
      const restAmount = amount - (runesOutInTotal[runeId] ?? 0n)
      if (restAmount <= 0n) return

      runesOut[outputAddrHex] ??= {}
      runesOut[outputAddrHex][runeId] ??= 0n
      runesOut[outputAddrHex][runeId] += restAmount
    })
  }

  return uniqBy(a => a.address, addresses).flatMap(address => {
    const addressScriptHex = encodeHex(address.scriptPubKey)
    const outAmounts = runesOut[addressScriptHex] ?? {}
    const inAmounts = runesIn[addressScriptHex] ?? {}
    const runeIds = uniq([...keys(outAmounts), ...keys(inAmounts)])

    return runeIds.flatMap(runeId => {
      const inAmount = inAmounts?.[runeId] ?? 0n
      const outAmount = outAmounts?.[runeId] ?? 0n

      if (inAmount === 0n && outAmount === 0n) return []

      return [
        {
          address,
          runeId,
          amount: outAmount - inAmount,
        },
      ]
    })
  })
}
