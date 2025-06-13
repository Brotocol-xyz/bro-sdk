import { unwrapResponse } from "clarity-codegen"
import { getTerminatingStacksTokenContractAddress as getTerminatingStacksTokenContractAddressEVM } from "../evmUtils/peggingHelpers"
import { getTerminatingStacksTokenContractAddress as getTerminatingStacksTokenContractAddressSolana } from "../solanaUtils/peggingHelpers"
import { addressToBuffer } from "../utils/addressHelpers"
import {
  KnownRoute_FromMeta,
  KnownRoute_FromMeta_ToBitcoin,
  KnownRoute_FromMeta_ToEVM,
  KnownRoute_FromMeta_ToMeta,
  KnownRoute_FromMeta_ToStacks,
  KnownRoute_FromMeta_ToSolana,
  KnownRoute_FromMeta_ToTron,
} from "../utils/buildSupportedRoutes"
import { UnsupportedBridgeRouteError } from "../utils/errors"
import { decodeHex } from "../utils/hexHelpers"
import {
  SwapRoute_WithMinimumAmountsToReceive,
  toCorrespondingStacksToken,
} from "../utils/SwapRouteHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  getChainIdNetworkType,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import { EVMAddress } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { CreateBridgeOrderResult } from "./createBridgeOrderFromBitcoin"
import { contractAssignedChainIdFromKnownChain } from "./crossContractDataMapping"
import { StacksContractName } from "./stxContractAddresses"
import {
  executeReadonlyCallBro,
  getStacksContractCallInfo,
  getStacksTokenContractInfo,
  numberToStacksContractNumber,
} from "./contractHelpers"
import { isEVMAddress } from "../sdkUtils/types"
import bs58check from "bs58check"

export async function createBridgeOrderFromMeta(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta & {
    fromBitcoinScriptPubKey: Uint8Array
    toBitcoinScriptPubKey: Uint8Array
    toAddress: string
    swap?: SwapRoute_WithMinimumAmountsToReceive
  },
): Promise<undefined | CreateBridgeOrderResult> {
  if (KnownChainId.isStacksChain(info.toChain)) {
    if (KnownTokenId.isStacksToken(info.toToken)) {
      return createBridgeOrder_MetaToStacks(sdkContext, {
        ...info,
        toChain: info.toChain,
        toToken: info.toToken,
        toStacksAddress: info.toAddress,
      })
    }
  }
  assertExclude(info.toChain, assertExclude.i<KnownChainId.StacksChain>())

  if (KnownChainId.isEVMChain(info.toChain)) {
    if (KnownTokenId.isEVMToken(info.toToken) && isEVMAddress(info.toAddress)) {
      return createBridgeOrder_MetaToEVM(sdkContext, {
        ...info,
        toChain: info.toChain,
        toToken: info.toToken,
        toEVMAddress: info.toAddress,
      })
    }
  }
  assertExclude(info.toChain, assertExclude.i<KnownChainId.EVMChain>())

  if (KnownChainId.isSolanaChain(info.toChain)) {
    if (KnownTokenId.isSolanaToken(info.toToken)) {
      return createBridgeOrder_MetaToSolana(sdkContext, {
        ...info,
        toChain: info.toChain,
        toToken: info.toToken,
        toSolanaAddress: info.toAddress,
      })
    }
  }
  assertExclude(info.toChain, assertExclude.i<KnownChainId.SolanaChain>())

  if (KnownChainId.isTronChain(info.toChain)) {
    if (KnownTokenId.isTronToken(info.toToken)) {
      return createBridgeOrder_MetaToTron(sdkContext, {
        ...info,
        toChain: info.toChain,
        toToken: info.toToken,
        toTronAddress: info.toAddress,
      })
    }
  }
  assertExclude(info.toChain, assertExclude.i<KnownChainId.TronChain>())

  if (KnownChainId.isBitcoinChain(info.toChain)) {
    if (KnownTokenId.isBitcoinToken(info.toToken)) {
      return createBridgeOrder_MetaToBitcoin(sdkContext, {
        ...info,
        toChain: info.toChain,
        toToken: info.toToken,
        toBitcoinScriptPubKey: info.toBitcoinScriptPubKey,
      })
    }
  }
  assertExclude(info.toChain, assertExclude.i<KnownChainId.BitcoinChain>())

  if (KnownChainId.isBRC20Chain(info.toChain)) {
    if (KnownTokenId.isBRC20Token(info.toToken)) {
      return createBridgeOrder_MetaToMeta(sdkContext, {
        ...info,
        toChain: info.toChain,
        toToken: info.toToken,
        toBitcoinScriptPubKey: info.toBitcoinScriptPubKey,
      })
    }
  }
  assertExclude(info.toChain, assertExclude.i<KnownChainId.BRC20Chain>())

  if (KnownChainId.isRunesChain(info.toChain)) {
    if (KnownTokenId.isRunesToken(info.toToken)) {
      return createBridgeOrder_MetaToMeta(sdkContext, {
        ...info,
        toChain: info.toChain,
        toToken: info.toToken,
        toBitcoinScriptPubKey: info.toBitcoinScriptPubKey,
      })
    }
  }
  assertExclude(info.toChain, assertExclude.i<KnownChainId.RunesChain>())

  checkNever(info)
  throw new UnsupportedBridgeRouteError(
    (info as any).fromChain,
    (info as any).toChain,
    (info as any).fromToken,
    (info as any).toToken,
  )
}

