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
  logLevel: "info" | "verbose" | "debug"
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
  if (options.logLevel === "verbose") {
    console.info("[getPossibleEVMDexAggregatorSwapParameters] start", {
      ...info,
      amount: BigNumber.toString(info.amount),
    })
  }

  const res = await _getPossibleEVMDexAggregatorSwapParametersImpl(
    sdkContext,
    info,
    options,
  )

  if (options.logLevel === "verbose") {
    console.info(
      "[getPossibleEVMDexAggregatorSwapParameters] end",
      res.map(r => ({
        ...r,
        fromAmount: BigNumber.toString(r.fromAmount),
      })),
    )
  }

  return res
}

async function _getPossibleEVMDexAggregatorSwapParametersImpl(
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
    if (options.logLevel === "debug") {
      console.debug(
        "[getPossibleEVMDexAggregatorSwapParameters] unsupported from/to chain, return []",
      )
    }
    return []
  }

  const transitStacksChain =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet

  const [fromStacksToken, toStacksToken] = await Promise.all([
    toCorrespondingStacksToken(sdkContext, info.fromChain, info.fromToken),
    toCorrespondingStacksToken(sdkContext, info.toChain, info.toToken),
  ])
  if (fromStacksToken == null || toStacksToken == null) {
    if (options.logLevel === "debug") {
      console.debug(
        "[getPossibleEVMDexAggregatorSwapParameters] cannot find corresponding stacks tokens, return []",
        "fromStacksToken",
        fromStacksToken,
        "toStacksToken",
        toStacksToken,
      )
    }
    return []
  }

  const initialToStacksTransferProphet =
    await info.getInitialToStacksTransferProphet({
      transitStacksChain,
      firstStepToStacksToken: fromStacksToken,
    })
  if (
    initialToStacksTransferProphet == null ||
    (options.ignoreTransferProphetPaused
      ? false
      : initialToStacksTransferProphet.isPaused)
  ) {
    if (options.logLevel === "debug") {
      console.debug(
        "[getPossibleEVMDexAggregatorSwapParameters] initial to-stacks transfer prophet is null or paused, return []",
        JSON.stringify(initialToStacksTransferProphet),
      )
    }
    return []
  }

  return Promise.all(
    possibleSwapOnEVMChains.map(async evmChain => {
      if (options.logLevel === "verbose") {
        console.info(
          "[getPossibleEVMDexAggregatorSwapParameters] checking possible evm dex aggregator swap parameters for",
          evmChain,
        )
      }

      const res = await _getEVMDexAggregatorSwapParametersImpl(
        sdkContext,
        {
          initialToStacksRoute: {
            fromChain: info.fromChain as KnownChainId.BitcoinChain,
            fromToken: info.fromToken as KnownTokenId.BitcoinToken,
            toChain: transitStacksChain,
            toToken: fromStacksToken,
          },
          initialToStacksTransferProphet,
          transitStacksChain,
          fromStacksToken,
          toStacksToken,
          evmChain,
          amount: info.amount,
        },
        {
          ignoreTransferProphetPaused: options.ignoreTransferProphetPaused,
          skipTransferProphetFees: options.skipTransferProphetFees,
          logLevel: options.logLevel,
        },
      )

      if (options.logLevel === "verbose") {
        console.info(
          "[getPossibleEVMDexAggregatorSwapParameters] check evm chain result:",
          evmChain,
          "result:",
          res.map(r => ({
            ...r,
            fromAmount: BigNumber.toString(r.fromAmount),
          })),
        )
      }

      return res
    }),
  ).then(res => res.flat())
}
async function _getEVMDexAggregatorSwapParametersImpl(
  sdkContext: SDKGlobalContext,
  info: {
    initialToStacksRoute: KnownRoute_ToStacks
    initialToStacksTransferProphet: TransferProphet
    transitStacksChain: KnownChainId.StacksChain
    fromStacksToken: KnownTokenId.StacksToken
    toStacksToken: KnownTokenId.StacksToken
    evmChain: KnownChainId.EVMChain
    amount: BigNumber
  },
  options: Required<GetPossibleEVMDexAggregatorSwapParametersImplOptions>,
): Promise<EVMDexAggregatorSwapParameters[]> {
  const { evmChain, transitStacksChain, fromStacksToken, toStacksToken } = info

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
      fromStacksToken,
    ).then(filterOutAvailableTokens),
    evmTokenFromCorrespondingStacksToken(
      sdkContext,
      evmChain,
      toStacksToken,
    ).then(filterOutAvailableTokens),
  ])
  if (!hasAny(possibleFromTokens) || !hasAny(possibleToTokens)) {
    if (options.logLevel === "debug") {
      console.debug(
        "[getPossibleEVMDexAggregatorSwapParameters] no possible from/to evm tokens, return []",
        "possibleFromTokens",
        possibleFromTokens,
        "possibleToTokens",
        possibleToTokens,
      )
    }
    return []
  }

  const fromTokensWithTransferProphet = await Promise.all(
    possibleFromTokens.map(token =>
      getStacks2EvmFeeInfo(
        sdkContext,
        {
          fromChain: transitStacksChain,
          fromToken: fromStacksToken,
          toChain: evmChain,
          toToken: token,
        },
        {
          toDexAggregator: true,
          initialRoute: info.initialToStacksRoute,
        },
      ).then(feeInfo => {
        if (feeInfo == null) {
          if (options.logLevel === "debug") {
            console.debug(
              "[getPossibleEVMDexAggregatorSwapParameters] no transfer prophet for from token",
              token,
            )
          }
          return null
        }

        if (!options.ignoreTransferProphetPaused && feeInfo.isPaused) {
          if (options.logLevel === "debug") {
            console.debug(
              "[getPossibleEVMDexAggregatorSwapParameters] from token transfer prophet is paused",
              token,
              "transferProphet",
              JSON.stringify(feeInfo),
            )
          }
          return null
        }

        if (!isTransferProphetValid(feeInfo, info.amount)) {
          if (options.logLevel === "debug") {
            console.debug(
              "[getPossibleEVMDexAggregatorSwapParameters] from token transfer prophet is not valid",
              token,
              "amount",
              BigNumber.toString(info.amount),
              "transferProphet",
              JSON.stringify(feeInfo),
            )
          }
          return null
        }

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
        toToken: toStacksToken,
      }).then(feeInfo => {
        if (feeInfo == null) {
          if (options.logLevel === "debug") {
            console.debug(
              "[getPossibleEVMDexAggregatorSwapParameters] no transfer prophet for to token",
              token,
            )
          }
          return null
        }

        if (!options.ignoreTransferProphetPaused && feeInfo.isPaused) {
          if (options.logLevel === "debug") {
            console.debug(
              "[getPossibleEVMDexAggregatorSwapParameters] to token transfer prophet is paused",
              token,
              "transferProphet",
              JSON.stringify(feeInfo),
            )
          }
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

  if (
    feeInfo.reserveAmount != null &&
    BigNumber.isLt(feeInfo.reserveAmount, amount)
  ) {
    return false
  }

  return true
}
