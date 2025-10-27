import { SDKGlobalContext } from "../../sdkUtils/types.internal"
import { uniqBy } from "../arrayHelpers"
import { BigNumber } from "../BigNumber"
import { AbortError } from "../errors"
import { isNotNull } from "../typeHelpers"
import { KnownChainId, KnownTokenId } from "../types/knownIds"
import {
  DexAggregatorRoute,
  FetchRoutesImpl,
  getQueryableRoutes,
} from "./fetchDexAggregatorPossibleRoutes/helpers"

export { DexAggregatorRoute } from "./fetchDexAggregatorPossibleRoutes/helpers"

export async function getDexAggregatorRoutes(
  sdkContext: SDKGlobalContext,
  info: {
    routeFetcher: FetchRoutesImpl
    routes: {
      evmChain: KnownChainId.EVMChain
      fromToken: KnownTokenId.EVMToken
      toToken: KnownTokenId.EVMToken
      amount: BigNumber
    }[]
  },
): Promise<DexAggregatorRoute[]> {
  const uniqPossibleRoutes = uniqBy(
    r => `${r.evmChain}:${r.fromToken}:${r.toToken}:${r.amount}`,
    info.routes,
  )

  const queryableRoutes = await Promise.all(
    uniqPossibleRoutes.map((r, idx) =>
      getQueryableRoutes(sdkContext, r).then(route =>
        route == null ? route : { ...route, id: String(idx) },
      ),
    ),
  ).then(res => res.filter(isNotNull))

  const res = await info
    .routeFetcher({
      possibleRoutes: queryableRoutes,
    })
    .catch(e => {
      if (e instanceof AbortError) {
        return []
      }
      throw e
    })

  return res
}
