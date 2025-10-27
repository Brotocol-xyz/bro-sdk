/**
 * @experimental these APIs are not stable and may change in the future, and are
 *   not covered by semantic versioning. Please use them at your own risk.
 */

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
  tronTokenToCorrespondingStacksToken,
  tronTokenFromCorrespondingStacksToken,
} from "./tronUtils/peggingHelpers"
import {
  solanaTokenToCorrespondingStacksToken,
  solanaTokenFromCorrespondingStacksToken,
} from "./solanaUtils/peggingHelpers"
import { KnownChainId, KnownTokenId } from "./utils/types/knownIds"
import { StacksContractAddress } from "./sdkUtils/types"
import { SDKGlobalContext } from "./sdkUtils/types.internal"

export {
  contractAssignedChainIdFromKnownChain,
  contractAssignedChainIdToKnownChain,
} from "./stacksUtils/crossContractDataMapping"
export {
  alexContractDeployerMainnet,
  alexContractDeployerTestnet,
  alexContractMultisigMainnet,
  alexContractMultisigTestnet,
  legacyAlexContractDeployerMainnet,
  legacyAlexContractDeployerTestnet,
  wrapContractAddress,
  contractsDeployerMainnet as brotocolContractsDeployerMainnet,
  contractsDeployerTestnet as brotocolContractsDeployerTestnet,
  contractsMultisigMainnet as brotocolContractsMultisigMainnet,
  contractsMultisigTestnet as brotocolContractsMultisigTestnet,
} from "./stacksUtils/stxContractAddresses"

export {
  KnownRoute_FromBitcoin,
  KnownRoute_FromBitcoin_ToBRC20,
  KnownRoute_FromBitcoin_ToEVM,
  KnownRoute_FromBitcoin_ToRunes,
  KnownRoute_FromBitcoin_ToStacks,
  KnownRoute_FromBRC20,
  KnownRoute_FromBRC20_ToBitcoin,
  KnownRoute_FromBRC20_ToEVM,
  KnownRoute_FromBRC20_ToRunes,
  KnownRoute_FromBRC20_ToStacks,
  KnownRoute_FromEVM,
  KnownRoute_FromEVM_ToBitcoin,
  KnownRoute_FromEVM_ToBRC20,
  KnownRoute_FromEVM_ToEVM,
  KnownRoute_FromEVM_ToRunes,
  KnownRoute_FromEVM_ToStacks,
  KnownRoute_FromRunes,
  KnownRoute_FromRunes_ToBitcoin,
  KnownRoute_FromRunes_ToBRC20,
  KnownRoute_FromRunes_ToEVM,
  KnownRoute_FromRunes_ToStacks,
  KnownRoute_FromStacks,
  KnownRoute_FromStacks_ToBitcoin,
  KnownRoute_FromStacks_ToBRC20,
  KnownRoute_FromStacks_ToEVM,
  KnownRoute_FromStacks_ToRunes,
} from "./utils/buildSupportedRoutes"

export {
  applyTransferProphets,
  applyTransferProphet,
  TransferProphetAppliedResult,
  composeTransferProphets,
} from "./utils/feeRateHelpers"

export { addressFromBuffer, addressToBuffer } from "./utils/addressHelpers"

export { bridgeFromEVM_toLaunchpad } from "./sdkUtils/bridgeFromEVM"
export { bridgeInfoFromEVM_toLaunchpad } from "./sdkUtils/bridgeInfoFromEVM"
export { bridgeInfoFromBitcoin_toLaunchpad } from "./sdkUtils/bridgeInfoFromBitcoin"

export { getBitcoinHardLinkageAddress } from "./bitcoinUtils/btcAddresses"

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
  return solanaTokenFromCorrespondingStacksToken(getSDKContext(sdk), chain, token)
}
