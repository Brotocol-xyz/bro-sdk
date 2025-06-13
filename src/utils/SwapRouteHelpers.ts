import { EVM_BARE_PEG_IN_USE_SWAP_CONTRACT } from "../config"
import { evmTokenToCorrespondingStacksToken } from "../evmUtils/peggingHelpers"
import { metaTokenToCorrespondingStacksToken } from "../metaUtils/peggingHelpers"
import { tronTokenToCorrespondingStacksToken } from "../tronUtils/peggingHelpers"
import { solanaTokenToCorrespondingStacksToken } from "../solanaUtils/peggingHelpers"
import { StacksContractName } from "../stacksUtils/stxContractAddresses"
import {
  executeReadonlyCallBro,
  getStacksContractCallInfo,
  getStacksToken,
  numberFromStacksContractNumber,
} from "../stacksUtils/contractHelpers"
import { SDKNumber, StacksContractAddress } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { last } from "./arrayHelpers"
import { BigNumber } from "./BigNumber"
import {
  KnownRoute,
  KnownRoute_FromStacks,
  KnownRoute_ToStacks,
} from "./buildSupportedRoutes"
import { props } from "./promiseHelpers"
import { checkNever, OneOrMore } from "./typeHelpers"
import { KnownChainId, KnownTokenId } from "./types/knownIds"

// ----------- SwapRouteViaALEX start -----------

export interface SwapRouteViaALEX {
  via: "ALEX"
  fromTokenAddress: StacksContractAddress
  swapPools: OneOrMore<{
    poolId: bigint
    toTokenAddress: StacksContractAddress
  }>
}

export interface SwapRouteViaALEX_WithExchangeRate extends SwapRouteViaALEX {
  composedExchangeRate: BigNumber
}
export interface SwapRouteViaALEX_WithExchangeRate_Public
  extends SwapRouteViaALEX {
  composedExchangeRate: SDKNumber
}

export interface SwapRouteViaALEX_WithMinimumAmountsToReceive
  extends SwapRouteViaALEX {
  minimumAmountsToReceive: BigNumber
}
export interface SwapRouteViaALEX_WithMinimumAmountsToReceive_Public
  extends SwapRouteViaALEX {
  minimumAmountsToReceive: SDKNumber
}

// ----------- SwapRouteViaALEX end -----------

// ----------- SwapRouteViaEVMDexAggregator start -----------

export interface SwapRouteViaEVMDexAggregator {
  via: "evmDexAggregator"
  evmChain: KnownChainId.EVMChain
  fromEVMToken: KnownTokenId.EVMToken
  toEVMToken: KnownTokenId.EVMToken
  expiredAt?: null | Date
}

export interface SwapRouteViaEVMDexAggregator_WithExchangeRate
  extends SwapRouteViaEVMDexAggregator {
  composedExchangeRate: BigNumber
}
export interface SwapRouteViaEVMDexAggregator_WithExchangeRate_Public
  extends SwapRouteViaEVMDexAggregator {
  composedExchangeRate: SDKNumber
}

export interface SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive
  extends SwapRouteViaEVMDexAggregator {
  minimumAmountsToReceive: BigNumber
}
export interface SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public
  extends SwapRouteViaEVMDexAggregator {
  minimumAmountsToReceive: SDKNumber
}

// ----------- SwapRouteViaEVMDexAggregator end -----------

// ----------- SwapRoute start -----------

export type SwapRoute = SwapRouteViaALEX | SwapRouteViaEVMDexAggregator

export type SwapRoute_WithExchangeRate =
  | SwapRouteViaALEX_WithExchangeRate
  | SwapRouteViaEVMDexAggregator_WithExchangeRate

export type SwapRoute_WithExchangeRate_Public =
  | SwapRouteViaALEX_WithExchangeRate_Public
  | SwapRouteViaEVMDexAggregator_WithExchangeRate_Public