export async function createBridgeOrder_MetaToStacks(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta_ToStacks & {
    fromBitcoinScriptPubKey: Uint8Array
    toStacksAddress: string
    swap?: SwapRoute_WithMinimumAmountsToReceive
  },
): Promise<undefined | CreateBridgeOrderResult> {
  if (info.swap?.via === "evmDexAggregator") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swap,
    )
  }

  return createBridgeOrderFromMetaImpl(sdkContext, {
    ...info,
    fromAddressBuffer: info.fromBitcoinScriptPubKey,
    toAddressBuffer: addressToBuffer(info.toChain, info.toStacksAddress),
  })
}

export async function createBridgeOrder_MetaToEVM(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta_ToEVM & {
    fromBitcoinScriptPubKey: Uint8Array
    toEVMAddress: EVMAddress
    swap?: SwapRoute_WithMinimumAmountsToReceive
  },
): Promise<undefined | CreateBridgeOrderResult> {
  return createBridgeOrderFromMetaImpl(sdkContext, {
    ...info,
    fromAddressBuffer: info.fromBitcoinScriptPubKey,
    toAddressBuffer: decodeHex(info.toEVMAddress),
  })
}

export async function createBridgeOrder_MetaToBitcoin(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta_ToBitcoin & {
    fromBitcoinScriptPubKey: Uint8Array
    toBitcoinScriptPubKey: Uint8Array
    swap?: SwapRoute_WithMinimumAmountsToReceive
  },
): Promise<undefined | CreateBridgeOrderResult> {
  return createBridgeOrderFromMetaImpl(sdkContext, {
    ...info,
    fromAddressBuffer: info.fromBitcoinScriptPubKey,
    toAddressBuffer: info.toBitcoinScriptPubKey,
  })
}

export async function createBridgeOrder_MetaToMeta(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta_ToMeta & {
    fromBitcoinScriptPubKey: Uint8Array
    toBitcoinScriptPubKey: Uint8Array
    swap?: SwapRoute_WithMinimumAmountsToReceive
  },
): Promise<undefined | CreateBridgeOrderResult> {
  return createBridgeOrderFromMetaImpl(sdkContext, {
    ...info,
    fromAddressBuffer: info.fromBitcoinScriptPubKey,
    toAddressBuffer: info.toBitcoinScriptPubKey,
  })
}

export async function createBridgeOrder_MetaToSolana(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta_ToSolana & {
    fromBitcoinScriptPubKey: Uint8Array
    toSolanaAddress: string
    swap?: SwapRoute_WithMinimumAmountsToReceive
  },
): Promise<undefined | CreateBridgeOrderResult> {
  return createBridgeOrderFromMetaImpl(sdkContext, {
    ...info,
    fromAddressBuffer: info.fromBitcoinScriptPubKey,
    toAddressBuffer: addressToBuffer(info.toChain, info.toSolanaAddress),
  })
}

export async function createBridgeOrder_MetaToTron(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta_ToTron & {
    fromBitcoinScriptPubKey: Uint8Array
    toTronAddress: string
    swap?: SwapRoute_WithMinimumAmountsToReceive
  },
): Promise<undefined | CreateBridgeOrderResult> {
  return createBridgeOrderFromMetaImpl(sdkContext, {
    ...info,
    fromAddressBuffer: info.fromBitcoinScriptPubKey,
    toAddressBuffer: bs58check.decode(info.toTronAddress),
  })
}

