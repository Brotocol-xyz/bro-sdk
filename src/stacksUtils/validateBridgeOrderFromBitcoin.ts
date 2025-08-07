import { Response } from "clarity-codegen"
import { hasLength } from "../utils/arrayHelpers"
import {
  SwapRouteViaALEX,
  SwapRouteViaEVMDexAggregator,
} from "../utils/SwapRouteHelpers"
import { KnownChainId } from "../utils/types/knownIds"
import { StacksContractAddress } from "../sdkUtils/types"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import { StacksContractName } from "./stxContractAddresses"
import {
  executeReadonlyCallBro,
  getStacksContractCallInfo,
} from "./contractHelpers"
import { checkNever } from "../utils/typeHelpers"

export async function validateBridgeOrderFromBitcoin(
  ctx: SDKGlobalContext,
  info: {
  chainId: KnownChainId.BitcoinChain
  commitTx: Uint8Array
  revealTx: Uint8Array
  terminatingStacksToken: StacksContractAddress
  swapRoute?: SwapRouteViaALEX | SwapRouteViaEVMDexAggregator
}): Promise<void> {
  const contractBaseCallInfo = getStacksContractCallInfo(
    ctx,
    info.chainId === KnownChainId.Bitcoin.Mainnet
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet,
    StacksContractName.BTCPegInEndpoint,
  )
  const contractSwapCallInfo = getStacksContractCallInfo(
    ctx,
    info.chainId === KnownChainId.Bitcoin.Mainnet
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet,
    StacksContractName.BTCPegInEndpointSwap,
  )
  const contractAggCallInfo = getStacksContractCallInfo(
    ctx,
    info.chainId === KnownChainId.Bitcoin.Mainnet
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet,
    StacksContractName.BTCPegInEndpointAggregator,
  )
  if (
    contractBaseCallInfo == null ||
    contractSwapCallInfo == null ||
    contractAggCallInfo == null
  ) {
    throw new Error(
      "[validateBridgeOrderFromBitcoin] stacks contract information not found",
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
            "output-idx": 1n,
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
            "output-idx": 1n,
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
          "output-idx": 1n,
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
      `[validateBridgeOrderFromBitcoin] unsupported swap route: ${JSON.stringify(
        swapRoute,
      )}`,
    )
  }

  if (resp.type === "success") return

  throw resp.error
}
