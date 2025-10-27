import { NETWORK, TEST_NETWORK } from "@scure/btc-signer"
import {
  c32address,
  c32addressDecode,
  versions as c32addressVersions,
} from "c32check"
import {
  addressToScriptPubKey,
  scriptPubKeyToAddress,
} from "../bitcoinUtils/bitcoinHelpers"
import { StacksAddressVersionNotSupportedError } from "./errors"
import { decodeHex, encodeHex, encodeZeroPrefixedHex } from "./hexHelpers"
import { checkNever } from "./typeHelpers"
import { KnownChainId } from "./types/knownIds"
import bs58check from "bs58check"
import bs58 from "bs58"

export function addressFromBuffer(
  chain: KnownChainId.KnownChain,
  buffer: Uint8Array,
): string {
  if (KnownChainId.isStacksChain(chain)) {
    return c32address(
      c32addressVersions[
        chain === KnownChainId.Stacks.Mainnet ? "mainnet" : "testnet"
      ].p2pkh,
      encodeHex(buffer),
    )
  }

  if (
    KnownChainId.isBitcoinChain(chain) ||
    KnownChainId.isBRC20Chain(chain) ||
    KnownChainId.isRunesChain(chain)
  ) {
    const network =
      chain === KnownChainId.Bitcoin.Mainnet ||
      chain === KnownChainId.BRC20.Mainnet ||
      chain === KnownChainId.Runes.Mainnet
        ? NETWORK
        : chain === KnownChainId.Bitcoin.Testnet ||
            chain === KnownChainId.BRC20.Testnet ||
            chain === KnownChainId.Runes.Testnet
          ? TEST_NETWORK
          : (checkNever(chain), NETWORK)
    return scriptPubKeyToAddress(network, buffer)
  }

  if (KnownChainId.isEVMChain(chain)) {
    return encodeZeroPrefixedHex(buffer)
  }

  if (KnownChainId.isTronChain(chain)) {
    return bs58check.encode(buffer)
  }

  if (KnownChainId.isSolanaChain(chain)) {
    return bs58.encode(buffer)
  }

  checkNever(chain)
  throw new TypeError("[addressFromBuffer] Unsupported chain: " + chain)
}

export function addressToBuffer(
  chain: KnownChainId.KnownChain,
  address: string,
): Uint8Array {
  if (KnownChainId.isStacksChain(chain)) {
    const [version, hash160] = c32addressDecode(address)

    if (
      (chain === KnownChainId.Stacks.Mainnet &&
        version == c32addressVersions.mainnet.p2sh) ||
      (chain === KnownChainId.Stacks.Testnet &&
        version == c32addressVersions.testnet.p2sh)
    ) {
      throw new StacksAddressVersionNotSupportedError(address, "Multisig")
    } else if (
      (chain === KnownChainId.Stacks.Mainnet &&
        version !== c32addressVersions.mainnet.p2pkh) ||
      (chain === KnownChainId.Stacks.Testnet &&
        version !== c32addressVersions.testnet.p2pkh)
    ) {
      throw new StacksAddressVersionNotSupportedError(address, `${version}`)
    }

    return decodeHex(hash160)
  }

  if (
    KnownChainId.isBitcoinChain(chain) ||
    KnownChainId.isBRC20Chain(chain) ||
    KnownChainId.isRunesChain(chain)
  ) {
    const network =
      chain === KnownChainId.Bitcoin.Mainnet ||
      chain === KnownChainId.BRC20.Mainnet ||
      chain === KnownChainId.Runes.Mainnet
        ? NETWORK
        : chain === KnownChainId.Bitcoin.Testnet ||
            chain === KnownChainId.BRC20.Testnet ||
            chain === KnownChainId.Runes.Testnet
          ? TEST_NETWORK
          : (checkNever(chain), NETWORK)
    return addressToScriptPubKey(network, address)
  }

  if (KnownChainId.isEVMChain(chain)) {
    return decodeHex(address)
  }

  if (KnownChainId.isTronChain(chain)) {
    return bs58check.decode(address)
  }

  if (KnownChainId.isSolanaChain(chain)) {
    return bs58.decode(address)
  }

  checkNever(chain)
  throw new TypeError("[addressToBuffer] Unsupported chain: " + chain)
}