export type SwapRoute_WithMinimumAmountsToReceive =
  | SwapRouteViaALEX_WithMinimumAmountsToReceive
  | SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive

export type SwapRoute_WithMinimumAmountsToReceive_Public =
  | SwapRouteViaALEX_WithMinimumAmountsToReceive_Public
  | SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public

// ----------- SwapRoute end -----------

export async function getFirstStepStacksTokenAddress(
  sdkContext: SDKGlobalContext,
  info:
    | {
        via: SwapRouteViaALEX["via"]
        swap: SwapRouteViaALEX
        stacksChain: KnownChainId.StacksChain
      }
    | {
        via: SwapRouteViaEVMDexAggregator["via"]
        swap: SwapRouteViaEVMDexAggregator
      },
): Promise<undefined | KnownTokenId.StacksToken> {
  if (info.via === "ALEX") {
    return getStacksToken(
      sdkContext,
      info.stacksChain,
      info.swap.fromTokenAddress,
    )
  } else if (info.via === "evmDexAggregator") {
    return evmTokenToCorrespondingStacksToken(
      sdkContext,
      info.swap.evmChain,
      info.swap.fromEVMToken,
    )
  } else {
    checkNever(info)
    return undefined
  }
}

export async function getFinalStepStacksTokenAddress(
  sdkContext: SDKGlobalContext,
  info:
    | {
        via: SwapRouteViaALEX["via"]
        swap: SwapRouteViaALEX
        stacksChain: KnownChainId.StacksChain
      }
    | {
        via: SwapRouteViaEVMDexAggregator["via"]
        swap: SwapRouteViaEVMDexAggregator
      },
): Promise<undefined | KnownTokenId.StacksToken> {
  if (info.via === "ALEX") {
    return getStacksToken(
      sdkContext,
      info.stacksChain,
      last(info.swap.swapPools).toTokenAddress,
    )
  } else if (info.via === "evmDexAggregator") {
    return evmTokenToCorrespondingStacksToken(
      sdkContext,
      info.swap.evmChain,
      info.swap.toEVMToken,
    )
  } else {
    checkNever(info)
    return undefined
  }
}

export async function getAndCheckTransitStacksTokens(
  ctx: SDKGlobalContext,
  info: KnownRoute & {
    swapRoute?: SwapRoute
  },
): Promise<null | {
  firstStepToStacksToken: KnownTokenId.StacksToken
  lastStepFromStacksToken: KnownTokenId.StacksToken
}> {
  let swapStartTokenPromise: Promise<undefined | KnownTokenId.StacksToken> =
    Promise.resolve(undefined)
  let swapEndTokenPromise: Promise<undefined | KnownTokenId.StacksToken> =
    Promise.resolve(undefined)
  if (info.swapRoute == null) {
    // do nothing
  } else if (info.swapRoute.via === "ALEX") {
    const stacksChain = await toCorrespondingStacksChain(info.fromChain)
    if (stacksChain == null) return null

    swapStartTokenPromise = getFirstStepStacksTokenAddress(ctx, {
      via: "ALEX",
      swap: info.swapRoute,
      stacksChain,
    })
    swapEndTokenPromise = getFinalStepStacksTokenAddress(ctx, {
      via: "ALEX",
      swap: info.swapRoute,
      stacksChain,
    })
  } else if (info.swapRoute.via === "evmDexAggregator") {
    swapStartTokenPromise = getFirstStepStacksTokenAddress(ctx, {
      via: "evmDexAggregator",
      swap: info.swapRoute,
    })
    swapEndTokenPromise = getFinalStepStacksTokenAddress(ctx, {
      via: "evmDexAggregator",
      swap: info.swapRoute,
    })
  } else {
    checkNever(info.swapRoute)
  }

  const [
    firstStepToStacksToken,
    lastStepFromStacksToken,
    swapStartToken,
    swapEndToken,
  ] = await Promise.all([
    toCorrespondingStacksToken(ctx, info.fromChain, info.fromToken),
    toCorrespondingStacksToken(ctx, info.toChain, info.toToken),
    swapStartTokenPromise,
    swapEndTokenPromise,
  ])

  if (firstStepToStacksToken == null || lastStepFromStacksToken == null) {
    return null
  }

  if (info.swapRoute == null) {
    if (firstStepToStacksToken !== lastStepFromStacksToken) {
      return null
    }
  } else {
    if (
      swapStartToken !== firstStepToStacksToken ||
      swapEndToken !== lastStepFromStacksToken
    ) {
      return null
    }
  }

  return {
    firstStepToStacksToken,
    lastStepFromStacksToken,
  }
}

