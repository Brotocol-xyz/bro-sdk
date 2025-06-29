import * as btc from "@scure/btc-signer"
import { BridgeFromBitcoinInput } from "../sdkUtils/bridgeFromBitcoin"
import { SDKNumber, toSDKNumberOrUndefined } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { CreateBridgeOrderResult } from "../stacksUtils/createBridgeOrderFromBitcoin"
import { validateBridgeOrderFromBitcoin } from "../stacksUtils/validateBridgeOrderFromBitcoin"
import { range } from "../utils/arrayHelpers"
import {
  BridgeValidateFailedError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { decodeHex } from "../utils/hexHelpers"
import {
  SwapRouteViaALEX,
  SwapRouteViaEVMDexAggregator,
  SwapRoute_GoThroughStacks_WithMinimumAmountsToReceive_Public,
} from "../utils/SwapRouteHelpers"
import { broadcastRevealableTransaction } from "./apiHelpers/broadcastRevealableTransaction"
import { createRevealTx } from "./apiHelpers/createRevealTx"
import {
  BitcoinAddress,
  getBTCPegInAddress,
  getBitcoinHardLinkageAddress,
} from "./btcAddresses"
import { createTransaction } from "./createTransaction"
import {
  PrepareBitcoinTransactionInput,
  prepareBitcoinTransaction,
} from "./prepareBitcoinTransaction"
import { SignPsbtInput_SigHash } from "./types"

export async function broadcastBitcoinTransaction(
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
  tx: Uint8Array
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

  const tx = await constructBitcoinTransaction(sdkContext, {
    ...info,
    validateBridgeOrder: (btcTx, revealTx, swapRoute) => {
      if (revealTx == null) {
        throw new UnsupportedBridgeRouteError(
          info.fromChain,
          info.toChain,
          info.fromToken,
          info.toToken,
        )
      }

      return validateBridgeOrderFromBitcoin(sdkContext, {
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
      ? ((await getBitcoinHardLinkageAddress(
          info.fromChain,
          info.toChain,
          info.swapRoute,
        )) ?? null)
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
      revealToAddress: pegInAddress,
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
    tx: decodeHex(tx.hex),
    extraOutputs: tx.extraOutputs,
  }
}

type ConstructBitcoinTransactionInput = Omit<
  PrepareBitcoinTransactionInput,
  "pegInAddress" | "pinnedInputs" | "pinnedOutputs" | "appendOutputs"
> & {
  pegInAddress: BitcoinAddress
  extraOutputs: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
  swapRoute:
    | undefined
    | SwapRoute_GoThroughStacks_WithMinimumAmountsToReceive_Public
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
  const txOptions = await prepareBitcoinTransaction(sdkContext, {
    ...info,
    toChain: info.toChain as any,
    toToken: info.toToken as any,
    pinnedInputs: [],
    pinnedOutputs: [],
    appendOutputs: info.extraOutputs ?? [],
  })

  const tx = createTransaction(
    txOptions.inputs.map(i => ({
      ...i,
      sighashType: Number(SignPsbtInput_SigHash.ALL),
    })),
    txOptions.recipients.concat({
      addressScriptPubKey: info.fromAddressScriptPubKey,
      satsAmount: txOptions.changeAmount,
    }),
    txOptions.opReturnScripts ?? [],
  )

  const { psbt } = await info.signPsbt({
    psbt: tx.toPSBT(),
    signInputs: range(0, tx.inputsLength).map(inputIndex => [
      inputIndex,
      SignPsbtInput_SigHash.ALL,
    ]),
    selectedUTXOs: txOptions.inputs.map(i => ({
      txId: i.txId,
      index: i.index,
      amount: i.amount,
    })),
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
    extraOutputs: txOptions.appendOutputs,
  }
}

type EstimateBitcoinTransactionInput = Omit<
  PrepareBitcoinTransactionInput,
  | "hardLinkageOutput"
  | "pegInAddress"
  | "pinnedInputs"
  | "pinnedOutputs"
  | "appendOutputs"
> & {
  extraOutputs: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
  withHardLinkageOutput: boolean
  orderData: Uint8Array
  swapRoute:
    | undefined
    | SwapRoute_GoThroughStacks_WithMinimumAmountsToReceive_Public
}
export interface EstimateBitcoinTransactionOutput {
  fee: SDKNumber
  estimatedVSize: SDKNumber
  revealTransactionSatoshiAmount?: SDKNumber
}
export async function estimateBitcoinTransaction(
  sdkContext: SDKGlobalContext,
  info: EstimateBitcoinTransactionInput,
): Promise<EstimateBitcoinTransactionOutput> {
  const pegInAddress = getBTCPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const resp = await prepareBitcoinTransaction(sdkContext, {
    ...info,
    toChain: info.toChain as any,
    toToken: info.toToken as any,
    pegInAddress,
    hardLinkageOutput:
      (await getBitcoinHardLinkageAddress(
        info.fromChain,
        info.toChain,
        info.swapRoute,
      )) ?? null,
    pinnedInputs: [],
    pinnedOutputs: [],
    appendOutputs: info.extraOutputs ?? [],
  })

  return {
    fee: toSDKNumberOrUndefined(resp.fee),
    estimatedVSize: toSDKNumberOrUndefined(resp.estimatedVSize),
    revealTransactionSatoshiAmount: toSDKNumberOrUndefined(
      resp.revealOutput.satsAmount,
    ),
  }
}
