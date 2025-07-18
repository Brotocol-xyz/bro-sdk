import { encodeFunctionData, Hex, toHex } from "viem"
import { estimateGas } from "viem/actions"
import { SDK_NAME } from "../bitcoinUtils/constants"
import { BridgeEndpointAbi } from "../evmUtils/contractAbi/bridgeEndpoint"
import { NativeBridgeEndpointAbi } from "../evmUtils/contractAbi/nativeBridgeEndpoint"
import {
  getEVMContractCallInfo,
  getEVMTokenContractInfo,
  numberToSolidityContractNumber,
} from "../evmUtils/contractHelpers"
import { sendMessageAbi } from "../evmUtils/contractMessageHelpers"
import { isSupportedEVMRoute } from "../evmUtils/peggingHelpers"
import { metaTokenToCorrespondingStacksToken } from "../metaUtils/peggingHelpers"
import { getSolanaSupportedRoutes } from "../solanaUtils/getSolanaSupportedRoutes"
import { solanaTokenToCorrespondingStacksToken } from "../solanaUtils/peggingHelpers"
import { getStacksTokenContractInfo } from "../stacksUtils/contractHelpers"
import { contractAssignedChainIdFromKnownChain } from "../stacksUtils/crossContractDataMapping"
import { addressToBuffer } from "../utils/addressHelpers"
import { BigNumber } from "../utils/BigNumber"
import {
  checkRouteValid,
  KnownRoute_FromEVM_ToBitcoin,
  KnownRoute_FromEVM_ToBRC20,
  KnownRoute_FromEVM_ToEVM,
  KnownRoute_FromEVM_ToRunes,
  KnownRoute_FromEVM_ToSolana,
  KnownRoute_FromEVM_ToStacks,
  KnownRoute_FromEVM_ToTron,
} from "../utils/buildSupportedRoutes"
import {
  InvalidMethodParametersError,
  UnsupportedBridgeRouteError,
} from "../utils/errors"
import { decodeHex, encodeZeroPrefixedHex } from "../utils/hexHelpers"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import {
  _knownChainIdToErrorMessagePart,
  KnownChainId,
  KnownTokenId,
} from "../utils/types/knownIds"
import {
  ChainId,
  EVMAddress,
  evmNativeCurrencyAddress,
  SDKNumber,
  TokenId,
  toSDKNumberOrUndefined,
} from "./types"
import { SDKGlobalContext } from "./types.internal"

export type BridgeFromEVMInput = {
  fromChain: ChainId
  toChain: ChainId
  fromToken: TokenId
  toToken: TokenId
  fromAddress: EVMAddress
  toAddress: string
  /**
   * **Required** when `toChain` is one of bitcoin chains
   */
  toAddressScriptPubKey?: Uint8Array
  amount: SDKNumber
  sendTransaction: (tx: {
    from: EVMAddress
    to: EVMAddress
    data: Uint8Array
    recommendedGasLimit: SDKNumber
    value?: SDKNumber
  }) => Promise<{
    txHash: string
  }>
}

export interface BridgeFromEVMOutput {
  txHash: string
}

