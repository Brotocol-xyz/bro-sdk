/**
 * @experimental these APIs are not stable and may change in the future, and are
 *   not covered by semantic versioning. Please use them at your own risk.
 */

import { deserializeCV, serializeCVBytes } from "@stacks/transactions"
import {
  getEVMTokenFromTerminatingStacksTokenContractAddress as _getEVMTokenFromTerminatingStacksTokenContractAddress,
  getStacksTokenFromTerminatingStacksTokenContractAddress as _getStacksTokenFromTerminatingStacksTokenContractAddress,
  getTerminatingStacksTokenContractAddress as _getTerminatingStacksTokenContractAddress,
  evmTokenFromCorrespondingStacksToken,
  evmTokenToCorrespondingStacksToken,
} from "./evmUtils/peggingHelpers"
import {
  metaTokenFromCorrespondingStacksToken,
  metaTokenToCorrespondingStacksToken,
} from "./metaUtils/peggingHelpers"
import {
  SDKNumber,
  SDKNumberifyNestly,
  StacksContractAddress,
  toSDKNumberOrUndefined,
} from "./sdkUtils/types"
import { SDKGlobalContext } from "./sdkUtils/types.internal"
import {
  solanaTokenFromCorrespondingStacksToken,
  solanaTokenToCorrespondingStacksToken,
} from "./solanaUtils/peggingHelpers"
import {
  tronTokenFromCorrespondingStacksToken,
  tronTokenToCorrespondingStacksToken,
} from "./tronUtils/peggingHelpers"
import { BigNumber } from "./utils/BigNumber"
import {
  TransferProphetAppliedResult as _TransferProphetAppliedResult,
  applyTransferProphet as _applyTransferProphet,
  applyTransferProphets as _applyTransferProphets,
} from "./utils/feeRateHelpers"
import { KnownChainId, KnownTokenId } from "./utils/types/knownIds"
import { TransferProphet as _TransferProphet } from "./utils/types/TransferProphet"

export {
  contractAssignedChainIdFromKnownChain,
  contractAssignedChainIdToKnownChain,
} from "./stacksUtils/crossContractDataMapping"
export {
  alexContractDeployerMainnet,
  alexContractDeployerTestnet,
  alexContractMultisigMainnet,
  alexContractMultisigTestnet,
  contractsDeployerMainnet as brotocolContractsDeployerMainnet,
  contractsDeployerTestnet as brotocolContractsDeployerTestnet,
  contractsMultisigMainnet as brotocolContractsMultisigMainnet,
  contractsMultisigTestnet as brotocolContractsMultisigTestnet,
  legacyAlexContractDeployerMainnet,
  legacyAlexContractDeployerTestnet,
  wrapContractAddress,
} from "./stacksUtils/stxContractAddresses"

export {
  KnownRoute_FromBRC20,
  KnownRoute_FromBRC20_ToBitcoin,
  KnownRoute_FromBRC20_ToEVM,
  KnownRoute_FromBRC20_ToRunes,
  KnownRoute_FromBRC20_ToStacks,
  KnownRoute_FromBitcoin,
  KnownRoute_FromBitcoin_ToBRC20,
  KnownRoute_FromBitcoin_ToEVM,
  KnownRoute_FromBitcoin_ToRunes,
  KnownRoute_FromBitcoin_ToStacks,
  KnownRoute_FromEVM,
  KnownRoute_FromEVM_ToBRC20,
  KnownRoute_FromEVM_ToBitcoin,
  KnownRoute_FromEVM_ToEVM,
  KnownRoute_FromEVM_ToRunes,
  KnownRoute_FromEVM_ToStacks,
  KnownRoute_FromRunes,
  KnownRoute_FromRunes_ToBRC20,
  KnownRoute_FromRunes_ToBitcoin,
  KnownRoute_FromRunes_ToEVM,
  KnownRoute_FromRunes_ToStacks,
  KnownRoute_FromStacks,
  KnownRoute_FromStacks_ToBRC20,
  KnownRoute_FromStacks_ToBitcoin,
  KnownRoute_FromStacks_ToEVM,
  KnownRoute_FromStacks_ToRunes,
} from "./utils/buildSupportedRoutes"

