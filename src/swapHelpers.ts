import {
  getALEXSwapParameters_FromBitcoin,
  getInstantSwapParameters_FromBitcoin,
  getPossibleEVMDexAggregatorSwapParameters_FromBitcoin,
} from "./bitcoinUtils/swapHelpers"
import { BroSDK } from "./BroSDK"
import { getALEXSwapParameters_FromEVM } from "./evmUtils/swapHelpers"
import { getSDKContext } from "./lowlevelUnstableInfos"
import {
  getALEXSwapParameters_FromMeta,
  getInstantSwapParameters_FromMeta,
  getPossibleEVMDexAggregatorSwapParameters_FromMeta,
} from "./metaUtils/swapHelpers"
import { SDKNumber, toSDKNumberOrUndefined } from "./sdkUtils/types"
import { getALEXSwapParameters_FromSolana } from "./solanaUtils/swapHelpers"
import { BigNumber } from "./utils/BigNumber"
import { KnownRoute } from "./utils/buildSupportedRoutes"
import { ALEXSwapParameters as _ALEXSwapParameters } from "./utils/swapHelpers/alexSwapParametersHelpers"
import {
  EVMDexAggregatorSwapParameters as _EVMDexAggregatorSwapParameters,
  GetPossibleEVMDexAggregatorSwapParametersImplOptions,
} from "./utils/swapHelpers/evmDexAggregatorSwapParametersHelpers"
import { FetchRoutesImpl } from "./utils/swapHelpers/fetchDexAggregatorPossibleRoutes/helpers"
import {
  DexAggregatorRoute as _DexAggregatorRoute,
  getDexAggregatorRoutes as _getDexAggregatorRoutes,
} from "./utils/swapHelpers/getDexAggregatorRoutes"
import { InstantSwapParameters as _InstantSwapParameters } from "./utils/swapHelpers/instantSwapParametersHelpers"
import { checkNever } from "./utils/typeHelpers"
import { KnownChainId, KnownTokenId } from "./utils/types/knownIds"

export {
  fetchIceScreamSwapPossibleRoutesFactory,
  FetchIceScreamSwapPossibleRoutesFailedError,
} from "./utils/swapHelpers/fetchDexAggregatorPossibleRoutes/fetchIceScreamSwapPossibleRoutes"
export {
  fetchKyberSwapPossibleRoutesFactory,
  FetchKyberSwapPossibleRoutesFailedError,
} from "./utils/swapHelpers/fetchDexAggregatorPossibleRoutes/fetchKyberSwapPossibleRoutes"
export {
  fetchMatchaPossibleRoutesFactory,
  FetchMatchaPossibleRoutesFailedError,
} from "./utils/swapHelpers/fetchDexAggregatorPossibleRoutes/fetchMatchaPossibleRoutes"
export { FetchRoutesImpl } from "./utils/swapHelpers/fetchDexAggregatorPossibleRoutes/helpers"

export interface DexAggregatorRoute
  extends Omit<_DexAggregatorRoute, "fromAmount" | "toAmount"> {
  fromAmount: SDKNumber
  toAmount: SDKNumber
}

export function getDexAggregatorRoutes(
  sdk: BroSDK,
  info: {
    routeFetcher: FetchRoutesImpl
    routes: {
      evmChain: KnownChainId.EVMChain
      fromToken: KnownTokenId.EVMToken
      toToken: KnownTokenId.EVMToken
      amount: SDKNumber
    }[]
  },
): Promise<DexAggregatorRoute[]> {
  return _getDexAggregatorRoutes(getSDKContext(sdk), {
    routeFetcher: info.routeFetcher,
    routes: info.routes.map(r => ({
      evmChain: r.evmChain,
      fromToken: r.fromToken,
      toToken: r.toToken,
      amount: BigNumber.from(r.amount),
    })),
  }).then(res =>
    res.map(r => ({
      ...r,
      fromAmount: toSDKNumberOrUndefined(r.fromAmount),
      toAmount: toSDKNumberOrUndefined(r.toAmount),
    })),
  )
}

export interface ALEXSwapParameters
  extends Omit<_ALEXSwapParameters, "fromAmount"> {
  fromAmount: SDKNumber
}
/**
 * This function retrieves the necessary parameters for performing an ALEX swap.
 * It provides the required details to proceed with an ALEX swap, such as the
 * tokens involved, and the amount to be swapped.
 *
 * @param sdk - The BroSDK instance
 * @param info - The entire bridging route
 */
