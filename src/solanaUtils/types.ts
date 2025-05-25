import { BigNumber } from "../utils/BigNumber"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { StacksContractAddress } from "../sdkUtils/types"

export interface SolanaSupportedRoute {
  solanaToken: KnownTokenId.SolanaToken
  stacksChain: KnownChainId.StacksChain
  stacksToken: KnownTokenId.StacksToken
  proxyStacksTokenContractAddress: null | StacksContractAddress
  pegOutFeeRate: BigNumber
  pegOutMinFeeAmount: null | BigNumber
  pegOutMinAmount: null | BigNumber
  pegOutMaxAmount: null | BigNumber
} 