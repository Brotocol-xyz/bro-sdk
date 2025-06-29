import { toSDKNumberOrUndefined } from "../../../sdkUtils/types"
import { arraySplit } from "../../arrayHelpers"
import { BigNumber } from "../../BigNumber"
import { AbortError, BroSDKErrorBase } from "../../errors"
import { FetchRoutesImpl, QueryableRoute } from "./helpers"

export class FetchIceScreamSwapPossibleRoutesFailedError extends BroSDKErrorBase {
  constructor(message: null | string, options: ErrorConstructorOptions) {
    super(message ?? "Request IceScreamSwap api failed", options)
  }
}

/**
 * @deprecated Use `fetchKyberSwapPossibleRoutesFactory` instead
 */
export const fetchIceScreamSwapPossibleRoutesFactory = (options: {
  /**
   * The maximum number of routes to fetch in same time
   *
   * @default 1
   */
  batchSize?: number
  baseUrl?: string
  debug?: boolean
  onError?: (error: FetchIceScreamSwapPossibleRoutesFailedError) => void
}): FetchRoutesImpl => {
  const debugLog: typeof console.log = (...args) => {
    if (!options.debug) return
    console.log("[fetchIceScreamSwapPossibleRoutesFactory]", ...args)
  }

  const baseUrl = options.baseUrl ?? "https://aggregator.icecreamswap.com"

  const batchSize = options.batchSize ?? 1

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
            fetchIceScreamSwapPossibleRouteImpl(
              { debugLog, baseUrl },
              route,
            ).catch(e => {
              options.onError?.(e)
              return []
            }),
          ),
        )),
      )

      if (info.abortSignal?.aborted) {
        throw new AbortError(info.abortSignal.reason)
      }
    }

    return res.flat()
  }
}

const fetchIceScreamSwapPossibleRouteImpl = async (
  context: {
    debugLog: typeof console.log
    baseUrl: string
  },
  info: QueryableRoute & { id: string },
): ReturnType<FetchRoutesImpl> => {
  if (BigNumber.isZero(info.amount)) {
    context.debugLog("Because of amount is 0, skipping...")
    return []
  }

  const querystring = new URLSearchParams({
    src: info.fromEVMToken.address,
    dst: info.toEVMToken.address,
    amount: String(
      BigNumber.toBigInt(
        { roundingMode: BigNumber.roundDown },
        BigNumber.rightMoveDecimals(info.fromEVMToken.decimals, info.amount),
      ),
    ),
    slippage: "10000",
  })

  const fetchUrl = `${context.baseUrl}/${String(info.chain.chainId)}?${querystring.toString()}`
  context.debugLog("fetchUrl", fetchUrl)

  const resp = await fetch(fetchUrl)
  if (!resp.ok) {
    context.debugLog("Request failed:", resp)

    try {
      const respText = await resp.text()
      context.debugLog("Response text:", respText)

      throw new FetchIceScreamSwapPossibleRoutesFailedError(null, {
        cause: {
          response: resp,
          data: respText,
        },
      })
    } catch {
      throw new FetchIceScreamSwapPossibleRoutesFailedError(null, {
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

  if (respData.toAmount === 0) return []

  return [
    {
      id: info.id,
      provider: "IceCreamSwap",
      evmChain: info.chain.chain,
      fromToken: info.fromEVMToken.token,
      toToken: info.toEVMToken.token,
      fromAmount: info.amount,
      toAmount: toSDKNumberOrUndefined(
        BigNumber.leftMoveDecimals(info.toEVMToken.decimals, respData.toAmount),
      ),
    },
  ]
}

type MockData = typeof mockData
const mockData = {
  swaps: [
    {
      amount_in: 166666666666666660000,
      amount_out: 6634209547,
      hops: 2,
      route: [
        {
          pool: "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59",
          token_in: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          token_out: "0x4200000000000000000000000000000000000006",
        },
        {
          pool: "0x70aCDF2Ad0bf2402C957154f944c19Ef4e1cbAE1",
          token_in: "0x4200000000000000000000000000000000000006",
          token_out: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        },
      ],
    },
    {
      amount_in: 166666666666666660000,
      amount_out: 2698983972,
      hops: 1,
      route: [
        {
          pool: "0xfBB6Eed8e7aa03B138556eeDaF5D271A5E1e43ef",
          token_in: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          token_out: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        },
      ],
    },
    {
      amount_in: 166666666666666660000,
      amount_out: 2442353520,
      hops: 3,
      route: [
        {
          pool: "0xd0b53D9277642d899DF5C87A3966A349A798F224",
          token_in: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          token_out: "0x4200000000000000000000000000000000000006",
        },
        {
          pool: "0xE31c372a7Af875b3B5E0F3713B17ef51556da667",
          token_in: "0x4200000000000000000000000000000000000006",
          token_out: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
        },
        {
          pool: "0xb909F567c5c2Bb1A4271349708CC4637D7318b4A",
          token_in: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
          token_out: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        },
      ],
    },
  ],
  toAmount: 19354990505,
  tx: {
    data: "0x...",
    from: "0xbB7899696049C3A820A56CADa04aEF5BccbB3b54",
    to: "0xD810A437e334B9C3660C18b38fB3C01000B91DD3",
    value: 0,
  },
}
