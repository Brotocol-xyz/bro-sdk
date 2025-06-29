import { SDK_NAME } from "../../constants"
import {
  SDKNumber,
  SDKNumberifyNestly,
  toSDKNumberOrUndefined,
} from "../../sdkUtils/types"
import { BigNumber } from "../BigNumber"
import { first, last } from "../arrayHelpers"
import { KnownRoute } from "../buildSupportedRoutes"
import {
  applyTransferProphet,
  applyTransferProphets,
  composeTransferProphets,
  TransferProphetAppliedResult,
} from "../feeRateHelpers"
import { checkNever, isNotNull, OneOrMore } from "../typeHelpers"
import { KnownChainId, KnownTokenId } from "./knownIds"

export type TransferProphetAggregated<
  T extends Readonly<TransferProphet[]> = OneOrMore<TransferProphet>,
> = TransferProphet & {
  transferProphets: T
}

export type TransferProphet_Fee_Rate = {
  type: "rate"
  token: KnownTokenId.KnownToken
  rate: BigNumber
  minimumAmount: BigNumber
}
export type TransferProphet_Fee_Fixed = {
  type: "fixed"
  token: KnownTokenId.KnownToken
  amount: BigNumber
}
export type TransferProphet_Fee =
  | TransferProphet_Fee_Rate
  | TransferProphet_Fee_Fixed

export interface TransferProphet {
  isPaused: boolean
  bridgeToken: KnownTokenId.KnownToken
  reserveAmount: null | BigNumber
  minBridgeAmount: null | BigNumber
  maxBridgeAmount: null | BigNumber
  fees: TransferProphet_Fee[]
}

export interface PublicTransferProphet
  extends Omit<SDKNumberifyNestly<TransferProphet>, "bridgeToken" | "fees"> {
  fromChain: KnownChainId.KnownChain
  fromToken: KnownTokenId.KnownToken
  toChain: KnownChainId.KnownChain
  toToken: KnownTokenId.KnownToken
  fromAmount: SDKNumber
  toAmount: SDKNumber
  fees: SDKNumberifyNestly<
    (
      | (TransferProphet_Fee_Rate & { amount: SDKNumber })
      | TransferProphet_Fee_Fixed
    )[]
  >
}

export interface PublicTransferProphetAggregated<
  T extends readonly PublicTransferProphet[] = readonly PublicTransferProphet[],
> extends SDKNumberifyNestly<PublicTransferProphet> {
  transferProphets: T
}

export function transformFromPublicTransferProphet(
  transferProphet: PublicTransferProphet,
): TransferProphet {
  return {
    isPaused: transferProphet.isPaused,
    bridgeToken: transferProphet.fromToken,
    fees: transferProphet.fees
      .flatMap(f =>
        f.type === "rate"
          ? {
              ...f,
              rate: BigNumber.from(f.rate),
              minimumAmount: BigNumber.from(f.minimumAmount),
            }
          : f.type === "fixed"
            ? {
                ...f,
                amount: BigNumber.from(f.amount),
              }
            : checkNever(f),
      )
      .filter(isNotNull),
    reserveAmount:
      transferProphet.reserveAmount == null
        ? null
        : BigNumber.from(transferProphet.reserveAmount),
    minBridgeAmount:
      transferProphet.minBridgeAmount == null
        ? null
        : BigNumber.from(transferProphet.minBridgeAmount),
    maxBridgeAmount:
      transferProphet.maxBridgeAmount == null
        ? null
        : BigNumber.from(transferProphet.maxBridgeAmount),
  }
}
export function transformToPublicTransferProphet(
  route: KnownRoute,
  fromAmount: SDKNumber | BigNumber,
  transferProphet: TransferProphet,
): PublicTransferProphet {
  const result = applyTransferProphet(
    transferProphet,
    BigNumber.from(fromAmount),
  )

  const fees: PublicTransferProphet["fees"] = result.fees
    .map(f =>
      f.type === "rate"
        ? {
            ...f,
            rate: toSDKNumberOrUndefined(f.rate),
            minimumAmount: toSDKNumberOrUndefined(f.minimumAmount),
            amount: toSDKNumberOrUndefined(f.amount),
          }
        : f.type === "fixed"
          ? {
              ...f,
              amount: toSDKNumberOrUndefined(f.amount),
            }
          : checkNever(f),
    )
    .filter(isNotNull)

  return {
    ...route,
    fromAmount: toSDKNumberOrUndefined(fromAmount),
    toAmount: toSDKNumberOrUndefined(result.netAmount),
    isPaused: transferProphet.isPaused,
    reserveAmount: toSDKNumberOrUndefined(transferProphet.reserveAmount),
    minBridgeAmount: toSDKNumberOrUndefined(transferProphet.minBridgeAmount),
    maxBridgeAmount: toSDKNumberOrUndefined(transferProphet.maxBridgeAmount),
    fees,
  }
}