async function toCorrespondingStacksChain(
  chain: KnownChainId.KnownChain,
): Promise<undefined | KnownChainId.StacksChain> {
  if (KnownChainId.isStacksChain(chain)) {
    return chain
  }

  if (KnownChainId.isEVMMainnetChain(chain)) {
    return KnownChainId.Stacks.Mainnet
  }
  if (KnownChainId.isEVMTestnetChain(chain)) {
    return KnownChainId.Stacks.Testnet
  }

  if (chain === KnownChainId.Bitcoin.Mainnet) {
    return KnownChainId.Stacks.Mainnet
  }
  if (chain === KnownChainId.Bitcoin.Testnet) {
    return KnownChainId.Stacks.Testnet
  }

  if (chain === KnownChainId.BRC20.Mainnet) {
    return KnownChainId.Stacks.Mainnet
  }
  if (chain === KnownChainId.BRC20.Testnet) {
    return KnownChainId.Stacks.Testnet
  }

  if (chain === KnownChainId.Runes.Mainnet) {
    return KnownChainId.Stacks.Mainnet
  }
  if (chain === KnownChainId.Runes.Testnet) {
    return KnownChainId.Stacks.Testnet
  }

  if (chain === KnownChainId.Tron.Mainnet) {
    return KnownChainId.Stacks.Mainnet
  }
  if (chain === KnownChainId.Tron.Testnet) {
    return KnownChainId.Stacks.Testnet
  }

  if (chain === KnownChainId.Solana.Mainnet) {
    return KnownChainId.Stacks.Mainnet
  }
  if (chain === KnownChainId.Solana.Testnet) {
    return KnownChainId.Stacks.Testnet
  }

  checkNever(chain)
  return undefined
}

export async function toCorrespondingStacksToken(
  ctx: SDKGlobalContext,
  chain: KnownChainId.KnownChain,
  token: KnownTokenId.KnownToken,
): Promise<undefined | KnownTokenId.StacksToken> {
  let toStacksTokenPromise:
    | undefined
    | Promise<undefined | KnownTokenId.StacksToken>

  if (KnownChainId.isBitcoinChain(chain)) {
    if (token === KnownTokenId.Bitcoin.BTC) {
      toStacksTokenPromise = Promise.resolve(KnownTokenId.Stacks.aBTC)
    }
  } else if (KnownChainId.isBRC20Chain(chain)) {
    if (KnownTokenId.isBRC20Token(token)) {
      toStacksTokenPromise = metaTokenToCorrespondingStacksToken(ctx, {
        chain: chain as KnownChainId.BRC20Chain,
        token: token as KnownTokenId.BRC20Token,
      })
    }
  } else if (KnownChainId.isRunesChain(chain)) {
    if (KnownTokenId.isRunesToken(token)) {
      toStacksTokenPromise = metaTokenToCorrespondingStacksToken(ctx, {
        chain: chain as KnownChainId.RunesChain,
        token: token as KnownTokenId.RunesToken,
      })
    }
  } else if (KnownChainId.isEVMChain(chain)) {
    if (KnownTokenId.isEVMToken(token)) {
      toStacksTokenPromise = evmTokenToCorrespondingStacksToken(
        ctx,
        chain,
        token,
      )
    }
  } else if (KnownChainId.isStacksChain(chain)) {
    if (KnownTokenId.isStacksToken(token)) {
      toStacksTokenPromise = Promise.resolve(token)
    }
  } else if (KnownChainId.isTronChain(chain)) {
    if (KnownTokenId.isTronToken(token)) {
      toStacksTokenPromise = tronTokenToCorrespondingStacksToken(ctx, chain, token)
    }
  } else if (KnownChainId.isSolanaChain(chain)) {
    if (KnownTokenId.isSolanaToken(token)) {
      toStacksTokenPromise = solanaTokenToCorrespondingStacksToken(ctx, chain, token)
    }
  } else {
    checkNever(chain)
  }

  return toStacksTokenPromise
}

