import { estimateInputVSizeAfterSign } from "@c4/btc-utils"
import { toHex } from "viem"
import { requestAPI } from "../../utils/apiHelpers"
import { BigNumber } from "../../utils/BigNumber"
import { UnsupportedBridgeRouteError } from "../../utils/errors"
import { decodeHex } from "../../utils/hexHelpers"
import { KnownChainId, KnownTokenId } from "../../utils/types/knownIds"
import { SDKGlobalContext } from "../../sdkUtils/types.internal"
import { getBTCPegInAddress } from "../btcAddresses"
import { BITCOIN_OUTPUT_MINIMUM_AMOUNT } from "../constants"
import { calculateFee } from "../prepareTransaction"
import { getMetaPegInAddress } from "../../metaUtils/btcAddresses"

const REVEAL_TX_OUTPUT_AMOUNT = BITCOIN_OUTPUT_MINIMUM_AMOUNT

export async function createBitcoinPegInRecipients(
  sdkContext: Pick<SDKGlobalContext, "backendAPI">,
  info: {
    fromChain:
      | KnownChainId.BitcoinChain
      | KnownChainId.BRC20Chain
      | KnownChainId.RunesChain
    fromToken:
      | KnownTokenId.BitcoinToken
      | KnownTokenId.BRC20Token
      | KnownTokenId.RunesToken
    toChain:
      | KnownChainId.StacksChain
      | KnownChainId.EVMChain
      | KnownChainId.BitcoinChain
      | KnownChainId.BRC20Chain
      | KnownChainId.RunesChain
      | KnownChainId.SolanaChain
      | KnownChainId.TronChain
    toToken:
      | KnownTokenId.StacksToken
      | KnownTokenId.EVMToken
      | KnownTokenId.BitcoinToken
      | KnownTokenId.BRC20Token
      | KnownTokenId.RunesToken
      | KnownTokenId.SolanaToken
      | KnownTokenId.TronToken
    fromAddress: {
      address: string
      scriptPubKey: Uint8Array
    }
    toAddress: string
    feeRate: bigint
    orderData: Uint8Array
  },
): Promise<{
  address: string
  scriptPubKey: Uint8Array
  satsAmount: bigint
}> {
  const pegInAddress = KnownChainId.isBitcoinChain(info.fromChain)
    ? await getBTCPegInAddress(info.fromChain, info.toChain)
    : KnownChainId.isBRC20Chain(info.fromChain) ||
        KnownChainId.isRunesChain(info.fromChain)
      ? await getMetaPegInAddress(info.fromChain, info.toChain)
      : null
  if (pegInAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const resp = await requestAPI<{
    addresses: BitcoinPegInRecipient[]
  }>(sdkContext, {
    path: `/2024-10-01/bitcoin/peg-in-recipients`,
    method: "POST",
    body: {
      fromChain: info.fromChain,
      toChain: info.toChain,
      fromToken: info.fromToken,
      toToken: info.toToken,
      fromAddress: {
        address: info.fromAddress.address,
        scriptPubKeyHex: toHex(info.fromAddress.scriptPubKey),
      },
      toAddress: info.toAddress,
      orderDataHex: toHex(info.orderData),
    },
  })

  const recipient = resp.addresses.find(
    address => address.type === "commitOrder",
  )!

  const revealInputSize = estimateInputVSizeAfterSign({
    addressType: "p2tr-leafScript",
    tapLeafScriptArgumentByteLengths: [/* signature */ 64],
    tapLeafScriptByteLength: recipient.tapScriptHex.length / 2,
    controlBlockByteLength: 33,
  })
  const { fee: newTxFee } = await calculateFee({
    recipientAddressScriptPubKeys: [pegInAddress.scriptPubKey],
    opReturnScripts: [],
    selectedUTXOs: [],
    feeRate: info.feeRate,
    extraSize: revealInputSize.inputSize + revealInputSize.witnessDataSize / 4,
  })

  const revealUTXOSatsAmount = BigNumber.sum([
    newTxFee,
    REVEAL_TX_OUTPUT_AMOUNT,
  ])

  return {
    address: recipient.address,
    scriptPubKey: decodeHex(recipient.scriptPubKeyHex),
    satsAmount: BigNumber.toBigInt(
      { roundingMode: BigNumber.roundUp },
      revealUTXOSatsAmount,
    ),
  }
}

export interface BitcoinPegInRecipient {
  type: "commitOrder"
  address: string
  scriptPubKeyHex: string
  tapScriptHex: `0x${string}`
}
