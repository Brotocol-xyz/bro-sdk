import { equalBytes } from "@scure/btc-signer/utils"
import { SDK_NAME } from "../bitcoinUtils/constants"
import { addressToBuffer } from "../utils/addressHelpers"
import { InvalidMethodParametersError } from "../utils/errors"
import { KnownChainId } from "../utils/types/knownIds"
import type { BridgeInfoBitcoinDestinationInfo } from "./types"

export function resolveBitcoinDestinationScriptPubKey(
  methodName: string,
  toChain: KnownChainId.BitcoinChain,
  destination: BridgeInfoBitcoinDestinationInfo,
): undefined | Uint8Array {
  const scriptPubKeyFromAddress =
    destination.toAddress == null
      ? undefined
      : addressToBuffer(toChain, destination.toAddress)

  if (destination.toAddressScriptPubKey == null) {
    return scriptPubKeyFromAddress
  }

  if (
    scriptPubKeyFromAddress != null &&
    !equalBytes(scriptPubKeyFromAddress, destination.toAddressScriptPubKey)
  ) {
    throw new InvalidMethodParametersError(
      [SDK_NAME, methodName],
      [
        {
          name: "toAddressScriptPubKey",
          expected: "the scriptPubKey of the toAddress",
          received: "invalid scriptPubKey",
        },
      ],
    )
  }

  return destination.toAddressScriptPubKey
}