export async function getALEXSwapParameters(
  sdk: BroSDK,
  info: KnownRoute & {
    amount: SDKNumber
  },
): Promise<undefined | ALEXSwapParameters> {
  let params: undefined | _ALEXSwapParameters

  if (KnownChainId.isStacksChain(info.fromChain)) {
    return
  } else if (KnownChainId.isEVMChain(info.fromChain)) {
    if (!KnownTokenId.isEVMToken(info.fromToken)) return
    params = await getALEXSwapParameters_FromEVM(getSDKContext(sdk), {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
      toChain: info.toChain as any,
      toToken: info.toToken as any,
      amount: BigNumber.from(info.amount),
    })
  } else if (KnownChainId.isBitcoinChain(info.fromChain)) {
    if (!KnownTokenId.isBitcoinToken(info.fromToken)) return
    params = await getALEXSwapParameters_FromBitcoin(getSDKContext(sdk), {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
      toChain: info.toChain as any,
      toToken: info.toToken as any,
      amount: BigNumber.from(info.amount),
    })
  } else if (KnownChainId.isBRC20Chain(info.fromChain)) {
    if (!KnownTokenId.isBRC20Token(info.fromToken)) return
    params = await getALEXSwapParameters_FromMeta(getSDKContext(sdk), {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
      toChain: info.toChain as any,
      toToken: info.toToken as any,
      amount: BigNumber.from(info.amount),
    })
  } else if (KnownChainId.isRunesChain(info.fromChain)) {
    if (!KnownTokenId.isRunesToken(info.fromToken)) return
    params = await getALEXSwapParameters_FromMeta(getSDKContext(sdk), {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
      toChain: info.toChain as any,
      toToken: info.toToken as any,
      amount: BigNumber.from(info.amount),
    })
  } else if (KnownChainId.isSolanaChain(info.fromChain)) {
    if (!KnownTokenId.isSolanaToken(info.fromToken)) return
    params = await getALEXSwapParameters_FromSolana(getSDKContext(sdk), {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
      toChain: info.toChain as any,
      toToken: info.toToken as any,
      amount: BigNumber.from(info.amount),
    })
  } else if (KnownChainId.isTronChain(info.fromChain)) {
    // Tron swap parameters not yet implemented
    return
  } else {
    checkNever(info.fromChain)
  }

  if (params == null) return

  return {
    ...params,
    fromAmount: toSDKNumberOrUndefined(params.fromAmount),
  }
}

export interface EVMDexAggregatorSwapParameters
  extends Omit<_EVMDexAggregatorSwapParameters, "fromAmount"> {
  fromAmount: SDKNumber
}
/**
 * Retrieves the parameters for a swap via an EVM DEX aggregator.
 *
 * This function calculates and returns the necessary parameters for executing
 * a swap through the aggregator
 *
 * @param sdk - The BroSDK instance used for interacting with the blockchain.
 * @param info - The entire bridging route
 */
