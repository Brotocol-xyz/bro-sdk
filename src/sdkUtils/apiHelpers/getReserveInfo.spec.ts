import { beforeEach, describe, expect, it, vi } from "vitest"
import { requestAPI } from "../../utils/apiHelpers"
import { BigNumber } from "../../utils/BigNumber"
import {
  createBRC20Token,
  createRunesToken,
  KnownChainId,
  KnownTokenId,
} from "../../utils/types/knownIds"
import { SDKGlobalContext } from "../types.internal"
import { getReserveInfo } from "./getReserveInfo"

vi.mock("../../utils/apiHelpers", () => ({
  requestAPI: vi.fn(),
}))

const ctx = (): SDKGlobalContext =>
  ({
    backendAPI: { runtimeEnv: "dev" },
  }) as any

describe("getReserveInfo", () => {
  beforeEach(() => {
    vi.mocked(requestAPI).mockReset()
  })

  it("POSTs supported chain/token queries and returns BigNumber reserves", async () => {
    const reserves = [
      {
        chain: KnownChainId.Bitcoin.Mainnet,
        token: KnownTokenId.Bitcoin.BTC,
        reserve: "123",
      },
      {
        chain: KnownChainId.BRC20.Mainnet,
        token: createBRC20Token("ordi"),
        reserve: "456",
      },
      {
        chain: KnownChainId.Runes.Mainnet,
        token: createRunesToken("840000:3"),
        reserve: "789",
      },
    ] as const
    vi.mocked(requestAPI).mockResolvedValue({ reserves })

    const queries = [
      { chain: KnownChainId.Bitcoin.Mainnet, token: KnownTokenId.Bitcoin.BTC },
      {
        chain: KnownChainId.BRC20.Mainnet,
        token: createBRC20Token("ordi"),
      },
      {
        chain: KnownChainId.Runes.Mainnet,
        token: createRunesToken("840000:3"),
      },
    ]
    const result = await getReserveInfo(ctx(), queries)

    expect(requestAPI).toHaveBeenCalledWith(ctx(), {
      method: "POST",
      path: "/2024-10-01/reserve-info",
      body: { queries },
    })
    expect(result).toEqual([
      {
        chain: KnownChainId.Bitcoin.Mainnet,
        token: KnownTokenId.Bitcoin.BTC,
        reserve: BigNumber.from("123"),
      },
      {
        chain: KnownChainId.BRC20.Mainnet,
        token: createBRC20Token("ordi"),
        reserve: BigNumber.from("456"),
      },
      {
        chain: KnownChainId.Runes.Mainnet,
        token: createRunesToken("840000:3"),
        reserve: BigNumber.from("789"),
      },
    ])
    expect(BigNumber.isBigNumber(result[0]!.reserve)).toBe(true)
  })
})
