import { StacksNetwork } from "@stacks/network"
import {
  fetchCallReadOnlyFunction,
  FungiblePostConditionWire,
  serializeCVBytes,
  STXPostConditionWire,
} from "@stacks/transactions"
import {
  CallReadOnlyFunctionFn,
  composeTxOptionsFactory,
  executeReadonlyCallFactory,
  OpenCallFunctionDescriptor,
  ParameterObjOfDescriptor,
  StringOnly,
} from "clarity-codegen"
import { bytesToHex } from "viem"
import { broContracts } from "../../generated/smartContract/contracts_bro"
import { STACKS_MAINNET, STACKS_TESTNET } from "../config"
import {
  isStacksContractAddressEqual,
  StacksContractAddress,
} from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { BigNumber, BigNumberSource } from "../utils/BigNumber"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { getAllStacksTokens } from "./apiHelpers/getAllStacksTokens"
import {
  StacksContractName,
  stxContractAddresses,
  stxTokenContractAddresses_legacy,
} from "./stxContractAddresses"

const CONTRACT_COMMON_NUMBER_SCALE = 8
export const numberFromStacksContractNumber = (
  num: bigint,
  decimals?: number,
): BigNumber => {
  return BigNumber.leftMoveDecimals(
    decimals ?? CONTRACT_COMMON_NUMBER_SCALE,
    num,
  )
}
export const numberToStacksContractNumber = (
  num: BigNumberSource,
  decimals?: number,
): bigint => {
  return BigNumber.toBigInt(
    {},
    BigNumber.rightMoveDecimals(decimals ?? CONTRACT_COMMON_NUMBER_SCALE, num),
  )
}

export type SerializedClarityValue = Uint8Array
type ContractCallOptions_PostCondition =
  | FungiblePostConditionWire
  | STXPostConditionWire

export interface ContractCallOptions {
  contractAddress: string
  contractName: string
  functionName: string
  functionArgs: SerializedClarityValue[]
}

const _composeTxBro = composeTxOptionsFactory(broContracts, {})
export type ComposeTxOptionsFn<Contracts extends typeof broContracts> = <
  T extends StringOnly<keyof Contracts>,
  F extends StringOnly<keyof Contracts[T]>,
  Descriptor extends Contracts[T][F],
  PC extends ContractCallOptions_PostCondition,
>(
  contractName: T,
  functionName: F,
  args: Descriptor extends OpenCallFunctionDescriptor
    ? ParameterObjOfDescriptor<Descriptor>
    : never,
  options?: {
    deployerAddress?: string
    postConditions?: PC[]
  },
) => ContractCallOptions
export const composeTxBro: ComposeTxOptionsFn<typeof broContracts> = (
  ...args
) => {
  const options = _composeTxBro(...args)
  return {
    ...options,
    functionArgs: options.functionArgs.map(arg => serializeCVBytes(arg)),
    anchorMode: undefined,
    postConditionMode: undefined,
    postConditions: undefined,
  }
}

export const executeReadonlyCallBro = executeReadonlyCallFactory(
  broContracts,
  {},
)

export const getStacksContractCallInfo = <C extends StacksContractName>(
  ctx: SDKGlobalContext,
  chainId: KnownChainId.StacksChain,
  contractName: C,
):
  | undefined
  | (Omit<StacksContractAddress, "contractName"> & {
      contractName: C
      network: StacksNetwork
      executeOptions: {
        deployerAddress?: string
        senderAddress?: string
        callReadOnlyFunction?: CallReadOnlyFunctionFn
      }
    }) => {
  const network =
    chainId === KnownChainId.Stacks.Mainnet ? STACKS_MAINNET : STACKS_TESTNET

  if (stxContractAddresses[contractName][chainId] == null) {
    return undefined
  }

  return {
    ...stxContractAddresses[contractName][chainId],
    contractName,
    network,
    executeOptions: {
      deployerAddress:
        stxContractAddresses[contractName][chainId].deployerAddress,
      callReadOnlyFunction(callOptions) {
        if (ctx.stacks?.logReadonlyCalls) {
          console.groupCollapsed(
            `callReadOnlyFunction ${callOptions.contractAddress}.${callOptions.contractName}/${callOptions.functionName}`,
          )
          callOptions.functionArgs.forEach((arg, idx) => {
            console.log(`args[${idx}]:`)
            console.log(arg)
            console.log(bytesToHex(serializeCVBytes(arg)))
          })
          console.groupEnd()
        }

        return fetchCallReadOnlyFunction({
          ...callOptions,
          contractAddress:
            stxContractAddresses[contractName][chainId].deployerAddress,
          contractName:
            stxContractAddresses[contractName][chainId].contractName,
          network,
        })
      },
    },
  }
}

export const getStacksTokenContractInfo = async (
  ctx: SDKGlobalContext,
  chainId: KnownChainId.StacksChain,
  tokenId: KnownTokenId.StacksToken,
): Promise<
  undefined | (StacksContractAddress & { network: StacksNetwork })
> => {
  let address: StacksContractAddress | undefined
  if (stxTokenContractAddresses_legacy[tokenId]?.[chainId] != null) {
    address = stxTokenContractAddresses_legacy[tokenId][chainId]
  } else {
    const allTokens = await getAllStacksTokens(ctx, chainId)
    for (const token of allTokens) {
      if (token.stacksTokenId === tokenId) {
        address = token.contractAddress
        break
      }
    }
  }

  if (address == null) {
    return undefined
  }

  const network =
    chainId === KnownChainId.Stacks.Mainnet ? STACKS_MAINNET : STACKS_TESTNET

  return { ...address, network }
}

export async function getStacksToken(
  ctx: SDKGlobalContext,
  chain: KnownChainId.StacksChain,
  tokenAddress: StacksContractAddress,
): Promise<undefined | KnownTokenId.StacksToken> {
  for (const token of Object.keys(
    stxTokenContractAddresses_legacy,
  ) as (keyof typeof stxTokenContractAddresses_legacy)[]) {
    const info = stxTokenContractAddresses_legacy[token]?.[chain]
    if (info == null) continue

    if (isStacksContractAddressEqual(info, tokenAddress)) {
      return token as KnownTokenId.StacksToken
    }
  }

  const allTokens = await getAllStacksTokens(ctx, chain)
  for (const token of allTokens) {
    if (isStacksContractAddressEqual(token.contractAddress, tokenAddress)) {
      return token.stacksTokenId
    }

    if (token.underlyingToken != null) {
      if (
        isStacksContractAddressEqual(
          token.underlyingToken.contractAddress,
          tokenAddress,
        )
      ) {
        return token.stacksTokenId
      }
    }
  }

  return
}
