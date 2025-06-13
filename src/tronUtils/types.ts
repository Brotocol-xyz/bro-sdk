import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { StacksContractAddress } from "../sdkUtils/types"
import { BigNumber } from "../utils/BigNumber"

export interface TronSupportedRoute {
  tronToken: KnownTokenId.TronToken
  tronTokenAddress: string
  stacksChain: KnownChainId.StacksChain
  stacksToken: KnownTokenId.StacksToken
  proxyStacksTokenContractAddress: null | StacksContractAddress
  pegOutFeeRate: BigNumber
  pegOutMinFeeAmount: null | BigNumber
  pegOutMinAmount: null | BigNumber
  pegOutMaxAmount: null | BigNumber
} 