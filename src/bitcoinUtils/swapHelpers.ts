import { KnownRoute_FromBitcoin } from "../lowlevelUnstableInfos"
import { BigNumber } from "../utils/BigNumber"
import {
  ALEXSwapParameters,
  getALEXSwapParametersImpl,
} from "../utils/swapHelpers/alexSwapParametersHelpers"
import {
  EVMDexAggregatorSwapParameters,
  getPossibleEVMDexAggregatorSwapParametersImpl,
  GetPossibleEVMDexAggregatorSwapParametersImplOptions,
} from "../utils/swapHelpers/evmDexAggregatorSwapParametersHelpers"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { getBtc2StacksFeeInfo } from "./peggingHelpers"

export async function getALEXSwapParameters_FromBitcoin(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromBitcoin & {
    amount: BigNumber
  },
): Promise<undefined | ALEXSwapParameters> {
  return getALEXSwapParametersImpl(sdkContext, {
    ...info,
    getInitialToStacksTransferProphet: ctx =>
      getBtc2StacksFeeInfo(
        sdkContext,
        {
          fromChain: info.fromChain,
          fromToken: info.fromToken,
          toChain: ctx.transitStacksChain,
          toToken: ctx.firstStepToStacksToken,
        },
        { swapRoute: { via: "ALEX" } },
      ),
  })
}

export async function getPossibleEVMDexAggregatorSwapParameters_FromBitcoin(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromBitcoin & {
    amount: BigNumber
  },
  options: GetPossibleEVMDexAggregatorSwapParametersImplOptions,
): Promise<EVMDexAggregatorSwapParameters[]> {
  return getPossibleEVMDexAggregatorSwapParametersImpl(
    sdkContext,
    {
      ...info,
      getInitialToStacksTransferProphet: ctx =>
        getBtc2StacksFeeInfo(
          sdkContext,
          {
            fromChain: info.fromChain,
            fromToken: info.fromToken,
            toChain: ctx.transitStacksChain,
            toToken: ctx.firstStepToStacksToken,
          },
          { swapRoute: { via: "evmDexAggregator" } },
        ),
    },
    options,
  )
}
