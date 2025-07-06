import { BigNumber } from "../utils/BigNumber"
import { KnownRoute_FromMeta } from "../utils/buildSupportedRoutes"
import {
  ALEXSwapParameters,
  getALEXSwapParametersImpl,
} from "../utils/swapHelpers/alexSwapParametersHelpers"
import {
  EVMDexAggregatorSwapParameters,
  getPossibleEVMDexAggregatorSwapParametersImpl,
  GetPossibleEVMDexAggregatorSwapParametersImplOptions,
} from "../utils/swapHelpers/evmDexAggregatorSwapParametersHelpers"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { getMeta2StacksFeeInfo } from "./peggingHelpers"

export async function getALEXSwapParameters_FromMeta(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta & {
    amount: BigNumber
  },
): Promise<undefined | ALEXSwapParameters> {
  return getALEXSwapParametersImpl(sdkContext, {
    ...info,
    getInitialToStacksTransferProphet: ctx =>
      getMeta2StacksFeeInfo(
        sdkContext,
        {
          fromChain: info.fromChain as KnownChainId.BRC20Chain,
          fromToken: info.fromToken as KnownTokenId.BRC20Token,
          toChain: ctx.transitStacksChain,
          toToken: ctx.firstStepToStacksToken,
        },
        { swapRoute: { via: "ALEX" } },
      ),
  })
}

export async function getPossibleEVMDexAggregatorSwapParameters_FromMeta(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta & {
    amount: BigNumber
  },
  options: GetPossibleEVMDexAggregatorSwapParametersImplOptions,
): Promise<EVMDexAggregatorSwapParameters[]> {
  return getPossibleEVMDexAggregatorSwapParametersImpl(
    sdkContext,
    {
      ...info,
      getInitialToStacksTransferProphet: ctx =>
        getMeta2StacksFeeInfo(
          sdkContext,
          {
            fromChain: info.fromChain as KnownChainId.BRC20Chain,
            fromToken: info.fromToken as KnownTokenId.BRC20Token,
            toChain: ctx.transitStacksChain,
            toToken: ctx.firstStepToStacksToken,
          },
          { swapRoute: { via: "evmDexAggregator" } },
        ),
    },
    options,
  )
}
