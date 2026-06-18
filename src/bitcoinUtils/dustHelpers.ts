import { getOutputDustThreshold } from "@c4/btc-utils"
import { BigNumber } from "../utils/BigNumber"
import { minInputForTargetOutput } from "../utils/feeRateHelpers"
import type { TransferProphet } from "../utils/types/TransferProphet"
import { satoshiToBitcoinBigNumber } from "./bitcoinHelpers"
import { BITCOIN_OUTPUT_MINIMUM_AMOUNT } from "./constants"

export function calcScriptPubKeyDustThreshold(
  scriptPubKey: Uint8Array,
): BigNumber {
  return satoshiToBitcoinBigNumber(
    Math.ceil(getOutputDustThreshold({ scriptPubKey })),
  )
}

/**
 * Calculate the Bitcoin dust threshold for a given output script. Falls back to
 * the conservative P2PKH value (546 sat) when no script is provided.
 */
export function calcDustThreshold(scriptPubKey?: Uint8Array): BigNumber {
  if (scriptPubKey == null) {
    return satoshiToBitcoinBigNumber(BITCOIN_OUTPUT_MINIMUM_AMOUNT)
  }

  return calcScriptPubKeyDustThreshold(scriptPubKey)
}

/**
 * Return a copy of the given TransferProphet with `minBridgeAmount` raised
 * to guarantee the output exceeds the Bitcoin dust threshold.
 *
 * For multi-step routes, apply this to the **last** step (the one landing on
 * Bitcoin) — `composeTransferProphet2` will propagate the constraint back to
 * the first step's denomination automatically.
 */
export function adjustTransferProphetForBitcoinDust(
  transferProphet: TransferProphet,
  toAddressScriptPubKey?: Uint8Array,
): TransferProphet {
  const dustThreshold = calcDustThreshold(toAddressScriptPubKey)
  const minInput = minInputForTargetOutput(dustThreshold, transferProphet)
  if (minInput == null) {
    return {
      ...transferProphet,
      isPaused: true,
    }
  }

  const currentMinBridgeAmount =
    transferProphet.minBridgeAmount ?? BigNumber.ZERO
  const minBridgeAmount = BigNumber.max([currentMinBridgeAmount, minInput])
  const isPaused =
    transferProphet.isPaused ||
    (transferProphet.maxBridgeAmount != null &&
      BigNumber.isGt(minBridgeAmount, transferProphet.maxBridgeAmount))

  // If dust did not raise the minimum and did not change the pause state,
  // keep the original object so callers/caches don't see a new equivalent copy.
  if (
    BigNumber.isEq(minBridgeAmount, currentMinBridgeAmount) &&
    isPaused === transferProphet.isPaused
  ) {
    return transferProphet
  }

  return {
    ...transferProphet,
    isPaused,
    minBridgeAmount,
  }
}
