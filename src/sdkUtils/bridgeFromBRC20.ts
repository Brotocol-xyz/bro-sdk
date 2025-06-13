import * as btc from "@scure/btc-signer"
import { equalBytes } from "@scure/btc-signer/utils"
import { broadcastRevealableTransaction } from "../bitcoinUtils/apiHelpers/broadcastRevealableTransaction"
import { createBitcoinPegInRecipients } from "../bitcoinUtils/apiHelpers/createBitcoinPegInRecipients"
import { createRevealTx } from "../bitcoinUtils/apiHelpers/createRevealTx"
import {
  UTXOSpendable,
  addressToScriptPubKey,
  bitcoinToSatoshi,
} from "../bitcoinUtils/bitcoinHelpers"
import {
  BitcoinAddress,
  getBTCPegInAddress,
  getBitcoinHardLinkageAddress,
} from "../bitcoinUtils/btcAddresses"
import {
  BITCOIN_OUTPUT_MINIMUM_AMOUNT,
  SDK_NAME,
} from "../bitcoinUtils/constants"
import { createTransaction } from "../bitcoinUtils/createTransaction"
import {
  BitcoinTransactionPrepareResult,
  prepareTransaction,
} from "../bitcoinUtils/prepareTransaction"
import { getMetaPegInAddress } from "../metaUtils/btcAddresses"
import {
  getMeta2StacksFeeInfo,
  isSupportedBRC20Route,
} from "../metaUtils/peggingHelpers"
import { getStacksTokenContractInfo } from "../stacksUtils/contractHelpers"
import { CreateBridgeOrderResult } from "../stacksUtils/createBridgeOrderFromBitcoin"
import {
  createBridgeOrder_MetaToBitcoin,
  createBridgeOrder_MetaToEVM,
  createBridgeOrder_MetaToMeta,
  createBridgeOrder_MetaToStacks,
  createBridgeOrder_MetaToSolana,
  createBridgeOrder_MetaToTron,
} from "../stacksUtils/createBridgeOrderFromMeta"
import { validateBridgeOrderFromMeta } from "../stacksUtils/validateBridgeOrderFromMeta"
import { range } from "../utils/arrayHelpers"
import { BigNumber } from "../utils/BigNumber"
import {
  KnownRoute_FromBRC20,
  KnownRoute_FromBRC20_ToBRC20,
  KnownRoute_FromBRC20_ToBitcoin,
  KnownRoute_FromBRC20_ToEVM,
  KnownRoute_FromBRC20_ToRunes,
  KnownRoute_FromBRC20_ToStacks,
  KnownRoute_FromBRC20_ToSolana,
  KnownRoute_FromBRC20_ToTron,
  KnownRoute_FromMeta,
  checkRouteValid,
} from "../utils/buildSupportedRoutes"
import {
  BridgeValidateFailedError,
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { decodeHex } from "../utils/hexHelpers"
import {
  SwapRoute,
  SwapRouteViaALEX,
  SwapRouteViaALEX_WithMinimumAmountsToReceive_Public,
  SwapRouteViaEVMDexAggregator,
  SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public,
  SwapRoute_WithMinimumAmountsToReceive_Public,
  toCorrespondingStacksToken,
} from "../utils/SwapRouteHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  KnownChainId,
  KnownTokenId,
  _knownChainIdToErrorMessagePart,
  getChainIdNetworkType,
} from "../utils/types/knownIds"
import { TransferProphet_Fee_Fixed } from "../utils/types/TransferProphet"
import {
  ReselectSpendableUTXOsFn_Public,
  reselectSpendableUTXOsFactory,
} from "./bridgeFromBitcoin"
import { ChainId, TokenId, isEVMAddress } from "./types"
import { SDKGlobalContext } from "./types.internal"

export type BridgeFromBRC20Input_reselectSpendableNetworkFeeUTXOs =
  ReselectSpendableUTXOsFn_Public

export type BridgeFromBRC20Input_signPsbtFn = (tx: {
  psbt: Uint8Array
  signBitcoinInputs: number[]
  signInscriptionInputs: number[]
}) => Promise<{ psbt: Uint8Array }>

export interface BridgeFromBRC20Input {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
  toToken: TokenId

  fromAddress: string
  fromAddressScriptPubKey: Uint8Array
  toAddress: string
  /**
   * **Required** when `toChain` is one of bitcoin chains
   */
  toAddressScriptPubKey?: Uint8Array

