import { describe, expect, it } from "vitest"
import { BigNumber } from "../utils/BigNumber"
import type { TransferProphet } from "../utils/types/TransferProphet"
import {
  adjustTransferProphetForBitcoinDust,
  calcDustThreshold,
} from "./dustHelpers"

const token = "token:a" as any
const transferProphet = (
  partial: Partial<TransferProphet> = {},
): TransferProphet => ({
  isPaused: false,
  bridgeToken: token,
  minBridgeAmount: null,
  maxBridgeAmount: null,
  fees: [],
  ...partial,
})

describe("calcDustThreshold", () => {
  it("converts the fallback dust threshold from sats to BTC units", () => {
    expect(BigNumber.isEq(calcDustThreshold(), BigNumber.from("0.00000546"))).toBe(
      true,
    )
  })
})

describe("adjustTransferProphetForBitcoinDust", () => {
  it("raises minBridgeAmount in BTC units", () => {
    const adjusted = adjustTransferProphetForBitcoinDust(transferProphet())

    expect(adjusted.minBridgeAmount).toBeDefined()
    expect(
      BigNumber.isEq(adjusted.minBridgeAmount!, BigNumber.from("0.00000546")),
    ).toBe(true)
  })

  it("pauses the route when dust minimum exceeds maxBridgeAmount", () => {
    const adjusted = adjustTransferProphetForBitcoinDust(
      transferProphet({ maxBridgeAmount: BigNumber.from("0.000001") }),
    )

    expect(adjusted.isPaused).toBe(true)
    expect(
      BigNumber.isGt(adjusted.minBridgeAmount!, adjusted.maxBridgeAmount!),
    ).toBe(true)
  })
})