export async function getPossibleEVMDexAggregatorSwapParameters(
  sdk: BroSDK,
  info: KnownRoute & {
    amount: SDKNumber
  },
  options: {
    ignoreTransferProphetPaused?: boolean
    skipTransferProphetFees?: boolean
    logLevel?: GetPossibleEVMDexAggregatorSwapParametersImplOptions["logLevel"]
  } = {},
): Promise<EVMDexAggregatorSwapParameters[]> {
  const {
    ignoreTransferProphetPaused = false,
    skipTransferProphetFees = false,
    logLevel = "info",
  } = options

  if (KnownChainId.isStacksChain(info.fromChain)) {
    return []
  }

  if (KnownChainId.isEVMChain(info.fromChain)) {
    return []
  }

  if (KnownChainId.isBitcoinChain(info.fromChain)) {
    if (!KnownTokenId.isBitcoinToken(info.fromToken)) return []

    const res = await getPossibleEVMDexAggregatorSwapParameters_FromBitcoin(
      getSDKContext(sdk),
      {
        fromChain: info.fromChain,
        fromToken: info.fromToken,
        toChain: info.toChain as any,
        toToken: info.toToken as any,
        amount: BigNumber.from(info.amount),
      },
      {
        ignoreTransferProphetPaused,
        skipTransferProphetFees,
        logLevel,
      },
    )
    if (res == null) return []

    return res.map(
      (r): EVMDexAggregatorSwapParameters => ({
        ...r,
        fromAmount: toSDKNumberOrUndefined(r.fromAmount),
      }),
    )
  }

  if (KnownChainId.isBRC20Chain(info.fromChain)) {
    if (!KnownTokenId.isBRC20Token(info.fromToken)) return []

    const res = await getPossibleEVMDexAggregatorSwapParameters_FromMeta(
      getSDKContext(sdk),
      {
        fromChain: info.fromChain,
        fromToken: info.fromToken,
        toChain: info.toChain as any,
        toToken: info.toToken as any,
        amount: BigNumber.from(info.amount),
      },
      {
        ignoreTransferProphetPaused,
        skipTransferProphetFees,
        logLevel,
      },
    )
    if (res == null) return []

    return res.map(
      (r): EVMDexAggregatorSwapParameters => ({
        ...r,
        fromAmount: toSDKNumberOrUndefined(r.fromAmount),
      }),
    )
  }

  if (KnownChainId.isRunesChain(info.fromChain)) {
    if (!KnownTokenId.isRunesToken(info.fromToken)) return []

    const res = await getPossibleEVMDexAggregatorSwapParameters_FromMeta(
      getSDKContext(sdk),
      {
        fromChain: info.fromChain,
        fromToken: info.fromToken,
        toChain: info.toChain as any,
        toToken: info.toToken as any,
        amount: BigNumber.from(info.amount),
      },
      {
        ignoreTransferProphetPaused,
        skipTransferProphetFees,
        logLevel,
      },
    )
    if (res == null) return []

    return res.map(
      (r): EVMDexAggregatorSwapParameters => ({
        ...r,
        fromAmount: toSDKNumberOrUndefined(r.fromAmount),
      }),
    )
  }

  if (KnownChainId.isSolanaChain(info.fromChain)) {
    // Solana EVM DEX aggregator swap parameters not yet implemented
    return []
  }

  if (KnownChainId.isTronChain(info.fromChain)) {
    // Tron EVM DEX aggregator swap parameters not yet implemented
    return []
  }

  checkNever(info.fromChain)
  return []
}

export interface InstantSwapParameters
  extends Omit<_InstantSwapParameters, "fromAmount"> {
  fromAmount: SDKNumber
}
/**
 * This function retrieves the necessary parameters for performing an ALEX swap.
 * It provides the required details to proceed with an ALEX swap, such as the
 * tokens involved, and the amount to be swapped.
 *
 * @param sdk - The BroSDK instance
 * @param info - The entire bridging route
 */
export async function getInstantSwapParameters(
  sdk: BroSDK,
  info: KnownRoute & {
    amount: SDKNumber
  },
): Promise<undefined | InstantSwapParameters> {
  let params: undefined | _InstantSwapParameters

  if (KnownChainId.isStacksChain(info.fromChain)) {
    return
  } else if (KnownChainId.isEVMChain(info.fromChain)) {
    return
  } else if (KnownChainId.isBitcoinChain(info.fromChain)) {
    if (!KnownTokenId.isBitcoinToken(info.fromToken)) return
    params = await getInstantSwapParameters_FromBitcoin(getSDKContext(sdk), {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
      toChain: info.toChain as any,
      toToken: info.toToken as any,
      amount: BigNumber.from(info.amount),
    })
  } else if (KnownChainId.isBRC20Chain(info.fromChain)) {
    return
  } else if (KnownChainId.isRunesChain(info.fromChain)) {
    if (!KnownTokenId.isRunesToken(info.fromToken)) return
    params = await getInstantSwapParameters_FromMeta(getSDKContext(sdk), {
      fromChain: info.fromChain,
      fromToken: info.fromToken,
      toChain: info.toChain as any,
      toToken: info.toToken as any,
      amount: BigNumber.from(info.amount),
    })
  } else if (KnownChainId.isSolanaChain(info.fromChain)) {
    return
  } else if (KnownChainId.isTronChain(info.fromChain)) {
    return
  } else {
    checkNever(info.fromChain)
  }

  if (params == null) return

  return {
    ...params,
    fromAmount: toSDKNumberOrUndefined(params.fromAmount),
  }
}
