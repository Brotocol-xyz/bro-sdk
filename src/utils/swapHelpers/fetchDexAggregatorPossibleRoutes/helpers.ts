import { readContract } from "viem/actions"
import { ERC20Abi } from "../../../evmUtils/contractAbi/ERC20Abi"
import { getEVMTokenContractInfo } from "../../../evmUtils/contractHelpers"
import { evmChainIdFromKnownChainId } from "../../../evmUtils/evmClients"
import {
  EVMAddress,
  evmNativeCurrencyAddress,
  SDKNumber,
  toSDKNumberOrUndefined,
} from "../../../sdkUtils/types"
import { SDKGlobalContext } from "../../../sdkUtils/types.internal"
import { BigNumber } from "../../BigNumber"
import { KnownChainId, KnownTokenId } from "../../types/knownIds"

export interface QueryableRoute {
  chain: {
    chain: KnownChainId.EVMChain
    chainId: bigint
  }
  fromEVMToken: {
    token: KnownTokenId.EVMToken
    address: EVMAddress
    decimals: number
  }
  toEVMToken: {
    token: KnownTokenId.EVMToken
    address: EVMAddress
    decimals: number
  }
  amount: SDKNumber
}

export interface DexAggregatorRoute {
  provider: "IceCreamSwap" | "Matcha" | "KyberSwap"
  evmChain: KnownChainId.EVMChain
  fromToken: KnownTokenId.EVMToken
  toToken: KnownTokenId.EVMToken
  fromAmount: SDKNumber
  toAmount: SDKNumber
}

export type FetchRoutesImpl = (info: {
  possibleRoutes: (QueryableRoute & { id: string })[]
  abortSignal?: AbortSignal
}) => Promise<(DexAggregatorRoute & { id: string })[]>

export async function getQueryableRoutes(
  sdkContext: SDKGlobalContext,
  info: {
    evmChain: KnownChainId.EVMChain
    fromToken: KnownTokenId.EVMToken
    toToken: KnownTokenId.EVMToken
    amount: BigNumber
  },
): Promise<undefined | QueryableRoute> {
  const [chainId, fromEVMToken, toEVMToken] = await Promise.all([
    evmChainIdFromKnownChainId(info.evmChain),
    getEVMTokenContractInfo(sdkContext, info.evmChain, info.fromToken),
    getEVMTokenContractInfo(sdkContext, info.evmChain, info.toToken),
  ])
  if (
    chainId == null ||
    fromEVMToken == null ||
    fromEVMToken.tokenContractAddress === evmNativeCurrencyAddress ||
    toEVMToken == null ||
    toEVMToken.tokenContractAddress === evmNativeCurrencyAddress
  ) {
    return
  }

  const client = Object.values(sdkContext.evm.viemClients).find(
    c => c.chain?.id === Number(chainId),
  )
  if (client == null) return

  const [fromTokenDecimals, toTokenDecimals] = await Promise.all([
    readContract(client, {
      abi: ERC20Abi,
      address: fromEVMToken.tokenContractAddress,
      functionName: "decimals",
    }),
    readContract(client, {
      abi: ERC20Abi,
      address: toEVMToken.tokenContractAddress,
      functionName: "decimals",
    }),
  ])

  return {
    chain: {
      chain: info.evmChain,
      chainId: chainId,
    },
    fromEVMToken: {
      token: info.fromToken,
      address: fromEVMToken.tokenContractAddress,
      decimals: fromTokenDecimals,
    },
    toEVMToken: {
      token: info.toToken,
      address: toEVMToken.tokenContractAddress,
      decimals: toTokenDecimals,
    },
    amount: toSDKNumberOrUndefined(info.amount),
  }
}
