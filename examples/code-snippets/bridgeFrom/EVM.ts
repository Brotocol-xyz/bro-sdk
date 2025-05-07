// Bridge From EVM

import {
  BroSDK,
  KnownTokenId,
  KnownChainId,
  toSDKNumberOrUndefined,
  BridgeFromEVMInput,
  EVMAddress,
  SDKNumber,
  formatSDKNumber,
} from "../../../src/index"

// Choose your preferred web3 lib here
import { ethers } from "ethers"

const sdk = new BroSDK()

// For Stacks provide the contract address
const stacksToken: KnownTokenId.StacksToken =
  (await sdk.stacksAddressToStacksToken(KnownChainId.Stacks.Mainnet, {
    deployerAddress: "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK",
    contractName: "token-abtc",
  }))!

// For EVM tokens provide the contract address
const evmToken: KnownTokenId.EVMToken = (await sdk.evmAddressToEVMToken(
  KnownChainId.EVM.Ethereum,
  "0x31761a152F1e96F966C041291644129144233b0B",
))!

// Example signer setup using ethers.js
const provider = new ethers.JsonRpcProvider(
  "https://mainnet.someprovider.io/YOUR_PROJECT_ID",
)
const signer = new ethers.Wallet(
  "000000000000000000000000000000000000000000000000000000000000002d",
  provider,
)
const signerAddress = signer.address as `0x${string}`

const bridgeFromEVMInput: BridgeFromEVMInput = {
  fromChain: KnownChainId.EVM.Ethereum,
  toChain: KnownChainId.Stacks.Mainnet,
  fromToken: evmToken,
  toToken: stacksToken,
  // Sender Ethereum address
  fromAddress: signerAddress,
  // Receiver Stacks principal
  toAddress: "SP2ZD731ANQZT6J4K3F5N8A40ZXWXC1XFXHVVQFKE",
  amount: toSDKNumberOrUndefined(100),
  sendTransaction: async (tx: {
    from: EVMAddress // Sender Ethereum address
    to: EVMAddress // Bridge Endpoint address
    data: Uint8Array
    recommendedGasLimit: SDKNumber
    value?: SDKNumber
  }): Promise<{ txHash: string }> => {
    /**
     * Implementation for sending transaction on Ethereum mainnet
     * See https://docs.ethers.org/v6/api/contract/ for reference
     */
    const txRequest = {
      from: tx.from,
      to: tx.to,
      data: ethers.hexlify(tx.data),
      gasLimit: formatSDKNumber(tx.recommendedGasLimit),
    }

    const sentTx = await signer.sendTransaction(txRequest)
    const receipt = await sentTx.wait()
    if (receipt === null) throw new Error("Transaction receipt is null")
    return { txHash: receipt.hash }
  },
}

// Perform the bridge operation
const result = await sdk.bridgeFromEVM(bridgeFromEVMInput)
console.log("Transaction ID:", result.txHash)
