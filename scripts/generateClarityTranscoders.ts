import { generateContracts } from "clarity-codegen/lib/generate"
import * as path from "node:path"
import {
  contractNameOverrides_mainnet,
  contractNameOverrides_testnet,
  STACKS_MAINNET,
  STACKS_TESTNET,
} from "../src/config"
import {
  StacksContractName,
  stxContractAddresses,
  contractsMultisigMainnet,
  contractsMultisigTestnet,
} from "../src/stacksUtils/stxContractAddresses"
import { KnownChainId } from "../src/utils/types/knownIds"

const envName = process.env.ENV_NAME === "dev" ? "dev" : "prod"

;(async function main(): Promise<void> {
  const stacksChainId =
    envName === "prod"
      ? KnownChainId.Stacks.Mainnet
      : KnownChainId.Stacks.Testnet
  const fallbackDeployerAddress =
    envName === "prod"
      ? contractsMultisigMainnet
      : contractsMultisigTestnet
  const fallbackStacksNetwork =
    envName === "prod" ? STACKS_MAINNET : STACKS_TESTNET

  await generateContracts(
    process.env.STACKS_CORE_API_URL ?? fallbackStacksNetwork.client.baseUrl,
    contractName => {
      return (
        stxContractAddresses[contractName as StacksContractName]?.[
          stacksChainId
        ]?.deployerAddress ?? fallbackDeployerAddress
      )
    },
    [
      "btc-peg-in-endpoint-v2-07",
      "btc-peg-in-endpoint-v2-07-swap",
      "btc-peg-in-endpoint-v2-07-agg",
      "btc-peg-in-endpoint-v2-05-launchpad",
      "btc-peg-out-endpoint-v2-01",
      "cross-peg-in-endpoint-v2-04",
      "cross-peg-in-endpoint-v2-04-swap",
      "cross-peg-out-endpoint-v2-01",
      "cross-peg-out-endpoint-v2-01-agg",
      "meta-peg-in-endpoint-v2-04",
      "meta-peg-in-endpoint-v2-06-swap",
      "meta-peg-in-endpoint-v2-06-agg",
      "meta-peg-out-endpoint-v2-04",
    ],
    path.resolve(__dirname, "../generated/smartContract/"),
    "bro",
    "../smartContractHelpers/codegenImport",
    envName === "prod"
      ? contractNameOverrides_mainnet
      : contractNameOverrides_testnet,
  )
})().catch(console.error)
