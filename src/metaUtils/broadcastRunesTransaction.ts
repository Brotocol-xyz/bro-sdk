import * as btc from "@scure/btc-signer"
import { createTransaction } from "../bitcoinHelpers"
import { broadcastRevealableTransaction } from "../bitcoinUtils/apiHelpers/broadcastRevealableTransaction"
import { createRevealTx } from "../bitcoinUtils/apiHelpers/createRevealTx"
import { BitcoinAddress } from "../bitcoinUtils/btcAddresses"
import { SignPsbtInput_SigHash } from "../bitcoinUtils/types"
import {
  KnownRoute_FromRunes,
  getBitcoinHardLinkageAddress,
} from "../lowlevelUnstableInfos"
import { SDKNumber, toSDKNumberOrUndefined } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { CreateBridgeOrderResult } from "../stacksUtils/createBridgeOrderFromBitcoin"
import { validateBridgeOrderFromMeta } from "../stacksUtils/validateBridgeOrderFromMeta"
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
import { getMetaPegInAddress } from "./btcAddresses"
import {
  PrepareRunesTransactionInput,
  prepareRunesTransaction,
} from "./prepareRunesTransaction"
import {
  BridgeFromRunesInput_sendTransactionFn,
  BridgeFromRunesInput_signPsbtFn,
} from "./types"

export async function broadcastRunesTransaction(
  sdkContext: SDKGlobalContext,
  info: Omit<
    ConstructRunesTransactionInput,
    "validateBridgeOrder" | "orderData" | "pegInAddress" | "hardLinkageOutput"
  > & {
    withHardLinkageOutput: boolean
    sendTransaction: BridgeFromRunesInput_sendTransactionFn
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
  const pegInAddress = getMetaPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const route: KnownRoute_FromRunes = {
    fromChain: info.fromChain,
    fromToken: info.fromToken,
    toChain: info.toChain as any,
    toToken: info.toToken as any,
  }

  const tx = await constructRunesTransaction(sdkContext, {
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
      // void validateBridgeOrderFromMeta(sdkContext, {
      //   chainId: info.fromChain,
      //   commitTx: btcTx,
      //   revealTx,
      //   terminatingStacksToken: createdOrder.tokenOutTrait,
      //   transferOutputIndex: extra.transferOutputIndex,
      //   bridgeFeeOutputIndex: extra.bridgeFeeOutputIndex,
      //   swapRoute: extra.swapRoute,
      // })
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

type ConstructRunesTransactionInput = Omit<
  PrepareRunesTransactionInput,
  | "pegInAddress"
  | "pinnedInputs"
  | "appendInputs"
  | "pinnedOutputs"
  | "appendOutputs"
> & {
  extraOutputs: {
    address: BitcoinAddress
    satsAmount: bigint
  }[]
  swapRoute:
    | undefined
    | SwapRoute_GoThroughStacks_WithMinimumAmountsToReceive_Public
  signPsbt: BridgeFromRunesInput_signPsbtFn
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
async function constructRunesTransaction(
  sdkContext: SDKGlobalContext,
  info: ConstructRunesTransactionInput,
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
  const txOptions = await prepareRunesTransaction(
    sdkContext,
    "bridgeFromRunes",
    {
      ...info,
      toChain: info.toChain as any,
      toToken: info.toToken as any,
      pinnedInputs: [],
      appendInputs: [],
      pinnedOutputs: [],
      appendOutputs: info.extraOutputs,
    },
  )

  const recipients =
    txOptions.changeAmount > 0n
      ? txOptions.recipients.concat({
          addressScriptPubKey: info.networkFeeChangeAddressScriptPubKey,
          satsAmount: txOptions.changeAmount,
        })
      : txOptions.recipients

  const tx = createTransaction(
    txOptions.inputs.map(i => ({
      ...i,
      sighashType: Number(SignPsbtInput_SigHash.ALL),
    })),
    recipients,
    txOptions.opReturnScripts ?? [],
  )

  const { psbt } = await info.signPsbt({
    psbt: tx.toPSBT(),
    signRunesInputs: range(0, info.inputRuneUTXOs.length).map(inputIndex => [
      inputIndex,
      SignPsbtInput_SigHash.ALL,
    ]),
    signBitcoinInputs: range(info.inputRuneUTXOs.length, tx.inputsLength).map(
      inputIndex => [inputIndex, SignPsbtInput_SigHash.ALL],
    ),
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
    .validateBridgeOrder(signedTx.extract(), decodeHex(revealTx.txHex), {
      transferOutputIndex: txOptions.transferOutput.index,
      bridgeFeeOutputIndex: txOptions.bridgeFeeOutput?.index,
      swapRoute: info.swapRoute,
    })
    .catch(err => {
      if (sdkContext.runes.ignoreValidateResult) {
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

type EstimateRunesTransactionInput = Omit<
  PrepareRunesTransactionInput,
  | "hardLinkageOutput"
  | "pegInAddress"
  | "pinnedInputs"
  | "appendInputs"
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
export interface EstimateRunesTransactionOutput {
  fee: SDKNumber
  estimatedVSize: SDKNumber
  revealTransactionSatoshiAmount?: SDKNumber
}
export async function estimateRunesTransaction(
  sdkContext: SDKGlobalContext,
  info: EstimateRunesTransactionInput,
): Promise<EstimateRunesTransactionOutput> {
  const pegInAddress = getMetaPegInAddress(info.fromChain, info.toChain)
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const resp = await prepareRunesTransaction(
    sdkContext,
    "estimateBridgeTransactionFromRunes",
    {
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
      appendInputs: [],
      pinnedOutputs: [],
      appendOutputs: info.extraOutputs,
    },
  )

  return {
    fee: toSDKNumberOrUndefined(resp.fee),
    estimatedVSize: toSDKNumberOrUndefined(resp.estimatedVSize),
    revealTransactionSatoshiAmount: toSDKNumberOrUndefined(
      resp.revealOutput.satsAmount,
    ),
  }
}
