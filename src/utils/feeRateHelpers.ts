import { SDK_NAME } from "../bitcoinUtils/constants"
import { BigNumber } from "./BigNumber"
import { concat, hasAny, last, reduce } from "./arrayHelpers"
import { checkNever, OneOrMore } from "./typeHelpers"
import {
  TransferProphet,
  TransferProphet_Fee_Fixed,
  TransferProphet_Fee_Rate,
  TransferProphetAggregated,
} from "./types/TransferProphet"

export interface TransferProphetAppliedResult {
  fees: (
    | (TransferProphet_Fee_Rate & { amount: BigNumber })
    | TransferProphet_Fee_Fixed
  )[]
  netAmount: BigNumber
}

const isBridgeTokenFee = (
  transferProphet: TransferProphet,
  fee: TransferProphet["fees"][number],
): boolean => fee.token === transferProphet.bridgeToken

const assertBridgeTokenRateFee = (
  transferProphet: TransferProphet,
  fee: TransferProphet_Fee_Rate,
): void => {
  if (isBridgeTokenFee(transferProphet, fee)) return

  throw new Error(
    `[${SDK_NAME}#applyTransferProphet] transferProphet.bridgeToken (${transferProphet.bridgeToken}) does not match rateFee.token (${fee.token}), which is not expected`,
  )
}

const calcRateFeeAmount = (
  fee: TransferProphet_Fee_Rate,
  amount: BigNumber,
): BigNumber => {
  return BigNumber.max([fee.minimumAmount, BigNumber.mul(fee.rate, amount)])
}

const getBridgeTokenRateFees = (
  transferProphet: TransferProphet,
): TransferProphet_Fee_Rate[] => {
  return transferProphet.fees.flatMap(fee =>
    fee.type === "rate" && isBridgeTokenFee(transferProphet, fee) ? [fee] : [],
  )
}

export const applyTransferProphets = (
  transferProphets: OneOrMore<TransferProphet>,
  amount: BigNumber,
  options: {
    exchangeRates?: readonly BigNumber[]
  } = {},
): OneOrMore<
  TransferProphetAppliedResult & {
    fromAmount: BigNumber
    transferProphetIndex: number
  }
> => {
  const { exchangeRates } = options

  if (
    exchangeRates != null &&
    exchangeRates.length < transferProphets.length - 1
  ) {
    throw new Error(
      `[${SDK_NAME}#applyTransferProphets] exchangeRate count not match with transferProphet count, which is not expected`,
    )
  }

  return reduce(
    (acc, transferProphet, idx) => {
      const fromAmount = BigNumber.mul(
        last(acc).netAmount,
        exchangeRates?.[idx] ?? BigNumber.ONE,
      )
      return concat(acc, [
        {
          ...applyTransferProphet(transferProphet, fromAmount),
          fromAmount,
          transferProphetIndex: idx + 1,
        },
      ])
    },
    [
      {
        ...applyTransferProphet(transferProphets[0], amount),
        fromAmount: amount,
        transferProphetIndex: 0,
      },
    ],
    transferProphets.slice(1),
  )
}

export const applyTransferProphet = (
  transferProphet: TransferProphet,
  amount: BigNumber,
): TransferProphetAppliedResult => {
  const fees: TransferProphetAppliedResult["fees"] = []

  let totalFeeAmount = BigNumber.ZERO
  for (const f of transferProphet.fees) {
    let feeAmount = BigNumber.ZERO

    if (f.type === "rate") {
      assertBridgeTokenRateFee(transferProphet, f)
      feeAmount = calcRateFeeAmount(f, amount)
      fees.push({ ...f, amount: feeAmount })
    } else if (f.type === "fixed") {
      if (isBridgeTokenFee(transferProphet, f)) {
        feeAmount = f.amount
      }
      fees.push(f)
    } else {
      checkNever(f)
    }

    totalFeeAmount = BigNumber.add(totalFeeAmount, feeAmount)
  }

  const netAmount = BigNumber.max([
    BigNumber.ZERO,
    BigNumber.minus(amount, totalFeeAmount),
  ])

  return { fees, netAmount }
}

/**
 * @example
 * composeTransferProphets(
 *   [
 *     // tokenA : chain1 -> chain2
 *     transferProphetOf(tokenAChain1, tokenAChain2),
 *     // tokenB : chain2 -> chain3
 *     transferProphetOf(tokenBChain2, tokenBChain3),
 *     // tokenC : chain3 -> chain4
 *     transferProphetOf(tokenCChain3, tokenCChain4),
 *   ],
 *   [
 *     // tokenA -> tokenB : chain2
 *     exchangeRateOf(tokenAChain2, tokenBChain2),
 *     // tokenB -> tokenC : chain3
 *     exchangeRateOf(tokenBChain3, tokenCChain3),
 *   ],
 * )
 */
