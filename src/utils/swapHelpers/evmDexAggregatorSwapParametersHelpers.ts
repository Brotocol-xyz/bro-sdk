import {
  evmTokenFromCorrespondingStacksToken,
  getEvm2StacksFeeInfo,
  getStacks2EvmFeeInfo,
} from "../../evmUtils/peggingHelpers"
import { getEVMTokenContractInfo } from "../../evmUtils/contractHelpers"
import { evmNativeCurrencyAddress } from "../../sdkUtils/types"
import { SDKGlobalContext } from "../../sdkUtils/types.internal"
import { hasAny, last } from "../arrayHelpers"
import { BigNumber } from "../BigNumber"
import {
  KnownRoute_FromBitcoin,
  KnownRoute_FromBRC20,
  KnownRoute_FromRunes,
  KnownRoute_ToStacks,
} from "../buildSupportedRoutes"
import { applyTransferProphets } from "../feeRateHelpers"
import { toCorrespondingStacksToken } from "../SwapRouteHelpers"
import { isNotNull } from "../typeHelpers"
import {
  getChainIdNetworkType,
  KnownChainId,
  KnownTokenId,
} from "../types/knownIds"
import { TransferProphet } from "../types/TransferProphet"

export const possibleSwapOnEVMChains = [
  KnownChainId.EVM.Ethereum,
  KnownChainId.EVM.Base,
  KnownChainId.EVM.Arbitrum,
  KnownChainId.EVM.Linea,
  KnownChainId.EVM.BSC,
  KnownChainId.EVM.Avalanche,
] satisfies KnownChainId.EVMChain[]

export interface EVMDexAggregatorSwapParameters {
  evmChain: KnownChainId.EVMChain
  fromToken: KnownTokenId.EVMToken
  toToken: KnownTokenId.EVMToken
  fromAmount: BigNumber
}

export interface GetPossibleEVMDexAggregatorSwapParametersImplOptions {
  ignoreTransferProphetPaused: boolean
  skipTransferProphetFees: boolean
}

