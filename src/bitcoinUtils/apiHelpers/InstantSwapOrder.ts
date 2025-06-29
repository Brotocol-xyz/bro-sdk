import { ClarityValue } from "@stacks/transactions"
import {
  bufferT,
  optionalT,
  tupleT,
  uintT,
} from "../../../generated/smartContractHelpers/codegenImport"
import { numberToStacksContractNumber } from "../../stacksUtils/contractHelpers"
import {
  contractAssignedChainIdFromKnownChain,
  contractAssignedChainIdToKnownChain,
} from "../../stacksUtils/crossContractDataMapping"
import { BigNumber } from "../../utils/BigNumber"
import { decodeHex, encodeZeroPrefixedHex } from "../../utils/hexHelpers"
import { KnownChainId, KnownTokenId } from "../../utils/types/knownIds"

export type InstantSwapChain =
  | KnownChainId.BitcoinChain
  | KnownChainId.RunesChain

export type InstantSwapToken =
  | KnownTokenId.BitcoinToken
  | KnownTokenId.RunesToken

export type InstantSwapOrder = {
  fromChain: InstantSwapChain
  fromAddress: Uint8Array
  fromTokenId: InstantSwapToken
  fromAmount: BigNumber

  toChain: InstantSwapChain
  toAddress: Uint8Array
  toTokenId: InstantSwapToken
  toAmount: BigNumber
}

export interface InstantSwapOrderSerialized {
  fromChain: InstantSwapChain
  fromAddress: `0x${string}`
  fromTokenId: InstantSwapToken
  fromAmount: `${number}`

  toChain: InstantSwapChain
  toAddress: `0x${string}`
  toTokenId: InstantSwapToken
  toAmount: `${number}`
}

export const serializeInstantSwapOrder = async (
  network: "mainnet" | "testnet",
  order: InstantSwapOrder,
): Promise<InstantSwapOrderSerialized | null> => {
  return {
    fromChain: order.fromChain,
    fromAddress: encodeZeroPrefixedHex(order.fromAddress),
    fromTokenId: order.fromTokenId,
    fromAmount: BigNumber.toString(order.fromAmount),
    toChain: order.toChain,
    toAddress: encodeZeroPrefixedHex(order.toAddress),
    toTokenId: order.toTokenId,
    toAmount: BigNumber.toString(order.toAmount),
  }
}

export const deserializeInstantSwapOrder = async (
  network: "mainnet" | "testnet",
  serialized: InstantSwapOrderSerialized,
): Promise<null | InstantSwapOrder> => {
  return {
    fromChain: serialized.fromChain,
    fromAddress: decodeHex(serialized.fromAddress),
    fromTokenId: serialized.fromTokenId,
    fromAmount: BigNumber.from(serialized.fromAmount),
    toChain: serialized.toChain,
    toAddress: decodeHex(serialized.toAddress),
    toTokenId: serialized.toTokenId,
    toAmount: BigNumber.from(serialized.toAmount),
  }
}

const instantSwapOrderSchema = tupleT({
  v: uintT, // version
  fc: optionalT(uintT), // fromChain
  ft: bufferT, // fromTokenId
  fa: bufferT, // fromAddress
  fn: uintT, // fromAmount
  tc: optionalT(uintT), // toChain
  tt: bufferT, // toTokenId
  ta: bufferT, // toAddress
  tn: uintT, // toAmount
})
export interface InstantSwapOrderData {
  fromChain: KnownChainId.KnownChain
  fromAddress: Uint8Array
  fromToken: Uint8Array
  fromAmount: BigNumber

  toChain: KnownChainId.KnownChain
  toAddress: Uint8Array
  toToken: Uint8Array
  toAmount: BigNumber
}
export const encodeInstantSwapOrderData = async (
  stacksNetwork: KnownChainId.StacksChain,
  info: InstantSwapOrderData,
): Promise<undefined | ClarityValue> => {
  return instantSwapOrderSchema.encode({
    v: 0n,
    fc: getChainId(info.fromChain),
    ft: info.fromToken,
    fa: info.fromAddress,
    fn: numberToStacksContractNumber(info.fromAmount),
    tc: getChainId(info.toChain),
    tt: info.toToken,
    ta: info.toAddress,
    tn: numberToStacksContractNumber(info.toAmount),
  })

  function getChainId(chain: KnownChainId.KnownChain): undefined | bigint {
    if (KnownChainId.isStacksChain(chain)) return
    return contractAssignedChainIdFromKnownChain(chain)
  }
}
export const decodeInstantSwapOrderData = async (
  stacksNetwork: KnownChainId.StacksChain,
  data: ClarityValue,
): Promise<undefined | InstantSwapOrderData> => {
  let res: ReturnType<typeof instantSwapOrderSchema.decode>
  try {
    res = instantSwapOrderSchema.decode(data)
  } catch (e) {
    return
  }

  // if is not supported version
  if (res.v !== 0n) return

  const fromChain = getChain(res.fc)
  const toChain = getChain(res.tc)
  if (fromChain == null || toChain == null) return

  return {
    fromChain,
    fromAddress: res.fa,
    fromToken: res.ft,
    fromAmount: BigNumber.from(res.fn),
    toChain,
    toAddress: res.ta,
    toToken: res.tt,
    toAmount: BigNumber.from(res.tn),
  }

  function getChain(
    chainId: undefined | bigint,
  ): undefined | KnownChainId.KnownChain {
    if (chainId == null) return stacksNetwork
    const chains = contractAssignedChainIdToKnownChain(chainId)
    return stacksNetwork === KnownChainId.Stacks.Mainnet ? chains[0] : chains[1]
  }
}