export async function bridgeFromEVM(
  ctx: SDKGlobalContext,
  info: BridgeFromEVMInput,
): Promise<BridgeFromEVMOutput> {
  const route = await checkRouteValid(ctx, isSupportedEVMRoute, info)

  if (KnownChainId.isEVMChain(route.fromChain)) {
    if (KnownChainId.isStacksChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isStacksToken(route.toToken)
      ) {
        return bridgeFromEVM_toStacks(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBitcoinChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isBitcoinToken(route.toToken)
      ) {
        return bridgeFromEVM_toBitcoin(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isEVMChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isEVMToken(route.toToken)
      ) {
        return bridgeFromEVM_toEVM(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isBRC20Chain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isBRC20Token(route.toToken)
      ) {
        return bridgeFromEVM_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isRunesChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isRunesToken(route.toToken)
      ) {
        return bridgeFromEVM_toMeta(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isSolanaChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isSolanaToken(route.toToken)
      ) {
        return bridgeFromEVM_toSolana(ctx, {
          ...info,
          fromChain: route.fromChain,
          toChain: route.toChain,
          fromToken: route.fromToken,
          toToken: route.toToken,
        })
      }
    } else if (KnownChainId.isTronChain(route.toChain)) {
      if (
        KnownTokenId.isEVMToken(route.fromToken) &&
        KnownTokenId.isTronToken(route.toToken)
      ) {
        return bridgeFromEVM_toTron(ctx, {
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

async function bridgeFromEVM_toStacks(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToStacks,
): Promise<BridgeFromEVMOutput> {
  const { bridgeEndpointContractAddress: bridgeEndpointAddress } =
    (await getEVMContractCallInfo(ctx, info.fromChain)) ?? {}
  const fromTokenContractInfo = await getEVMTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )
  const toTokenContractInfo = await getStacksTokenContractInfo(
    ctx,
    info.toChain,
    info.toToken,
  )
  if (
    bridgeEndpointAddress == null ||
    fromTokenContractInfo == null ||
    toTokenContractInfo == null ||
    fromTokenContractInfo.tokenContractAddress === evmNativeCurrencyAddress
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const message = await encodeFunctionData({
    abi: sendMessageAbi,
    functionName: "transferToStacks",
    args: [info.toAddress],
  })

  const functionData = await encodeFunctionData({
    abi: BridgeEndpointAbi,
    functionName: "sendMessageWithToken",
    args: [
      fromTokenContractInfo.tokenContractAddress,
      numberToSolidityContractNumber(info.amount),
      message,
    ],
  })

  const fallbackGasLimit = 200_000
  const estimated = await estimateGas(fromTokenContractInfo.client, {
    account: info.fromAddress,
    to: bridgeEndpointAddress,
    data: functionData,
  })
    .then(n =>
      BigNumber.round(
        { precision: 0 },
        BigNumber.max([fallbackGasLimit, BigNumber.mul(n, 1.2)]),
      ),
    )
    .catch(
      // add a fallback in case estimate failed
      () => fallbackGasLimit,
    )

  return await info.sendTransaction({
    from: info.fromAddress,
    to: bridgeEndpointAddress,
    data: decodeHex(functionData),
    recommendedGasLimit: toSDKNumberOrUndefined(estimated),
  })
}

async function bridgeFromEVM_toBitcoin(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToBitcoin,
): Promise<BridgeFromEVMOutput> {
  const { bridgeEndpointContractAddress, nativeBridgeEndpointContractAddress } =
    (await getEVMContractCallInfo(ctx, info.fromChain)) ?? {}

  const fromTokenContractInfo = await getEVMTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )
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
      [SDK_NAME, "bridgeFromEVM (to Bitcoin)"],
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

  const message = await encodeFunctionData({
    abi: sendMessageAbi,
    functionName: "transferToBTC",
    args: [toAddressHex],
  })
  let bridgeEndpointAddress: undefined | EVMAddress
  let functionData: Hex
  let value: undefined | SDKNumber
  if (fromTokenContractInfo.tokenContractAddress === evmNativeCurrencyAddress) {
    functionData = await encodeFunctionData({
      abi: NativeBridgeEndpointAbi,
      functionName: "withdraw",
      args: [
        encodeZeroPrefixedHex(addressToBuffer(info.toChain, info.toAddress)),
      ],
    })

    const nativeCurrencyDecimals =
      fromTokenContractInfo.client.chain?.nativeCurrency.decimals
    if (nativeCurrencyDecimals == null) {
      throw new UnsupportedBridgeRouteError(
        info.fromChain,
        info.toChain,
        info.fromToken,
        info.toToken,
      )
    }

    bridgeEndpointAddress = nativeBridgeEndpointContractAddress
    value = toSDKNumberOrUndefined(
      BigNumber.rightMoveDecimals(nativeCurrencyDecimals, info.amount),
    )
  } else {
    functionData = await encodeFunctionData({
      abi: BridgeEndpointAbi,
      functionName: "sendMessageWithToken",
      args: [
        fromTokenContractInfo.tokenContractAddress,
        numberToSolidityContractNumber(info.amount),
        message,
      ],
    })

    bridgeEndpointAddress = bridgeEndpointContractAddress
  }

  if (bridgeEndpointAddress == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const fallbackGasLimit = 200_000
  const estimated = await estimateGas(fromTokenContractInfo.client, {
    account: info.fromAddress,
    to: bridgeEndpointAddress,
    data: functionData,
  })
    .then(n =>
      BigNumber.round(
        { precision: 0 },
        BigNumber.max([fallbackGasLimit, BigNumber.mul(n, 1.2)]),
      ),
    )
    .catch(
      // add a fallback in case estimate failed
      () => fallbackGasLimit,
    )

  return await info.sendTransaction({
    from: info.fromAddress,
    to: bridgeEndpointAddress,
    data: decodeHex(functionData),
    value,
    recommendedGasLimit: toSDKNumberOrUndefined(estimated),
  })
}

async function bridgeFromEVM_toEVM(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToEVM,
): Promise<BridgeFromEVMOutput> {
  const { bridgeEndpointContractAddress: bridgeEndpointAddress } =
    (await getEVMContractCallInfo(ctx, info.fromChain)) ?? {}
  const fromTokenContractInfo = await getEVMTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )
  const toTokenContractInfo = await getEVMTokenContractInfo(
    ctx,
    info.toChain,
    info.toToken,
  )

  const fromTokenContractAddress = fromTokenContractInfo?.tokenContractAddress
  const toTokenContractAddress = toTokenContractInfo?.tokenContractAddress
  if (
    bridgeEndpointAddress == null ||
    fromTokenContractInfo == null ||
    fromTokenContractAddress == null ||
    fromTokenContractAddress === evmNativeCurrencyAddress ||
    toTokenContractInfo == null ||
    toTokenContractAddress == null ||
    toTokenContractAddress === evmNativeCurrencyAddress
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }

  const message = await encodeFunctionData({
    abi: sendMessageAbi,
    functionName: "transferToEVM",
    args: [
      contractAssignedChainIdFromKnownChain(info.toChain),
      toTokenContractAddress,
      info.toAddress as EVMAddress,
    ],
  })
  const functionData = await encodeFunctionData({
    abi: BridgeEndpointAbi,
    functionName: "sendMessageWithToken",
    args: [
      fromTokenContractAddress,
      numberToSolidityContractNumber(info.amount),
      message,
    ],
  })

  const fallbackGasLimit = 200_000
  const estimated = await estimateGas(fromTokenContractInfo.client, {
    account: info.fromAddress,
    to: bridgeEndpointAddress,
    data: functionData,
  })
    .then(n =>
      BigNumber.round(
        { precision: 0 },
        BigNumber.max([fallbackGasLimit, BigNumber.mul(n, 1.2)]),
      ),
    )
    .catch(
      // add a fallback in case estimate failed
      () => fallbackGasLimit,
    )

  return await info.sendTransaction({
    from: info.fromAddress,
    to: bridgeEndpointAddress,
    data: decodeHex(functionData),
    recommendedGasLimit: toSDKNumberOrUndefined(estimated),
  })
}

async function bridgeFromEVM_toSolana(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToSolana,
): Promise<BridgeFromEVMOutput> {
  const { bridgeEndpointContractAddress: bridgeEndpointAddress } =
    (await getEVMContractCallInfo(ctx, info.fromChain)) ?? {}
  const fromTokenContractInfo = await getEVMTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )
  const solanaSupportedRoutes = await getSolanaSupportedRoutes(ctx, info.toChain)
  const toTokenContractInfo = solanaSupportedRoutes.find(r => r.solanaToken === info.toToken)
  if (toTokenContractInfo == null) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      info.toChain,
      info.fromToken,
      info.toToken,
    )
  }
  const toTokenCorrespondingStacksToken = await solanaTokenToCorrespondingStacksToken(
    ctx,
    info.toChain,
    info.toToken,
  )
  const toTokenStacksAddress = toTokenCorrespondingStacksToken == null
    ? undefined
    : await getStacksTokenContractInfo(
      ctx,
      KnownChainId.isEVMMainnetChain(info.fromChain)
        ? KnownChainId.Stacks.Mainnet
        : KnownChainId.Stacks.Testnet,
      toTokenCorrespondingStacksToken,
    )

  const fromTokenContractAddress = fromTokenContractInfo?.tokenContractAddress
  if (
    bridgeEndpointAddress == null ||
    fromTokenContractInfo == null ||
    fromTokenContractAddress == null ||
    fromTokenContractAddress === evmNativeCurrencyAddress ||
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

  // i want the code below to typecheck
  if (1 % 2 === 1) {
    throw new Error(`Not implemented, ${toTokenContractInfo.solanaTokenAddress} need new EVM messages`)
  }

  const message = await encodeFunctionData({
    abi: sendMessageAbi,
    functionName: "transferToEVM",
    args: [
      contractAssignedChainIdFromKnownChain(info.toChain),
      toTokenContractInfo.solanaTokenAddress as `0x${string}`, // TODO: fix this
      info.toAddress as EVMAddress,
    ],
  })
  const functionData = await encodeFunctionData({
    abi: BridgeEndpointAbi,
    functionName: "sendMessageWithToken",
    args: [
      fromTokenContractAddress,
      numberToSolidityContractNumber(info.amount),
      message,
    ],
  })

  const fallbackGasLimit = 200_000
  const estimated = await estimateGas(fromTokenContractInfo.client, {
    account: info.fromAddress,
    to: bridgeEndpointAddress,
    data: functionData,
  })
    .then(n =>
      BigNumber.round(
        { precision: 0 },
        BigNumber.max([fallbackGasLimit, BigNumber.mul(n, 1.2)]),
      ),
    )
    .catch(
      // add a fallback in case estimate failed
      () => fallbackGasLimit,
    )

  return await info.sendTransaction({
    from: info.fromAddress,
    to: bridgeEndpointAddress,
    data: decodeHex(functionData),
    recommendedGasLimit: toSDKNumberOrUndefined(estimated),
  })
}

async function bridgeFromEVM_toTron(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    KnownRoute_FromEVM_ToTron,
): Promise<BridgeFromEVMOutput> {
  throw new Error(`Not implemented, ${info.toToken} EVM to TRON need contract update`)
}

async function bridgeFromEVM_toMeta(
  ctx: SDKGlobalContext,
  info: Omit<
    BridgeFromEVMInput,
    "fromChain" | "toChain" | "fromToken" | "toToken"
  > &
    (KnownRoute_FromEVM_ToBRC20 | KnownRoute_FromEVM_ToRunes),
): Promise<BridgeFromEVMOutput> {
  const { bridgeEndpointContractAddress: bridgeEndpointAddress } =
    (await getEVMContractCallInfo(ctx, info.fromChain)) ?? {}
  const fromTokenContractInfo = await getEVMTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )

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
        KnownChainId.isEVMMainnetChain(info.fromChain)
          ? KnownChainId.Stacks.Mainnet
          : KnownChainId.Stacks.Testnet,
        toTokenCorrespondingStacksToken,
      )

  if (
    bridgeEndpointAddress == null ||
    fromTokenContractInfo == null ||
    fromTokenContractInfo.tokenContractAddress === evmNativeCurrencyAddress ||
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
        `bridgeFromEVM (to ${_knownChainIdToErrorMessagePart(info.toChain)})`,
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

  const message = await encodeFunctionData({
    abi: sendMessageAbi,
    functionName: KnownChainId.isBRC20Chain(info.toChain)
      ? "transferToBRC20"
      : "transferToRunes",
    args: [
      toAddressHex,
      `${toTokenStacksAddress.deployerAddress}.${toTokenStacksAddress.contractName}`,
    ],
  })
  const functionData = await encodeFunctionData({
    abi: BridgeEndpointAbi,
    functionName: "sendMessageWithToken",
    args: [
      fromTokenContractInfo.tokenContractAddress,
      numberToSolidityContractNumber(info.amount),
      message,
    ],
  })

  const fallbackGasLimit = 200_000
  const estimated = await estimateGas(fromTokenContractInfo.client, {
    account: info.fromAddress,
    to: bridgeEndpointAddress,
    data: functionData,
  })
    .then(n =>
      BigNumber.round(
        { precision: 0 },
        BigNumber.max([fallbackGasLimit, BigNumber.mul(n, 1.2)]),
      ),
    )
    .catch(
      // add a fallback in case estimate failed
      () => fallbackGasLimit,
    )

  return await info.sendTransaction({
    from: info.fromAddress,
    to: bridgeEndpointAddress,
    data: decodeHex(functionData),
    recommendedGasLimit: toSDKNumberOrUndefined(estimated),
  })
}

export async function bridgeFromEVM_toLaunchpad(
  ctx: SDKGlobalContext,
  info: {
    fromChain: KnownChainId.EVMChain
    fromToken: KnownTokenId.EVMToken
    fromAddress: EVMAddress
    receiverChain: KnownChainId.KnownChain
    receiverAddress: string
    /**
     * **Required** when `receiverChain` is one of bitcoin chains
     */
    receiverAddressScriptPubKey?: Uint8Array
    launchId: SDKNumber
    amount: SDKNumber
    sendTransaction: (tx: {
      from: EVMAddress
      to: EVMAddress
      data: Uint8Array
      recommendedGasLimit: SDKNumber
      value?: SDKNumber
    }) => Promise<{
      txHash: string
    }>
  },
): Promise<BridgeFromEVMOutput> {
  const { bridgeEndpointContractAddress: bridgeEndpointAddress } =
    (await getEVMContractCallInfo(ctx, info.fromChain)) ?? {}
  const fromTokenContractInfo = await getEVMTokenContractInfo(
    ctx,
    info.fromChain,
    info.fromToken,
  )
  const stacksChain = KnownChainId.isEVMMainnetChain(info.fromChain)
    ? KnownChainId.Stacks.Mainnet
    : KnownChainId.Stacks.Testnet
  if (
    bridgeEndpointAddress == null ||
    fromTokenContractInfo == null ||
    fromTokenContractInfo.tokenContractAddress === evmNativeCurrencyAddress
  ) {
    throw new UnsupportedBridgeRouteError(
      info.fromChain,
      stacksChain,
      info.fromToken,
    )
  }

  if (
    KnownChainId.isBitcoinChain(info.receiverChain) &&
    info.receiverAddressScriptPubKey == null
  ) {
    throw new InvalidMethodParametersError(
      [
        SDK_NAME,
        `bridgeFromEVM_toLaunchpad (to ${_knownChainIdToErrorMessagePart(info.receiverChain)})`,
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

  const toAddressHex =
    info.receiverAddressScriptPubKey != null
      ? toHex(info.receiverAddressScriptPubKey)
      : toHex(addressToBuffer(info.receiverChain, info.receiverAddress))

  const message = await encodeFunctionData({
    abi: sendMessageAbi,
    functionName: "transferToLaunchpad",
    args: [
      BigNumber.toBigInt({ roundingMode: BigNumber.roundDown }, info.launchId),
      toAddressHex,
    ],
  })
  const functionData = await encodeFunctionData({
    abi: BridgeEndpointAbi,
    functionName: "sendMessageWithToken",
    args: [
      fromTokenContractInfo.tokenContractAddress,
      numberToSolidityContractNumber(info.amount),
      message,
    ],
  })

  const fallbackGasLimit = 200_000
  const estimated = await estimateGas(fromTokenContractInfo.client, {
    account: info.fromAddress,
    to: bridgeEndpointAddress,
    data: functionData,
  })
    .then(n =>
      BigNumber.round(
        { precision: 0 },
        BigNumber.max([fallbackGasLimit, BigNumber.mul(n, 1.2)]),
      ),
    )
    .catch(
      // add a fallback in case estimate failed
      () => fallbackGasLimit,
    )

  return await info.sendTransaction({
    from: info.fromAddress,
    to: bridgeEndpointAddress,
    data: decodeHex(functionData),
    recommendedGasLimit: toSDKNumberOrUndefined(estimated),
  })
}
