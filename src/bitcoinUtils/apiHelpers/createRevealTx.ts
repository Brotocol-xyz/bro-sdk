import { toHex } from "viem"
import { requestAPI } from "../../utils/apiHelpers"
import { KnownChainId } from "../../utils/types/knownIds"
import { SDKGlobalContext } from "../../xlinkSdkUtils/types.internal"

export async function createRevealTx(
  sdkContext: Pick<SDKGlobalContext, "backendAPI">,
  info: {
    fromChain:
      | KnownChainId.BitcoinChain
      | KnownChainId.BRC20Chain
      | KnownChainId.RunesChain
    txId: string
    vout: number
    satsAmount: bigint
    orderData: Uint8Array
    xlinkPegInAddress: {
      address: string
      scriptPubKey: Uint8Array
    }
  },
): Promise<{ txHex: `0x${string}` }> {
  const resp = await requestAPI<{
    revealTxHex: `0x${string}`
  }>(sdkContext, {
    path: `/2024-10-01/bitcoin/reveal-txs`,
    method: "POST",
    body: {
      fromChain: info.fromChain,
      txId: info.txId,
      vout: info.vout,
      satsAmount: info.satsAmount,
      orderDataHex: toHex(info.orderData),
      xlinkPegInAddress: {
        address: info.xlinkPegInAddress.address,
        scriptPubKeyHex: toHex(info.xlinkPegInAddress.scriptPubKey),
      },
    },
  })

  return { txHex: resp.revealTxHex }
}
