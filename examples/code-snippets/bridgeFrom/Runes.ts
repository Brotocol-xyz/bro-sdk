// Bridge From Runes
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
  BridgeFromRunesInput,
  RunesUTXOSpendable,
} from "../../../src/index"
import { Psbt, payments, networks } from "bitcoinjs-lib"
import axios from "axios"

const sdk = new BroSDK()

// For Runes provide the runes ID
const runesToken: KnownTokenId.RunesToken = (await sdk.runesIdToRunesToken(
  KnownChainId.Runes.Mainnet,
  "500:20",
))!

// For EVM tokens provide the contract address
const evmToken: KnownTokenId.EVMToken = (await sdk.evmAddressToEVMToken(
  KnownChainId.EVM.Ethereum,
  "0x31761a152F1e96F966C041291644129144233b0B",
))!

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

// Select UTXOs to spend for network fees
const reselectSpendableNetworkFeeUTXOsForRunes: BridgeFromRunesInput["reselectSpendableNetworkFeeUTXOs"] =
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

// Example Runes UTXOs
const runesUTXOs: RunesUTXOSpendable[] = [
  {
    txId: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    index: 0,
    amount: 1000n,
    scriptPubKey: scriptPubKey!,
    addressType: "p2wpkh",
    runes: [
      {
        runeId: "500:20",
        runeDivisibility: 8,
        runeAmount: 100000000n, // 1.0 rune
      },
    ],
  },
]

// Sign a Bitcoin PSBT for Runes
const signPsbtForRunes: BridgeFromRunesInput["signPsbt"] = async tx => {
  const psbt = Psbt.fromBuffer(Buffer.from(tx.psbt))

  // For each Bitcoin input that needs to be signed
  for (const index of tx.signBitcoinInputs) {
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

  // For each Runes input that needs to be signed
  for (const index of tx.signRunesInputs) {
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
const sendTransactionForRunes: BridgeFromRunesInput["sendTransaction"] =
  async tx => {
    const response = await axios.post(
      "https://blockstream.info/api/tx",
      tx.hex,
      {
        headers: { "Content-Type": "text/plain" },
      },
    )
    return { txid: response.data }
  }

// Create the bridge input
const bridgeFromRunesInput: BridgeFromRunesInput = {
  fromChain: KnownChainId.Runes.Mainnet,
  fromToken: runesToken,
  toChain: KnownChainId.EVM.Ethereum,
  toToken: evmToken,
  fromAddress: senderAddress!,
  fromAddressScriptPubKey: scriptPubKey!,
  toAddress: "0x31751a152F1e95F966C041291644129144233b0B",
  amount: toSDKNumberOrUndefined(1), // 1.0 rune
  inputRuneUTXOs: runesUTXOs,
  networkFeeRate: 10n,
  reselectSpendableNetworkFeeUTXOs: reselectSpendableNetworkFeeUTXOsForRunes,
  networkFeeChangeAddress: senderAddress!,
  networkFeeChangeAddressScriptPubKey: scriptPubKey!,
  signPsbt: signPsbtForRunes,
  sendTransaction: sendTransactionForRunes,
}

// Perform the bridge operation
const result = await sdk.bridgeFromRunes(bridgeFromRunesInput)
console.log("Bitcoin Transaction ID:", result.txid)