export {
  createBRC20Token,
  createEVMToken,
  createRunesToken,
  createStacksToken,
} from "./utils/types/knownIds"

export { addressFromBuffer, addressToBuffer } from "./utils/addressHelpers"

export { bridgeFromEVM_toLaunchpad } from "./sdkUtils/bridgeFromEVM"
export { bridgeInfoFromBitcoin_toLaunchpad } from "./sdkUtils/bridgeInfoFromBitcoin"
export { bridgeInfoFromEVM_toLaunchpad } from "./sdkUtils/bridgeInfoFromEVM"

export { getBitcoinHardLinkageAddress } from "./bitcoinUtils/btcAddresses"

export * as BitcoinTransactionCheckHelpers from "./utils/bitcoinTransactionCheckHelpers.export"

export const getSDKContext = (
  sdk: import("./BroSDK").BroSDK,
): SDKGlobalContext => {
  return sdk["sdkContext"]
}

export const getTerminatingStacksTokenContractAddress = async (
  sdk: import("./BroSDK").BroSDK,
  info: {
    evmChain: KnownChainId.EVMChain
    evmToken: KnownTokenId.EVMToken
    stacksChain: KnownChainId.StacksChain
  },
): Promise<undefined | StacksContractAddress> => {
  return _getTerminatingStacksTokenContractAddress(getSDKContext(sdk), info)
}
export const getStacksTokenFromTerminatingStacksTokenContractAddress = async (
  sdk: import("./BroSDK").BroSDK,
  info: {
    stacksChain: KnownChainId.StacksChain
    stacksTokenAddress: StacksContractAddress
  },
): Promise<undefined | KnownTokenId.StacksToken> => {
  return _getStacksTokenFromTerminatingStacksTokenContractAddress(
    getSDKContext(sdk),
    info,
  )
}
export const getEVMTokenIdFromTerminatingStacksTokenContractAddress = async (
  sdk: import("./BroSDK").BroSDK,
  info: {
    evmChain: KnownChainId.EVMChain
    stacksChain: KnownChainId.StacksChain
    stacksTokenAddress: StacksContractAddress
  },
): Promise<undefined | KnownTokenId.EVMToken> => {
  return _getEVMTokenFromTerminatingStacksTokenContractAddress(
    getSDKContext(sdk),
    info,
  )
}

export const evmTokensFromStacksToken = async (
  sdk: import("./BroSDK").BroSDK,
  options: {
    fromStacksChain: KnownChainId.StacksChain
    fromStacksToken: KnownTokenId.StacksToken
    toChain: KnownChainId.EVMChain
  },
): Promise<{
  evmTokens: KnownTokenId.EVMToken[]
}> => {
  const evmTokens = await evmTokenFromCorrespondingStacksToken(
    getSDKContext(sdk),
    options.toChain,
    options.fromStacksToken,
  )
  return { evmTokens }
}
export const evmTokenToStacksToken = async (
  sdk: import("./BroSDK").BroSDK,
  options: {
    fromChain: KnownChainId.EVMChain
    fromToken: KnownTokenId.EVMToken
    toStacksChain: KnownChainId.StacksChain
  },
): Promise<{
  stacksTokens: KnownTokenId.StacksToken[]
}> => {
  const stacksTokens = await evmTokenToCorrespondingStacksToken(
    getSDKContext(sdk),
    options.fromChain,
    options.fromToken,
  )
  return { stacksTokens: stacksTokens == null ? [] : [stacksTokens] }
}

