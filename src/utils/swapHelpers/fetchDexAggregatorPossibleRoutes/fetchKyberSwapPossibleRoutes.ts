import { toSDKNumberOrUndefined } from "../../../sdkUtils/types"
import { arraySplit } from "../../arrayHelpers"
import { BigNumber } from "../../BigNumber"
import { AbortError, BroSDKErrorBase } from "../../errors"
import { checkNever } from "../../typeHelpers"
import { KnownChainId } from "../../types/knownIds"
import { FetchRoutesImpl, QueryableRoute } from "./helpers"

export class FetchKyberSwapPossibleRoutesFailedError extends BroSDKErrorBase {
  constructor(message: null | string, options: ErrorConstructorOptions) {
    super(message ?? "Request KyberSwap api failed", options)
  }
}

export const fetchKyberSwapPossibleRoutesFactory = (options: {
  /**
   * The maximum number of routes to fetch in same time
   *
   * @default 1
   */
  batchSize?: number
  clientId?: string
  debug?: boolean
  onError?: (error: FetchKyberSwapPossibleRoutesFailedError) => void
}): FetchRoutesImpl => {
  const debugLog: typeof console.log = (...args) => {
    if (!options.debug) return
    console.log("[fetchKyberSwapPossibleRoutesFactory]", ...args)
  }

  const baseUrl = "https://aggregator-api.kyberswap.com"

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
            fetchKyberSwapPossibleRouteImpl(
              { debugLog, baseUrl, clientId: options.clientId },
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

const fetchKyberSwapPossibleRouteImpl = async (
  context: {
    debugLog: typeof console.log
    baseUrl: string
    clientId?: string
  },
  info: QueryableRoute & { id: string },
): ReturnType<FetchRoutesImpl> => {
  if (BigNumber.isZero(info.amount)) {
    context.debugLog("Because of amount is 0, skipping...")
    return []
  }

  const kyberChainId = mapSDKChainIdToKyberChainId(info.chain.chain)
  if (!kyberChainId) {
    context.debugLog(
      `Because of chain ${info.chain.chain} is not supported, skipping...`,
    )
    return []
  }

  const querystring = new URLSearchParams({
    tokenIn: info.fromEVMToken.address,
    tokenOut: info.toEVMToken.address,
    amountIn: BigNumber.toString(
      BigNumber.toBigInt(
        { roundingMode: BigNumber.roundDown },
        BigNumber.rightMoveDecimals(info.fromEVMToken.decimals, info.amount),
      ),
    ),
  })

  const fetchUrl =
    context.baseUrl.replace(/\/*$/, "/") +
    `${kyberChainId}/api/v1/routes?${querystring.toString()}`.replace(
      /\/+/,
      "/",
    )
  context.debugLog("fetchUrl", fetchUrl)

  const resp = await fetch(fetchUrl, {
    headers: {
      ...(context.clientId ? { "x-client-id": context.clientId } : {}),
    },
  })
  if (!resp.ok) {
    context.debugLog("Request failed:", resp)

    try {
      const respText = await resp.text()
      context.debugLog("Response text:", respText)

      throw new FetchKyberSwapPossibleRoutesFailedError(null, {
        cause: {
          response: resp,
          data: respText,
        },
      })
    } catch {
      throw new FetchKyberSwapPossibleRoutesFailedError(null, {
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

  if (respData.code !== 0) {
    throw new FetchKyberSwapPossibleRoutesFailedError(
      (respData as any).message,
      {
        cause: {
          response: resp,
          data: respText,
        },
      },
    )
  }
  return [
    {
      id: info.id,
      provider: "KyberSwap",
      evmChain: info.chain.chain,
      fromToken: info.fromEVMToken.token,
      toToken: info.toEVMToken.token,
      fromAmount: info.amount,
      toAmount: toSDKNumberOrUndefined(
        BigNumber.leftMoveDecimals(
          info.toEVMToken.decimals,
          respData.data.routeSummary.amountOut,
        ),
      ),
    },
  ]
}

function mapSDKChainIdToKyberChainId(
  chainId: KnownChainId.EVMChain,
): undefined | string {
  /**
   * https://docs.kyberswap.com/getting-started/supported-exchanges-and-networks
   */
  switch (chainId) {
    case KnownChainId.EVM.Ethereum:
      return "ethereum"
    case KnownChainId.EVM.BSC:
      return "bsc"
    case KnownChainId.EVM.Arbitrum:
      return "arbitrum"
    case KnownChainId.EVM.Base:
      return "base"
    case KnownChainId.EVM.Linea:
      return "linea"
    case KnownChainId.EVM.Avalanche:
      return "avalanche"
    case KnownChainId.EVM.Sepolia:
    case KnownChainId.EVM.BSCTestnet:
    case KnownChainId.EVM.CoreDAOTestnet:
    case KnownChainId.EVM.BlifeTestnet:
    case KnownChainId.EVM.BitboyTestnet:
    case KnownChainId.EVM.BeraTestnet:
    case KnownChainId.EVM.CoreDAO:
    case KnownChainId.EVM.Bsquared:
    case KnownChainId.EVM.BOB:
    case KnownChainId.EVM.Bitlayer:
    case KnownChainId.EVM.Lorenzo:
    case KnownChainId.EVM.Merlin:
    case KnownChainId.EVM.AILayer:
    case KnownChainId.EVM.Mode:
    case KnownChainId.EVM.XLayer:
    case KnownChainId.EVM.Aurora:
    case KnownChainId.EVM.Manta:
    case KnownChainId.EVM.Mezo:
      return undefined
    default:
      checkNever(chainId)
      return undefined
  }
}

type MockData = typeof mockData
const mockData = {
  code: 0 as const,
  message: "successfully",
  data: {
    routeSummary: {
      tokenIn: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      amountIn: "1000000000000000000" as `${number}`,
      amountInUsd: "1668.95" as `${number}`,
      tokenInMarketPriceAvailable: false,
      tokenOut: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
      amountOut: "1666243758" as `${number}`,
      amountOutUsd: "1665.9071767608839" as `${number}`,
      tokenOutMarketPriceAvailable: false,
      gas: "253000" as `${number}`,
      gasPrice: "181968304449" as `${number}`,
      gasUsd: "0.06491355324609177" as `${number}`,
      extraFee: {
        feeAmount: "10" as `${number}`,
        chargeFeeBy: "currency_out",
        isInBps: true,
        feeReceiver: "0x0513c794bC2c65C6f374a86D6ad04425e32Df22e",
      },
      route: [
        [
          {
            pool: "0x4b543e89351faa242cb0172b2da0cdb52db699b4",
            tokenIn: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
            tokenOut: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
            limitReturnAmount: "0",
            swapAmount: "1000000000000000000",
            amountOut: "1667911669",
            exchange: "dodo",
            poolLength: 2,
            poolType: "dodo",
            poolExtra: {
              type: "DPP",
              dodoV1SellHelper: "0xdfaf9584f5d229a9dbe5978523317820a8897c5a",
              baseToken: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
              quoteToken: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
            },
            extra: {
              amountIn: "1000000000000000000",
              filledOrders: [
                {
                  allowedSenders: "0x0000000000000000000000000000000000000000",
                  feeAmount: "0",
                  feeRecipient: "0x0000000000000000000000000000000000000000",
                  filledMakingAmount: "950000",
                  filledTakingAmount: "1000000000000000000",
                  getMakerAmount:
                    "f4a215c30000000000000000000000000000000000000000000000000000000011e1a3000000000000000000000000000000000000000000000000111e75953102eec1a0",
                  getTakerAmount:
                    "296637bf0000000000000000000000000000000000000000000000000000000011e1a3000000000000000000000000000000000000000000000000111e75953102eec1a0",
                  interaction: "",
                  isFallback: false,
                  maker: "0xda060fd9ae5b23cebf8abcb2d19fab152a419d61",
                  makerAsset: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
                  makerAssetData: "",
                  makerTokenFeePercent: 0,
                  makingAmount: "300000000",
                  orderId: 9886,
                  permit: "",
                  predicate:
                    "961d5b1e000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000227b0c196ea8db17a665ea6824d972a64202e936000000000000000000000000227b0c196ea8db17a665ea6824d972a64202e9360000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000044cf6fc6e3000000000000000000000000da060fd9ae5b23cebf8abcb2d19fab152a419d61000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002463592c2b000000000000000000000000000000000000000000000000000000006453683300000000000000000000000000000000000000000000000000000000",
                  receiver: "0xda060fd9ae5b23cebf8abcb2d19fab152a419d61",
                  salt: "202362243813858115557509104206720377774",
                  signature:
                    "8fb37c9b14d9ccd7709ccc8289860c24580b69f1ab0e905a7d8c20e2ae5e45c570d33324990afb94a445246872545c5eaf9712b164a90ac7f97502d91a7c27001b",
                  takerAsset: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
                  takerAssetData: "",
                  takingAmount: "315789473684210500000",
                },
              ],
              swapSide: "BUY",
            },
          },
        ],
      ],
    },
    routerAddress: "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5",
  },
}