async function createBridgeOrderFromMetaImpl(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta & {
    fromAddressBuffer: Uint8Array
    toAddressBuffer: Uint8Array
    swap?: SwapRoute_WithMinimumAmountsToReceive
  },
): Promise<undefined | CreateBridgeOrderResult> {
  const transitStacksChain =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet
  const contractBaseCallInfo = getStacksContractCallInfo(
    transitStacksChain,
    StacksContractName.MetaPegInEndpoint,
  )
  const contractSwapCallInfo = getStacksContractCallInfo(
    transitStacksChain,
    StacksContractName.MetaPegInEndpointSwap,
  )
  const contractAggCallInfo = getStacksContractCallInfo(
    transitStacksChain,
    StacksContractName.MetaPegInEndpointAggregator,
  )
  if (
    contractBaseCallInfo == null ||
    contractSwapCallInfo == null ||
    contractAggCallInfo == null
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const { swap: swapInfo } = info

  const targetChainId = KnownChainId.isStacksChain(info.toChain)
    ? undefined
    : contractAssignedChainIdFromKnownChain(info.toChain)

  const bridgedFromStacksToken = await toCorrespondingStacksToken(
    sdkContext,
    info.fromChain,
    info.fromToken,
  )
  const bridgedFromStacksTokenAddress =
    bridgedFromStacksToken == null
      ? null
      : await getStacksTokenContractInfo(
          sdkContext,
          transitStacksChain,
          bridgedFromStacksToken,
        )
  const bridgedToStacksToken = await toCorrespondingStacksToken(
    sdkContext,
    info.toChain,
    info.toToken,
  )
  const bridgedToStacksTokenAddress =
    bridgedToStacksToken == null
      ? null
      : await getStacksTokenContractInfo(
          sdkContext,
          transitStacksChain,
          bridgedToStacksToken,
        )
  if (
    bridgedFromStacksTokenAddress == null ||
    bridgedToStacksTokenAddress == null
  ) {
    return undefined
  }

  const tokenOutStacksAddress =
    (KnownChainId.isEVMChain(info.toChain) &&
    KnownTokenId.isEVMToken(info.toToken)
      ? await getTerminatingStacksTokenContractAddressEVM(sdkContext, {
          stacksChain: transitStacksChain,
          evmChain: info.toChain,
          evmToken: info.toToken,
        })
      : KnownChainId.isSolanaChain(info.toChain) &&
        KnownTokenId.isSolanaToken(info.toToken)
      ? await getTerminatingStacksTokenContractAddressSolana(sdkContext, {
          stacksChain: transitStacksChain,
          solanaChain: info.toChain,
          solanaToken: info.toToken,
        })
      : undefined) ?? bridgedToStacksTokenAddress

  let data: undefined | Uint8Array
  if (swapInfo == null) {
    data = await executeReadonlyCallBro(
      contractBaseCallInfo.contractName,
      "create-order-cross-or-fail",
      {
        order: {
          from: info.fromAddressBuffer,
          to: info.toAddressBuffer,
          "chain-id": targetChainId,
          token: `${bridgedToStacksTokenAddress.deployerAddress}.${bridgedToStacksTokenAddress.contractName}`,
          "token-out": `${tokenOutStacksAddress.deployerAddress}.${tokenOutStacksAddress.contractName}`,
        },
      },
      contractBaseCallInfo.executeOptions,
    ).then(unwrapResponse)
  } else if (swapInfo.via === "ALEX") {
    data = await executeReadonlyCallBro(
      contractSwapCallInfo.contractName,
      "create-order-cross-swap-or-fail",
      {
        order: {
          from: info.fromAddressBuffer,
          to: info.toAddressBuffer,
          "chain-id": targetChainId,
          routing: swapInfo.swapPools.map(n => n.poolId),
          "min-amount-out": numberToStacksContractNumber(
            swapInfo.minimumAmountsToReceive,
          ),
          "token-out": `${tokenOutStacksAddress.deployerAddress}.${tokenOutStacksAddress.contractName}`,
        },
      },
      contractSwapCallInfo.executeOptions,
    ).then(unwrapResponse)
  } else if (swapInfo.via === "evmDexAggregator") {
    const swapFromTokenStacksAddress =
      (await getTerminatingStacksTokenContractAddressEVM(sdkContext, {
        stacksChain: transitStacksChain,
        evmChain: swapInfo.evmChain,
        evmToken: swapInfo.fromEVMToken,
      })) ?? bridgedFromStacksTokenAddress
    const swapToTokenStacksAddress =
      (await getTerminatingStacksTokenContractAddressEVM(sdkContext, {
        stacksChain: transitStacksChain,
        evmChain: swapInfo.evmChain,
        evmToken: swapInfo.toEVMToken,
      })) ?? bridgedToStacksTokenAddress

    const swapOnChainId = contractAssignedChainIdFromKnownChain(
      swapInfo.evmChain,
    )
    if (swapOnChainId == null) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
        swapInfo,
      )
    }
    data = await executeReadonlyCallBro(
      contractAggCallInfo.contractName,
      "create-order-agg-or-fail",
      {
        order: {
          from: info.fromAddressBuffer,
          to: info.toAddressBuffer,
          "chain-id": targetChainId,
          "dest-chain-id": swapOnChainId,
          "min-amount-out": numberToStacksContractNumber(
            swapInfo.minimumAmountsToReceive,
          ),
          "swap-token-in": `${swapFromTokenStacksAddress.deployerAddress}.${swapFromTokenStacksAddress.contractName}`,
          "swap-token-out": `${swapToTokenStacksAddress.deployerAddress}.${swapToTokenStacksAddress.contractName}`,
          "token-out": `${tokenOutStacksAddress.deployerAddress}.${tokenOutStacksAddress.contractName}`,
          expiry:
            swapInfo.expiredAt == null
              ? 0n
              : BigInt(Math.ceil(swapInfo.expiredAt.getTime() / 1000)),
        },
      },
      contractAggCallInfo.executeOptions,
    ).then(unwrapResponse)
  } else {
    checkNever(swapInfo)
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      swapInfo,
    )
  }

  return {
    tokenOutTrait: {
      deployerAddress: tokenOutStacksAddress.deployerAddress,
      contractName: tokenOutStacksAddress.contractName,
    },
    data: data!,
  }
}
