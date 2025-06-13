import * as btc from "@scure/btc-signer"
import { equalBytes } from "@scure/btc-signer/utils"
import { broadcastRevealableTransaction } from "../bitcoinUtils/apiHelpers/broadcastRevealableTransaction"
import { createBitcoinPegInRecipients } from "../bitcoinUtils/apiHelpers/createBitcoinPegInRecipients"
import { createRevealTx } from "../bitcoinUtils/apiHelpers/createRevealTx"
import {
  UTXOSpendable,
  addressToScriptPubKey,
  bitcoinToSatoshi,
  excludeUTXOs,
  sumUTXO,
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
import { isSupportedBitcoinRoute } from "../bitcoinUtils/peggingHelpers"
import {
  BitcoinTransactionPrepareResult,
  ReselectSpendableUTXOsFn,
  prepareTransaction,
} from "../bitcoinUtils/prepareTransaction"
import {
  CreateBridgeOrderResult,
  createBridgeOrder_BitcoinToEVM,
  createBridgeOrder_BitcoinToMeta,
  createBridgeOrder_BitcoinToStacks,
  createBridgeOrder_BitcoinToSolana,
  createBridgeOrder_BitcoinToTron,
} from "../stacksUtils/createBridgeOrderFromBitcoin"
import { validateBridgeOrderFromBitcoin } from "../stacksUtils/validateBridgeOrderFromBitcoin"
import { getStacksTokenContractInfo } from "../stacksUtils/contractHelpers"
import { range } from "../utils/arrayHelpers"
import { BigNumber } from "../utils/BigNumber"
import {
  KnownRoute_FromBitcoin,
  KnownRoute_FromBitcoin_ToBRC20,
  KnownRoute_FromBitcoin_ToEVM,
  KnownRoute_FromBitcoin_ToRunes,
  KnownRoute_FromBitcoin_ToStacks,
  KnownRoute_FromBitcoin_ToSolana,
  KnownRoute_FromBitcoin_ToTron,
  checkRouteValid,
} from "../utils/buildSupportedRoutes"
import {
  BridgeValidateFailedError,
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { decodeHex } from "../utils/hexHelpers"
import {
  SwapRouteViaALEX,
  SwapRouteViaALEX_WithMinimumAmountsToReceive_Public,
  SwapRouteViaEVMDexAggregator,
  SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public,
  SwapRoute_WithMinimumAmountsToReceive_Public,
} from "../utils/SwapRouteHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  KnownChainId,
  KnownTokenId,
  _knownChainIdToErrorMessagePart,
} from "../utils/types/knownIds"
import { ChainId, SDKNumber, TokenId, isEVMAddress } from "./types"
import { SDKGlobalContext } from "./types.internal"

export type BridgeFromBitcoinInput_signPsbtFn = (tx: {
  psbt: Uint8Array
  signInputs: number[]
}) => Promise<{ psbt: Uint8Array }>

export type BridgeFromBitcoinInput_reselectSpendableUTXOs =
  ReselectSpendableUTXOsFn_Public

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

export interface BridgeFromBitcoinOutput {
  txid: string
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
      [SDK_NAME, "bridgeFromBitcoin"],
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
        [SDK_NAME, "bridgeFromBitcoin"],
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
      withHardLinkageOutput: false,
      swapRoute: info.swapRoute,
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

  const createdOrder = !isEVMAddress(info.toAddress)
    ? null
    : await createBridgeOrder_BitcoinToEVM(sdkContext, {
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

  return broadcastBitcoinTransaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: false,
      swapRoute: info.swapRoute,
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

  return broadcastBitcoinTransaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: true,
      swapRoute: info.swapRoute,
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

  const createdOrder = await createBridgeOrder_BitcoinToSolana(sdkContext, {
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

  return broadcastBitcoinTransaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: false,
      swapRoute: info.swapRoute,
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

  const createdOrder = await createBridgeOrder_BitcoinToTron(sdkContext, {
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

  return broadcastBitcoinTransaction(
    sdkContext,
    {
      ...info,
      withHardLinkageOutput: false,
      swapRoute: info.swapRoute,
      extraOutputs: info.extraOutputs ?? [],
    },
    createdOrder,
  )
}

async function broadcastBitcoinTransaction(
  sdkContext: SDKGlobalContext,
  info: Omit<
    ConstructBitcoinTransactionInput,
    "validateBridgeOrder" | "orderData" | "pegInAddress" | "hardLinkageOutput"
  > & {
    withHardLinkageOutput: boolean
    sendTransaction: BridgeFromBitcoinInput["sendTransaction"]
  },
  createdOrder: CreateBridgeOrderResult,
): Promise<{
  txid: string
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}> {
  const pegInAddress = getBTCPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const route: KnownRoute_FromBitcoin = {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: info.toChain,
    toToken: info.toToken,
  } as any

  const tx = await constructBitcoinTransaction(sdkContext, {
    ...info,
    ...route,
    validateBridgeOrder: (btcTx, revealTx, swapRoute) => {
      if (revealTx == null) {
        throw new UnsupportedBridgeRouteError(
          info.fromChain,
          info.toChain,
          info.fromToken,
          info.toToken,
        )
      }

      return validateBridgeOrderFromBitcoin({
        chainId: info.fromChain,
        commitTx: btcTx,
        revealTx,
        terminatingStacksToken: createdOrder.tokenOutTrait,
        swapRoute,
      })
    },
    orderData: createdOrder.data,
    pegInAddress,
    hardLinkageOutput: info.withHardLinkageOutput
      ? ((await getBitcoinHardLinkageAddress(info.fromChain, info.toChain)) ??
        null)
      : null,
  })

  if (tx.revealOutput == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

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

type ConstructBitcoinTransactionInput = PrepareBitcoinTransactionInput & {
  swapRoute:
    | undefined
    | SwapRouteViaALEX_WithMinimumAmountsToReceive_Public
    | SwapRouteViaEVMDexAggregator_WithMinimumAmountsToReceive_Public
  signPsbt: BridgeFromBitcoinInput["signPsbt"]
  validateBridgeOrder: (
    pegInTx: Uint8Array,
    revealTx: undefined | Uint8Array,
    swapRoute: undefined | SwapRouteViaALEX | SwapRouteViaEVMDexAggregator,
  ) => Promise<void>
}
async function constructBitcoinTransaction(
  sdkContext: SDKGlobalContext,
  info: ConstructBitcoinTransactionInput,
): Promise<{
  hex: string
  revealOutput?: {
    index: number
    satsAmount: bigint
  }
  extraOutputs: {
    index: number
    satsAmount: bigint
  }[]
}> {
  const txOptions = await prepareBitcoinTransaction(sdkContext, info)

  const tx = createTransaction(
    txOptions.inputs,
    txOptions.recipients.concat({
      addressScriptPubKey: info.fromAddressScriptPubKey,
      satsAmount: txOptions.changeAmount,
    }),
    txOptions.opReturnScripts ?? [],
  )

  const { psbt } = await info.signPsbt({
    psbt: tx.toPSBT(),
    signInputs: range(0, tx.inputsLength),
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
    .validateBridgeOrder(
      signedTx.extract(),
      decodeHex(revealTx.txHex),
      info.swapRoute,
    )
    .catch(err => {
      if (sdkContext.btc.ignoreValidateResult) {
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

export type PrepareBitcoinTransactionInput = KnownRoute_FromBitcoin & {
  fromAddressScriptPubKey: BridgeFromBitcoinInput["fromAddressScriptPubKey"]
  fromAddress: BridgeFromBitcoinInput["fromAddress"]
  toAddress: BridgeFromBitcoinInput["toAddress"]
  amount: BridgeFromBitcoinInput["amount"]
  networkFeeRate: BridgeFromBitcoinInput["networkFeeRate"]
  reselectSpendableUTXOs: BridgeFromBitcoinInput["reselectSpendableUTXOs"]
  orderData: Uint8Array
  hardLinkageOutput: null | BitcoinAddress
  pegInAddress: BitcoinAddress
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
 *    * Order data
 *    * Send to ALEX
 *    * Hard linkage (optional)
 *    * Bitcoin Changes
 */
export async function prepareBitcoinTransaction(
  sdkContext: Pick<SDKGlobalContext, "backendAPI">,
  info: PrepareBitcoinTransactionInput,
): Promise<
  BitcoinTransactionPrepareResult & {
    bitcoinNetwork: typeof btc.NETWORK
    revealOutput: {
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
    info.fromChain === KnownChainId.Bitcoin.Mainnet
      ? btc.NETWORK
      : btc.TEST_NETWORK

  const recipient = await createBitcoinPegInRecipients(sdkContext, {
    fromChain: info.fromChain,
    toChain: info.toChain,
    fromToken: info.fromToken,
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
    recipients: [
      {
        addressScriptPubKey: recipient.scriptPubKey,
        satsAmount: recipient.satsAmount,
      },
      {
        addressScriptPubKey: info.pegInAddress.scriptPubKey,
        satsAmount: bitcoinToSatoshi(info.amount),
      },
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
    changeAddressScriptPubKey: info.fromAddressScriptPubKey,
    feeRate: info.networkFeeRate,
    reselectSpendableUTXOs: reselectSpendableUTXOsFactory(
      info.reselectSpendableUTXOs,
    ),
  })

  const pegInOrderDataCausedOffset = 1
  const pegInBitcoinTokenCausedOffset = pegInOrderDataCausedOffset + 1
  const hardLinkageCausedOffset =
    pegInBitcoinTokenCausedOffset + (info.hardLinkageOutput == null ? 0 : 1)
  const extraOutputsStartOffset = hardLinkageCausedOffset

  return {
    ...result,
    bitcoinNetwork,
    revealOutput: {
      index: pegInOrderDataCausedOffset - 1,
      satsAmount: recipient.satsAmount,
    },
    hardLinkageOutput:
      hardLinkageCausedOffset == null
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

export type ReselectSpendableUTXOsFn_Public = (
  satsToSend: bigint,
  lastTimeSelectedUTXOs: UTXOSpendable[],
) => Promise<UTXOSpendable[]>
export function reselectSpendableUTXOsFactory(
  reselectSpendableUTXOs_public: ReselectSpendableUTXOsFn_Public,
): ReselectSpendableUTXOsFn {
  return async (satsToSend, pinnedUTXOs, lastTimeSelectedUTXOs) => {
    satsToSend = satsToSend - sumUTXO(pinnedUTXOs)
    lastTimeSelectedUTXOs = lastTimeSelectedUTXOs.filter(
      excludeUTXOs(pinnedUTXOs),
    )
    const selected = await reselectSpendableUTXOs_public(
      satsToSend,
      lastTimeSelectedUTXOs,
    )
    return [...pinnedUTXOs, ...selected]
  }
}
