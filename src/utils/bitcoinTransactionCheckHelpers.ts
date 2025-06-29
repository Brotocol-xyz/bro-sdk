import { Transaction } from "@scure/btc-signer"
import { UTXOBasic } from "../bitcoinUtils/bitcoinHelpers"
import { BitcoinAddress } from "../bitcoinUtils/btcAddresses"
import { analyzeTransactionBTCAmountChanges } from "../bitcoinUtils/txHelpers/analyzeTransactionBTCAmountChanges"
import { analyzeTransactionRunesAmountChanges } from "../metaUtils/txHelpers/analyzeTransactionRunesAmountChanges"
import { RuneIdCombined } from "../sdkUtils/types"
import { encodeHex } from "./hexHelpers"
import { Result } from "./Result"
import { isNotNull } from "./typeHelpers"

export function checkPSBTMatches(options: {
  tx: Transaction
  inputTokens: (
    | null
    | (UTXOBasic & {
        runes: { runeId: RuneIdCombined; amount: bigint }[]
      })
  )[]
  expectedInOutFlow: CheckPSBTInOutFlowMatchesOptions_ExpectedInOutFlow[]
}): Result<void, string> {
  const res1 = checkPSBTInputMatches({
    tx: options.tx,
    utxosToChecking: options.inputTokens,
  })
  if (res1.type === "error") {
    return Result.error(
      `PSBT input#${res1.payload.mismatchedInput.index} has been tampered`,
    )
  }

  const res2 = checkPSBTInOutFlowMatches({
    tx: options.tx,
    inputTokens: options.inputTokens.filter(isNotNull),
    expectedInOutFlow: options.expectedInOutFlow,
  })
  if (res2.type === "error") {
    return Result.error(
      `PSBT in-out flow does not match the expected in-out flow, assets: ${res2.payload.tokenId}, expected: ${
        typeof res2.payload.expectedAmount === "bigint"
          ? res2.payload.expectedAmount
          : `${res2.payload.expectedAmount[0]}~${res2.payload.expectedAmount[1]}`
      }, actual: ${res2.payload.actualAmount}`,
    )
  }

  return Result.ok()
}

/**
 * Checks whether the PSBT inputs match the expected UTXOs
 *
 * @param options
 * @param options.tx - The transaction to check
 * @param options.utxosToChecking - The UTXOs to check against the transaction inputs, `null` means skip checking this input
 * @returns
 */
export function checkPSBTInputMatches(options: {
  tx: Transaction
  utxosToChecking: (null | UTXOBasic)[]
}): Result<
  void,
  {
    mismatchedInput: {
      index: number
    }
  }
> {
  const { tx } = options

  for (let idx = 0; idx < options.utxosToChecking.length; idx++) {
    const utxo = options.utxosToChecking[idx]

    if (utxo == null) continue

    const input = tx.getInput(idx)
    if (
      input == null ||
      input.txid == null ||
      !(encodeHex(input.txid) === utxo.txId && input.index === utxo.index)
    ) {
      return Result.error({ mismatchedInput: { index: idx } })
    }
  }

  return Result.ok()
}

export interface CheckPSBTInOutFlowMatchesOptions_ExpectedInOutFlow {
  address: BitcoinAddress
  bitcoin?: { satsAmount: bigint | [min: bigint, max: bigint] }
  runes?: { runeId: RuneIdCombined; amount: bigint }[]
}
export function checkPSBTInOutFlowMatches(options: {
  tx: Transaction
  inputTokens: (UTXOBasic & {
    runes: { runeId: RuneIdCombined; amount: bigint }[]
  })[]
  expectedInOutFlow: CheckPSBTInOutFlowMatchesOptions_ExpectedInOutFlow[]
}): Result<
  void,
  {
    mismatchedInOutFlowType: "bitcoin" | "runes"
    tokenId: string
    expectedAmount: bigint | [min: bigint, max: bigint]
    actualAmount: bigint
  }
> {
  const satsAmountChange = analyzeTransactionBTCAmountChanges(
    options.expectedInOutFlow.map(e => e.address),
    options.tx,
  )

  const runesAmountChange =
    analyzeTransactionRunesAmountChanges(
      options.tx,
      options.expectedInOutFlow.map(e => e.address),
      options.inputTokens,
    ) ?? []

  for (const expected of options.expectedInOutFlow) {
    // check bitcoin
    if (expected.bitcoin != null) {
      const actual = satsAmountChange.find(
        e => e.address.address === expected.address.address,
      )

      if (actual == null) {
        return Result.error({
          mismatchedInOutFlowType: "bitcoin",
          tokenId: "BTC",
          expectedAmount: expected.bitcoin.satsAmount,
          actualAmount: 0n,
        })
      }

      if (typeof expected.bitcoin.satsAmount === "bigint") {
        if (actual.satsAmount !== expected.bitcoin.satsAmount) {
          return Result.error({
            mismatchedInOutFlowType: "bitcoin",
            tokenId: "BTC",
            expectedAmount: expected.bitcoin.satsAmount,
            actualAmount: actual.satsAmount,
          })
        }
      } else {
        const [min, max] = expected.bitcoin.satsAmount
        if (actual.satsAmount < min || actual.satsAmount > max) {
          return Result.error({
            mismatchedInOutFlowType: "bitcoin",
            tokenId: "BTC",
            expectedAmount: expected.bitcoin.satsAmount,
            actualAmount: actual.satsAmount,
          })
        }
      }
    }

    // check runes
    if (expected.runes != null) {
      const walkedActualRunes = new Set<(typeof runesAmountChange)[number]>()

      // check if the expected runes are all matched
      for (const expectedRune of expected.runes) {
        const _actualRune = runesAmountChange.find(
          r => r.runeId === expectedRune.runeId,
        )
        if (_actualRune != null) {
          walkedActualRunes.add(_actualRune)
        }

        const actualRune = _actualRune ?? {
          runeId: expectedRune.runeId,
          amount: 0n,
        }
        if (actualRune.amount !== expectedRune.amount) {
          return Result.error({
            mismatchedInOutFlowType: "runes",
            tokenId: expectedRune.runeId,
            expectedAmount: expectedRune.amount,
            actualAmount: actualRune.amount,
          })
        }
      }

      // check if there are any extra runes amount changed
      for (const actualRune of runesAmountChange) {
        if (!walkedActualRunes.has(actualRune)) {
          // user's other rune balance should not be changed
          if (actualRune.amount < 0n) {
            return Result.error({
              mismatchedInOutFlowType: "runes",
              tokenId: actualRune.runeId,
              expectedAmount: 0n,
              actualAmount: actualRune.amount,
            })
          }
        }
      }
    }
  }

  return Result.ok()
}