export const composeTransferProphets = (
  transferProphets: readonly TransferProphet[],
  exchangeRates: readonly BigNumber[],
): TransferProphetAggregated<TransferProphet[]> => {
  if (
    exchangeRates != null &&
    exchangeRates.length < transferProphets.length - 1
  ) {
    throw new Error(
      `[${SDK_NAME}#composeTransferProphets] exchangeRate count not match with transferProphet count, which is not expected`,
    )
  }

  const cumulativeExchangeRates = calcCumulativeExchangeRates(exchangeRates)

  return reduce(
    (res, transferProphet, idx) => ({
      ...composeTransferProphet2(
        res,
        transferProphet,
        cumulativeExchangeRates[idx + 1],
      ),
      transferProphets: [...res.transferProphets, transferProphet],
    }),
    composeTransferProphet2(
      transferProphets[0],
      transferProphets[1],
      cumulativeExchangeRates[0],
    ) as TransferProphetAggregated<TransferProphet[]>,
    transferProphets.slice(2),
  )
}
/**
 * @example
 * calcCumulativeExchangeRates([
 *   exchangeRateOf(A, B),
 *   exchangeRateOf(B, C),
 *   exchangeRateOf(C, D),
 *   // ...
 * ])
 *
 * // =>
 *
 * [
 *   exchangeRateOf(A, B),
 *   exchangeRateOf(A, C),
 *   exchangeRateOf(A, D),
 *   // ...
 * ]
 */
const calcCumulativeExchangeRates = (
  exchangeRates: readonly BigNumber[],
): readonly BigNumber[] => {
  return BigNumber.cumulativeMul(BigNumber.ONE, exchangeRates).slice(1)
}

export const composeTransferProphet2 = (
  transferProphet1: TransferProphet,
  transferProphet2: TransferProphet,
  exchangeRate: BigNumber,
): TransferProphetAggregated<[TransferProphet, TransferProphet]> => {
  /**
   * flatFeeRate = 1 - (amount1 * (1-feeRate1) * (1-feeRate2) * (1-feeRateN...) / amount1)
   * flatFeeRate = 1 - (1-feeRate1) * (1-feeRate2) * (1-feeRateN...)
   */
  const step1FlatFeeRate = BigNumber.minus(
    BigNumber.ONE,
    last(
      BigNumber.cumulativeMul(
        BigNumber.ONE,
        getBridgeTokenRateFees(transferProphet1).map(f =>
          BigNumber.minus(1, f.rate),
        ),
      ),
    ),
  )

  /**
   * step2Amount = step1Amount * (1-feeRate1) * (1-feeRate2) * (1-feeRateN)... * exchangeRate
   * step2Amount = step1Amount * (1-flatFeeRate1) * exchangeRate
   * step2Amount = step1Amount * step1ToStep2Rate
   * step1ToStep2Rate = (1-flatFeeRate1) * exchangeRate
   */
  const step1ToStep2Rate = BigNumber.mul(
    BigNumber.minus(1, step1FlatFeeRate),
    exchangeRate,
  )

  const step1MinAmount = maxOrNull([
    ...getBridgeTokenRateFees(transferProphet1).map(f => f.minimumAmount),
    transferProphet1.minBridgeAmount,
  ])
  const step2MinAmount = maxOrNull([
    ...getBridgeTokenRateFees(transferProphet2).map(f => f.minimumAmount),
    transferProphet2.minBridgeAmount,
  ])

  const minBridgeAmountCandidates = [step1MinAmount]
  let minBridgeAmountImpossible = false
  // `null` means step2 has no minimum constraint to propagate. It is not an
  // impossible state; the composed minimum can then come from step1 alone.
  if (step2MinAmount != null) {
    // Step2's minimum is denominated in step2's token. Convert it back to the
    // required step1 output, then invert step1's fees to find the step1 input
    // needed to produce that output. `null` means step1 can never produce it.
    const propagatedMinBridgeAmount = minInputForTargetOutput(
      BigNumber.div(step2MinAmount, exchangeRate),
      transferProphet1,
    )
    if (propagatedMinBridgeAmount == null) {
      minBridgeAmountImpossible = true
    } else {
      minBridgeAmountCandidates.push(propagatedMinBridgeAmount)
    }
  }

  const minBridgeAmount = minBridgeAmountImpossible
    ? null
    : maxOrNull(minBridgeAmountCandidates)

  let maxBridgeAmount: BigNumber | null = null
  if (
    transferProphet1.maxBridgeAmount == null &&
    transferProphet2.maxBridgeAmount == null
  ) {
    maxBridgeAmount = null
  } else if (
    transferProphet1.maxBridgeAmount != null &&
    transferProphet2.maxBridgeAmount != null
  ) {
    maxBridgeAmount = BigNumber.min([
      transferProphet1.maxBridgeAmount,
      BigNumber.div(transferProphet2.maxBridgeAmount, step1ToStep2Rate),
    ])
  } else {
    maxBridgeAmount =
      transferProphet1.maxBridgeAmount ?? transferProphet2.maxBridgeAmount
  }

  const isPaused =
    transferProphet1.isPaused ||
    transferProphet2.isPaused ||
    minBridgeAmountImpossible ||
    (minBridgeAmount != null &&
      maxBridgeAmount != null &&
      BigNumber.isGt(minBridgeAmount, maxBridgeAmount))

  return {
    isPaused,
    bridgeToken: transferProphet1.bridgeToken,
    minBridgeAmount,
    maxBridgeAmount,
    fees: [
      ...transferProphet1.fees,
      ...transferProphet2.fees.map(fee => {
        if (fee.type === "fixed") {
          if (fee.token !== transferProphet2.bridgeToken) return fee
          return {
            type: "fixed",
            token: transferProphet1.bridgeToken,
            amount: BigNumber.div(fee.amount, step1ToStep2Rate),
          } satisfies TransferProphet_Fee_Fixed
        }

        if (fee.type === "rate") {
          if (fee.token !== transferProphet2.bridgeToken) return fee
          return {
            type: "rate",
            token: transferProphet1.bridgeToken,
            /**
             * feeAmount = step2Amount * fee.rate
             * feeAmount = (step1Amount * (1 - step1FlatFeeRate) * exchangeRate) * fee.rate
             * step1Amount * newFeeRate = (step1Amount * (1 - step1FlatFeeRate) * exchangeRate) * fee.rate
             * newFeeRate = (1 - step1FlatFeeRate) * exchangeRate * fee.rate
             * newFeeRate = step1ToStep2Rate * fee.rate
             */
            rate: BigNumber.mul(step1ToStep2Rate, fee.rate),
            minimumAmount: BigNumber.div(fee.minimumAmount, step1ToStep2Rate),
          } satisfies TransferProphet_Fee_Rate
        }

        checkNever(fee)
        return fee
      }),
    ],
    transferProphets: [transferProphet1, transferProphet2],
  }
}

