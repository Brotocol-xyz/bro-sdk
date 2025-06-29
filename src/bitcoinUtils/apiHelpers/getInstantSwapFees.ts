import { SDKGlobalContext } from "../../sdkUtils/types.internal"
import { requestAPI } from "../../utils/apiHelpers"
import { BigNumber } from "../../utils/BigNumber"
import {
  KnownRoute_FromBitcoin_ToRunes,
  KnownRoute_FromRunes_ToBitcoin,
  KnownRoute_FromRunes_ToRunes,
} from "../../utils/buildSupportedRoutes"
import { checkNever } from "../../utils/typeHelpers"
import { KnownTokenId } from "../../utils/types/knownIds"
import {
  TransferProphet,
  TransferProphet_Fee,
  TransferProphet_Fee_Fixed,
  TransferProphet_Fee_Rate,
} from "../../utils/types/TransferProphet"

type ServerTransferProphet_Fee_Rate = {
  type: "rate"
  token: KnownTokenId.KnownToken
  rate: `${number}`
  minimumAmount: `${number}`
}
type ServerTransferProphet_Fee_Fixed = {
  type: "fixed"
  token: KnownTokenId.KnownToken
  amount: `${number}`
}
type ServerTransferProphet_Fee =
  | ServerTransferProphet_Fee_Rate
  | ServerTransferProphet_Fee_Fixed
interface ServerTransferProphet {
  isPaused: boolean
  bridgeToken: KnownTokenId.KnownToken
  reserveAmount?: `${number}`
  minBridgeAmount?: `${number}`
  maxBridgeAmount?: `${number}`
  fees: ServerTransferProphet_Fee[]
}

export async function getInstantSwapFees(
  sdkContext: Pick<SDKGlobalContext, "backendAPI">,
  info:
    | KnownRoute_FromBitcoin_ToRunes
    | KnownRoute_FromRunes_ToBitcoin
    | KnownRoute_FromRunes_ToRunes,
): Promise<undefined | TransferProphet> {
  const params = new URLSearchParams({
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: info.toChain,
    toToken: info.toToken,
  })

  const resp = await requestAPI<{
    transferProphet?: ServerTransferProphet
  }>(sdkContext, {
    path: `/2024-10-01/instant-swap/fees?${params.toString()}`,
    method: "GET",
  })
  if (resp.transferProphet == null) return

  let isInvalidTransferProphet = false
  const fees = resp.transferProphet.fees.flatMap(
    (fee): TransferProphet_Fee[] => {
      if (!KnownTokenId.isKnownToken(fee.token)) {
        isInvalidTransferProphet = true
        return []
      }

      if (fee.type === "rate") {
        return [
          {
            ...fee,
            rate: BigNumber.from(fee.rate),
            minimumAmount: BigNumber.from(fee.minimumAmount),
          } satisfies TransferProphet_Fee_Rate,
        ]
      } else if (fee.type === "fixed") {
        return [
          {
            ...fee,
            amount: BigNumber.from(fee.amount),
          } satisfies TransferProphet_Fee_Fixed,
        ]
      } else {
        checkNever(fee)
        return []
      }
    },
  )
  if (isInvalidTransferProphet) return

  const bridgeToken = KnownTokenId.isKnownToken(
    resp.transferProphet.bridgeToken,
  )
    ? resp.transferProphet.bridgeToken
    : null
  if (bridgeToken == null) return

  return {
    ...resp.transferProphet,
    bridgeToken,
    reserveAmount:
      resp.transferProphet.reserveAmount != null
        ? BigNumber.from(resp.transferProphet.reserveAmount)
        : null,
    minBridgeAmount:
      resp.transferProphet.minBridgeAmount != null
        ? BigNumber.from(resp.transferProphet.minBridgeAmount)
        : null,
    maxBridgeAmount:
      resp.transferProphet.maxBridgeAmount != null
        ? BigNumber.from(resp.transferProphet.maxBridgeAmount)
        : null,
    fees,
  }
}
