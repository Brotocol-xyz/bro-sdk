import * as btc from "@scure/btc-signer"
import { equalBytes } from "@scure/btc-signer/utils"
import { addressToScriptPubKey } from "../bitcoinUtils/bitcoinHelpers"
import {
  broadcastBitcoinInstantSwapTransaction,
  getBitcoin2RunesInstantSwapTransactionParams,
} from "../bitcoinUtils/broadcastBitcoinInstantSwapTransaction"
import { broadcastBitcoinTransaction } from "../bitcoinUtils/broadcastBitcoinTransaction"
import {
  BitcoinAddress,
  getBTCPegInAddress,
} from "../bitcoinUtils/btcAddresses"
import {
  getInstantSwapFeeInfo,
  isSupportedBitcoinRoute,
} from "../bitcoinUtils/peggingHelpers"
import {
  BridgeFromBitcoinInput_reselectSpendableUTXOs,
  BridgeFromBitcoinInput_sendTransactionFn,
  BridgeFromBitcoinInput_signPsbtFn,
} from "../bitcoinUtils/types"
import { SDK_NAME } from "../constants"
import { getStacksTokenContractInfo } from "../stacksUtils/contractHelpers"
import {
  createBridgeOrder_BitcoinToEVM,
  createBridgeOrder_BitcoinToMeta,
  createBridgeOrder_BitcoinToSolana,
  createBridgeOrder_BitcoinToStacks,
  createBridgeOrder_BitcoinToTron,
} from "../stacksUtils/createBridgeOrderFromBitcoin"
import { BigNumber } from "../utils/BigNumber"
import {
  KnownRoute_FromBitcoin_ToBRC20,
  KnownRoute_FromBitcoin_ToEVM,
  KnownRoute_FromBitcoin_ToRunes,
  KnownRoute_FromBitcoin_ToSolana,
  KnownRoute_FromBitcoin_ToStacks,
  KnownRoute_FromBitcoin_ToTron,
  checkRouteValid,
} from "../utils/buildSupportedRoutes"
import {
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { SwapRoute_WithMinimumAmountsToReceive_Public } from "../utils/SwapRouteHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  KnownChainId,
  KnownTokenId,
  _knownChainIdToErrorMessagePart,
} from "../utils/types/knownIds"
import { ChainId, SDKNumber, TokenId, isEVMAddress } from "./types"
import { SDKGlobalContext } from "./types.internal"

export interface BridgeFromBitcoinInput {
  fromChain: ChainId
  fromToken: TokenId
  toChain: ChainId
  toToken: TokenId

  fromAddress: string
  fromAddressScriptPubKey: Uint8Array
  toAddress: string
  /**
   * **Required** when `toChain` is one of bitcoin chains
   */
  toAddressScriptPubKey?: Uint8Array

  amount: SDKNumber
  swapRoute?: SwapRoute_WithMinimumAmountsToReceive_Public

  networkFeeRate: bigint
  reselectSpendableUTXOs: BridgeFromBitcoinInput_reselectSpendableUTXOs

  extraOutputs?: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]

  signPsbt: BridgeFromBitcoinInput_signPsbtFn
  sendTransaction: BridgeFromBitcoinInput_sendTransactionFn
}

export interface BridgeFromBitcoinOutput {
  txid: string
  tx: Uint8Array
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}

export async function bridgeFromBitcoin(
  ctx: SDKGlobalContext,
  info: BridgeFromBitcoinInput,
): Promise<BridgeFromBitcoinOutput> {
  const route = await checkRouteValid(ctx, isSupportedBitcoinRoute, info)

  if (
    !equalBytes(
      info.fromAddressScriptPubKey,
      addressToScriptPubKey(
        info.fromChain === KnownChainId.Bitcoin.Mainnet
          ? btc.NETWORK
          : btc.TEST_NETWORK,
        info.fromAddress,
      ),
    )
  ) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromBitcoin (from ${_knownChainIdToErrorMessagePart(info.fromChain)})`,
      ],
      [
        {
          name: "fromAddressScriptPubKey",
          expected: "the scriptPubKey of the fromAddress",
          received: "invalid scriptPubKey",
        },
      ],
    )
  }

  if (info.toAddressScriptPubKey != null) {
    if (
      !equalBytes(
        info.toAddressScriptPubKey,
        addressToScriptPubKey(
          info.fromChain === KnownChainId.Bitcoin.Mainnet
            ? btc.NETWORK
            : btc.TEST_NETWORK,
          info.toAddress,
        ),
      )
    ) {
      throw new InvalidMethodParametersError(
        [
          SDK_NAME,
          `bridgeFromBitcoin (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
        ],
        [
          {
            name: "toAddressScriptPubKey",
            expected: "the scriptPubKey of the toAddress",
            received: "invalid scriptPubKey",
          },
        ],
      )
    }
  }

  if (KnownChainId.isBitcoinChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeFromBitcoin_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeFromBitcoin_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeFromBitcoin_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeFromBitcoin_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeFromBitcoin_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isBitcoinToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeFromBitcoin_toTron(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else {
      assertExclude(route.toChain, assertExclude.i<KnownChainId.BitcoinChain>())
      checkNever(route)
    }
  } else {
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.StacksChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BRC20Chain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.RunesChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.SolanaChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.TronChain>())
    checkNever(route)
  }

  throw new UnsupportedBridgeRouteError(
    info.fromChain,
    info.toChain,
    info.fromToken,
    info.toToken,
  )
}

