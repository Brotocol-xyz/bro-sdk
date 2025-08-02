import { Address, Client } from "viem"
import {
  EVMAddress,
  EVMNativeCurrencyAddress,
  evmNativeCurrencyAddress,
} from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { BigNumber, BigNumberSource } from "../utils/BigNumber"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { nativeCurrencyAddress } from "./addressHelpers"
import { getEVMOnChainConfig } from "./apiHelpers/getEVMOnChainConfig"
import { getEVMSupportedRoutes } from "./apiHelpers/getEVMSupportedRoutes"
import { EVMEndpointContract } from "./evmContractAddresses"
import { readContract } from "viem/actions"
import { ERC20Abi } from "./contractAbi/ERC20Abi"

const CONTRACT_COMMON_NUMBER_SCALE = 18
export const numberFromSolidityContractNumber = (
  num: bigint,
  decimals?: number,
): BigNumber => {
  return BigNumber.leftMoveDecimals(
    decimals ?? CONTRACT_COMMON_NUMBER_SCALE,
    num,
  )
}
export const numberToSolidityContractNumber = (
  num: BigNumberSource,
  decimals?: number,
): bigint => {
  return BigNumber.toBigInt(
    {},
    BigNumber.rightMoveDecimals(decimals ?? CONTRACT_COMMON_NUMBER_SCALE, num),
  )
}

export async function getEVMContractCallInfo(
  sdkContext: SDKGlobalContext,
  chainId: KnownChainId.EVMChain,
): Promise<
  | undefined
  | {
      client: Client
      bridgeEndpointContractAddress: Address
      nativeBridgeEndpointContractAddress?: Address
      registryContractAddress?: Address
      timeLockContractAddress?: Address
    }
> {
  const client = sdkContext.evm.viemClients[chainId]
  if (client == null) return

  const config = await getEVMOnChainConfig(sdkContext, chainId)
  if (config == null) return

  const bridgeEndpointContractAddress =
    config[EVMEndpointContract.BridgeEndpoint]
  if (bridgeEndpointContractAddress == null) return

  const nativeBridgeEndpointContractAddress =
    config[EVMEndpointContract.NativeBridgeEndpoint]
  const registryContractAddress = config[EVMEndpointContract.Registry]
  const timeLockContractAddress = config[EVMEndpointContract.TimeLock]

  return {
    client,
    bridgeEndpointContractAddress,
    nativeBridgeEndpointContractAddress,
    registryContractAddress,
    timeLockContractAddress,
  }
}

export async function getEVMTokenContractInfo(
  sdkContext: SDKGlobalContext,
  chainId: KnownChainId.EVMChain,
  tokenId: KnownTokenId.EVMToken,
): Promise<
  | undefined
  | {
      client: Client
      tokenContractAddress: Address | EVMNativeCurrencyAddress
    }
> {
  const client = sdkContext.evm.viemClients[chainId]
  if (client == null) return

  const routes = await getEVMSupportedRoutes(sdkContext, chainId)
  if (routes == null) return

  const tokenContractAddress = routes.find(
    r => r.evmToken === tokenId,
  )?.evmTokenAddress
  if (tokenContractAddress == null) return

  return {
    client,
    tokenContractAddress:
      tokenContractAddress === nativeCurrencyAddress
        ? evmNativeCurrencyAddress
        : tokenContractAddress,
  }
}

export async function getEVMToken(
  sdkContext: SDKGlobalContext,
  chain: KnownChainId.EVMChain,
  tokenAddress: EVMAddress,
): Promise<undefined | KnownTokenId.EVMToken> {
  const routes = await getEVMSupportedRoutes(sdkContext, chain)
  if (routes == null) return

  tokenAddress = tokenAddress.toLowerCase() as EVMAddress
  return routes.find(
    r => r.evmTokenAddress.toLowerCase() === tokenAddress.toLowerCase(),
  )?.evmToken
}

export function getERC20TokenDecimals(
  sdkContext: SDKGlobalContext,
  chainId: KnownChainId.EVMChain,
  tokenAddress: EVMAddress,
): Promise<undefined | number> {
  const cacheKey = `${chainId}:${tokenAddress}`

  const tokenInfoCache = sdkContext.evm.tokenInfoCaches.decimals.get(cacheKey)
  if (tokenInfoCache != null) return tokenInfoCache

  const client = sdkContext.evm.viemClients[chainId]
  if (client == null) return Promise.resolve(undefined)

  const resPromise = readContract(client, {
    abi: ERC20Abi,
    address: tokenAddress,
    functionName: "decimals",
  }).catch(err => {
    queueMicrotask(() => {
      if (
        sdkContext.evm.tokenInfoCaches.decimals.get(cacheKey) === resPromise
      ) {
        sdkContext.evm.tokenInfoCaches.decimals.delete(cacheKey)
      }
    })
    throw err
  })
  sdkContext.evm.tokenInfoCaches.decimals.set(cacheKey, resPromise)

  return resPromise
}
