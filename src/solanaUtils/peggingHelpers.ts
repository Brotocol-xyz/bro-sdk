import { getSolanaSupportedRoutes } from "./getSolanaSupportedRoutes"
import { getEVMSupportedRoutes } from "../evmUtils/apiHelpers/getEVMSupportedRoutes"
import { getBRC20SupportedRoutes } from "../metaUtils/apiHelpers/getBRC20SupportedRoutes"
import { getRunesSupportedRoutes } from "../metaUtils/apiHelpers/getRunesSupportedRoutes"
import { getTronSupportedRoutes } from "../tronUtils/getTronSupportedRoutes"
import { IsSupportedFn } from "../utils/buildSupportedRoutes"
import { checkNever } from "../utils/typeHelpers"
import { SDKGlobalContext, withGlobalContextCache } from "../sdkUtils/types.internal"
import {
  _allNoLongerSupportedEVMChains,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import { getAndCheckTransitStacksTokens } from "../utils/SwapRouteHelpers"
import {
  KnownRoute_FromSolana_ToStacks,
  KnownRoute_FromStacks_ToSolana,
  KnownRoute_ToStacks,
} from "../utils/buildSupportedRoutes"
import { TransferProphet } from "../utils/types/TransferProphet"
import { BigNumber } from "../utils/BigNumber"
import { StacksContractName } from "../stacksUtils/stxContractAddresses"
import { getSpecialFeeDetailsForSwapRoute } from "../utils/SwapRouteHelpers"
import { TransferProphet_Fee_Fixed } from "../utils/types/TransferProphet"
import { executeReadonlyCallBro, getStacksContractCallInfo, getStacksTokenContractInfo, numberFromStacksContractNumber } from "../stacksUtils/contractHelpers"
import { contractAssignedChainIdFromKnownChain } from "../lowlevelUnstableInfos"
import { unwrapResponse } from "clarity-codegen"
import { getSolanaConfigs } from "./getSolanaSupportedRoutes"
import { AnchorWrapper } from "./anchorWrapper"
import { TokenConfigAccount } from "./types"
import { isStacksContractAddressEqual, type StacksContractAddress } from "../sdkUtils/types"

export const isSupportedSolanaRoute: IsSupportedFn = async (ctx, route) => {
  const { fromChain, toChain, fromToken, toToken } = route

  if (fromChain === toChain && fromToken === toToken) {
    return false
  }

  if (!KnownChainId.isKnownChain(toChain)) return false

  if (
    (KnownChainId.isEVMChain(fromChain) &&
      _allNoLongerSupportedEVMChains.includes(fromChain)) ||
    (KnownChainId.isEVMChain(toChain) &&
      _allNoLongerSupportedEVMChains.includes(toChain))
  ) {
    return false
  }

  if (
    !KnownChainId.isSolanaChain(fromChain) ||
    !KnownTokenId.isSolanaToken(fromToken)
  ) {
    return false
  }

  const headAndTailStacksTokens = await getAndCheckTransitStacksTokens(ctx, {
    ...route,
    fromChain,
    fromToken,
    toChain: toChain as any,
    toToken: toToken as any,
  })
  if (headAndTailStacksTokens == null) return false
  const { firstStepToStacksToken, lastStepFromStacksToken } =
    headAndTailStacksTokens

  // solana -> stacks
  if (KnownChainId.isStacksChain(toChain)) {
    if (!KnownTokenId.isStacksToken(toToken)) return false

    const solanaRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    return solanaRoutes.some(
      route => route.solanaToken === fromToken && route.stacksToken === toToken,
    )
  }

  // solana -> evm
  if (KnownChainId.isEVMChain(toChain)) {
    if (!KnownTokenId.isEVMToken(toToken)) return false

    // Waiting for backend support
    return false

    // const fromRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    // const toRoutes = await getEVMSupportedRoutes(ctx, toChain)

    // return (
    //   fromRoutes.some(
    //     route =>
    //       route.solanaToken === fromToken &&
    //       route.stacksToken === firstStepToStacksToken,
    //   ) &&
    //   toRoutes.some(
    //     route =>
    //       route.evmToken === toToken &&
    //       route.stacksToken === lastStepFromStacksToken,
    //   )
    // )
  }

  // solana -> btc
  if (KnownChainId.isBitcoinChain(toChain)) {
    if (!KnownTokenId.isBitcoinToken(toToken)) return false

    return toToken === KnownTokenId.Bitcoin.BTC
  }

  // solana -> brc20
  if (KnownChainId.isBRC20Chain(toChain)) {
    if (!KnownTokenId.isBRC20Token(toToken)) return false

    const fromRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    const toRoutes = await getBRC20SupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.solanaToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.brc20Token === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // solana -> runes
  if (KnownChainId.isRunesChain(toChain)) {
    if (!KnownTokenId.isRunesToken(toToken)) return false

    const fromRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    const toRoutes = await getRunesSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.solanaToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.runesToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // solana -> tron
  if (KnownChainId.isTronChain(toChain)) {
    if (!KnownTokenId.isTronToken(toToken)) return false

    const fromRoutes = await getSolanaSupportedRoutes(ctx, fromChain)
    const toRoutes = await getTronSupportedRoutes(ctx, toChain)

    return (
      fromRoutes.find(
        route =>
          route.solanaToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      toRoutes.find(
        route =>
          route.tronToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  // solana -> solana
  if (KnownChainId.isSolanaChain(toChain)) {
    if (!KnownTokenId.isSolanaToken(toToken)) return false

    const solanaRoutes = await getSolanaSupportedRoutes(ctx, fromChain)

    return (
      solanaRoutes.find(
        route =>
          route.solanaToken === fromToken &&
          route.stacksToken === firstStepToStacksToken,
      ) != null &&
      solanaRoutes.find(
        route =>
          route.solanaToken === toToken &&
          route.stacksToken === lastStepFromStacksToken,
      ) != null
    )
  }

  checkNever(toChain)
  return false
}

export async function solanaTokenToCorrespondingStacksToken(
  sdkContext: SDKGlobalContext,
  fromChain: KnownChainId.SolanaChain,
  fromSolanaToken: KnownTokenId.SolanaToken,
): Promise<undefined | KnownTokenId.StacksToken> {
  const supportedRoutes = await getSolanaSupportedRoutes(sdkContext, fromChain)
  return supportedRoutes.find(route => route.solanaToken === fromSolanaToken)?.stacksToken
}

export async function solanaTokenFromCorrespondingStacksToken(
  sdkContext: SDKGlobalContext,
  toChain: KnownChainId.SolanaChain,
  fromStacksToken: KnownTokenId.StacksToken,
): Promise<KnownTokenId.SolanaToken[]> {
  const supportedRoutes = await getSolanaSupportedRoutes(sdkContext, toChain)
  return supportedRoutes.reduce(
    (acc, route) =>
      route.stacksToken === fromStacksToken ? [...acc, route.solanaToken] : acc,
    [] as KnownTokenId.SolanaToken[],
  )
}

export const getTerminatingStacksTokenContractAddress = async (
  sdkContext: SDKGlobalContext,
  info: {
    solanaChain: KnownChainId.SolanaChain
    solanaToken: KnownTokenId.SolanaToken
    stacksChain: KnownChainId.StacksChain
  },
): Promise<undefined | StacksContractAddress> => {
  const supportedRoutes = await getSolanaSupportedRoutes(sdkContext, info.solanaChain)

  return (
    supportedRoutes.find(r => r.solanaToken === info.solanaToken)
      ?.proxyStacksTokenContractAddress ?? undefined
  )
}

export const getStacksTokenFromTerminatingStacksTokenContractAddress = async (
  sdkContext: SDKGlobalContext,
  info: {
    stacksChain: KnownChainId.StacksChain
    stacksTokenAddress: StacksContractAddress
  },
): Promise<undefined | KnownTokenId.StacksToken> => {
  const routes = await getSolanaSupportedRoutes(
    sdkContext,
    info.stacksChain === KnownChainId.Stacks.Mainnet ? KnownChainId.Solana.Mainnet : KnownChainId.Solana.Testnet,
  )

  return (
    routes.find(r =>
      r.proxyStacksTokenContractAddress == null
        ? false
        : isStacksContractAddressEqual(
            r.proxyStacksTokenContractAddress,
            info.stacksTokenAddress,
          ),
    )?.stacksToken ?? undefined
  )
}

export const getSolana2StacksFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromSolana_ToStacks,
): Promise<undefined | TransferProphet> => {
  return withGlobalContextCache(
    ctx.solana.feeRateCache,
    withGlobalContextCache.cacheKeyFromRoute(route),
    () => _getSolana2StacksFeeInfo(ctx, route),
  )
}

const _getSolana2StacksFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromSolana_ToStacks,
): Promise<undefined | TransferProphet> => {
  // Get Solana config
  const solanaConfig = await getSolanaConfigs(ctx, route.fromChain)
  const solanaRoutes = await getSolanaSupportedRoutes(ctx, route.fromChain)
  const solanaRoute = solanaRoutes.find(r => r.solanaToken === route.fromToken)
  if (!solanaRoute) {
    throw new Error(`Solana route not found for token ${route.fromToken}`)
  }

  const anchorWrapper = new AnchorWrapper(
    solanaConfig.rpcEndpoint,
    solanaConfig.programIds.registry,
    solanaConfig.programIds.bridgeEndpoint
  )

  // Get token config from cache or fetch it
  const tokenMint = solanaRoute.solanaTokenAddress
  const cacheKey = tokenMint
  let tokenConfig: TokenConfigAccount

  if (ctx.solana.tokenConfigCache?.has(cacheKey)) {
    tokenConfig = await ctx.solana.tokenConfigCache.get(cacheKey)!
  } else {
    tokenConfig = await anchorWrapper.getTokenConfigAccount(tokenMint)
    if (!ctx.solana.tokenConfigCache) {
      ctx.solana.tokenConfigCache = new Map()
    }
    ctx.solana.tokenConfigCache.set(cacheKey, Promise.resolve(tokenConfig))
  }

  // Create a new TransferProphet with the fee information
  const transferProphet: TransferProphet = {
    isPaused: false,
    bridgeToken: route.fromToken,
    minBridgeAmount: tokenConfig.minAmount,
    maxBridgeAmount: tokenConfig.maxAmount,
    fees: [
      {
        type: "rate",
        token: route.fromToken,
        rate: tokenConfig.feePct,
        minimumAmount: tokenConfig.minFee
      }
    ]
  }

  return transferProphet
}

export const getStacks2SolanaFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromStacks_ToSolana,
  options: {
    initialRoute: null | KnownRoute_ToStacks
  },
): Promise<undefined | TransferProphet> => {
  return withGlobalContextCache(
    ctx.solana.feeRateCache,
    [
      withGlobalContextCache.cacheKeyFromRoute(route),
      options.initialRoute == null
        ? ""
        : withGlobalContextCache.cacheKeyFromRoute(options.initialRoute),
    ].join("#"),
    () => _getStacks2SolanaFeeInfo(ctx, route, options),
  )
}

const _getStacks2SolanaFeeInfo = async (
  ctx: SDKGlobalContext,
  route: KnownRoute_FromStacks_ToSolana,
  options: {
    initialRoute: null | KnownRoute_ToStacks
  },
): Promise<undefined | TransferProphet> => {
  const stacksContractCallInfo = getStacksContractCallInfo(
    route.fromChain,
    StacksContractName.EVMPegOutEndpoint,
  )
  const stacksTokenContractCallInfo = await getStacksTokenContractInfo(
    ctx,
    route.fromChain,
    route.fromToken,
  )
  const toChainId = contractAssignedChainIdFromKnownChain(route.toChain)
  if (
    stacksContractCallInfo == null ||
    stacksTokenContractCallInfo == null
  ) {
    return
  }

  const terminatingStacksTokenAddress = (await getTerminatingStacksTokenContractAddress(ctx, {
    solanaChain: route.toChain,
    solanaToken: route.toToken,
    stacksChain: route.fromChain,
  })) ?? stacksTokenContractCallInfo

  const specialFeeInfo = await getSpecialFeeDetailsForSwapRoute(ctx, route, {
    initialRoute: options.initialRoute,
    swapRoute: null,
  })

  if (ctx.debugLog) {
    console.log("[getStacks2EvmFeeInfo/specialFeeInfo]", route, specialFeeInfo)
  }

  const tokenConf = await Promise.all([
    executeReadonlyCallBro(
      stacksContractCallInfo.contractName,
      "get-approved-pair-or-fail",
      {
        pair: {
          token: `${terminatingStacksTokenAddress.deployerAddress}.${terminatingStacksTokenAddress.contractName}`,
          "chain-id": toChainId,
        },
      },
      stacksContractCallInfo.executeOptions,
    ),
    executeReadonlyCallBro(
      stacksContractCallInfo.contractName,
      "get-paused",
      {},
      stacksContractCallInfo.executeOptions,
    ),
  ]).then(
    ([resp, isPaused]) => {
      if (ctx.debugLog) {
        console.log("[getStacks2EvmFeeInfo]", route, resp, isPaused)
      }

      if (resp.type !== "success") return undefined

      return {
        ...unwrapResponse(resp),
        isPaused,
      }
    },
    err => {
      if (ctx.debugLog) {
        console.log("[getStacks2EvmFeeInfo]", route, err)
      }
      throw err
    },
  )

  if (tokenConf == null) return undefined

  const isPaused = tokenConf.isPaused || tokenConf.approved === false
  const reserve = numberFromStacksContractNumber(tokenConf.reserve)

  const minAmount = numberFromStacksContractNumber(tokenConf["min-amount"])
  const maxAmount = BigNumber.min([
    numberFromStacksContractNumber(tokenConf["max-amount"]),
    reserve,
  ])

  if (specialFeeInfo != null) {
    return {
      isPaused,
      bridgeToken: route.fromToken,
      fees: [
        {
          type: "rate",
          token: route.fromToken,
          rate: specialFeeInfo.feeRate,
          minimumAmount: specialFeeInfo.minFeeAmount,
        },
        ...(specialFeeInfo.gasFee == null
          ? []
          : [
            {
              type: "fixed",
              token: specialFeeInfo.gasFee.token,
              amount: specialFeeInfo.gasFee.amount,
            } satisfies TransferProphet_Fee_Fixed,
          ]),
      ],
      minBridgeAmount: BigNumber.isZero(minAmount)
        ? specialFeeInfo.minFeeAmount
        : BigNumber.max([minAmount, specialFeeInfo.minFeeAmount]),
      maxBridgeAmount: maxAmount,
    }
  }

  const feeRate = numberFromStacksContractNumber(tokenConf.fee)
  const minFee = numberFromStacksContractNumber(tokenConf["min-fee"])

  return {
    isPaused,
    bridgeToken: route.fromToken,
    fees: [
      {
        type: "rate",
        token: route.fromToken,
        rate: feeRate,
        minimumAmount: minFee,
      },
    ],
    minBridgeAmount: BigNumber.isZero(minAmount)
      ? minFee
      : BigNumber.max([minAmount, minFee]),
    maxBridgeAmount: maxAmount,
  }
}