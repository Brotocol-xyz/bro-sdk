import type { Transaction } from "@solana/web3.js"
import { encodeFunctionData, hexToBytes, toHex } from "viem"
import { SDK_NAME } from "../bitcoinUtils/constants"
import {
  getEVMTokenContractInfo
} from "../evmUtils/contractHelpers"
import { sendMessageAbi } from "../evmUtils/contractMessageHelpers"
import { metaTokenToCorrespondingStacksToken } from "../metaUtils/peggingHelpers"
import { AnchorWrapper } from "../solanaUtils/anchorWrapper"
import { getSolanaConfigs, getSolanaSupportedRoutes } from "../solanaUtils/getSolanaSupportedRoutes"
import { isSupportedSolanaRoute } from "../solanaUtils/peggingHelpers"
import { getStacksTokenContractInfo } from "../stacksUtils/contractHelpers"
import {
  checkRouteValid,
  KnownRoute_FromSolana_ToBitcoin,
  KnownRoute_FromSolana_ToBRC20,
  KnownRoute_FromSolana_ToEVM,
  KnownRoute_FromSolana_ToRunes,
  KnownRoute_FromSolana_ToSolana,
  KnownRoute_FromSolana_ToStacks,
  KnownRoute_FromSolana_ToTron,
} from "../utils/buildSupportedRoutes"
import {
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  _knownChainIdToErrorMessagePart,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import {
  ChainId,
  evmNativeCurrencyAddress,
  SDKNumber,
  TokenId,
  type EVMAddress
} from "./types"
import { SDKGlobalContext } from "./types.internal"
import { contractAssignedChainIdFromKnownChain } from "../lowlevelUnstableInfos"

export type BridgeFromSolanaInput = {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
  toToken: TokenId
  fromAddress: string
  toAddress: string
  /**
   * **Required** when `toChain` is one of bitcoin chains
   */
  toAddressScriptPubKey?: Uint8Array
  /**
   * The token account that holds the tokens to be bridged
   */
  senderTokenAccount: string
  amount: SDKNumber
  sendTransaction: (tx: {
    transaction: Transaction
  }) => Promise<{
    signature: string
  }>
}

export interface BridgeFromSolanaOutput {
  signature: string
}

export async function bridgeFromSolana(
  ctx: SDKGlobalContext,
  info: BridgeFromSolanaInput,
): Promise<BridgeFromSolanaOutput> {
  const route = await checkRouteValid(ctx, isSupportedSolanaRoute, info)

  if (KnownChainId.isSolanaChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeFromSolana_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeFromSolana_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeFromSolana_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeFromSolana_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeFromSolana_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeFromSolana_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isSolanaToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeFromSolana_toTron(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else {
      checkNever(route.toChain)
    }
  } else {
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.StacksChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BitcoinChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BRC20Chain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.RunesChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.TronChain>())
    checkNever(route)
  }

  throw new UnsupportedBridgeRouteError(
    info.fromChain,
    info.toChain,
    info.fromToken,
    info.toToken,
  )
}

async function bridgeFromSolana_toStacks(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToStacks,
): Promise<BridgeFromSolanaOutput> {
  const solanaSupportedRoutes = await getSolanaSupportedRoutes(ctx, info.fromChain)
  const fromTokenContractInfo = solanaSupportedRoutes.find(r => r.solanaToken === info.fromToken)
  const toTokenContractInfo = await getStacksTokenContractInfo(
    ctx,
    info.toChain,
    info.toToken,
  )
  if (
    fromTokenContractInfo == null ||
    toTokenContractInfo == null
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  // Get Solana config
  const solanaConfig = await getSolanaConfigs(ctx, info.fromChain)

  // Create AnchorWrapper instance
  const anchorWrapper = new AnchorWrapper(
    solanaConfig.rpcEndpoint,
    solanaConfig.programIds.registry,
    solanaConfig.programIds.bridgeEndpoint
  )

  // Create the message payload for transferToStacks
  const message = encodeFunctionData({
    abi: sendMessageAbi,
    functionName: "transferToStacks",
    args: [info.toAddress],
  })

  // Create the transaction
  const tx = await anchorWrapper.createSendMessageWithTokenTx({
    mint: fromTokenContractInfo.solanaTokenAddress,
    amount: info.amount,
    payload: hexToBytes(message),
    sender: info.fromAddress,
    senderTokenAccount: info.senderTokenAccount
  })

  // Send the transaction
  const result = await info.sendTransaction({
    transaction: tx
  })

  return {
    signature: result.signature
  }
}

async function bridgeFromSolana_toBitcoin(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToBitcoin,
): Promise<BridgeFromSolanaOutput> {
  const solanaSupportedRoutes = await getSolanaSupportedRoutes(ctx, info.fromChain)
  const fromTokenContractInfo = solanaSupportedRoutes.find(r => r.solanaToken === info.fromToken)
  if (fromTokenContractInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [SDK_NAME, "bridgeFromSolana (to Bitcoin)"],
      [
        {
          name: "toAddressScriptPubKey",
          expected: "Uint8Array",
          received: "undefined",
        },
      ],
    )
  }

  const toAddressHex = toHex(info.toAddressScriptPubKey)

  // Get Solana config
  const solanaConfig = await getSolanaConfigs(ctx, info.fromChain)

  // Create AnchorWrapper instance
  const anchorWrapper = new AnchorWrapper(
    solanaConfig.rpcEndpoint,
    solanaConfig.programIds.registry,
    solanaConfig.programIds.bridgeEndpoint
  )

  // Create the message payload for transferToBTC
  const message = encodeFunctionData({
    abi: sendMessageAbi,
    functionName: "transferToBTC",
    args: [toAddressHex],
  })

  // Create the transaction
  const tx = await anchorWrapper.createSendMessageWithTokenTx({
    mint: fromTokenContractInfo.solanaTokenAddress,
    amount: info.amount,
    payload: hexToBytes(message),
    sender: info.fromAddress,
    senderTokenAccount: info.senderTokenAccount
  })

  // Send the transaction
  const result = await info.sendTransaction({
    transaction: tx
  })

  return {
    signature: result.signature
  }
}

async function bridgeFromSolana_toEVM(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToEVM,
): Promise<BridgeFromSolanaOutput> {
  const solanaSupportedRoutes = await getSolanaSupportedRoutes(ctx, info.fromChain)
  const fromTokenContractInfo = solanaSupportedRoutes.find(r => r.solanaToken === info.fromToken)
  const toTokenContractInfo = await getEVMTokenContractInfo(
    ctx,
    info.toChain,
    info.toToken,
  )

  if (
    fromTokenContractInfo == null ||
    toTokenContractInfo == null ||
    toTokenContractInfo.tokenContractAddress === evmNativeCurrencyAddress
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  // Get Solana config
  const solanaConfig = await getSolanaConfigs(ctx, info.fromChain)

  // Create AnchorWrapper instance
  const anchorWrapper = new AnchorWrapper(
    solanaConfig.rpcEndpoint,
    solanaConfig.programIds.registry,
    solanaConfig.programIds.bridgeEndpoint
  )

  // Create the message payload for transferToEVM
  const message = encodeFunctionData({
    abi: sendMessageAbi,
    functionName: "transferToEVM",
    args: [
      contractAssignedChainIdFromKnownChain(info.toChain),
      toTokenContractInfo.tokenContractAddress,
      info.toAddress as EVMAddress,
    ],
  })

  // Create the transaction
  const tx = await anchorWrapper.createSendMessageWithTokenTx({
    mint: fromTokenContractInfo.solanaTokenAddress,
    amount: info.amount,
    payload: hexToBytes(message),
    sender: info.fromAddress,
    senderTokenAccount: info.senderTokenAccount
  })

  // Send the transaction
  const result = await info.sendTransaction({
    transaction: tx
  })

  return {
    signature: result.signature
  }
}

async function bridgeFromSolana_toMeta(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromSolana_ToBRC20 | KnownRoute_FromSolana_ToRunes),
): Promise<BridgeFromSolanaOutput> {
  const solanaSupportedRoutes = await getSolanaSupportedRoutes(ctx, info.fromChain)
  const fromTokenContractInfo = solanaSupportedRoutes.find(r => r.solanaToken === info.fromToken)

  const toTokenCorrespondingStacksToken =
    await metaTokenToCorrespondingStacksToken(ctx, {
      chain: info.toChain as any,
      token: info.toToken as any,
    })
  const toTokenStacksAddress =
    toTokenCorrespondingStacksToken == null
      ? undefined
      : await getStacksTokenContractInfo(
        ctx,
        KnownChainId.isSolanaChain(info.fromChain)
          ? KnownChainId.Stacks.Mainnet
          : KnownChainId.Stacks.Testnet,
        toTokenCorrespondingStacksToken,
      )

  if (
    fromTokenContractInfo == null ||
    toTokenCorrespondingStacksToken == null ||
    toTokenStacksAddress == null
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  if (info.toAddressScriptPubKey == null) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromSolana (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
      ],
      [
        {
          name: "toAddressScriptPubKey",
          expected: "Uint8Array",
          received: "undefined",
        },
      ],
    )
  }

  const toAddressHex = toHex(info.toAddressScriptPubKey)

  // Get Solana config
  const solanaConfig = await getSolanaConfigs(ctx, info.fromChain)

  // Create AnchorWrapper instance
  const anchorWrapper = new AnchorWrapper(
    solanaConfig.rpcEndpoint,
    solanaConfig.programIds.registry,
    solanaConfig.programIds.bridgeEndpoint
  )

  // Create the message payload for transferToBRC20 or transferToRunes
  const message = encodeFunctionData({
    abi: sendMessageAbi,
    functionName: KnownChainId.isBRC20Chain(info.toChain)
      ? "transferToBRC20"
      : "transferToRunes",
    args: [
      toAddressHex,
      `${toTokenStacksAddress.deployerAddress}.${toTokenStacksAddress.contractName}`,
    ],
  })

  // Create the transaction
  const tx = await anchorWrapper.createSendMessageWithTokenTx({
    mint: fromTokenContractInfo.solanaTokenAddress,
    amount: info.amount,
    payload: hexToBytes(message),
    sender: info.fromAddress,
    senderTokenAccount: info.senderTokenAccount
  })

  // Send the transaction
  const result = await info.sendTransaction({
    transaction: tx
  })

  return {
    signature: result.signature
  }
}

