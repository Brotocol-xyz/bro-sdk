import { toSDKNumberOrUndefined } from "../../../sdkUtils/types"
import { arraySplit } from "../../arrayHelpers"
import { BigNumber } from "../../BigNumber"
import { BroSDKErrorBase } from "../../errors"
import { FetchRoutesImpl, QueryableRoute } from "./helpers"

export class FetchMatchaPossibleRoutesFailedError extends BroSDKErrorBase {
  constructor(message: null | string, options: ErrorConstructorOptions) {
    super(message ?? "Request 0x.org api failed", options)
  }
}

/**
 * @deprecated Use `fetchKyberSwapPossibleRoutesFactory` instead
 */
export const fetchMatchaPossibleRoutesFactory = (options: {
  apiKey: string
  /**
   * The maximum number of routes to fetch in same time
   *
   * @default 10 (0x.org api limit, see https://0x.org/docs/developer-resources/rate-limits#what-are-the-rate-limits-for-the-0x-apis)
   */
  batchSize?: number
  baseUrl?: string
  debug?: boolean
  onError?: (error: FetchMatchaPossibleRoutesFailedError) => void
}): FetchRoutesImpl => {
  const debugLog: typeof console.log = (...args) => {
    if (!options.debug) return
    console.log("[fetchMatchaPossibleRouteImpl]", ...args)
  }

  const baseUrl = options.baseUrl ?? "https://api.0x.org"

  const batchSize = options.batchSize ?? 10

  return async info => {
    const batches = arraySplit(
      (_, idx) => Math.floor(idx / batchSize),
      info.possibleRoutes,
    )

    const res: Awaited<ReturnType<FetchRoutesImpl>>[] = []
    for (const batch of batches) {
      res.push(
        ...(await Promise.all(
          batch.map(route =>
            fetchMatchaPossibleRouteImpl(
              { debugLog, baseUrl, apiKey: options.apiKey },
              route,
            ).catch(e => {
              options.onError?.(e)
              return []
            }),
          ),
        )),
      )

      if (info.abortSignal?.aborted) break
    }

    return res.flat()
  }
}

const fetchMatchaPossibleRouteImpl = async (
  context: {
    apiKey: string
    baseUrl: string
    debugLog: typeof console.log
  },
  info: QueryableRoute,
): ReturnType<FetchRoutesImpl> => {
  if (BigNumber.isZero(info.amount)) {
    context.debugLog("Because of amount is 0, skipping...")
    return []
  }

  const querystring = new URLSearchParams({
    chainId: String(info.chain.chainId),
    sellToken: info.fromEVMToken.address,
    buyToken: info.toEVMToken.address,
    sellAmount: BigNumber.toString(
      BigNumber.toBigInt(
        { roundingMode: BigNumber.roundDown },
        BigNumber.rightMoveDecimals(info.fromEVMToken.decimals, info.amount),
      ),
    ),
    taker: `0x00000000000000000000000000000000000fffff`,
    slippageBps: BigNumber.toString(BigNumber.mul(info.slippage, 10000)),
  })

  const fetchUrl =
    context.baseUrl.replace(/\/*$/, "/") +
    `swap/allowance-holder/quote?${querystring.toString()}`.replace(/\/+/, "/")
  context.debugLog("fetchUrl", fetchUrl)

  const resp = await fetch(fetchUrl, {
    headers: {
      "0x-api-key": context.apiKey,
      "0x-version": "v2",
    },
  })
  if (!resp.ok) {
    context.debugLog("Request failed:", resp)

    try {
      const respText = await resp.text()
      context.debugLog("Response text:", respText)

      let respData: MockErrorData
      try {
        respData = JSON.parse(respText)
        throw new FetchMatchaPossibleRoutesFailedError(respData.message ?? "", {
          cause: {
            response: resp,
            data: respData,
          },
        })
      } catch (e) {
        throw new FetchMatchaPossibleRoutesFailedError(null, {
          cause: {
            response: resp,
            data: respText,
          },
        })
      }
    } catch {
      throw new FetchMatchaPossibleRoutesFailedError(null, {
        cause: {
          response: resp,
        },
      })
    }
  }

  const respText = await resp.text()
  context.debugLog("Request succeed:", respText)

  let respData: MockData
  try {
    respData = JSON.parse(respText)
  } catch (e) {
    return []
  }

  if (!respData.liquidityAvailable) return []

  return [
    {
      provider: "Matcha",
      evmChain: info.chain.chain,
      fromToken: info.fromEVMToken.token,
      toToken: info.toEVMToken.token,
      fromAmount: info.amount,
      toAmount: toSDKNumberOrUndefined(
        BigNumber.leftMoveDecimals(
          info.toEVMToken.decimals,
          respData.buyAmount,
        ),
      ),
      slippage: info.slippage,
    },
  ]
}

type MockErrorData = typeof mockErrorData
const mockErrorData = {
  message:
    "No API key provided. Please visit https://0x.org/pricing to get a free API key or sign up to a paid plan",
  request_id: "...",
}

type MockData = typeof mockDataSuccess | typeof mockDataFailed
const mockDataFailed = {
  liquidityAvailable: false as const,
  zid: "0x...",
}
const mockDataSuccess = {
  liquidityAvailable: true as const,
  zid: "0x...",
  blockNumber: "20114692",
  buyAmount: "100037537",
  buyToken: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  fees: {
    integratorFee: null,
    zeroExFee: null,
    gasFee: null,
  },
  issues: {
    allowance: {
      actual: "0",
      spender: "0x0000000000001ff3684f28c67538d4d072c22734",
    },
    balance: {
      token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      actual: "0",
      expected: "100000000",
    },
    simulationIncomplete: false,
    invalidSourcesPassed: [],
  },
  minBuyAmount: "99037162",
  route: {
    fills: [
      {
        from: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        to: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        source: "SolidlyV3",
        proportionBps: "10000",
      },
    ],
    tokens: [
      {
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        symbol: "USDC",
      },
      {
        address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        symbol: "USDT",
      },
    ],
  },
  sellAmount: "100000000",
  sellToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  tokenMetadata: {
    buyToken: {
      buyTaxBps: "0",
      sellTaxBps: "0",
    },
    sellToken: {
      buyTaxBps: "0",
      sellTaxBps: "0",
    },
  },
  totalNetworkFee: "1393685870940000",
  transaction: {
    to: "0x7f6cee965959295cc64d0e6c00d99d6532d8e86b",
    data: "0x1fff991f00000000000000000000000070a9f34f9b34c64957b9c401a97bfed35b95049e000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000005e72fea00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000144c1fb425e0000000000000000000000007f6cee965959295cc64d0e6c00d99d6532d8e86b000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000006e898131631616b1779bad70bc17000000000000000000000000000000000000000000000000000000006670d06c00000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000041ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000016438c9c147000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000000000000000000000000000000000000000027100000000000000000000000006146be494fee4c73540cb1c5f87536abf1452500000000000000000000000000000000000000000000000000000000000000004400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000084c31b8d7a0000000000000000000000007f6cee965959295cc64d0e6c00d99d6532d8e86b00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000005f5e10000000000000000000000000000000000000000000000000000000001000276a40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    gas: "288079",
    gasPrice: "4837860000",
    value: "0",
  },
}
