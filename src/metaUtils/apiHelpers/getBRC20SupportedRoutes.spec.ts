import { beforeEach, describe, expect, it, vi } from "vitest"
import { KnownChainId, KnownTokenId } from "../../utils/types/knownIds"
import { SDKGlobalContext } from "../../sdkUtils/types.internal"
import { requestAPI } from "../../utils/apiHelpers"
import { getStacksToken } from "../../stacksUtils/contractHelpers"
import { getBRC20SupportedRoutes } from "./getBRC20SupportedRoutes"

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
    brc20: { routesConfigCache: new Map() },
    runes: {},
    evm: { viemClients: {} },
    tron: {},
    solana: {},
  }) as any

const supportedRouteResponse = {
  routes: [
    {
      brc20Tick: "ordi",
      stacksTokenContractAddress: {
        deployerAddress: "SP000000000000000000002Q6VF78",
        contractName: "ordi-token",
      },
      pegInPaused: false,
      pegInFeeRate: "0.01",
      pegInFeeBitcoinAmount: null,
      pegOutPaused: false,
      pegOutFeeRate: "0.02",
      pegOutFeeBitcoinAmount: "1000",
      reserve: "123456789",
    },
  ],
}

describe("getBRC20SupportedRoutes", () => {
  beforeEach(() => {
    vi.mocked(requestAPI).mockReset()
    vi.mocked(getStacksToken).mockReset()
  })

  it("returns static route fields and ignores reserve from the response", async () => {
    vi.mocked(requestAPI).mockResolvedValue(supportedRouteResponse as any)
    vi.mocked(getStacksToken).mockResolvedValue(KnownTokenId.Stacks.aBTC)

    const routes = await getBRC20SupportedRoutes(ctx(), KnownChainId.BRC20.Mainnet)

    expect(routes).toHaveLength(1)
    expect(routes[0]).toEqual({
      brc20Tick: "ordi",
      brc20Chain: KnownChainId.BRC20.Mainnet,
      brc20Token: "brc20-ordi",
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
      getBRC20SupportedRoutes(sdkContext, KnownChainId.BRC20.Mainnet),
      getBRC20SupportedRoutes(sdkContext, KnownChainId.BRC20.Mainnet),
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
      getBRC20SupportedRoutes(sdkContext, KnownChainId.BRC20.Mainnet),
    ).rejects.toThrow("boom")
    await expect(
      getBRC20SupportedRoutes(sdkContext, KnownChainId.BRC20.Mainnet),
    ).resolves.toHaveLength(1)

    expect(requestAPI).toHaveBeenCalledTimes(2)
  })
})