async function bridgeFromSolana_toSolana(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToSolana,
): Promise<BridgeFromSolanaOutput> {
  const solanaSupportedRoutes = await getSolanaSupportedRoutes(ctx, info.fromChain)
  const fromTokenContractInfo = solanaSupportedRoutes.find(r => r.solanaToken === info.fromToken)
  const toTokenContractInfo = solanaSupportedRoutes.find(r => r.solanaToken === info.toToken)

  if (
    fromTokenContractInfo == null ||
    toTokenContractInfo == null
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  // const message = await encodeFunctionData({
  //   abi: sendMessageAbi,
  //   functionName: "transferToSolana",
  //   args: [
  //     info.toAddress,
  //     toTokenContractInfo.solanaTokenAddress,
  //   ],
  // })

  // const functionData = await encodeFunctionData({
  //   abi: BridgeEndpointAbi,
  //   functionName: "sendMessageWithToken",
  //   args: [
  //     fromTokenContractInfo.solanaTokenAddress,
  //     numberToSolidityContractNumber(info.amount),
  //     message,
  //   ],
  // })

  // const fallbackGasLimit = 200_000
  // const estimated = await estimateGas(fromTokenContractInfo.client, {
  //   account: info.fromAddress,
  //   to: fromTokenContractInfo.bridgeEndpointAddress,
  //   data: functionData,
  // })
  //   .then(n =>
  //     BigNumber.round(
  //       { precision: 0 },
  //       BigNumber.max([fallbackGasLimit, BigNumber.mul(n, 1.2)]),
  //     ),
  //   )
  //   .catch(
  //     // add a fallback in case estimate failed
  //     () => fallbackGasLimit,
  //   )

  // return await info.sendTransaction({
  //   from: info.fromAddress,
  //   to: fromTokenContractInfo.bridgeEndpointAddress,
  //   data: decodeHex(functionData),
  //   recommendedGasLimit: toSDKNumberOrUndefined(estimated),
  // })
  throw new Error("WIP")
}

async function bridgeFromSolana_toTron(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromSolanaInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromSolana_ToTron,
): Promise<BridgeFromSolanaOutput> {
  throw new Error("WIP")
} 