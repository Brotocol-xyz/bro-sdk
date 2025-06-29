import { SDKGlobalContext } from "../../sdkUtils/types.internal"
import { BigNumber } from "../BigNumber"
import { KnownRoute } from "../buildSupportedRoutes"
import { applyTransferProphet } from "../feeRateHelpers"
import { KnownChainId, KnownTokenId } from "../types/knownIds"
import { TransferProphet } from "../types/TransferProphet"

export interface InstantSwapParameters {
  fromChain: KnownChainId.KnownChain
  fromToken: KnownTokenId.KnownToken
  toChain: KnownChainId.KnownChain
  toToken: KnownTokenId.KnownToken
  fromAmount: BigNumber
  reserveAmount: null | BigNumber
}

export async function getInstantSwapParametersImpl(
  sdkContext: SDKGlobalContext,
  info: KnownRoute & {
    amount: BigNumber
    getInstantSwapTransferProphet: () => Promise<undefined | TransferProphet>
  },
): Promise<undefined | InstantSwapParameters> {
  const transferProphet = await info.getInstantSwapTransferProphet()

  if (transferProphet == null) return

  const fromAmount = applyTransferProphet(
    transferProphet,
    BigNumber.from(info.amount),
  ).netAmount

  return {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: info.toChain,
    toToken: info.toToken,
    fromAmount,
    reserveAmount: transferProphet.reserveAmount,
  }
}
