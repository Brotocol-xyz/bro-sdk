import { BigNumber } from "../utils/BigNumber"
import { KnownRoute_FromSolana } from "../utils/buildSupportedRoutes"
import {
  ALEXSwapParameters,
  getALEXSwapParametersImpl,
} from "../utils/swapHelpers/alexSwapParametersHelpers"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { getSolana2StacksFeeInfo } from "./peggingHelpers"

export async function getALEXSwapParameters_FromSolana(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromSolana & {
    amount: BigNumber
  },
): Promise<undefined | ALEXSwapParameters> {
  return getALEXSwapParametersImpl(sdkContext, {
    ...info,
    getInitialToStacksTransferProphet: ctx =>
      getSolana2StacksFeeInfo(sdkContext, {
        fromChain: info.fromChain as any,
        fromToken: info.fromToken,
        toChain: ctx.transitStacksChain,
        toToken: ctx.firstStepToStacksToken,
      }),
  })
} 