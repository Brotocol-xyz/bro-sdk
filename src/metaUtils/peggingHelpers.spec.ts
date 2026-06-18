import { beforeEach, describe, expect, it, vi } from "vitest"
import { getStacksToken } from "../stacksUtils/contractHelpers"
import { requestAPI } from "../utils/apiHelpers"
import { BigNumber } from "../utils/BigNumber"
import {
  createBRC20Token,
  createRunesToken,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { getMeta2StacksFeeInfo, getStacks2MetaFeeInfo } from "./peggingHelpers"

vi.mock("../utils/apiHelpers", () => ({
  requestAPI: vi.fn(),
}))
vi.mock("../stacksUtils/contractHelpers", () => ({
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
    runes: { routesConfigCache: new Map() },
    evm: { viemClients: {} },
    tron: {},
    solana: {},
  }) as any

const brc20RoutesResponse = {
  routes: [
    {
      brc20Tick: "ordi",
      stacksTokenContractAddress: {
        deployerAddress: "SP000000000000000000002Q6VF78",
        contractName: "ordi-token",
      },
      pegInPaused: false,
      pegInFeeRate: "0",
      pegInFeeBitcoinAmount: null,
      pegOutPaused: false,
      pegOutFeeRate: "0",
      pegOutFeeBitcoinAmount: null,
    },
  ],
}

const runesRoutesResponse = {
  routes: [
    {
      runesId: "840000:3",
      stacksTokenContractAddress: {
        deployerAddress: "SP000000000000000000002Q6VF78",
        contractName: "runes-token",
      },
      pegInPaused: false,
      pegInFeeRate: "0",
      pegInFeeBitcoinAmount: null,
      pegOutPaused: false,
      pegOutFeeRate: "0",
      pegOutFeeBitcoinAmount: "1000",
    },
  ],
}

describe("meta pegging maxBridgeAmount", () => {
  beforeEach(() => {
    vi.mocked(requestAPI).mockReset()
    vi.mocked(getStacksToken).mockReset()
    vi.mocked(getStacksToken).mockResolvedValue(KnownTokenId.Stacks.aBTC)
  })

  it("keeps direct meta-to-Stacks base fee maxBridgeAmount null", async () => {
    const brc20Token = createBRC20Token("ordi")
    vi.mocked(requestAPI).mockResolvedValueOnce(brc20RoutesResponse as any)

    const feeInfo = await getMeta2StacksFeeInfo(
      ctx(),
      {
        fromChain: KnownChainId.BRC20.Mainnet,
        fromToken: brc20Token,
        toChain: KnownChainId.Stacks.Mainnet,
        toToken: KnownTokenId.Stacks.aBTC,
      },
      { swapRoute: null },
    )

    expect(requestAPI).toHaveBeenLastCalledWith(expect.anything(), {
      method: "GET",
      path: "/2024-10-01/brc20/supported-routes",
      query: { network: "mainnet" },
    })
    expect(feeInfo).toBeDefined()
    expect(feeInfo!.maxBridgeAmount).toBeNull()
  })

  it("uses fresh Runes reserve endpoint result as maxBridgeAmount for direct peg-out", async () => {
    const runesToken = createRunesToken("840000:3")
    vi.mocked(requestAPI)
      .mockResolvedValueOnce(runesRoutesResponse as any)
      .mockResolvedValueOnce({
        reserves: [
          {
            chain: KnownChainId.Runes.Mainnet,
            token: runesToken,
            reserve: "67890",
          },
        ],
      } as any)

    const feeInfo = await getStacks2MetaFeeInfo(
      ctx(),
      {
        fromChain: KnownChainId.Stacks.Mainnet,
        fromToken: KnownTokenId.Stacks.aBTC,
        toChain: KnownChainId.Runes.Mainnet,
        toToken: runesToken,
      },
      { initialRoute: null, swapRoute: null },
    )

    expect(requestAPI).toHaveBeenLastCalledWith(expect.anything(), {
      method: "POST",
      path: "/2024-10-01/reserve-info",
      body: {
        queries: [{ chain: KnownChainId.Runes.Mainnet, token: runesToken }],
      },
    })
    expect(feeInfo).toBeDefined()
    expect(
      BigNumber.isEq(feeInfo!.maxBridgeAmount!, BigNumber.from(67890)),
    ).toBe(true)
  })

  it("maps omitted reserve rows to null while keeping route fee data", async () => {
    const brc20Token = createBRC20Token("ordi")
    vi.mocked(requestAPI)
      .mockResolvedValueOnce(brc20RoutesResponse as any)
      .mockResolvedValueOnce({ reserves: [] } as any)

    const feeInfo = await getMeta2StacksFeeInfo(
      ctx(),
      {
        fromChain: KnownChainId.BRC20.Mainnet,
        fromToken: brc20Token,
        toChain: KnownChainId.Stacks.Mainnet,
        toToken: KnownTokenId.Stacks.aBTC,
      },
      { swapRoute: null },
    )

    expect(feeInfo).toBeDefined()
    expect(feeInfo!.maxBridgeAmount).toBeNull()
    expect(feeInfo!.fees).toHaveLength(1)
  })

  it("keeps Stacks-to-meta static fee data cached while refreshing reserves", async () => {
    const sdkContext = ctx()
    const brc20Token = createBRC20Token("ordi")
    sdkContext.brc20.feeRateCache = new Map()
    vi.mocked(requestAPI)
      .mockResolvedValueOnce(brc20RoutesResponse as any)
      .mockResolvedValueOnce({
        reserves: [
          { chain: KnownChainId.BRC20.Mainnet, token: brc20Token, reserve: "1" },
        ],
      } as any)
      .mockResolvedValueOnce({
        reserves: [
          { chain: KnownChainId.BRC20.Mainnet, token: brc20Token, reserve: "2" },
        ],
      } as any)

    const route = {
      fromChain: KnownChainId.Stacks.Mainnet,
      fromToken: KnownTokenId.Stacks.aBTC,
      toChain: KnownChainId.BRC20.Mainnet,
      toToken: brc20Token,
    }
    const first = await getStacks2MetaFeeInfo(sdkContext, route, {
      initialRoute: null,
      swapRoute: null,
    })
    const second = await getStacks2MetaFeeInfo(sdkContext, route, {
      initialRoute: null,
      swapRoute: null,
    })

    expect(requestAPI).toHaveBeenCalledTimes(3)
    expect(requestAPI).toHaveBeenNthCalledWith(1, expect.anything(), {
      method: "GET",
      path: "/2024-10-01/brc20/supported-routes",
      query: { network: "mainnet" },
    })
    expect(requestAPI).toHaveBeenNthCalledWith(2, expect.anything(), {
      method: "POST",
      path: "/2024-10-01/reserve-info",
      body: {
        queries: [{ chain: KnownChainId.BRC20.Mainnet, token: brc20Token }],
      },
    })
    expect(requestAPI).toHaveBeenNthCalledWith(3, expect.anything(), {
      method: "POST",
      path: "/2024-10-01/reserve-info",
      body: {
        queries: [{ chain: KnownChainId.BRC20.Mainnet, token: brc20Token }],
      },
    })
    expect(BigNumber.isEq(first!.maxBridgeAmount!, BigNumber.from(1))).toBe(true)
    expect(BigNumber.isEq(second!.maxBridgeAmount!, BigNumber.from(2))).toBe(true)
  })
})