async function bridgeFromBitcoin_toStacks(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToStacks,
): Promise<BridgeFromBitcoinOutput> {
  const swapRoute = info.swapRoute

  if (swapRoute?.via === "instantSwap") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  const pegInAddress = getBTCPegInAddress(info.fromChain, info.toChain)
  const toTokenContractInfo = await getStacksTokenContractInfo(
    sdkContext,
    info.toChain,
    info.toToken,
  )
  if (pegInAddress == null || toTokenContractInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const createdOrder = await createBridgeOrder_BitcoinToStacks(sdkContext, {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toChain: info.toChain,
    toToken: info.toToken,
    toStacksAddress: info.toAddress,
    swap:
      swapRoute == null
        ? undefined
        : {
            ...swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              swapRoute.minimumAmountsToReceive,
            ),
          },
  })
  if (createdOrder == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return broadcastBitcoinTransaction(
    sdkContext,
    {
      ...info,
      toAddressScriptPubKey: undefined,
      withHardLinkageOutput: false,
      swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromBitcoin_toEVM(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToEVM,
): Promise<BridgeFromBitcoinOutput> {
  const swapRoute = info.swapRoute

  if (swapRoute?.via === "instantSwap") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  const createdOrder = !isEVMAddress(info.toAddress)
    ? null
    : await createBridgeOrder_BitcoinToEVM(sdkContext, {
        ...info,
        fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
        fromAmount: BigNumber.from(info.amount),
        toEVMAddress: info.toAddress,
        swap:
          swapRoute == null
            ? undefined
            : {
                ...swapRoute,
                minimumAmountsToReceive: BigNumber.from(
                  swapRoute.minimumAmountsToReceive,
                ),
              },
      })
  if (createdOrder == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return broadcastBitcoinTransaction(
    sdkContext,
    {
      ...info,
      toAddressScriptPubKey: undefined,
      withHardLinkageOutput: false,
      swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromBitcoin_toMeta(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBitcoin_ToBRC20 | KnownRoute_FromBitcoin_ToRunes),
): Promise<BridgeFromBitcoinOutput> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromBitcoin (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "toAddressScriptPubKey",
          expected: "Uint8Array",
          received: "undefined",
        },
      ],
    )
  }

  const swapRoute = info.swapRoute

  const createdOrder = await createBridgeOrder_BitcoinToMeta(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toBitcoinScriptPubKey: info.toAddressScriptPubKey,
    swap:
      swapRoute == null
        ? undefined
        : {
            ...swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              swapRoute.minimumAmountsToReceive,
            ),
          },
  })
  if (createdOrder == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  if (swapRoute?.via === "instantSwap") {
    // TODO: implement instantSwap for Bitcoin>BRC20

    if (
      KnownChainId.isRunesChain(info.toChain) &&
      KnownTokenId.isRunesToken(info.toToken)
    ) {
      const instantSwapFee = await getInstantSwapFeeInfo(sdkContext, {
        fromChain: info.fromChain,
        fromToken: info.fromToken,
        toChain: info.toChain,
        toToken: info.toToken,
      })
      if (instantSwapFee == null) {
        throw new UnsupportedBridgeRouteError(
          info.fromChain,
          info.toChain,
          info.fromToken,
          info.toToken,
        )
      }

      const { params, transformResponse } =
        await getBitcoin2RunesInstantSwapTransactionParams(sdkContext, {
          methodName: "bridgeFromBitcoin",
          transferProphet: instantSwapFee,
          fromChain: info.fromChain,
          fromAddress: info.fromAddress,
          fromAddressScriptPubKey: info.fromAddressScriptPubKey,
          fromAmount: BigNumber.from(info.amount),
          toChain: info.toChain,
          toToken: info.toToken,
          toAddress: info.toAddress,
          toAddressScriptPubKey: info.toAddressScriptPubKey,
          extraOutputs: info.extraOutputs ?? [],
          signPsbt: info.signPsbt,
        })

      const resp = await broadcastBitcoinInstantSwapTransaction(
        sdkContext,
        {
          ...info,
          toChain: info.toChain,
          toToken: info.toToken,
          toAddressScriptPubKey: info.toAddressScriptPubKey,
          swapRoute,
          ...params,
        },
        {
          orderData: createdOrder,
          swapRoute,
        },
      )

      return transformResponse(resp)
    }

    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  return broadcastBitcoinTransaction(
    sdkContext,
    {
      ...info,
      toAddressScriptPubKey: info.toAddressScriptPubKey,
      withHardLinkageOutput: true,
      swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromBitcoin_toSolana(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToSolana,
): Promise<BridgeFromBitcoinOutput> {
  const swapRoute = info.swapRoute

  if (swapRoute?.via === "instantSwap") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  const createdOrder = await createBridgeOrder_BitcoinToSolana(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toSolanaAddress: info.toAddress,
    swap:
      swapRoute == null
        ? undefined
        : {
            ...swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              swapRoute.minimumAmountsToReceive,
            ),
          },
  })
  if (createdOrder == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return broadcastBitcoinTransaction(
    sdkContext,
    {
      ...info,
      toAddressScriptPubKey: info.toAddressScriptPubKey,
      withHardLinkageOutput: false,
      swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromBitcoin_toTron(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBitcoinInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBitcoin_ToTron,
): Promise<BridgeFromBitcoinOutput> {
  const swapRoute = info.swapRoute

  if (swapRoute?.via === "instantSwap") {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
      info.swapRoute,
    )
  }

  const createdOrder = await createBridgeOrder_BitcoinToTron(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
    fromAmount: BigNumber.from(info.amount),
    toTronAddress: info.toAddress,
    swap:
      swapRoute == null
        ? undefined
        : {
            ...swapRoute,
            minimumAmountsToReceive: BigNumber.from(
              swapRoute.minimumAmountsToReceive,
            ),
          },
  })
  if (createdOrder == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  return broadcastBitcoinTransaction(
    sdkContext,
    {
      ...info,
      toAddressScriptPubKey: info.toAddressScriptPubKey,
      withHardLinkageOutput: false,
      swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}
