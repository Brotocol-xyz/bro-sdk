import { SDKGlobalContext } from "../sdkUtils/types.internal"
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
import {
  getInstantSwapParametersImpl,
  InstantSwapParameters,
} from "../utils/swapHelpers/instantSwapParametersHelpers"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { getInstantSwapFeeInfo, getMeta2StacksFeeInfo } from "./peggingHelpers"

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

export async function getInstantSwapParameters_FromMeta(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta & {
    amount: BigNumber
  },
): Promise<undefined | InstantSwapParameters> {
  const { fromChain, fromToken, toChain, toToken } = info

  if (
    KnownChainId.isRunesChain(fromChain) &&
    KnownTokenId.isRunesToken(fromToken) &&
    KnownChainId.isBitcoinChain(toChain) &&
    KnownTokenId.isBitcoinToken(toToken)
  ) {
    return getInstantSwapParametersImpl(sdkContext, {
      ...info,
      getInstantSwapTransferProphet: () =>
        getInstantSwapFeeInfo(sdkContext, {
          fromChain,
          fromToken,
          toChain,
          toToken,
        }),
    })
  }

  if (
    KnownChainId.isRunesChain(fromChain) &&
    KnownTokenId.isRunesToken(fromToken) &&
    KnownChainId.isRunesChain(toChain) &&
    KnownTokenId.isRunesToken(toToken)
  ) {
    return getInstantSwapParametersImpl(sdkContext, {
      ...info,
      getInstantSwapTransferProphet: () =>
        getInstantSwapFeeInfo(sdkContext, {
          fromChain,
          fromToken,
          toChain,
          toToken,
        }),
    })
  }

  return undefined
}