export async function getPossibleEVMDexAggregatorSwapParametersImpl(
  sdkContext: SDKGlobalContext,
  info: (
    | KnownRoute_FromBitcoin
    | KnownRoute_FromBRC20
    | KnownRoute_FromRunes
  ) & {
    amount: BigNumber
    getInitialToStacksTransferProphet: (info: {
      transitStacksChain: KnownChainId.StacksChain
      firstStepToStacksToken: KnownTokenId.StacksToken
    }) => Promise<undefined | TransferProphet>
  },
  options: GetPossibleEVMDexAggregatorSwapParametersImplOptions,
): Promise<EVMDexAggregatorSwapParameters[]> {
  /**
   * currently we only support:
   *
   *  * bitcoin, brc20, runes chain
   *  * most mainnet
   */
  if (
    !(
      (KnownChainId.Bitcoin.Mainnet === info.fromChain ||
        KnownChainId.BRC20.Mainnet === info.fromChain ||
        KnownChainId.Runes.Mainnet === info.fromChain) &&
      (KnownChainId.isEVMMainnetChain(info.toChain) ||
        KnownChainId.Stacks.Mainnet === info.toChain ||
        KnownChainId.Bitcoin.Mainnet === info.toChain ||
        KnownChainId.BRC20.Mainnet === info.toChain ||
        KnownChainId.Runes.Mainnet === info.toChain)
    )
  ) {
    return []
  }

  const { ignoreTransferProphetPaused, skipTransferProphetFees } = options

  const transitStacksChain =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet

  const [firstStepToStacksToken, lastStepFromStacksToken] = await Promise.all([
    toCorrespondingStacksToken(sdkContext, info.fromChain, info.fromToken),
    toCorrespondingStacksToken(sdkContext, info.toChain, info.toToken),
  ])
  if (firstStepToStacksToken == null || lastStepFromStacksToken == null) {
    return []
  }

  const initialToStacksTransferProphet =
    await info.getInitialToStacksTransferProphet({
      transitStacksChain,
      firstStepToStacksToken,
    })
  if (
    initialToStacksTransferProphet == null ||
    (ignoreTransferProphetPaused
      ? false
      : initialToStacksTransferProphet.isPaused)
  ) {
    return []
  }

  return Promise.all(
    possibleSwapOnEVMChains.map(async evmChain =>
      _getEVMDexAggregatorSwapParametersImpl(
        sdkContext,
        {
          initialToStacksRoute: {
            fromChain: info.fromChain as KnownChainId.BitcoinChain,
            fromToken: info.fromToken as KnownTokenId.BitcoinToken,
            toChain: transitStacksChain,
            toToken: firstStepToStacksToken,
          },
          initialToStacksTransferProphet,
          transitStacksChain,
          firstStepToStacksToken,
          lastStepFromStacksToken,
          evmChain,
          amount: info.amount,
        },
        {
          ignoreTransferProphetPaused,
          skipTransferProphetFees,
        },
      ),
    ),
  ).then(res => res.flat())
}
async function _getEVMDexAggregatorSwapParametersImpl(
  sdkContext: SDKGlobalContext,
  info: {
    initialToStacksRoute: KnownRoute_ToStacks
    initialToStacksTransferProphet: TransferProphet
    transitStacksChain: KnownChainId.StacksChain
    firstStepToStacksToken: KnownTokenId.StacksToken
    lastStepFromStacksToken: KnownTokenId.StacksToken
    evmChain: KnownChainId.EVMChain
    amount: BigNumber
  },
  options: Required<GetPossibleEVMDexAggregatorSwapParametersImplOptions>,
): Promise<EVMDexAggregatorSwapParameters[]> {
  const {
    evmChain,
    transitStacksChain,
    firstStepToStacksToken,
    lastStepFromStacksToken,
  } = info

  const filterOutAvailableTokens = async (
    tokens: KnownTokenId.EVMToken[],
  ): Promise<KnownTokenId.EVMToken[]> => {
    return Promise.all(
      tokens.map(token =>
        getEVMTokenContractInfo(sdkContext, evmChain, token).then(res =>
          res == null || res.tokenContractAddress === evmNativeCurrencyAddress
            ? null
            : token,
        ),
      ),
    ).then(infos => infos.filter(isNotNull))
  }
  const [possibleFromTokens, possibleToTokens] = await Promise.all([
    evmTokenFromCorrespondingStacksToken(
      sdkContext,
      evmChain,
      firstStepToStacksToken,
    ).then(filterOutAvailableTokens),
    evmTokenFromCorrespondingStacksToken(
      sdkContext,
      evmChain,
      lastStepFromStacksToken,
    ).then(filterOutAvailableTokens),
  ])
  if (!hasAny(possibleFromTokens) || !hasAny(possibleToTokens)) return []

  const fromTokensWithTransferProphet = await Promise.all(
    possibleFromTokens.map(token =>
      getStacks2EvmFeeInfo(
        sdkContext,
        {
          fromChain: transitStacksChain,
          fromToken: firstStepToStacksToken,
          toChain: evmChain,
          toToken: token,
        },
        {
          toDexAggregator: true,
          initialRoute: info.initialToStacksRoute,
        },
      ).then(feeInfo => {
        if (feeInfo == null) return null

        if (!options.ignoreTransferProphetPaused && feeInfo.isPaused) {
          return null
        }

        if (!isTransferProphetValid(feeInfo, info.amount)) return null

        return { token, transferProphet: feeInfo }
      }),
    ),
  ).then(infos => infos.filter(isNotNull))

  const toTokens = await Promise.all(
    possibleToTokens.map(token =>
      getEvm2StacksFeeInfo(sdkContext, {
        fromChain: evmChain,
        fromToken: token,
        toChain: transitStacksChain,
        toToken: lastStepFromStacksToken,
      }).then(feeInfo => {
        if (feeInfo == null) return null

        if (!options.ignoreTransferProphetPaused && feeInfo.isPaused) {
          return null
        }

        /**
         * we can not compare the amount with the max/min bridge amount here,
         * since we can not know the swapped amount here
         */

        return token
      }),
    ),
  ).then(tokens => tokens.filter(isNotNull))

  const results: EVMDexAggregatorSwapParameters[] = []
  for (const fromToken of fromTokensWithTransferProphet) {
    for (const toToken of toTokens) {
      let fromAmount = info.amount
      if (!options.skipTransferProphetFees) {
        const feeInfos = [
          info.initialToStacksTransferProphet,
          fromToken.transferProphet,
        ] as const
        fromAmount = last(
          applyTransferProphets(feeInfos, BigNumber.from(info.amount)),
        ).netAmount
      }

      results.push({
        evmChain,
        fromToken: fromToken.token,
        toToken,
        fromAmount,
      })
    }
  }
  return results
}

function isTransferProphetValid(
  feeInfo: TransferProphet,
  amount: BigNumber,
): boolean {
  if (
    feeInfo.minBridgeAmount != null &&
    BigNumber.isLt(amount, feeInfo.minBridgeAmount)
  ) {
    return false
  }

  if (
    feeInfo.maxBridgeAmount != null &&
    BigNumber.isGt(amount, feeInfo.maxBridgeAmount)
  ) {
    return false
  }

  return true
}