export const metaTokensFromStacksToken = async (
  sdk: import("./BroSDK").BroSDK,
  options: {
    fromStacksChain: KnownChainId.StacksChain
    fromStacksToken: KnownTokenId.StacksToken
    toChain: KnownChainId.BRC20Chain | KnownChainId.RunesChain
  },
): Promise<{
  tokens: (KnownTokenId.BRC20Token | KnownTokenId.RunesToken)[]
}> => {
  const metaTokens = await metaTokenFromCorrespondingStacksToken(
    getSDKContext(sdk),
    options.toChain,
    options.fromStacksToken,
  )
  return { tokens: metaTokens == null ? [] : [metaTokens as any] }
}
export const metaTokenToStacksToken = async (
  sdk: import("./BroSDK").BroSDK,
  options: {
    fromChain: KnownChainId.BRC20Chain | KnownChainId.RunesChain
    fromToken: KnownTokenId.BRC20Token | KnownTokenId.RunesToken
    toStacksChain: KnownChainId.StacksChain
  },
): Promise<{
  stacksTokens: KnownTokenId.StacksToken[]
}> => {
  const stacksTokens = await metaTokenToCorrespondingStacksToken(
    getSDKContext(sdk),
    {
      chain: options.fromChain as any,
      token: options.fromToken as any,
    },
  )
  return { stacksTokens: stacksTokens == null ? [] : [stacksTokens] }
}

export const tronTokenToStacksToken = async (
  sdk: import("./BroSDK").BroSDK,
  chain: KnownChainId.TronChain,
  token: KnownTokenId.TronToken,
): Promise<undefined | KnownTokenId.StacksToken> => {
  return tronTokenToCorrespondingStacksToken(getSDKContext(sdk), chain, token)
}

export const stacksTokenToTronTokens = async (
  sdk: import("./BroSDK").BroSDK,
  chain: KnownChainId.TronChain,
  token: KnownTokenId.StacksToken,
): Promise<KnownTokenId.TronToken[]> => {
  return tronTokenFromCorrespondingStacksToken(getSDKContext(sdk), chain, token)
}

export const solanaTokenToStacksToken = async (
  sdk: import("./BroSDK").BroSDK,
  chain: KnownChainId.SolanaChain,
  token: KnownTokenId.SolanaToken,
): Promise<undefined | KnownTokenId.StacksToken> => {
  return solanaTokenToCorrespondingStacksToken(getSDKContext(sdk), chain, token)
}

export const stacksTokenToSolanaTokens = async (
  sdk: import("./BroSDK").BroSDK,
  chain: KnownChainId.SolanaChain,
  token: KnownTokenId.StacksToken,
): Promise<KnownTokenId.SolanaToken[]> => {
  return solanaTokenFromCorrespondingStacksToken(
    getSDKContext(sdk),
    chain,
    token,
  )
}

import {
  InstantSwapOrderData as _InstantSwapOrderData,
  decodeInstantSwapOrderData as _decodeInstantSwapOrderData,
  encodeInstantSwapOrderData as _encodeInstantSwapOrderData,
} from "./bitcoinUtils/apiHelpers/InstantSwapOrder"
export interface InstantSwapOrderData
  extends Omit<_InstantSwapOrderData, "fromAmount" | "toAmount"> {
  fromAmount: SDKNumber
  toAmount: SDKNumber
}
export const encodeInstantSwapOrderData = async (
  stacksNetwork: KnownChainId.StacksChain,
  data: InstantSwapOrderData,
): Promise<undefined | Uint8Array> => {
  const res = await _encodeInstantSwapOrderData(stacksNetwork, {
    ...data,
    fromAmount: BigNumber.from(data.fromAmount),
    toAmount: BigNumber.from(data.toAmount),
  })
  if (res == null) return
  return serializeCVBytes(res)
}
export const decodeInstantSwapOrderData = async (
  stacksNetwork: KnownChainId.StacksChain,
  data: Uint8Array,
): Promise<undefined | InstantSwapOrderData> => {
  const res = await _decodeInstantSwapOrderData(
    stacksNetwork,
    deserializeCV(data),
  )
  if (res == null) return
  return {
    ...res,
    fromAmount: toSDKNumberOrUndefined(res.fromAmount),
    toAmount: toSDKNumberOrUndefined(res.toAmount),
  }
}

