import { BigNumber } from "../utils/BigNumber"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { StacksContractAddress } from "../sdkUtils/types"

export interface SolanaSupportedRoute {
  solanaToken: KnownTokenId.SolanaToken
  solanaTokenAddress: string
  stacksChain: KnownChainId.StacksChain
  stacksToken: KnownTokenId.StacksToken
  proxyStacksTokenContractAddress: null | StacksContractAddress
  pegOutFeeRate: BigNumber
  pegOutMinFeeAmount: null | BigNumber
  pegOutMinAmount: null | BigNumber
  pegOutMaxAmount: null | BigNumber
}

export interface SolanaToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface SolanaConfig {
  network: "mainnet" | "testnet";
  rpcEndpoint: string;
  programIds: {
    bridgeEndpoint: string;
    registry: string;
  };
  tokens: SolanaToken[];
}

export interface SolanaSupportedRoutesAndConfig {
  routes: SolanaSupportedRoute[];
  solanaConfig: SolanaConfig;
}

export interface TokenConfigAccount {
  feePct: BigNumber;
  minFee: BigNumber;
  minAmount: BigNumber;
  maxAmount: BigNumber;
} 