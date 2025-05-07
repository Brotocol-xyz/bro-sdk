// Bridge From Stacks
import {
  BroSDK,
  KnownTokenId,
  KnownChainId,
  BridgeFromStacksInput,
  toSDKNumberOrUndefined,
} from "../../../src/index"
import {
  makeContractCall,
  broadcastTransaction,
  deserializeCV,
} from "@stacks/transactions"
import { ContractCallOptions } from "../../../src/stacksUtils/contractHelpers"

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

const bridgeInfo = await sdk.bridgeInfoFromStacks({
  fromChain: KnownChainId.Stacks.Mainnet,
  toChain: KnownChainId.EVM.Ethereum,
  fromToken: stacksToken,
  toToken: evmToken,
  amount: toSDKNumberOrUndefined(100_000_000),
})

console.log("Bridge Info:", bridgeInfo)

const bridgeFromStacksInput: BridgeFromStacksInput = {
  fromChain: KnownChainId.Stacks.Mainnet,
  toChain: KnownChainId.EVM.Ethereum,
  fromToken: stacksToken,
  toToken: evmToken,
  fromAddress: "SP2ZD731ANQZT6J4K3F5N8A40ZXWXC1XFXHVVQFKE",
  // Receiver EVM address
  toAddress: "0x31751a152F1e95F966C041291644129144233b0B",
  amount: toSDKNumberOrUndefined(100),
  sendTransaction: async (tx: ContractCallOptions) => {
    /**
     * Implementation for sending transaction on Stacks mainnet.
     * Refer to:
     *   - https://github.com/hirosystems/stacks.js/tree/main/packages/transactions#smart-contract-function-call
     *   - https://stacks.js.org/functions/_stacks_transactions.makeContractCall
     *   - https://stacks.js.org/functions/_stacks_transactions.broadcastTransaction
     */
    const transaction = await makeContractCall({
      contractAddress: tx.contractAddress,
      contractName: tx.contractName,
      functionName: tx.functionName,
      // Deserialize each element of functionArgs and convert it into ClarityValue[]
      functionArgs: tx.functionArgs.map(arg => deserializeCV(arg)),
      postConditions: [] /* Add post conditions */,
      validateWithAbi: true,
      senderKey:
        "b244296d5907de9864c0b0d51f98a13c52890be0404e83f273144cd5b9960eed01",
      network: "mainnet",
    })

    const broadcastResponse = await broadcastTransaction({
      transaction,
      network: "mainnet",
    })
    return { txid: broadcastResponse.txid }
  },
}

const result = await sdk.bridgeFromStacks(bridgeFromStacksInput)
console.log("Transaction ID:", result.txid)
