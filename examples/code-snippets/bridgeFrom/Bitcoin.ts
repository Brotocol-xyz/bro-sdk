// Bridge From BTC

import {
  GetConfirmedSpendableUTXOFn,
  reselectSpendableUTXOsFactory,
  UTXOBasic,
} from "../../../src/bitcoinHelpers"
import {
  BroSDK,
  KnownTokenId,
  KnownChainId,
  toSDKNumberOrUndefined,
  BridgeFromBitcoinInput,
} from "../../../src/index"
import { Psbt, payments, networks } from "bitcoinjs-lib"
import axios from "axios"

const sdk = new BroSDK()

// For EVM tokens provide the contract address
const evmToken = await sdk.evmAddressToEVMToken(
  KnownChainId.EVM.Ethereum,
  "0x31761a152F1e96F966C041291644129144233b0B",
)

// Mock functions for key management
// In a real implementation, these would be provided by the user's environment
const getPublicKey = async (): Promise<string> => {
  // This is a mock implementation
  // In a real implementation, this would return the user's public key
  return "02a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7"
}

const signTx = async (hex: string): Promise<string> => {
  // This is a mock implementation
  // In a real implementation, this would sign the transaction with the user's private key
  return "mock_signature"
}

// Get address and scriptPubKey
const publicKey = await getPublicKey()
const { address: senderAddress, output: scriptPubKey } = payments.p2wpkh({
  pubkey: Buffer.from(publicKey, "hex"),
  network: networks.bitcoin,
})

// Select UTXOs to spend
const reselectSpendableUTXOs: BridgeFromBitcoinInput["reselectSpendableUTXOs"] =
  async (satsToSend, lastTimeSelectedUTXOs) => {
    // Example of available UTXOs from a Bitcoin node or API
    const availableUTXOs: UTXOBasic[] = [
      {
        txId: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        index: 0,
        amount: 5000n,
      },
      {
        txId: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        index: 1,
        amount: 3000n,
      },
      {
        txId: "7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
        index: 2,
        amount: 2000n,
      },
    ]

    // Function to convert basic UTXOs to spendable UTXOs with scriptPubKey
    const getUTXOSpendable: GetConfirmedSpendableUTXOFn = async (
      utxo: UTXOBasic,
    ) => {
      // For this example, we'll create a simple UTXOSpendable object
      return {
        ...utxo,
        scriptPubKey: scriptPubKey!,
        addressType: "p2wpkh",
        blockHeight: 800000n, // Example block height
      }
    }

    // Create the reselect function with factory helper
    const reselectFn = reselectSpendableUTXOsFactory(
      availableUTXOs,
      getUTXOSpendable,
    )

    return reselectFn(satsToSend, lastTimeSelectedUTXOs)
  }

// Sign a Bitcoin PSBT
const signPsbt: BridgeFromBitcoinInput["signPsbt"] = async tx => {
  /**
   * Implementation example for signing a Bitcoin PSBT (Partially Signed Bitcoin Transaction)
   */
  const psbt = Psbt.fromBuffer(Buffer.from(tx.psbt))

  // For each input that needs to be signed
  for (const index of tx.signInputs) {
    // Get the input's sighash
    const input = psbt.data.inputs[index]
    // @ts-ignore
    const sighash = input.sighashType

    // Sign the transaction using the mocked signTx function
    const signature = await signTx(psbt.toHex())

    // Add the signature to the PSBT
    psbt.updateInput(index, {
      partialSig: [
        {
          pubkey: Buffer.from(await getPublicKey(), "hex"),
          signature: Buffer.from(signature, "hex"),
        },
      ],
    })
  }

  psbt.finalizeAllInputs()
  return { psbt: psbt.toBuffer() }
}

// Broadcast the signed transaction
const sendTransaction: BridgeFromBitcoinInput["sendTransaction"] = async tx => {
  /**
   * Implementation example for broadcasting a Bitcoin transaction with Axios
   */
  const response = await axios.post("https://blockstream.info/api/tx", tx.hex, {
    headers: { "Content-Type": "text/plain" },
  })
  return { txid: response.data }
}

// Estimate transaction fee and virtual size before performing the bridge operation
const estimateTransaction = await sdk.estimateBridgeTransactionFromBitcoin({
  fromChain: KnownChainId.Bitcoin.Mainnet,
  fromToken: KnownTokenId.Bitcoin.BTC,
  toChain: KnownChainId.EVM.Ethereum,
  toToken: evmToken as KnownTokenId.EVMToken,
  fromAddressScriptPubKey: scriptPubKey!,
  fromAddress: senderAddress!,
  toAddress: "0x31751a152F1e95F966C041291644129144233b0B",
  amount: toSDKNumberOrUndefined(1),
  networkFeeRate: 10n,
  reselectSpendableUTXOs: reselectSpendableUTXOs,
})

console.log("Estimated Transaction: ", estimateTransaction)

const bridgeFromBitcoinInput: BridgeFromBitcoinInput = {
  fromChain: KnownChainId.Bitcoin.Mainnet,
  fromToken: KnownTokenId.Bitcoin.BTC,
  toChain: KnownChainId.EVM.Ethereum,
  toToken: evmToken as KnownTokenId.EVMToken,
  fromAddressScriptPubKey: scriptPubKey!,
  fromAddress: senderAddress!,
  toAddress: "0x31751a152F1e95F966C041291644129144233b0B",
  amount: toSDKNumberOrUndefined(1),
  networkFeeRate: 10n, // Expressed in satoshis per virtual byte (sat/vbyte).
  reselectSpendableUTXOs,
  signPsbt,
  sendTransaction,
}

// Perform the bridge operation
const result = await sdk.bridgeFromBitcoin(bridgeFromBitcoinInput)
console.log("Bitcoin Transaction ID:", result.txid)
