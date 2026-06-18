import { describe, it, expect } from "vitest"
import { BigNumber } from "./BigNumber"
import {
  applyTransferProphet,
  applyTransferProphets,
  composeTransferProphet2,
  minInputForTargetOutput,
} from "./feeRateHelpers"
import { TransferProphet } from "./types/TransferProphet"

const token = "token:a" as any
const transferProphet = (fees: TransferProphet["fees"]): TransferProphet => ({
  isPaused: false,
  bridgeToken: token,
  minBridgeAmount: null,
  maxBridgeAmount: null,
  fees,
})

const expectMinInput = (
  target: BigNumber,
  prophet: TransferProphet,
): BigNumber => {
  const minInput = minInputForTargetOutput(target, prophet)
  expect(minInput).toBeDefined()
  return minInput!
}

describe("minInputForTargetOutput", () => {
  it("handles rate fee only (rate dominates)", () => {
    const fees: TransferProphet["fees"] = [
      {
        type: "rate",
        token,
        rate: BigNumber.from(0.5),
        minimumAmount: BigNumber.from(10),
      },
    ]
    const target = BigNumber.from(546)
    const minInput = expectMinInput(target, transferProphet(fees))

    // rate dominates: 546 / (1 - 0.5) = 1092
    expect(BigNumber.isEq(minInput, BigNumber.from(1092))).toBe(true)

    // Verify the output is at least target
    const result = applyTransferProphet(transferProphet(fees), minInput)
    expect(BigNumber.isGte(result.netAmount, target)).toBe(true)
  })

  it("handles rate fee only (min fee dominates)", () => {
    const fees: TransferProphet["fees"] = [
      {
        type: "rate",
        token,
        rate: BigNumber.from(0.1),
        minimumAmount: BigNumber.from(100),
      },
    ]
    const target = BigNumber.from(546)
    const minInput = expectMinInput(target, transferProphet(fees))

    // min fee dominates: 546 + 100 = 646
    expect(BigNumber.isEq(minInput, BigNumber.from(646))).toBe(true)

    const result = applyTransferProphet(transferProphet(fees), minInput)
    expect(BigNumber.isGte(result.netAmount, target)).toBe(true)
  })

  it("handles fixed fee in bridge token", () => {
    const fees: TransferProphet["fees"] = [
      {
        type: "fixed",
        token,
        amount: BigNumber.from(200),
      },
    ]
    const target = BigNumber.from(546)
    const minInput = expectMinInput(target, transferProphet(fees))

    // 546 + 200 = 746
    expect(BigNumber.isEq(minInput, BigNumber.from(746))).toBe(true)

    const result = applyTransferProphet(transferProphet(fees), minInput)
    expect(BigNumber.isGte(result.netAmount, target)).toBe(true)
  })

  it("handles rate fee + fixed fee combined", () => {
    const fees: TransferProphet["fees"] = [
      {
        type: "rate",
        token,
        rate: BigNumber.from(0.1),
        minimumAmount: BigNumber.from(50),
      },
      {
        type: "fixed",
        token,
        amount: BigNumber.from(100),
      },
    ]
    const target = BigNumber.from(546)
    const minInput = expectMinInput(target, transferProphet(fees))

    const result = applyTransferProphet(transferProphet(fees), minInput)
    expect(BigNumber.isGte(result.netAmount, target)).toBe(true)
  })

  it("handles multiple rate fees with mixed minimum/rate dominance", () => {
    const fees: TransferProphet["fees"] = [
      {
        type: "rate",
        token,
        rate: BigNumber.from(0.1),
        minimumAmount: BigNumber.from(100),
      },
      {
        type: "rate",
        token,
        rate: BigNumber.from(0.1),
        minimumAmount: BigNumber.ZERO,
      },
    ]
    const target = BigNumber.from(546)
    const minInput = expectMinInput(target, transferProphet(fees))

    // The first fee stays minimum-dominated, while the second is rate-dominated:
    // (546 + 100) / (1 - 0.1) = 717.777...
    expect(
      BigNumber.isEq(
        minInput,
        BigNumber.div(BigNumber.from(646), BigNumber.from(0.9)),
      ),
    ).toBe(true)

    const result = applyTransferProphet(transferProphet(fees), minInput)
    expect(BigNumber.isGte(result.netAmount, target)).toBe(true)
  })

  it("returns undefined when fees make the target impossible", () => {
    const fees: TransferProphet["fees"] = [
      {
        type: "rate",
        token,
        rate: BigNumber.ONE,
        minimumAmount: BigNumber.ZERO,
      },
    ]
    const target = BigNumber.from(546)

    expect(minInputForTargetOutput(target, transferProphet(fees))).toBeUndefined()
  })

  it("ignores fixed fees in different token", () => {
    const otherToken = "token:b" as any
    const fees: TransferProphet["fees"] = [
      {
        type: "rate",
        token,
        rate: BigNumber.from(0.1),
        minimumAmount: BigNumber.ZERO,
      },
      {
        type: "fixed",
        token: otherToken,
        amount: BigNumber.from(9999),
      },
    ]
    const target = BigNumber.from(546)
    const minInput = expectMinInput(target, transferProphet(fees))

    const result = applyTransferProphet(transferProphet(fees), minInput)
    expect(BigNumber.isGte(result.netAmount, target)).toBe(true)
  })

  it("handles zero fees", () => {
    const fees: TransferProphet["fees"] = []
    const target = BigNumber.from(546)
    const minInput = expectMinInput(target, transferProphet(fees))

    expect(BigNumber.isEq(minInput, target)).toBe(true)
  })
})

describe("composeTransferProphet2", () => {
  it("propagates the second step minimum through first step minimum fees", () => {
    const step1 = transferProphet([
      {
        type: "rate",
        token,
        rate: BigNumber.from(0.1),
        minimumAmount: BigNumber.from(100),
      },
    ])
    const step2: TransferProphet = {
      ...transferProphet([]),
      minBridgeAmount: BigNumber.from(546),
    }

    const composed = composeTransferProphet2(step1, step2, BigNumber.ONE)
    expect(composed.minBridgeAmount).toBeDefined()
    expect(BigNumber.isEq(composed.minBridgeAmount!, BigNumber.from(646))).toBe(
      true,
    )

    const results = applyTransferProphets(
      [step1, step2],
      composed.minBridgeAmount!,
    )
    expect(BigNumber.isGte(results[1].netAmount, step2.minBridgeAmount!)).toBe(
      true,
    )
  })
})