/**
 * @example
 * transformToPublicTransferProphetAggregated(
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
export const transformToPublicTransferProphetAggregated = (
  routes: OneOrMore<KnownRoute>,
  transferProphets: OneOrMore<TransferProphet>,
  fromAmount: BigNumber,
  exchangeRates: OneOrMore<BigNumber>,
): PublicTransferProphetAggregated<PublicTransferProphet[]> => {
  if (routes.length !== transferProphets.length) {
    throw new Error(
      `[${SDK_NAME}#transformToPublicTransferProphetAggregated2] route count not match with transferProphet count, which is not expected`,
    )
  }

  const transformFees = (
    fees: TransferProphetAppliedResult["fees"],
  ): PublicTransferProphet["fees"] => {
    return fees
      .map(f =>
        f.type === "rate"
          ? {
              ...f,
              rate: toSDKNumberOrUndefined(f.rate),
              minimumAmount: toSDKNumberOrUndefined(f.minimumAmount),
              amount: toSDKNumberOrUndefined(f.amount),
            }
          : f.type === "fixed"
            ? {
                ...f,
                amount: toSDKNumberOrUndefined(f.amount),
              }
            : checkNever(f),
      )
      .filter(isNotNull)
  }

  if (transferProphets.length === 1) {
    const [route] = routes
    const [transferProphet] = transferProphets
    const applyResult = applyTransferProphet(transferProphet, fromAmount)
    const toAmount = BigNumber.mul(applyResult.netAmount, exchangeRates[0])
    return {
      fromChain: route.fromChain,
      fromToken: route.fromToken,
      toChain: route.toChain,
      toToken: route.toToken,
      fromAmount: toSDKNumberOrUndefined(fromAmount),
      toAmount: toSDKNumberOrUndefined(toAmount),
      isPaused: transferProphet.isPaused,
      fees: transformFees(applyResult.fees),
      reserveAmount: toSDKNumberOrUndefined(transferProphet.reserveAmount),
      minBridgeAmount: toSDKNumberOrUndefined(transferProphet.minBridgeAmount),
      maxBridgeAmount: toSDKNumberOrUndefined(transferProphet.maxBridgeAmount),
      transferProphets: [],
    }
  }

  const composed = composeTransferProphets(transferProphets, exchangeRates)
  const applyResult = applyTransferProphets(transferProphets, fromAmount, {
    exchangeRates,
  })

  const firstRoute = first(routes)
  const lastRoute = last(routes)
  const publicTransferProphets = applyResult.map(
    (r, idx): PublicTransferProphet =>
      transformToPublicTransferProphet(
        routes[idx],
        applyResult[idx].fromAmount,
        transferProphets[idx],
      ),
  )
  return {
    fromChain: firstRoute.fromChain,
    fromToken: firstRoute.fromToken,
    toChain: lastRoute.toChain,
    toToken: lastRoute.toToken,
    fromAmount: toSDKNumberOrUndefined(fromAmount),
    toAmount: toSDKNumberOrUndefined(last(applyResult).netAmount),
    isPaused: composed.isPaused,
    fees: transformFees(applyResult.flatMap(r => r.fees)),
    reserveAmount: toSDKNumberOrUndefined(composed.reserveAmount),
    minBridgeAmount: toSDKNumberOrUndefined(composed.minBridgeAmount),
    maxBridgeAmount: toSDKNumberOrUndefined(composed.maxBridgeAmount),
    transferProphets: publicTransferProphets,
  }
}

export const transformToPublicTransferProphetAggregated2 = (
  routes: [KnownRoute, KnownRoute],
  transferProphets: [TransferProphet, TransferProphet],
  fromAmount: BigNumber,
  exchangeRate: BigNumber,
): PublicTransferProphetAggregated<
  [PublicTransferProphet, PublicTransferProphet]
> => {
  return transformToPublicTransferProphetAggregated(
    routes,
    transferProphets,
    fromAmount,
    [exchangeRate],
  ) as any
}
