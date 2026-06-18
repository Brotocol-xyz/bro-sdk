import { beforeEach, describe, expect, it, vi } from "vitest"
import { KnownChainId, KnownTokenId } from "../../utils/types/knownIds"
import { SDKGlobalContext } from "../../sdkUtils/types.internal"
import { requestAPI } from "../../utils/apiHelpers"
import { getStacksToken } from "../../stacksUtils/contractHelpers"
import { getRunesSupportedRoutes } from "./getRunesSupportedRoutes"

vi.mock("../../utils/apiHelpers", () => ({
  requestAPI: vi.fn(),
}))
vi.mock("../../stacksUtils/contractHelpers", () => ({
  getStacksToken: vi.fn(),
}))

const ctx = (): SDKGlobalContext =>
  ({
    debugLog: false,
    routes: { detectedCache: new Map() },
    backendAPI: { runtimeEnv: "prod" },
    stacks: {},
    btc: {},
    brc20: {},
    runes: { routesConfigCache: new Map() },
    evm: { viemClients: {} },
    tron: {},
    solana: {},
  }) as any

const supportedRouteResponse = {
  routes: [
    {
      runesId: "840000:3",
      stacksTokenContractAddress: {
        deployerAddress: "SP000000000000000000002Q6VF78",
        contractName: "rune-token",
      },
      pegInPaused: false,
      pegInFeeRate: "0.01",
      pegInFeeBitcoinAmount: null,
      pegOutPaused: false,
      pegOutFeeRate: "0.02",
      pegOutFeeBitcoinAmount: "1000",
      reserve: "987654321",
    },
  ],
}

describe("getRunesSupportedRoutes", () => {
  beforeEach(() => {
    vi.mocked(requestAPI).mockReset()
    vi.mocked(getStacksToken).mockReset()
  })

  it("returns static route fields and ignores reserve from the response", async () => {
    vi.mocked(requestAPI).mockResolvedValue(supportedRouteResponse as any)
    vi.mocked(getStacksToken).mockResolvedValue(KnownTokenId.Stacks.aBTC)

    const routes = await getRunesSupportedRoutes(ctx(), KnownChainId.Runes.Mainnet)

    expect(routes).toHaveLength(1)
    expect(routes[0]).toEqual({
      runesId: "840000:3",
      runesChain: KnownChainId.Runes.Mainnet,
      runesToken: "runes-840000:3",
      stacksChain: KnownChainId.Stacks.Mainnet,
      stacksToken: KnownTokenId.Stacks.aBTC,
      pegInPaused: false,
      pegInFeeRate: expect.anything(),
      pegInFeeBitcoinAmount: null,
      pegOutPaused: false,
      pegOutFeeRate: expect.anything(),
      pegOutFeeBitcoinAmount: expect.anything(),
    })
    expect("reserve" in routes[0]!).toBe(false)
  })

  it("reuses in-flight route config promise", async () => {
    const sdkContext = ctx()
    vi.mocked(requestAPI).mockResolvedValue(supportedRouteResponse as any)
    vi.mocked(getStacksToken).mockResolvedValue(KnownTokenId.Stacks.aBTC)

    const [first, second] = await Promise.all([
      getRunesSupportedRoutes(sdkContext, KnownChainId.Runes.Mainnet),
      getRunesSupportedRoutes(sdkContext, KnownChainId.Runes.Mainnet),
    ])

    expect(requestAPI).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it("deletes cached route config promise on rejection", async () => {
    const sdkContext = ctx()
    vi.mocked(requestAPI)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(supportedRouteResponse as any)
    vi.mocked(getStacksToken).mockResolvedValue(KnownTokenId.Stacks.aBTC)

    await expect(
      getRunesSupportedRoutes(sdkContext, KnownChainId.Runes.Mainnet),
    ).rejects.toThrow("boom")
    await expect(
      getRunesSupportedRoutes(sdkContext, KnownChainId.Runes.Mainnet),
    ).resolves.toHaveLength(1)

    expect(requestAPI).toHaveBeenCalledTimes(2)
  })
})