export interface SpecialFeeDetailsForSwapRoute {
  feeRate: BigNumber
  minFeeAmount: BigNumber
  gasFee?: { token: KnownTokenId.KnownToken; amount: BigNumber }
}
export async function getSpecialFeeDetailsForSwapRoute(
  ctx: SDKGlobalContext,
  route: KnownRoute_FromStacks,
  options: {
    /**
     * The entry route step that triggered the Stacks transaction.
     * It's crucial for correctly calculating fees in multi-step bridging
     * processes.
     *
     * Examples:
     *
     * * BTC > Runes (`via: ALEX`):
     *     1. btc > stacks (initialRoute)
     *     2. stacks > runes
     * * BTC > Runes (`via: evmDexAggregator`):
     *     1. btc > stacks (initialRoute as well, but not what we want)
     *     2. stacks > evm
     *     3. evm swap
     *     4. evm > stacks (initialRoute for this partition)
     *     5. stacks > runes
     */
    initialRoute: null | KnownRoute_ToStacks
    /**
     * the swap step between the previous route and the current one
     */
    swapRoute: null | Pick<SwapRoute, "via">
  },
): Promise<undefined | SpecialFeeDetailsForSwapRoute> {
  let feeInfo: undefined | SpecialFeeDetailsForSwapRoute
  if (options.initialRoute != null) {
    if (
      options.swapRoute == null ||
      options.swapRoute.via === "evmDexAggregator"
    ) {
      /**
       * most of the bare peg in contract doesn't yet support this feature
       */
      if (!EVM_BARE_PEG_IN_USE_SWAP_CONTRACT) return

      const evmPegInContractCallInfo = getStacksContractCallInfo(
        route.fromChain,
        StacksContractName.EVMPegInEndpointSwap,
      )
      if (evmPegInContractCallInfo == null) {
        return
      }

      return getFeeInfo(
        {
          fromEVM: {
            getFeeRate: () =>
              executeReadonlyCallBro(
                evmPegInContractCallInfo.contractName,
                "get-peg-out-fee",
                {},
                evmPegInContractCallInfo.executeOptions,
              ).then(numberFromStacksContractNumber),
            getFixedFeeAmount: () =>
              executeReadonlyCallBro(
                evmPegInContractCallInfo.contractName,
                "get-peg-out-gas-fee",
                {},
                evmPegInContractCallInfo.executeOptions,
              ).then(numberFromStacksContractNumber),
          },
        },
        {
          initialRoute: options.initialRoute,
        },
      )
    } else if (options.swapRoute.via === "ALEX") {
      const btcPegInSwapContractCallInfo = getStacksContractCallInfo(
        route.fromChain,
        StacksContractName.BTCPegInEndpointSwap,
      )
      const metaPegInSwapContractCallInfo = getStacksContractCallInfo(
        route.fromChain,
        StacksContractName.MetaPegInEndpointSwap,
      )
      const evmPegInSwapContractCallInfo = getStacksContractCallInfo(
        route.fromChain,
        StacksContractName.EVMPegInEndpointSwap,
      )

      if (
        btcPegInSwapContractCallInfo == null ||
        metaPegInSwapContractCallInfo == null ||
        evmPegInSwapContractCallInfo == null
      ) {
        return
      }

      return getFeeInfo(
        {
          fromBitcoin: {
            getFeeRate: () =>
              executeReadonlyCallBro(
                btcPegInSwapContractCallInfo.contractName,
                "get-peg-out-fee",
                {},
                btcPegInSwapContractCallInfo.executeOptions,
              ).then(numberFromStacksContractNumber),
            getFixedFeeAmount: () =>
              executeReadonlyCallBro(
                btcPegInSwapContractCallInfo.contractName,
                "get-peg-out-gas-fee",
                {},
                btcPegInSwapContractCallInfo.executeOptions,
              ).then(numberFromStacksContractNumber),
          },
          fromMeta: {
            getFeeRate: () =>
              executeReadonlyCallBro(
                metaPegInSwapContractCallInfo.contractName,
                "get-peg-out-fee",
                {},
                metaPegInSwapContractCallInfo.executeOptions,
              ).then(numberFromStacksContractNumber),
            getFixedFeeAmount: () =>
              executeReadonlyCallBro(
                metaPegInSwapContractCallInfo.contractName,
                "get-peg-out-gas-fee",
                {},
                metaPegInSwapContractCallInfo.executeOptions,
              ).then(numberFromStacksContractNumber),
          },
          fromEVM: {
            getFeeRate: () =>
              executeReadonlyCallBro(
                evmPegInSwapContractCallInfo.contractName,
                "get-peg-out-fee",
                {},
                evmPegInSwapContractCallInfo.executeOptions,
              ).then(numberFromStacksContractNumber),
            getFixedFeeAmount: () =>
              executeReadonlyCallBro(
                evmPegInSwapContractCallInfo.contractName,
                "get-peg-out-gas-fee",
                {},
                evmPegInSwapContractCallInfo.executeOptions,
              ).then(numberFromStacksContractNumber),
          },
        },
        {
          initialRoute: options.initialRoute,
        },
      )
    } else {
      checkNever(options.swapRoute.via)
    }
  }

  if (feeInfo == null) return undefined

  return props(feeInfo)

  async function getFeeInfo(
    context: {
      fromBitcoin?: {
        getFeeRate: () => Promise<BigNumber>
        getFixedFeeAmount: () => Promise<BigNumber>
      }
      fromMeta?: {
        getFeeRate: () => Promise<BigNumber>
        getFixedFeeAmount: () => Promise<BigNumber>
      }
      fromEVM?: {
        getFeeRate: () => Promise<BigNumber>
        getFixedFeeAmount: () => Promise<BigNumber>
      }
    },
    options: {
      initialRoute: KnownRoute_ToStacks
    },
  ): Promise<undefined | SpecialFeeDetailsForSwapRoute> {
    let feeInfo: undefined | SpecialFeeDetailsForSwapRoute

    if (KnownChainId.isBitcoinChain(options.initialRoute.fromChain)) {
      if (context.fromBitcoin == null) return

      const feeRate = context.fromBitcoin.getFeeRate()

      let minFeeAmount: Promise<SpecialFeeDetailsForSwapRoute["minFeeAmount"]> =
        Promise.resolve(BigNumber.ZERO)

      let gasFee: Promise<SpecialFeeDetailsForSwapRoute["gasFee"]> =
        Promise.resolve(undefined)

      if (
        KnownChainId.isBitcoinChain(route.toChain) ||
        KnownChainId.isBRC20Chain(route.toChain) ||
        KnownChainId.isRunesChain(route.toChain)
      ) {
        gasFee = context.fromBitcoin.getFixedFeeAmount().then(amount =>
          props({
            token: KnownTokenId.Bitcoin.BTC,
            amount,
          }),
        )
      } else if (KnownChainId.isEVMChain(route.toChain)) {
        minFeeAmount = context.fromBitcoin.getFixedFeeAmount()
      } else if (KnownChainId.isSolanaChain(route.toChain)) {
        // Solana fee handling not yet implemented
        minFeeAmount = context.fromBitcoin.getFixedFeeAmount()
      } else if (KnownChainId.isTronChain(route.toChain)) {
        // Tron fee handling not yet implemented
        minFeeAmount = context.fromBitcoin.getFixedFeeAmount()
      } else {
        checkNever(route.toChain)
      }

      feeInfo = await props({
        feeRate,
        minFeeAmount,
        gasFee,
      })
    } else if (
      KnownChainId.isBRC20Chain(options.initialRoute.fromChain) ||
      KnownChainId.isRunesChain(options.initialRoute.fromChain)
    ) {
      if (context.fromMeta == null) return

      const feeRate = context.fromMeta.getFeeRate()

      let minFeeAmount: Promise<SpecialFeeDetailsForSwapRoute["minFeeAmount"]> =
        Promise.resolve(BigNumber.ZERO)

      let gasFee: Promise<SpecialFeeDetailsForSwapRoute["gasFee"]> =
        Promise.resolve(undefined)

      if (
        KnownChainId.isBitcoinChain(route.toChain) ||
        KnownChainId.isBRC20Chain(route.toChain) ||
        KnownChainId.isRunesChain(route.toChain)
      ) {
        gasFee = context.fromMeta.getFixedFeeAmount().then(amount =>
          props({
            token: KnownTokenId.Bitcoin.BTC,
            amount,
          }),
        )
      } else if (KnownChainId.isEVMChain(route.toChain)) {
        minFeeAmount = context.fromMeta.getFixedFeeAmount()
      } else if (KnownChainId.isSolanaChain(route.toChain)) {
        // Solana fee handling not yet implemented
        minFeeAmount = context.fromMeta.getFixedFeeAmount()
      } else if (KnownChainId.isTronChain(route.toChain)) {
        // Tron fee handling not yet implemented
        minFeeAmount = context.fromMeta.getFixedFeeAmount()
      } else {
        checkNever(route.toChain)
      }

      feeInfo = await props({
        feeRate,
        minFeeAmount,
        gasFee,
      })
    } else if (KnownChainId.isEVMChain(options.initialRoute.fromChain)) {
      if (context.fromEVM == null) return

      const feeRate = context.fromEVM.getFeeRate()

      let minFeeAmount: Promise<SpecialFeeDetailsForSwapRoute["minFeeAmount"]> =
        Promise.resolve(BigNumber.ZERO)

      let gasFee: Promise<SpecialFeeDetailsForSwapRoute["gasFee"]> =
        Promise.resolve(undefined)

      if (
        KnownChainId.isBitcoinChain(route.toChain) ||
        KnownChainId.isBRC20Chain(route.toChain) ||
        KnownChainId.isRunesChain(route.toChain)
      ) {
        gasFee = context.fromEVM.getFixedFeeAmount().then(amount =>
          props({
            token: KnownTokenId.Bitcoin.BTC,
            amount,
          }),
        )
      } else if (KnownChainId.isEVMChain(route.toChain)) {
        minFeeAmount = context.fromEVM.getFixedFeeAmount()
      } else if (KnownChainId.isSolanaChain(route.toChain)) {
        // Solana fee handling not yet implemented
        minFeeAmount = context.fromEVM.getFixedFeeAmount()
      } else if (KnownChainId.isTronChain(route.toChain)) {
        // Tron fee handling not yet implemented
        minFeeAmount = context.fromEVM.getFixedFeeAmount()
      } else {
        checkNever(route.toChain)
      }

      feeInfo = await props({
        feeRate,
        minFeeAmount,
        gasFee,
      })
    } else if (KnownChainId.isSolanaChain(options.initialRoute.fromChain)) {
      // Solana swap route fee handling not yet implemented
      return
    } else if (KnownChainId.isTronChain(options.initialRoute.fromChain)) {
      // Tron swap route fee handling not yet implemented
      return
    } else {
      checkNever(options.initialRoute.fromChain)
    }

    return feeInfo
  }
}
