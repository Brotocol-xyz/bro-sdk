import { requestAPI } from "../../utils/apiHelpers"
import { BigNumber } from "../../utils/BigNumber"
import { KnownChainId, KnownTokenId } from "../../utils/types/knownIds"
import { TransferProphet } from "../../utils/types/TransferProphet"
import { SDKGlobalContext } from "../types.internal"

export type ReserveInfoQuery =
  | {
      chain: KnownChainId.BitcoinChain
      token: KnownTokenId.BitcoinToken
    }
  | {
      chain: KnownChainId.BRC20Chain
      token: KnownTokenId.BRC20Token
    }
  | {
      chain: KnownChainId.RunesChain
      token: KnownTokenId.RunesToken
    }

export type ReserveInfo = ReserveInfoQuery & {
  reserve: BigNumber
}

export const withMaxBridgeAmountReserve = (
  transferProphet: TransferProphet,
  reserve: null | BigNumber,
): TransferProphet => {
  if (transferProphet.maxBridgeAmount == null) {
    return { ...transferProphet, maxBridgeAmount: reserve }
  }

  if (reserve == null) return transferProphet

  return {
    ...transferProphet,
    maxBridgeAmount: BigNumber.min([transferProphet.maxBridgeAmount, reserve]),
  }
}

type ReserveInfoWire = ReserveInfoQuery & {
  reserve: string
}

interface ReserveInfoResponseWire {
  reserves: ReserveInfoWire[]
}

export async function getReserveInfo(
  sdkContext: SDKGlobalContext,
  queries: ReserveInfoQuery[],
): Promise<ReserveInfo[]> {
  const resp = await requestAPI<ReserveInfoResponseWire>(sdkContext, {
    method: "POST",
    path: "/2024-10-01/reserve-info",
    body: { queries },
  })

  return resp.reserves.map(item => ({
    ...item,
    reserve: BigNumber.from(item.reserve),
  }))
}

export async function getReserveAmount(
  sdkContext: SDKGlobalContext,
  query: ReserveInfoQuery,
): Promise<null | BigNumber> {
  const reserves = await getReserveInfo(sdkContext, [query])
  const reserve = reserves.find(
    item => item.chain === query.chain && item.token === query.token,
  )
  return reserve?.reserve ?? null
}
