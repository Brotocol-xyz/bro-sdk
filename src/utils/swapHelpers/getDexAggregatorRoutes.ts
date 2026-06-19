import { SDKGlobalContext } from "../../sdkUtils/types.internal"
import { uniqBy } from "../arrayHelpers"
import { BigNumber } from "../BigNumber"
import { isNotNull } from "../typeHelpers"
import { KnownChainId, KnownTokenId } from "../types/knownIds"
import {
  DexAggregatorRoute,
  FetchRoutesImpl,
  getQueryableRoutes,
} from "./fetchDexAggregatorPossibleRoutes/helpers"

export { type DexAggregatorRoute } from "./fetchDexAggregatorPossibleRoutes/helpers"

export async function getDexAggregatorRoutes(
  sdkContext: SDKGlobalContext,
  info: {
    routeFetcher: FetchRoutesImpl
    routes: {
      evmChain: KnownChainId.EVMChain
      fromToken: KnownTokenId.EVMToken
      toToken: KnownTokenId.EVMToken
      amount: BigNumber
      slippage: BigNumber
    }[]
  },
): Promise<DexAggregatorRoute[]> {
  const uniqPossibleRoutes = uniqBy(
    r => `${r.evmChain}:${r.fromToken}:${r.toToken}:${r.amount}:${r.slippage}`,
    info.routes,
  )

  const queryableRoutes = await Promise.all(
    uniqPossibleRoutes.map(r => getQueryableRoutes(sdkContext, r)),
  ).then(res => res.filter(isNotNull))

  return info.routeFetcher({
    possibleRoutes: queryableRoutes,
  })
}
