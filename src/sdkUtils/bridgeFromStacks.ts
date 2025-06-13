import * as btc from "@scure/btc-signer"
import { FungiblePostConditionWire } from "@stacks/transactions"
import { addressToScriptPubKey } from "../bitcoinUtils/bitcoinHelpers"
import { getTerminatingStacksTokenContractAddress as getTerminatingStacksTokenContractAddressEVM } from "../evmUtils/peggingHelpers"
import {
  composeTxBro,
  ContractCallOptions,
  getStacksContractCallInfo,
  getStacksTokenContractInfo,
  numberToStacksContractNumber,
} from "../stacksUtils/contractHelpers"
import { contractAssignedChainIdFromKnownChain } from "../stacksUtils/crossContractDataMapping"
import { isSupportedStacksRoute } from "../stacksUtils/peggingHelpers"
import { StacksContractName } from "../stacksUtils/stxContractAddresses"
import {
  checkRouteValid,
  KnownRoute_FromStacks_ToBitcoin,
  KnownRoute_FromStacks_ToBRC20,
  KnownRoute_FromStacks_ToEVM,
  KnownRoute_FromStacks_ToRunes,
  type KnownRoute_FromStacks_ToSolana,
  type KnownRoute_FromStacks_ToTron,
} from "../utils/buildSupportedRoutes"
import { UnsupportedBridgeRouteError } from "../utils/errors"
import { decodeHex } from "../utils/hexHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { ChainId, SDKNumber, TokenId } from "./types"
import { SDKGlobalContext } from "./types.internal"
import { addressToBuffer } from "../lowlevelUnstableInfos"
import { getTerminatingStacksTokenContractAddress as getTerminatingStacksTokenContractAddressSolana } from "../solanaUtils/peggingHelpers"

export type BridgeFromStacksInput_ContractCallOptions = ContractCallOptions

export type BridgeFromStacksInput_sendTransactionFn = (
  tx: BridgeFromStacksInput_ContractCallOptions,
) => Promise<{
  txid: string
}>

export interface BridgeFromStacksInput {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
  toToken: TokenId
  fromAddress: string
  toAddress: string
  amount: SDKNumber
  sendTransaction: BridgeFromStacksInput_sendTransactionFn
}

export interface BridgeFromStacksOutput {
  txid: string
}