function maxOrNull(amounts: (null | BigNumber)[]): null | BigNumber {
  const nonZero = amounts.filter(
    (a): a is BigNumber => a != null && !BigNumber.isZero(a),
  )
  return hasAny(nonZero) ? BigNumber.max(nonZero) : null
}

/**
 * Calculate the minimum input amount needed to produce at least `targetOutput`
 * after applying the given fees.
 *
 * This is the inverse of `applyTransferProphet`: given the desired output,
 * work backwards through the fee structure to find the smallest input that
 * yields `netAmount >= targetOutput`. Returns `undefined` when no input can
 * satisfy the target.
 *
 * For example:
 *
 *     targetOutput = 546
 *     transferProphet fee rate = 100%
 *
 * In this case:
 *
 *     minInputForTargetOutput(546, transferProphet)
 *
 * returns `undefined`, because after the first step deducts its fees, it can
 * never leave 546 for the second step.
 */
export const minInputForTargetOutput = (
  targetOutput: BigNumber,
  transferProphet: TransferProphet,
): undefined | BigNumber => {
  if (BigNumber.isLte(targetOutput, BigNumber.ZERO)) {
    return BigNumber.ZERO
  }

  let fixedFeeAmount = BigNumber.ZERO

  for (const fee of transferProphet.fees) {
    if (fee.type === "fixed") {
      if (isBridgeTokenFee(transferProphet, fee)) {
        fixedFeeAmount = BigNumber.add(fixedFeeAmount, fee.amount)
      }
      continue
    }

    if (fee.type === "rate") {
      assertBridgeTokenRateFee(transferProphet, fee)
      continue
    }

    checkNever(fee)
  }

  // Each rate fee has two possible modes:
  //
  //   fee = minimumAmount  // when the input is still small
  //   fee = input * rate   // when the input is large enough
  //
  // Example: minimumAmount = 100, rate = 10%.
  //
  //   input = 500  -> max(100, 500 * 10%)  = 100  (minimum mode)
  //   input = 1000 -> max(100, 1000 * 10%) = 100  (switch point)
  //   input = 2000 -> max(100, 2000 * 10%) = 200  (rate mode)
  //
  // The switch point is minimumAmount / rate. We call it a breakpoint.
  const rateFeeBreakpoints = getBridgeTokenRateFees(transferProphet).map(
    fee => ({
      fee,
      breakpoint: BigNumber.isZero(fee.rate)
        ? undefined
        : BigNumber.div(fee.minimumAmount, fee.rate),
    }),
  )

  // All breakpoints split the whole input range into segments.
  //
  // For example, if fee A switches at 1000 and fee B switches at 5000, the
  // segments are:
  //
  //   [0, 1000)       -> both fees are in minimum mode
  //   [1000, 5000)    -> fee A is in rate mode, fee B is still in minimum mode
  //   [5000, infinity)-> both fees are in rate mode
  //
  // Inside one segment, every fee's mode is fixed. That means net output is a
  // straight line in that segment, so we can solve it with one formula.
  const breakpoints = uniqueBigNumbers(
    BigNumber.sort(
      BigNumber.ascend,
      [
        BigNumber.ZERO,
        ...rateFeeBreakpoints.flatMap(({ breakpoint }) =>
          breakpoint == null ? [] : [breakpoint],
        ),
      ],
    ),
  )

  for (let idx = 0; idx < breakpoints.length; idx++) {
    const lowerBound = breakpoints[idx]
    const upperBound = breakpoints[idx + 1]

    // Decide which mode each fee uses in this segment.
    //
    // If the segment starts at or after a fee's breakpoint, that fee has already
    // switched to rate mode for the entire segment. Otherwise it is still in
    // minimum mode for this segment.
    let activeRate = BigNumber.ZERO
    let inactiveMinimumFeeAmount = BigNumber.ZERO
    for (const { fee, breakpoint } of rateFeeBreakpoints) {
      if (breakpoint != null && BigNumber.isGte(lowerBound, breakpoint)) {
        activeRate = BigNumber.add(activeRate, fee.rate)
      } else {
        inactiveMinimumFeeAmount = BigNumber.add(
          inactiveMinimumFeeAmount,
          fee.minimumAmount,
        )
      }
    }

    // First check the segment start.
    //
    // If lowerBound already produces enough output, it must be the smallest
    // valid input in this segment because every other point in the segment is
    // larger than lowerBound.
    const lowerBoundNetAmount = BigNumber.max([
      BigNumber.ZERO,
      BigNumber.minus(
        lowerBound,
        BigNumber.sum([
          fixedFeeAmount,
          inactiveMinimumFeeAmount,
          BigNumber.mul(lowerBound, activeRate),
        ]),
      ),
    ])
    if (BigNumber.isGte(lowerBoundNetAmount, targetOutput)) {
      return lowerBound
    }

    const retainedRate = BigNumber.minus(BigNumber.ONE, activeRate)
    if (BigNumber.isLte(retainedRate, BigNumber.ZERO)) {
      return undefined
    }

    // lowerBound was not enough, so solve for the first point inside this
    // segment that can reach targetOutput.
    //
    // In this segment, rate-mode fees take a percentage of input, and
    // minimum-mode fees are just constants:
    //
    //   net = input - fixedFeeAmount - inactiveMinimumFeeAmount - input * activeRate
    //
    // Rewrite it as:
    //
    //   net = input * (1 - activeRate) - fixedFeeAmount - inactiveMinimumFeeAmount
    //
    // So the input that makes net == targetOutput is:
    //
    //   input = (targetOutput + fixedFeeAmount + inactiveMinimumFeeAmount)
    //           / (1 - activeRate)
    const requiredInput = BigNumber.div(
      BigNumber.sum([targetOutput, fixedFeeAmount, inactiveMinimumFeeAmount]),
      retainedRate,
    )

    // The formula above is only valid for this segment. If the answer falls
    // outside [lowerBound, upperBound], then it belongs to another segment where
    // a different set of fees is in rate mode.
    if (
      BigNumber.isLt(requiredInput, lowerBound) ||
      (upperBound != null && BigNumber.isGt(requiredInput, upperBound))
    ) {
      continue
    }

    if (
      BigNumber.isGte(
        applyTransferProphet(transferProphet, requiredInput).netAmount,
        targetOutput,
      )
    ) {
      return requiredInput
    }
  }

  return undefined
}

function uniqueBigNumbers(numbers: BigNumber[]): BigNumber[] {
  const result: BigNumber[] = []
  for (const n of numbers) {
    if (!result.some(existing => BigNumber.isEq(existing, n))) {
      result.push(n)
    }
  }
  return result
}

export const composeRates2 = (
  rate1: BigNumber,
  rate2: BigNumber,
): BigNumber => {
  /**
   * n = bridge amount
   * rate = ((n * r1) +
   *         (n * (1 - r1)) * r2)
   *        / n
   *      |
   *      V
   *      = (n * r1 / n) +
   *        (n * (1 - r1) * r2 / n)
   *      |
   *      V
   *      = r1 + (1 - r1) * r2
   */
  // prettier-ignore
  return BigNumber.sum([
    rate1,
    BigNumber.mul(
      BigNumber.minus(1, rate1),
      rate2,
    ),
  ])
}
