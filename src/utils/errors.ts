import { InstantSwapJobFailedReasonCode } from "../bitcoinUtils/apiHelpers/createInstantSwapTx"
import { SDK_NAME } from "../constants"
import { ChainId, TokenId } from "../sdkUtils/types"
import {
  SwapRouteViaALEX,
  SwapRouteViaEVMDexAggregator,
  SwapRouteViaInstantSwap,
} from "./SwapRouteHelpers"

/** Extends the Error class and serves as the base for all custom errors within the SDK. */
export class BroSDKErrorBase extends Error {
  constructor(...args: ConstructorParameters<typeof Error>) {
    super(...args)
    this.name = `${SDK_NAME}ErrorBase`
  }
}

export class AbortError extends BroSDKErrorBase {
  constructor(reason: unknown) {
    super("Abort", { cause: reason })
    this.name = "AbortError"
    this.cause = reason
  }
}

export class BridgeValidateFailedError extends BroSDKErrorBase {
  constructor(public cause: Error) {
    super("Bridge order validation failed", { cause })
    this.name = "BridgeValidateFailedError"
  }
}

export class StacksAddressVersionNotSupportedError extends BroSDKErrorBase {
  constructor(
    public address: string,
    public versionName: string,
  ) {
    super(`Stacks address ${address} version not supported: ${versionName}`)
    this.name = "StacksAddressVersionNotSupportedError"
  }
}

export class TooFrequentlyError extends BroSDKErrorBase {
  constructor(
    public methodPath: string[],
    public retryAfter?: number,
    options?: ErrorConstructorOptions,
  ) {
    super(
      `Call method ${methodPath.join(".")} too frequently` + retryAfter == null
        ? ""
        : `, retry after ${retryAfter} seconds`,
      options,
    )
    this.name = "TooFrequentlyError"
  }
}

/** It is thrown when a method in the SDK receives invalid parameters. */
export class InvalidMethodParametersError extends BroSDKErrorBase {
  constructor(
    public methodPath: string[],
    public params: {
      name: string
      expected: string
      received: string
    }[],
  ) {
    super(`Invalid method parameters of method ${methodPath.join(".")}`)
    this.name = "InvalidMethodParametersError"
  }
}

/** It is thrown when an attempt is made to bridge tokens between unsupported chains in the SDK. */
export class UnsupportedBridgeRouteError extends BroSDKErrorBase {
  constructor(
    public fromChain: ChainId,
    public toChain: ChainId,
    public fromToken: TokenId,
    public toToken?: TokenId,
    public swap?:
      | SwapRouteViaALEX
      | SwapRouteViaEVMDexAggregator
      | SwapRouteViaInstantSwap,
  ) {
    super(
      `Unsupported chain combination: ${fromToken}(${fromChain})${swap ? ` via ${swap.via}` : ""} -> ${toToken ?? "Unknown Token"}(${toChain})`,
    )
    this.name = "UnsupportedBridgeRouteError"
  }
}

/** It is thrown when a method in the SDK receives an unknown chain. */
export class UnsupportedChainError extends BroSDKErrorBase {
  constructor(public chain: ChainId) {
    super(`Unsupported chain: ${chain}`)
    this.name = "UnsupportedChainError"
  }
}
/** It is thrown when a smart contract is assigned an unknown or unsupported chain ID. */
export class UnsupportedContractAssignedChainIdError extends BroSDKErrorBase {
  constructor(public chainId: bigint) {
    super(`Unsupported smart contract assigned chain id: ${chainId}`)
    this.name = "UnsupportedContractAssignedChainIdError"
  }
}

export enum InstantSwapTransactionCreationFailedReasonCode {
  Timeout = InstantSwapJobFailedReasonCode.Timeout,
  BroadcastFailed = InstantSwapJobFailedReasonCode.BroadcastFailed,
}
export class InstantSwapTransactionCreationFailedError extends BroSDKErrorBase {
  constructor(
    public reasonCode: InstantSwapTransactionCreationFailedReasonCode,
    public reasonDetails: string,
  ) {
    super(`Instant swap transaction creation failed: ${reasonCode}`)
    this.name = "InstantSwapFinalizeJobFailedError"
  }
}
