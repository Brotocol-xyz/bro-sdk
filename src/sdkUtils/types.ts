import { isAddress } from "viem"
import { SDK_NAME } from "../constants"
import { EVMEndpointContract } from "../evmUtils/evmContractAddresses"
import { BigNumber } from "../utils/BigNumber"
import { InvalidMethodParametersError } from "../utils/errors"

/**
 * A branded literal type used for SDK-specific types `ChainId`, `TokenId` and `SDKNumber`.
 *
 * For example:
 * - `"bitcoin-mainnet (BroSDK ChainId)"` represents a valid `ChainId`
 * - `"brc20-something (BroSDK TokenId)"` represents a valid `TokenId`
 * - `"10 (BroSDK number)"` represents a valid `SDKNumber`
 */
type SDKBrandedLiteral<
  Type extends string,
  T extends string | number,
> = `${T} (${typeof SDK_NAME} ${Type})`

/**
 * Represents a unique identifier for a blockchain network.
 */
export type ChainId<T extends string = string> = SDKBrandedLiteral<"ChainId", T>
/**
 * Represents a unique identifier for a cryptocurrency token.
 */
export type TokenId<T extends string = string> = SDKBrandedLiteral<"TokenId", T>

export type SDKNumber = SDKBrandedLiteral<"number", string>
export type SDKNumberifyNestly<T> =
  {
  // prettier-ignore
  [K in keyof T]:
    number extends T[K] ? SDKNumber | Exclude<T[K], number> :
    bigint extends T[K] ? SDKNumber | Exclude<T[K], bigint> :
    BigNumber extends T[K] ? SDKNumber | Exclude<T[K], BigNumber> :
    undefined extends T[K] ? undefined | SDKNumberifyNestly<Exclude<T[K], undefined>> :
    null extends T[K] ? null | SDKNumberifyNestly<Exclude<T[K], null>> :
    T[K] extends object ? SDKNumberifyNestly<T[K]> :
    T[K]
}
/**
 * https://github.com/MikeMcl/big.js/blob/9c6c959c92dc9044a0f98c31f60322fd91243468/big.js#L74
 */
const NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i
export function toSDKNumberOrUndefined<
  T extends null | undefined | SDKNumber | number | bigint | BigNumber,
>(n: T): Exclude<T, number | bigint | BigNumber> | SDKNumber {
  if (n == null) return undefined as any

  const str = BigNumber.toString(n)
  if (!NUMERIC.test(str)) {
    throw new InvalidMethodParametersError(
      ["toSDKNumberOrUndefined"],
      [
        {
          name: "n",
          expected:
            "a number, bigint, or a string that can be converted to a number",
          received: str,
        },
      ],
    )
  }

  return BigNumber.toString(n) as SDKNumber
}

export function formatSDKNumber(
  n: SDKNumber | number | bigint | BigNumber,
): `${number}` {
  return toSDKNumberOrUndefined(n) as `${number}`
}

export type EVMAddress = `0x${string}`
export const isEVMAddress = isAddress

export const evmNativeCurrencyAddress = Symbol(
  `[${SDK_NAME}] EVM Native Currency Address`,
)
export type EVMNativeCurrencyAddress = typeof evmNativeCurrencyAddress

export type RuneIdCombined = `${number}:${number}`

export interface StacksContractAddress {
  deployerAddress: string
  contractName: string
}
export const isStacksContractAddressEqual = (
  a: StacksContractAddress,
  b: StacksContractAddress,
): boolean => {
  return (
    a.deployerAddress === b.deployerAddress && a.contractName === b.contractName
  )
}

/**
 * Represents the type of public EVM contracts that are accessible through the SDK.
 * The `PublicEVMContractType` is tied to the specific `BridgeEndpoint` contract type defined
 * in the `EVMEndpointContract` namespace.
 */
export type PublicEVMContractType = typeof PublicEVMContractType.BridgeEndpoint
/**
 * A namespace that defines the public contract types available in the SDK for EVM-compatible blockchains.
 * This namespace currently includes only the `BridgeEndpoint` contract type, which corresponds to
 * the main contract used for bridging assets across EVM-compatible blockchains.
 */
export namespace PublicEVMContractType {
  /** Represents the bridge endpoint contract type in an EVM-compatible blockchain. */
  export const BridgeEndpoint = EVMEndpointContract.BridgeEndpoint
}
