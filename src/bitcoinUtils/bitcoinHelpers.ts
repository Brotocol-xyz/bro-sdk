import type { EstimationInput } from "@c4/btc-utils"
import * as btc from "@scure/btc-signer"
import { Address, OutScript } from "@scure/btc-signer"
import { sum } from "../utils/bigintHelpers"
import { BigNumber } from "../utils/BigNumber"
import { SDKNumber } from "../sdkUtils/types"

export interface UTXOBasic {
  txId: string
  index: number
  amount: bigint
}

export interface UTXOConfirmed extends UTXOBasic {
  blockHeight: bigint
}

export type UTXOSpendable = EstimationInput &
  UTXOBasic & {
    scriptPubKey: Uint8Array
  }

export interface BitcoinNetwork {
  bech32: string
  pubKeyHash: number
  scriptHash: number
  wif: number
}

export function sumUTXO(utxos: Array<UTXOBasic>): bigint {
  return sum(utxos.map(utxo => utxo.amount))
}

export function isSameUTXO(utxo1: UTXOBasic, utxo2: UTXOBasic): boolean {
  return utxo1.txId === utxo2.txId && utxo1.index === utxo2.index
}

export type UTXOFilter = <U extends UTXOBasic>(utxo: U) => boolean
export function excludeUTXOs(excludingUTXOs: UTXOBasic[]): UTXOFilter {
  return filteringUTXO =>
    !excludingUTXOs.some(excludingUTXO =>
      isSameUTXO(excludingUTXO, filteringUTXO),
    )
}

export function addressToScriptPubKey(
  network: BitcoinNetwork,
  address: string,
): Uint8Array {
  const addr = Address(network).decode(address)
  return OutScript.encode(addr)
}
export function scriptPubKeyToAddress(
  network: BitcoinNetwork,
  output: Uint8Array,
): string {
  return Address(network).encode(OutScript.decode(output))
}

export function bitcoinToSatoshi(
  bitcoinAmount: `${number}` | SDKNumber | BigNumber,
): bigint {
  return BigNumber.toBigInt({}, BigNumber.rightMoveDecimals(8, bitcoinAmount))
}

export function satoshiToBitcoin(satoshiAmount: bigint): `${number}` {
  return BigNumber.toString(BigNumber.leftMoveDecimals(8, satoshiAmount))
}

export function getP2TRInternalPublicKey_from_P2TR_publicKey(
  network: BitcoinNetwork,
  publicKey: Uint8Array,
): Uint8Array {
  const ecdsaPublicKeyLength = 33

  if (publicKey.byteLength !== ecdsaPublicKeyLength) {
    throw new Error("Invalid public key length")
  }

  return publicKey.slice(1)
}

export function getTapInternalKey_from_P2TR_publicKey(
  network: BitcoinNetwork,
  publicKey: Uint8Array,
): Uint8Array {
  return btc.p2tr(
    getP2TRInternalPublicKey_from_P2TR_publicKey(network, publicKey),
    undefined,
    network,
  ).tapInternalKey
}

export function getRedeemScript_from_P2SH_P2WPKH_publicKey(
  network: BitcoinNetwork,
  publicKey: Uint8Array,
): Uint8Array {
  return btc.p2sh(btc.p2wpkh(publicKey, network), network).redeemScript!
}

export const getTxId = (transaction: Uint8Array): string => {
  return btc.Transaction.fromRaw(transaction, {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
    disableScriptCheck: true,
    allowLegacyWitnessUtxo: true,
  }).id
}