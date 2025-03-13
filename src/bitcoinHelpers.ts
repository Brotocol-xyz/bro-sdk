import { isSameUTXO, UTXOConfirmed } from "./bitcoinUtils/bitcoinHelpers"
import { selectUTXOs as selectUTXOsImpl } from "./bitcoinUtils/selectUTXOs"
import { isNotNull } from "./utils/typeHelpers"

export {
  BitcoinNetwork,
  bitcoinToSatoshi,
  getP2TRInternalPublicKey_from_P2TR_publicKey,
  getRedeemScript_from_P2SH_P2WPKH_publicKey,
  getTapInternalKey_from_P2TR_publicKey,
  isSameUTXO,
  satoshiToBitcoin,
  sumUTXO,
  UTXOBasic,
  UTXOConfirmed,
  UTXOSpendable,
} from "./bitcoinUtils/bitcoinHelpers"
export { createTransaction } from "./bitcoinUtils/createTransaction"
export {
  BitcoinRecipient,
  BitcoinTransactionPrepareResult,
  prepareTransaction,
  ReselectSpendableUTXOsFn,
} from "./bitcoinUtils/prepareTransaction"
export {
  GetConfirmedSpendableUTXOFn,
  reselectSpendableUTXOsFactory,
  reselectSpendableUTXOsWithSafePadFactory,
} from "./bitcoinUtils/selectUTXOs"

export function selectUTXOs<T extends UTXOConfirmed>(
  satsToSend: bigint,
  selectedUTXOs: T[],
  otherAvailableUTXOs: T[],
): T[] {
  const selected = selectUTXOsImpl(
    satsToSend,
    selectedUTXOs,
    otherAvailableUTXOs,
  )
  const allUTXOs = [...selectedUTXOs, ...otherAvailableUTXOs]
  return selected
    .map(finding => allUTXOs.find(utxo => isSameUTXO(utxo, finding)))
    .filter(isNotNull)
}
