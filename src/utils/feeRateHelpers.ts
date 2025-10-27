import { SDK_NAME } from "../constants"
import { BigNumber } from "./BigNumber"
import { concat, last, reduce } from "./arrayHelpers"
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
      if (f.token !== transferProphet.bridgeToken) {
        throw new Error(
          `[${SDK_NAME}#applyTransferProphet] transferProphet.bridgeToken (${transferProphet.bridgeToken}) does not match rateFee.token (${f.token}), which is not expected`,
        )
      }
      feeAmount = BigNumber.max([
        f.minimumAmount,
        BigNumber.mul(f.rate, amount),
      ])
      fees.push({ ...f, amount: feeAmount })
    } else if (f.type === "fixed") {
      if (f.token === transferProphet.bridgeToken) {
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
        transferProphet1.fees.flatMap(f =>
          f.type === "rate" && f.token === transferProphet1.bridgeToken
            ? [BigNumber.minus(1, f.rate)]
            : [],
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

  const bridgeTokenMinFeeAmount = BigNumber.sum([
    ...transferProphet1.fees.flatMap(f =>
      f.type === "rate" && f.token === transferProphet1.bridgeToken
        ? [f.minimumAmount]
        : [],
    ),
    ...transferProphet2.fees.flatMap(f =>
      f.type === "rate" && f.token === transferProphet2.bridgeToken
        ? [
            /**
             * convert to the denomination of the first step token
             */
            BigNumber.div(f.minimumAmount, step1ToStep2Rate),
          ]
        : [],
    ),
  ])

  let minBridgeAmount: BigNumber | null = null
  if (
    BigNumber.isZero(bridgeTokenMinFeeAmount) /* min fee amount not set */ &&
    transferProphet1.minBridgeAmount == null &&
    transferProphet2.minBridgeAmount == null
  ) {
    minBridgeAmount = null
  } else {
    minBridgeAmount = BigNumber.max([
      bridgeTokenMinFeeAmount,
      transferProphet1.minBridgeAmount ?? 0,
      transferProphet2.minBridgeAmount == null
        ? 0
        : BigNumber.div(transferProphet2.minBridgeAmount, step1ToStep2Rate),
    ])
  }

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

  return {
    isPaused: transferProphet1.isPaused || transferProphet2.isPaused,
    bridgeToken: transferProphet1.bridgeToken,
    /**
     * Users only need to consider the final step reserve amount, the insufficient
     * reserve of intermediate steps will be handled automatically by the bridge
     */
    reserveAmount: transferProphet2.reserveAmount,
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