export async function bridgeFromStacks(
  ctx: SDKGlobalContext,
  info: BridgeFromStacksInput,
): Promise<BridgeFromStacksOutput> {
  const route = await checkRouteValid(ctx, isSupportedStacksRoute, info)

  if (KnownChainId.isStacksChain(route.fromChain)) {
    if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeFromStacks_toBitcoin({
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeFromStacks_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeFromStacks_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeFromStacks_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeFromStacks_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isStacksToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeFromStacks_toTron(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else {
      assertExclude(route.toChain, assertExclude.i<KnownChainId.StacksChain>())
      checkNever(route)
    }
  } else {
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.EVMChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BitcoinChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.BRC20Chain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.RunesChain>())
    assertExclude(route.fromChain, assertExclude.i<KnownChainId.SolanaChain>())
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

async function bridgeFromStacks_toBitcoin(
  info: Omit<
    BridgeFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromStacks_ToBitcoin,
): Promise<BridgeFromStacksOutput> {
  const contractCallInfo = getStacksContractCallInfo(
    info.fromChain,
    StacksContractName.BTCPegOutEndpoint,
  )
  if (!contractCallInfo) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const bitcoinNetwork =
    info.toChain === KnownChainId.Bitcoin.Mainnet
      ? btc.NETWORK
      : btc.TEST_NETWORK

  const options = composeTxBro(
    contractCallInfo.contractName,
    "request-peg-out-0",
    {
      "peg-out-address": addressToScriptPubKey(bitcoinNetwork, info.toAddress),
      amount: numberToStacksContractNumber(info.amount),
    },
    {
      ...contractCallInfo.executeOptions,
      postConditions: undefined as undefined | FungiblePostConditionWire[],
    },
  )

  return await info.sendTransaction(options)
}

async function bridgeFromStacks_toEVM(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromStacks_ToEVM,
): Promise<BridgeFromStacksOutput> {
  const contractCallInfo = getStacksContractCallInfo(
    info.fromChain,
    StacksContractName.EVMPegOutEndpoint,
  )
  const fromTokenContractInfo = await getStacksTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )
  if (contractCallInfo == null || fromTokenContractInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const terminatingTokenContractAddress =
    (await getTerminatingStacksTokenContractAddressEVM(ctx, {
      stacksChain: info.fromChain,
      evmChain: info.toChain,
      evmToken: info.toToken,
    })) ?? fromTokenContractInfo

  const options = composeTxBro(
    contractCallInfo.contractName,
    "transfer-to-unwrap",
    {
      "token-trait": `${terminatingTokenContractAddress.deployerAddress}.${terminatingTokenContractAddress.contractName}`,
      "amount-in-fixed": numberToStacksContractNumber(info.amount),
      "dest-chain-id": contractAssignedChainIdFromKnownChain(info.toChain),
      "settle-address": decodeHex(info.toAddress),
    },
    {
      ...contractCallInfo.executeOptions,
      postConditions: undefined as undefined | FungiblePostConditionWire[],
    },
  )

  return await info.sendTransaction(options)
}

async function bridgeFromStacks_toSolana(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromStacks_ToSolana,
): Promise<BridgeFromStacksOutput> {
  const contractCallInfo = getStacksContractCallInfo(
    info.fromChain,
    StacksContractName.EVMPegOutEndpoint,
  )
  const fromTokenContractInfo = await getStacksTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )
  if (contractCallInfo == null || fromTokenContractInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const terminatingTokenContractAddress =
    (await getTerminatingStacksTokenContractAddressSolana(ctx, {
      stacksChain: info.fromChain,
      solanaToken: info.toToken,
      solanaChain: info.toChain,
    })) ?? fromTokenContractInfo

  const options = composeTxBro(
    contractCallInfo.contractName,
    "transfer-to-unwrap",
    {
      "token-trait": `${terminatingTokenContractAddress.deployerAddress}.${terminatingTokenContractAddress.contractName}`,
      "amount-in-fixed": numberToStacksContractNumber(info.amount),
      "dest-chain-id": contractAssignedChainIdFromKnownChain(info.toChain),
      "settle-address": addressToBuffer(info.toChain, info.toAddress),
    },
    {
      ...contractCallInfo.executeOptions,
      postConditions: undefined as undefined | FungiblePostConditionWire[],
    },
  )

  return await info.sendTransaction(options)
}

async function bridgeFromStacks_toTron(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromStacks_ToTron,
): Promise<BridgeFromStacksOutput> {
  const contractCallInfo = getStacksContractCallInfo(
    info.fromChain,
    StacksContractName.EVMPegOutEndpoint,
  )
  const fromTokenContractInfo = await getStacksTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )
  if (contractCallInfo == null || fromTokenContractInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const terminatingTokenContractAddress = fromTokenContractInfo

  const options = composeTxBro(
    contractCallInfo.contractName,
    "transfer-to-unwrap",
    {
      "token-trait": `${terminatingTokenContractAddress.deployerAddress}.${terminatingTokenContractAddress.contractName}`,
      "amount-in-fixed": numberToStacksContractNumber(info.amount),
      "dest-chain-id": contractAssignedChainIdFromKnownChain(info.toChain),
      "settle-address": addressToBuffer(info.toChain, info.toAddress),
    },
    {
      ...contractCallInfo.executeOptions,
      postConditions: undefined as undefined | FungiblePostConditionWire[],
    },
  )

  return await info.sendTransaction(options)
}

async function bridgeFromStacks_toMeta(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromStacksInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromStacks_ToBRC20 | KnownRoute_FromStacks_ToRunes),
): Promise<BridgeFromStacksOutput> {
  const contractCallInfo = getStacksContractCallInfo(
    info.fromChain,
    StacksContractName.MetaPegOutEndpoint,
  )
  const fromTokenContractInfo = await getStacksTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )
  if (contractCallInfo == null || fromTokenContractInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const bitcoinNetwork =
    info.toChain === KnownChainId.BRC20.Mainnet ||
    info.toChain === KnownChainId.Runes.Mainnet
      ? btc.NETWORK
      : btc.TEST_NETWORK

  const options = composeTxBro(
    contractCallInfo.contractName,
    "request-peg-out",
    {
      "peg-out-address": addressToScriptPubKey(bitcoinNetwork, info.toAddress),
      "the-chain-id": contractAssignedChainIdFromKnownChain(info.toChain),
      "token-trait": `${fromTokenContractInfo.deployerAddress}.${fromTokenContractInfo.contractName}`,
      amount: numberToStacksContractNumber(info.amount),
    },
    {
      ...contractCallInfo.executeOptions,
      postConditions: undefined as undefined | FungiblePostConditionWire[],
    },
  )

  return await info.sendTransaction(options)
}