  inputInscriptionUTXO: UTXOSpendable
  swapRoute?: SwapRoute_WithMinimumAmountsToReceive_Public

  networkFeeRate: bigint
  reselectSpendableNetworkFeeUTXOs: BridgeFromBRC20Input_reselectSpendableNetworkFeeUTXOs
  networkFeeChangeAddress: string
  networkFeeChangeAddressScriptPubKey: Uint8Array

  extraOutputs?: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]

  signPsbt: BridgeFromBRC20Input_signPsbtFn
  sendTransaction: (tx: {
    hex: string
    pegInOrderOutput: {
      index: number
      amount: bigint
      orderData: Uint8Array
    }
  }) => Promise<{
    txid: string
  }>
}

export interface BridgeFromBRC20Output {
  txid: string
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}

export async function bridgeFromBRC20(
  ctx: SDKGlobalContext,
  info: BridgeFromBRC20Input,
): Promise<BridgeFromBRC20Output> {
  const route = await checkRouteValid(ctx, isSupportedBRC20Route, info)

  if (
    !equalBytes(
      info.fromAddressScriptPubKey,
      addressToScriptPubKey(
        info.fromChain === KnownChainId.BRC20.Mainnet
          ? btc.NETWORK
          : btc.TEST_NETWORK,
        info.fromAddress,
      ),
    )
  ) {
    throw new InvalidMethodParametersError(
      [SDK_NAME, "bridgeFromBRC20"],
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
          info.fromChain === KnownChainId.BRC20.Mainnet
            ? btc.NETWORK
            : btc.TEST_NETWORK,
          info.toAddress,
        ),
      )
    ) {
      throw new InvalidMethodParametersError(
        [SDK_NAME, "bridgeFromBRC20"],
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

  if (KnownChainId.isBRC20Chain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeFromBRC20_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeFromBRC20_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeFromBRC20_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeFromBRC20_toTron(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeFromBRC20_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeFromBRC20_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isBRC20Token(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeFromBRC20_toMeta(ctx, {
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
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BitcoinChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.StacksChain>())
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

export async function getBridgeFeeOutput(
  sdkContext: SDKGlobalContext,
  info: KnownRoute_FromMeta & {
    swapRoute?: SwapRoute
  },
): Promise<null | {
  address: string
  scriptPubKey: Uint8Array
  satsAmount: BigNumber
}> {
  const btcPegInAddress = getBTCPegInAddress(
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? KnownChainId.Bitcoin.Mainnet
      : KnownChainId.Bitcoin.Testnet,
    info.toChain,
  )
  const transitStacksChain =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet
  const transitStacksToken = await toCorrespondingStacksToken(
    sdkContext,
    info.fromChain,
    info.fromToken,
  )
  if (btcPegInAddress == null || transitStacksToken == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const step1FeeInfo = await getMeta2StacksFeeInfo(
    sdkContext,
    {
      fromChain: info.fromChain as KnownChainId.BRC20Chain,
      fromToken: info.fromToken as KnownTokenId.BRC20Token,
      toChain: transitStacksChain,
      toToken: transitStacksToken,
    },
    { swapRoute: info.swapRoute ?? null },
  )
  if (step1FeeInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const bridgeFeeInBTC = step1FeeInfo.fees.find(
    (f): f is TransferProphet_Fee_Fixed =>
      f.type === "fixed" && f.token === KnownTokenId.Bitcoin.BTC,
  )

  if (bridgeFeeInBTC == null) return null
  if (BigNumber.isZero(bridgeFeeInBTC.amount)) return null

  return {
    ...btcPegInAddress,
    satsAmount: BigNumber.from(
      bitcoinToSatoshi(BigNumber.toString(bridgeFeeInBTC.amount)),
    ),
  }
}

async function bridgeFromBRC20_toStacks(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToStacks,
): Promise<BridgeFromBRC20Output> {
  const swapRoute = info.swapRoute

  const pegInAddress = getMetaPegInAddress(info.fromChain, info.toChain)
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

  const createdOrder = await createBridgeOrder_MetaToStacks(sdkContext, {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return broadcastBRC20Transaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      swapRoute: info.swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromBRC20_toEVM(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToEVM,
): Promise<BridgeFromBRC20Output> {
  const swapRoute = info.swapRoute

  const createdOrder = !isEVMAddress(info.toAddress)
    ? null
    : await createBridgeOrder_MetaToEVM(sdkContext, {
        ...info,
        fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return broadcastBRC20Transaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      swapRoute: info.swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromBRC20_toBitcoin(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToBitcoin,
): Promise<BridgeFromBRC20Output> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromBRC20 (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
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
  const createdOrder = await createBridgeOrder_MetaToBitcoin(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return broadcastBRC20Transaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: true,
      bridgeFeeOutput,
      swapRoute: info.swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromBRC20_toMeta(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromBRC20_ToBRC20 | KnownRoute_FromBRC20_ToRunes),
): Promise<BridgeFromBRC20Output> {
  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromBRC20 (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
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
  const createdOrder = await createBridgeOrder_MetaToMeta(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return broadcastBRC20Transaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: true,
      bridgeFeeOutput,
      swapRoute: info.swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromBRC20_toSolana(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToSolana,
): Promise<BridgeFromBRC20Output> {
  const swapRoute = info.swapRoute

  const createdOrder = await createBridgeOrder_MetaToSolana(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return broadcastBRC20Transaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      swapRoute: info.swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function bridgeFromBRC20_toTron(
  sdkContext: SDKGlobalContext,
  info: Omit<
    BridgeFromBRC20Input,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromBRC20_ToTron,
): Promise<BridgeFromBRC20Output> {
  const swapRoute = info.swapRoute

  const createdOrder = await createBridgeOrder_MetaToTron(sdkContext, {
    ...info,
    fromBitcoinScriptPubKey: info.fromAddressScriptPubKey,
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

  const bridgeFeeOutput = await getBridgeFeeOutput(sdkContext, info)

  return broadcastBRC20Transaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: false,
      bridgeFeeOutput,
      swapRoute: info.swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function broadcastBRC20Transaction(
  sdkContext: SDKGlobalContext,
  info: Omit<
    ConstructBRC20TransactionInput,
    "validateBridgeOrder" | "orderData" | "pegInAddress" | "hardLinkageOutput"
  > & {
    withHardLinkageOutput: boolean
    sendTransaction: BridgeFromBRC20Input["sendTransaction"]
  },
  createdOrder: CreateBridgeOrderResult,
): Promise<{
  txid: string
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}> {
  const pegInAddress = getMetaPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const route: KnownRoute_FromBRC20 = {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: info.toChain,
    toToken: info.toToken,
  } as any

  const tx = await constructBRC20Transaction(sdkContext, {
    ...info,
    ...route,
    validateBridgeOrder: async (btcTx, revealTx, extra) => {
      if (revealTx == null) {
        throw new UnsupportedBridgeRouteError(
          info.fromChain,
          info.toChain,
          info.fromToken,
          info.toToken,
        )
      }

      /**
       * due to contract limit, we are unable to validate this tx before the
       * commit tx be confirmed, so we will skip it and fix it in the future
       */
      void validateBridgeOrderFromMeta({
        chainId: info.fromChain,
        commitTx: btcTx,
        revealTx,
        terminatingStacksToken: createdOrder.tokenOutTrait,
        transferOutputIndex: extra.transferOutputIndex,
        bridgeFeeOutputIndex: extra.bridgeFeeOutputIndex,
        swapRoute: extra.swapRoute,
      })
    },
    orderData: createdOrder.data,
    pegInAddress,
    hardLinkageOutput: info.withHardLinkageOutput
      ? ((await getBitcoinHardLinkageAddress(info.fromChain, info.toChain)) ??
        null)
      : null,
  })

  const { txid: apiBroadcastedTxId } = await broadcastRevealableTransaction(
    sdkContext,
    {
      fromChain: info.fromChain,
      transactionHex: `0x${tx.hex}`,
      orderData: createdOrder.data,
      orderOutputIndex: tx.revealOutput.index,
      orderOutputSatsAmount: tx.revealOutput.satsAmount,
      pegInAddress: pegInAddress,
    },
  )

  const { txid: delegateBroadcastedTxId } = await info.sendTransaction({
    hex: tx.hex,
    pegInOrderOutput: {
      index: tx.revealOutput.index,
      amount: tx.revealOutput.satsAmount,
      orderData: createdOrder.data,
    },
  })

  if (apiBroadcastedTxId !== delegateBroadcastedTxId) {
    console.warn(
      "[bro-sdk] Transaction id broadcasted by API and delegatee are different:",
      `API: ${apiBroadcastedTxId}, `,
      `Delegatee: ${delegateBroadcastedTxId}`,
    )
  }

  return {
    txid: delegateBroadcastedTxId,
    extraOutputs: tx.extraOutputs,
  }
}

type ConstructBRC20TransactionInput = PrepareBRC20TransactionInput & {
  swapRoute:
    | undefined
    | SwapRouteViaALEX_WithMinimumAmountsToReceive_Public
    | SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public
  signPsbt: BridgeFromBRC20Input["signPsbt"]
  pegInAddress: BitcoinAddress
  validateBridgeOrder: (
    pegInTx: Uint8Array,
    revealTx: undefined | Uint8Array,
    info: {
      transferOutputIndex: number
      bridgeFeeOutputIndex: undefined | number
      swapRoute: undefined | SwapRouteViaALEX | SwapRouteViaEVMDexAggregator
    },
  ) => Promise<void>
}
async function constructBRC20Transaction(
  sdkContext: SDKGlobalContext,
  info: ConstructBRC20TransactionInput,
): Promise<{
  hex: string
  revealOutput: {
    index: number
    satsAmount: bigint
  }
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}> {
  const txOptions = await prepareBRC20Transaction(sdkContext, info)

  const recipients =
    txOptions.changeAmount > 0n
      ? txOptions.recipients.concat({
          addressScriptPubKey: info.networkFeeChangeAddressScriptPubKey,
          satsAmount: txOptions.changeAmount,
        })
      : txOptions.recipients

  const tx = createTransaction(
    txOptions.inputs,
    recipients,
    txOptions.opReturnScripts ?? [],
  )

  const { psbt } = await info.signPsbt({
    psbt: tx.toPSBT(),
    signInscriptionInputs: [0],
    signBitcoinInputs: range(1, tx.inputsLength),
  })

  const signedTx = btc.Transaction.fromPSBT(psbt, {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
  })
  if (!signedTx.isFinal) {
    signedTx.finalize()
  }

  const revealTx = await createRevealTx(sdkContext, {
    fromChain: info.fromChain,
    txId: signedTx.id,
    vout: txOptions.revealOutput.index,
    satsAmount: txOptions.revealOutput.satsAmount,
    orderData: info.orderData,
    pegInAddress: info.pegInAddress,
  })

  await info
    .validateBridgeOrder(signedTx.extract(), decodeHex(revealTx.txHex), {
      transferOutputIndex: txOptions.transferOutput.index,
      bridgeFeeOutputIndex: txOptions.bridgeFeeOutput?.index,
      swapRoute: info.swapRoute,
    })
    .catch(err => {
      if (sdkContext.brc20.ignoreValidateResult) {
        console.error(
          "Bridge tx validation failed, but ignoreValidateResult is true, so we ignore the error",
          err,
        )
      } else {
        throw new BridgeValidateFailedError(err)
      }
    })

  return {
    hex: signedTx.hex,
    revealOutput: txOptions.revealOutput,
    extraOutputs: txOptions.extraOutputs,
  }
}

export type PrepareBRC20TransactionInput = KnownRoute_FromBRC20 & {
  fromAddressScriptPubKey: BridgeFromBRC20Input["fromAddressScriptPubKey"]
  fromAddress: BridgeFromBRC20Input["fromAddress"]
  toAddress: BridgeFromBRC20Input["toAddress"]
  inputInscriptionUTXO: BridgeFromBRC20Input["inputInscriptionUTXO"]

  networkFeeRate: BridgeFromBRC20Input["networkFeeRate"]
  networkFeeChangeAddress: string
  networkFeeChangeAddressScriptPubKey: Uint8Array
  reselectSpendableNetworkFeeUTXOs: BridgeFromBRC20Input["reselectSpendableNetworkFeeUTXOs"]

  pegInAddress: BitcoinAddress
  orderData: Uint8Array
  bridgeFeeOutput: null | {
    address: string
    scriptPubKey: Uint8Array
    satsAmount: BigNumber
  }
  hardLinkageOutput: null | BitcoinAddress
  extraOutputs: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
}
/**
 * Bitcoin Tx Structure:
 *
 * * Inputs: ...
 * * Outputs:
 *   * Peg-in BRC-20 tokens
 *   * Peg-in order data
 *   * Bridge fee (optional)
 *   * Hard linkage (optional)
 *   * ...extra outputs
 *   * BTC change (optional)
 *
 * (with bridge fee example tx) https://mempool.space/testnet/tx/e127a2d3c343675a1cde8ca8d10ae5621b40d309ce44b4f45bedc10499f8d596
 * (with hard linkage example tx) https://mempool.space/tx/51ff0b2de15cb6e9df0685458faf9b13d761b6e5991496b89c53641d27a8c9da#vin=1
 */
export async function prepareBRC20Transaction(
  sdkContext: Pick<SDKGlobalContext, "backendAPI">,
  info: PrepareBRC20TransactionInput,
): Promise<
  BitcoinTransactionPrepareResult & {
    bitcoinNetwork: typeof btc.NETWORK
    transferOutput: {
      index: number
    }
    revealOutput: {
      index: number
      satsAmount: bigint
    }
    bridgeFeeOutput?: {
      index: number
      satsAmount: bigint
    }
    hardLinkageOutput?: {
      index: number
      satsAmount: bigint
    }
    extraOutputs: {
      index: number
      satsAmount: bigint
    }[]
  }
> {
  const bitcoinNetwork =
    getChainIdNetworkType(info.fromChain) === "mainnet"
      ? btc.NETWORK
      : btc.TEST_NETWORK

  const pegInOrderRecipient = await createBitcoinPegInRecipients(sdkContext, {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: info.toChain,
    toToken: info.toToken,
    fromAddress: {
      address: info.fromAddress,
      scriptPubKey: info.fromAddressScriptPubKey,
    },
    toAddress: info.toAddress,
    orderData: info.orderData,
    feeRate: info.networkFeeRate,
  })

  const result = await prepareTransaction({
    pinnedUTXOs: [info.inputInscriptionUTXO],
    recipients: [
      {
        addressScriptPubKey: info.pegInAddress.scriptPubKey,
        satsAmount: info.inputInscriptionUTXO.amount,
      },
      {
        addressScriptPubKey: pegInOrderRecipient.scriptPubKey,
        satsAmount: pegInOrderRecipient.satsAmount,
      },
      ...(info.bridgeFeeOutput == null
        ? []
        : [
            {
              addressScriptPubKey: info.pegInAddress.scriptPubKey,
              satsAmount: BigNumber.toBigInt(
                { roundingMode: BigNumber.roundUp },
                info.bridgeFeeOutput.satsAmount,
              ),
            },
          ]),
      ...(info.hardLinkageOutput == null
        ? []
        : [
            {
              addressScriptPubKey: info.hardLinkageOutput.scriptPubKey,
              satsAmount: BITCOIN_OUTPUT_MINIMUM_AMOUNT,
            },
          ]),
      ...info.extraOutputs.map(o => ({
        addressScriptPubKey: o.address.scriptPubKey,
        satsAmount: o.satsAmount,
      })),
    ],
    changeAddressScriptPubKey: info.networkFeeChangeAddressScriptPubKey,
    feeRate: info.networkFeeRate,
    reselectSpendableUTXOs: reselectSpendableUTXOsFactory(
      info.reselectSpendableNetworkFeeUTXOs,
    ),
  })

  const pegInBRC20TokensCausedOffset = 1
  const pegInOrderDataCausedOffset = pegInBRC20TokensCausedOffset + 1
  const bridgeFeeCausedOffset =
    pegInOrderDataCausedOffset + (info.bridgeFeeOutput == null ? 0 : 1)
  const hardLinkageCausedOffset =
    bridgeFeeCausedOffset + (info.hardLinkageOutput == null ? 0 : 1)
  const extraOutputsStartOffset = hardLinkageCausedOffset

  return {
    ...result,
    bitcoinNetwork,
    transferOutput: {
      index: pegInBRC20TokensCausedOffset - 1,
    },
    revealOutput: {
      index: pegInOrderDataCausedOffset - 1,
      satsAmount: pegInOrderRecipient.satsAmount,
    },
    bridgeFeeOutput:
      info.bridgeFeeOutput == null
        ? undefined
        : {
            index: bridgeFeeCausedOffset - 1,
            satsAmount: bitcoinToSatoshi(
              BigNumber.toString(info.bridgeFeeOutput.satsAmount),
            ),
          },
    hardLinkageOutput:
      info.hardLinkageOutput == null
        ? undefined
        : {
            index: hardLinkageCausedOffset - 1,
            satsAmount: BITCOIN_OUTPUT_MINIMUM_AMOUNT,
          },
    extraOutputs: info.extraOutputs.map((o, i) => ({
      index: extraOutputsStartOffset + i,
      satsAmount: o.satsAmount,
    })),
  }
}
