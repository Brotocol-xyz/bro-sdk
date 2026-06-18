import { SDK_NAME } from "../../bitcoinUtils/constants"
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

export function isSameTransferProphetFee(
  a: TransferProphet_Fee,
  b: TransferProphet_Fee,
) {
  if (a.type !== b.type) {
    return false
  }

  if (a.type === "rate") {
    if (b.type !== "rate") return false
    return (
      a.token === b.token &&
      BigNumber.isEq(a.rate, b.rate) &&
      BigNumber.isEq(a.minimumAmount, b.minimumAmount)
    )
  }

  if (a.type === "fixed") {
    if (b.type !== "fixed") return false
    return a.token === b.token && BigNumber.isEq(a.amount, b.amount)
  }

  checkNever(a)
  return false
}

export function isSameTransferProphetFeeSet(
  a: TransferProphet_Fee[],
  b: TransferProphet_Fee[],
): boolean {
  if (a.length !== b.length) return false

  const _a = [...a]
  const _b = [...b]

  let aRateFee = _a.pop()
  while (aRateFee != null) {
    const bRateFeeIndex = _b.findIndex(bRateFee => isSameTransferProphetFee(aRateFee!, bRateFee))
    if (bRateFeeIndex === -1) return false

    _b.splice(bRateFeeIndex, 1)
    aRateFee = _a.pop()
  }
  return _b.length === 0
}


export interface TransferProphet {
  isPaused: boolean
  bridgeToken: KnownTokenId.KnownToken
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

  const composed = composeTransferProphets(transferProphets, exchangeRates)
  const applyResult = applyTransferProphets(transferProphets, fromAmount, {
    exchangeRates,
  })

  const fees: PublicTransferProphet["fees"] = applyResult
    .flatMap(r => r.fees)
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
    fees,
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
