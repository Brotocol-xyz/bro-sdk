import { NETWORK, p2tr, TEST_NETWORK } from "@scure/btc-signer"
import { checkNever } from "../utils/typeHelpers"
import { KnownChainId } from "../utils/types/knownIds"
import { addressToScriptPubKey } from "./bitcoinHelpers"
import { SwapRoute } from "../utils/SwapRouteHelpers"

export interface BitcoinAddress {
  address: string
  scriptPubKey: Uint8Array
}

export function getBTCPegInAddress(
  fromChain: KnownChainId.BitcoinChain,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toChain: KnownChainId.KnownChain,
): undefined | BitcoinAddress {
  let addr: undefined | string
  switch (fromChain) {
    case KnownChainId.Bitcoin.Mainnet:
      // /**
      //  * https://t.me/c/1599543687/51386
      //  */
      // addr = "bc1qlhkfxlzzzcc25z95v7c0v7svlp5exegxn0tf58"
      /**
       * https://t.me/c/1599543687/54621
       */
      addr = "bc1q9hs56nskqsxmgend4w0823lmef33sux6p8rzlp"
      break
    case KnownChainId.Bitcoin.Testnet:
      addr = "tb1qeprcndv9n8luumegjsnljjcf68e7ay62n5a667"
      break
    default:
      checkNever(fromChain)
  }

  if (addr == null) return undefined

  const script = addressToScriptPubKey(
    fromChain === KnownChainId.Bitcoin.Mainnet ? NETWORK : TEST_NETWORK,
    addr,
  )

  return {
    address: addr,
    scriptPubKey: script,
  }
}

export const getBitcoinHardLinkageAddress = (
  fromChain:
    | KnownChainId.BitcoinChain
    | KnownChainId.BRC20Chain
    | KnownChainId.RunesChain,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toChain: KnownChainId.KnownChain,
  swapRoute: undefined | Pick<SwapRoute, "via">,
): undefined | BitcoinAddress => {
  const pubKey =
    "1ab1c25de20e4f186a405abb7430e05439269c53d99938741961ee9db83ee58d"

  if (
    swapRoute?.via === "evmDexAggregator" ||
    swapRoute?.via === "instantSwap"
  ) {
    return undefined
  }

  let bitcoinNetwork: undefined | typeof NETWORK | typeof TEST_NETWORK
  switch (fromChain) {
    case KnownChainId.Bitcoin.Mainnet:
    case KnownChainId.BRC20.Mainnet:
    case KnownChainId.Runes.Mainnet:
      bitcoinNetwork = NETWORK
      break
    case KnownChainId.Bitcoin.Testnet:
    case KnownChainId.BRC20.Testnet:
    case KnownChainId.Runes.Testnet:
      bitcoinNetwork = TEST_NETWORK
      break
    default:
      checkNever(fromChain)
  }

  if (bitcoinNetwork == null) return undefined

  const payment = p2tr(pubKey, undefined, bitcoinNetwork)

  return {
    address: payment.address!,
    scriptPubKey: payment.script,
  }
}