import { mapArray } from "./utils/arrayHelpers"
import {
  tokenIdFromBuffer as _tokenIdFromBuffer,
  tokenIdToBuffer as _tokenIdToBuffer,
} from "./utils/tokenIdHelpers"
import { OneOrMore } from "./utils/typeHelpers"
export function tokenIdFromBuffer(
  sdk: import("./BroSDK").BroSDK,
  chain: KnownChainId.KnownChain,
  buffer: Uint8Array,
): Promise<undefined | KnownTokenId.KnownToken> {
  return _tokenIdFromBuffer(getSDKContext(sdk), chain, buffer)
}
export function tokenIdToBuffer(
  sdk: import("./BroSDK").BroSDK,
  chain: KnownChainId.KnownChain,
  token: KnownTokenId.KnownToken,
): Promise<undefined | Uint8Array> {
  return _tokenIdToBuffer(getSDKContext(sdk), chain, token)
}

export type BasicTransferProphet = SDKNumberifyNestly<_TransferProphet>
export type BasicTransferProphetAppliedResult =
  SDKNumberifyNestly<_TransferProphetAppliedResult>
const transformToBasicTransferProphetAppliedResult = (
  res: _TransferProphetAppliedResult,
): BasicTransferProphetAppliedResult => {
  return {
    netAmount: toSDKNumberOrUndefined(res.netAmount),
    fees: res.fees.map(fee =>
      fee.type === "rate"
        ? {
            ...fee,
            rate: toSDKNumberOrUndefined(fee.rate),
            minimumAmount: toSDKNumberOrUndefined(fee.minimumAmount),
            amount: toSDKNumberOrUndefined(fee.amount),
          }
        : { ...fee, amount: toSDKNumberOrUndefined(fee.amount) },
    ),
  }
}
const transformFromBasicTransferProphet = (
  transferProphet: BasicTransferProphet,
): _TransferProphet => {
  return {
    ...transferProphet,
    reserveAmount:
      transferProphet.reserveAmount == null
        ? null
        : BigNumber.from(transferProphet.reserveAmount),
    minBridgeAmount:
      transferProphet.minBridgeAmount == null
        ? null
        : BigNumber.from(transferProphet.minBridgeAmount),
    maxBridgeAmount:
      transferProphet.maxBridgeAmount == null
        ? null
        : BigNumber.from(transferProphet.maxBridgeAmount),
    fees: transferProphet.fees.map(fee =>
      fee.type === "rate"
        ? {
            ...fee,
            rate: BigNumber.from(fee.rate),
            minimumAmount: BigNumber.from(fee.minimumAmount),
          }
        : {
            ...fee,
            amount: BigNumber.from(fee.amount),
          },
    ),
  }
}
export async function applyTransferProphet(
  sdk: import("./BroSDK").BroSDK,
  transferProphet: BasicTransferProphet,
  amount: SDKNumber,
): Promise<BasicTransferProphetAppliedResult> {
  const res = _applyTransferProphet(
    transformFromBasicTransferProphet(transferProphet),
    BigNumber.from(amount),
  )
  return transformToBasicTransferProphetAppliedResult(res)
}
export async function applyTransferProphets(
  sdk: import("./BroSDK").BroSDK,
  transferProphets: OneOrMore<BasicTransferProphet>,
  amount: SDKNumber,
  options: {
    exchangeRates?: SDKNumber[]
  } = {},
): Promise<
  OneOrMore<
    BasicTransferProphetAppliedResult & {
      fromAmount: SDKNumber
      transferProphetIndex: number
    }
  >
> {
  const res = _applyTransferProphets(
    mapArray(transferProphets, transformFromBasicTransferProphet),
    BigNumber.from(amount),
    {
      exchangeRates: options.exchangeRates?.map(BigNumber.from),
    },
  )
  return mapArray(res, (r, idx) => ({
    ...transformToBasicTransferProphetAppliedResult(r),
    fromAmount: toSDKNumberOrUndefined(r.fromAmount),
    transferProphetIndex: idx,
  }))
}
