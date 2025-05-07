// Bridge From BRC20

import {
  GetConfirmedSpendableUTXOFn,
  reselectSpendableUTXOsFactory,
  UTXOBasic,
} from "../../../src/bitcoinHelpers"
import {
  BroSDK,
  KnownTokenId,
  KnownChainId,
  BridgeFromBRC20Input,
} from "../../../src/index"

import { Psbt, payments, networks } from "bitcoinjs-lib"
import axios from "axios"

const sdk = new BroSDK()

// For BRC20 provide the tick symbol
const brc20Token: KnownTokenId.BRC20Token = (await sdk.brc20TickToBRC20Token(
  KnownChainId.BRC20.Mainnet,
  "alex$",
))!

// For EVM tokens provide the contract address
const evmToken: KnownTokenId.EVMToken = (await sdk.evmAddressToEVMToken(
  KnownChainId.EVM.Ethereum,
  "0x31761a152F1e96F966C041291644129144233b0B",
))!

// Mock functions for key management
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

const publicKey = await getPublicKey()
const { address: senderAddress, output: scriptPubKey } = payments.p2wpkh({
  pubkey: Buffer.from(publicKey, "hex"),
  network: networks.bitcoin,
})

// Select UTXOs to spend
const reselectSpendableNetworkFeeUTXOs: BridgeFromBRC20Input["reselectSpendableNetworkFeeUTXOs"] =
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

const sendTransaction: BridgeFromBRC20Input["sendTransaction"] = async tx => {
  /**
   * Implementation example for broadcasting a Bitcoin transaction with Axios
   */
  const response = await axios.post("https://blockstream.info/api/tx", tx.hex, {
    headers: { "Content-Type": "text/plain" },
  })
  return { txid: response.data }
}

const bridgeFromBRC20Input: BridgeFromBRC20Input = {
  fromChain: KnownChainId.BRC20.Mainnet,
  fromToken: brc20Token,
  toChain: KnownChainId.EVM.Ethereum,
  toToken: evmToken,
  fromAddress: senderAddress!,
  fromAddressScriptPubKey: scriptPubKey!,
  toAddress: "0x31751a152F1e95F966C041291644129144233b0B",
  inputInscriptionUTXO: {
    txId: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    index: 0,
    amount: 1000n,
    scriptPubKey: scriptPubKey!,
    addressType: "p2wpkh",
  },
  networkFeeRate: 10n,
  reselectSpendableNetworkFeeUTXOs,
  networkFeeChangeAddress: senderAddress!,
  networkFeeChangeAddressScriptPubKey: scriptPubKey!,
  signPsbt: async tx => {
    const psbt = Psbt.fromBuffer(Buffer.from(tx.psbt))

    for (const index of tx.signBitcoinInputs) {
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

    for (const index of tx.signInscriptionInputs) {
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
  },
  sendTransaction,
}

const result = await sdk.bridgeFromBRC20(bridgeFromBRC20Input)
console.log("Bitcoin Transaction ID:", result.txid)
