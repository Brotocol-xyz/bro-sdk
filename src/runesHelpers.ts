import { RuneIdCombined, toSDKNumberOrUndefined } from "./sdkUtils/types"
import {
  GetAvailableRuneUTXOFn as _GetAvailableRuneUTXOFn,
  RuneInfo,
  selectRuneUTXOs as _selectRuneUTXOs,
} from "./bitcoinUtils/selectRuneUTXOs"
import { SDKNumber } from "./sdkUtils/types"
import { UTXOSpendable } from "./bitcoinHelpers"
import { BigNumber } from "./utils/BigNumber"
import { RuneId } from "./utils/RunesProtocol/RunesProtocol.types"

export const parseRuneId = (runeId: RuneIdCombined): RuneId => {
  const [_blockHeight, _txIndex] = runeId.split(":")
  const blockHeight = BigInt(_blockHeight)
  const txIndex = BigInt(_txIndex)
  return {
    blockHeight,
    txIndex,
  }
}

export type SpendableRuneUTXO = UTXOSpendable & {
  runes: Record<
    RuneIdCombined,
    {
      runeInfo: RuneInfo
      runeAmount: SDKNumber
    }
  >
}

export interface RuneOutput {
  runeId: RuneIdCombined
  amount: SDKNumber
}

export type GetAvailableRuneUTXOFn = (
  runeId: RuneIdCombined,
  usedUTXOs: SpendableRuneUTXO[],
) => Promise<null | SpendableRuneUTXO>

export const selectRuneUTXOs = async (
  runeOutputs: RuneOutput[],
  getAvailableRuneUTXO: GetAvailableRuneUTXOFn,
): Promise<{
  inputRuneUTXOs: SpendableRuneUTXO[]
  changeAmounts: { info: RuneInfo; amount: SDKNumber }[]
}> => {
  const _runeOutputs = runeOutputs.map(output => ({
    ...output,
    amount: BigNumber.from(output.amount),
  }))

  const _getAvailableRuneUTXO: _GetAvailableRuneUTXOFn = async (
    runeId,
    usedUTXOs,
  ) => {
    const res = await getAvailableRuneUTXO(
      runeId,
      usedUTXOs.map(utxo => ({
        ...utxo,
        runes: Object.fromEntries(
          Object.entries(utxo.runes).map(([runeId, rune]) => [
            runeId,
            { ...rune, runeAmount: toSDKNumberOrUndefined(rune.runeAmount) },
          ]),
        ),
      })),
    )
    if (res == null) return null
    return {
      ...res,
      runes: Object.fromEntries(
        Object.entries(res.runes).map(([runeId, rune]) => [
          runeId,
          { ...rune, runeAmount: BigNumber.from(rune.runeAmount) },
        ]),
      ),
    }
  }

  const res = await _selectRuneUTXOs(_runeOutputs, _getAvailableRuneUTXO)

  return {
    inputRuneUTXOs: res.inputRuneUTXOs.map(utxo => ({
      ...utxo,
      runes: Object.fromEntries(
        Object.entries(utxo.runes).map(([runeId, rune]) => [
          runeId,
          { ...rune, runeAmount: toSDKNumberOrUndefined(rune.runeAmount) },
        ]),
      ),
    })),
    changeAmounts: res.changeAmounts.map(change => ({
      ...change,
      amount: toSDKNumberOrUndefined(change.amount),
    })),
  }
}
