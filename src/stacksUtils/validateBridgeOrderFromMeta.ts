import { Response } from "clarity-codegen"
import { hasLength } from "../utils/arrayHelpers"
import {
  SwapRouteViaALEX,
  SwapRouteViaEVMDexAggregator,
} from "../utils/SwapRouteHelpers"
import { getChainIdNetworkType, KnownChainId } from "../utils/types/knownIds"
import { StacksContractAddress } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { StacksContractName } from "./stxContractAddresses"
import {
  executeReadonlyCallBro,
  getStacksContractCallInfo,
} from "./contractHelpers"
import { checkNever } from "../utils/typeHelpers"

export async function validateBridgeOrderFromMeta(
  ctx: SDKGlobalContext,
  info: {
  chainId: KnownChainId.BRC20Chain | KnownChainId.RunesChain
  commitTx: Uint8Array
  revealTx: Uint8Array
  terminatingStacksToken: StacksContractAddress
  transferOutputIndex: number
  bridgeFeeOutputIndex: undefined | number
  swapRoute?: SwapRouteViaALEX | SwapRouteViaEVMDexAggregator
}): Promise<void> {
  const contractBaseCallInfo = getStacksContractCallInfo(
    ctx,
    getChainIdNetworkType(info.chainId) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet,
    StacksContractName.MetaPegInEndpoint,
  )
  const contractSwapCallInfo = getStacksContractCallInfo(
    ctx,
    getChainIdNetworkType(info.chainId) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet,
    StacksContractName.MetaPegInEndpointSwap,
  )
  const contractAggCallInfo = getStacksContractCallInfo(
    ctx,
    getChainIdNetworkType(info.chainId) === "mainnet"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet,
    StacksContractName.MetaPegInEndpointAggregator,
  )
  if (
    contractBaseCallInfo == null ||
    contractSwapCallInfo == null ||
    contractAggCallInfo == null
  ) {
    throw new Error(
      "[validateBridgeOrderFromMeta] stacks contract information not found",
    )
  }

  const { commitTx, revealTx, swapRoute } = info

  let resp: Response<any>

  if (swapRoute == null || swapRoute.via === "ALEX") {
    if (swapRoute == null || hasLength(swapRoute.swapPools, 0)) {
      resp = await executeReadonlyCallBro(
        contractBaseCallInfo.contractName,
        "validate-tx-cross",
        {
          "commit-tx": {
            tx: commitTx,
            "output-idx": BigInt(info.transferOutputIndex),
            "fee-idx":
              info.bridgeFeeOutputIndex == null
                ? undefined
                : BigInt(info.bridgeFeeOutputIndex),
          },
          "reveal-tx": {
            tx: revealTx,
            "order-idx": 0n,
          },
          "token-out-trait": `${info.terminatingStacksToken.deployerAddress}.${info.terminatingStacksToken.contractName}`,
        },
        contractBaseCallInfo.executeOptions,
      )
    } else {
      resp = await executeReadonlyCallBro(
        contractSwapCallInfo.contractName,
        "validate-tx-cross-swap",
        {
          "commit-tx": {
            tx: commitTx,
            "output-idx": BigInt(info.transferOutputIndex),
            "fee-idx":
              info.bridgeFeeOutputIndex == null
                ? undefined
                : BigInt(info.bridgeFeeOutputIndex),
          },
          "reveal-tx": {
            tx: revealTx,
            "order-idx": 0n,
          },
          "token-out-trait": `${info.terminatingStacksToken.deployerAddress}.${info.terminatingStacksToken.contractName}`,
          "routing-traits": [
            `${swapRoute.fromTokenAddress.deployerAddress}.${swapRoute.fromTokenAddress.contractName}`,
            ...swapRoute.swapPools.map(
              (pool): `${string}.${string}` =>
                `${pool.toTokenAddress.deployerAddress}.${pool.toTokenAddress.contractName}`,
            ),
          ],
        },
        contractSwapCallInfo.executeOptions,
      )
    }
  } else if (swapRoute.via === "evmDexAggregator") {
    resp = await executeReadonlyCallBro(
      contractAggCallInfo.contractName,
      "validate-tx-agg",
      {
        "commit-tx": {
          tx: commitTx,
          "output-idx": BigInt(info.transferOutputIndex),
          "fee-idx":
            info.bridgeFeeOutputIndex == null
              ? undefined
              : BigInt(info.bridgeFeeOutputIndex),
        },
        "reveal-tx": {
          tx: revealTx,
          "order-idx": 0n,
        },
      },
      contractAggCallInfo.executeOptions,
    )
  } else {
    checkNever(swapRoute)
    throw new Error(
      `[validateBridgeOrderFromMeta] unsupported swap route: ${JSON.stringify(
        swapRoute,
      )}`,
    )
  }

  if (resp.type === "success") return

  throw resp.error
}
