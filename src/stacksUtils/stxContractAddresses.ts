import {
  contractNameOverrides_mainnet,
  contractNameOverrides_testnet,
} from "../config"
import { KnownChainId, KnownTokenId } from "../utils/types/knownIds"
import { StacksContractAddress } from "../sdkUtils/types"

export const contractsDeployerMainnet =
  "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK"
export const contractsDeployerTestnet =
  "ST2QXSK64YQX3CQPC530K79XWQ98XFAM9W3XKEH3N"

export const contractsMultisigMainnet =
  "SP673Z4BPB4R73359K9HE55F2X91V5BJTN5SXZ5T"
export const contractsMultisigTestnet =
  "ST2QXSK64YQX3CQPC530K79XWQ98XFAM9W3XKEH3N"

export const alexContractDeployerMainnet =
  "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM"
export const alexContractDeployerTestnet =
  "ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK"

export const alexContractMultisigMainnet =
  "SP1E0XBN9T4B10E9QMR7XMFJPMA19D77WY3KP2QKC"
export const alexContractMultisigTestnet =
  "ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK"

export const legacyAlexContractDeployerMainnet =
  "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"
export const legacyAlexContractDeployerTestnet =
  "ST1J2JTYXGRMZYNKE40GM87ZCACSPSSEEQVSNB7DC"

export const wrapContractAddress = (
  network: "mainnet" | "testnet",
  address: StacksContractAddress,
): StacksContractAddress => {
  const contractNameOverrides =
    network === "mainnet"
      ? contractNameOverrides_mainnet
      : contractNameOverrides_testnet
  const contractName =
    (contractNameOverrides as any)?.[address.contractName] ??
    address.contractName
  return {
    ...address,
    contractName,
  }
}

export enum StacksContractName {
  BTCPegInEndpoint = "btc-peg-in-endpoint-v2-07",
  BTCPegInEndpointSwap = "btc-peg-in-endpoint-v2-07-swap",
  BTCPegInEndpointAggregator = "btc-peg-in-endpoint-v2-07-agg",
  BTCPegInEndpointLaunchpad = "btc-peg-in-endpoint-v2-05-launchpad",
  BTCPegOutEndpoint = "btc-peg-out-endpoint-v2-01",

  MetaPegInEndpoint = "meta-peg-in-endpoint-v2-04",
  MetaPegInEndpointSwap = "meta-peg-in-endpoint-v2-06-swap",
  MetaPegInEndpointAggregator = "meta-peg-in-endpoint-v2-06-agg",
  MetaPegOutEndpoint = "meta-peg-out-endpoint-v2-04",

  EVMPegInEndpoint = "cross-peg-in-endpoint-v2-04",
  EVMPegInEndpointSwap = "cross-peg-in-endpoint-v2-04-swap",
  EVMPegOutEndpoint = "cross-peg-out-endpoint-v2-01",
  EVMPegOutEndpointAggregator = "cross-peg-out-endpoint-v2-01-agg",
}

export const stxContractAddresses = {
  [StacksContractName.BTCPegInEndpoint]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.BTCPegInEndpoint,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.BTCPegInEndpoint,
    }),
  },
  [StacksContractName.BTCPegInEndpointSwap]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.BTCPegInEndpointSwap,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.BTCPegInEndpointSwap,
    }),
  },
  [StacksContractName.BTCPegInEndpointAggregator]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.BTCPegInEndpointAggregator,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.BTCPegInEndpointAggregator,
    }),
  },
  [StacksContractName.BTCPegInEndpointLaunchpad]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.BTCPegInEndpointLaunchpad,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.BTCPegInEndpointLaunchpad,
    }),
  },
  [StacksContractName.BTCPegOutEndpoint]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsDeployerMainnet,
      contractName: StacksContractName.BTCPegOutEndpoint,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsDeployerTestnet,
      contractName: StacksContractName.BTCPegOutEndpoint,
    }),
  },
  [StacksContractName.EVMPegInEndpoint]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.EVMPegInEndpoint,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.EVMPegInEndpoint,
    }),
  },
  [StacksContractName.EVMPegInEndpointSwap]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.EVMPegInEndpointSwap,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.EVMPegInEndpointSwap,
    }),
  },
  [StacksContractName.EVMPegOutEndpoint]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsDeployerMainnet,
      contractName: StacksContractName.EVMPegOutEndpoint,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsDeployerTestnet,
      contractName: StacksContractName.EVMPegOutEndpoint,
    }),
  },
  [StacksContractName.EVMPegOutEndpointAggregator]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.EVMPegOutEndpointAggregator,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.EVMPegOutEndpointAggregator,
    }),
  },
  [StacksContractName.MetaPegInEndpoint]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.MetaPegInEndpoint,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.MetaPegInEndpoint,
    }),
  },
  [StacksContractName.MetaPegInEndpointSwap]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.MetaPegInEndpointSwap,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.MetaPegInEndpointSwap,
    }),
  },
  [StacksContractName.MetaPegInEndpointAggregator]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.MetaPegInEndpointAggregator,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.MetaPegInEndpointAggregator,
    }),
  },
  [StacksContractName.MetaPegOutEndpoint]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: StacksContractName.MetaPegOutEndpoint,
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: StacksContractName.MetaPegOutEndpoint,
    }),
  },
} satisfies Record<
  StacksContractName,
  Record<typeof KnownChainId.Stacks.Mainnet | typeof KnownChainId.Stacks.Testnet, StacksContractAddress>
>

/**
 * @deprecated
 *
 * use `getStacksTokenContractInfo` instead
 */
export const stxTokenContractAddresses_legacy: Record<
  string,
  Record<KnownChainId.StacksChain, StacksContractAddress>
> = {
  [KnownTokenId.Stacks.ALEX]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: alexContractDeployerMainnet,
      contractName: "token-alex",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: alexContractDeployerTestnet,
      contractName: "token-alex",
    }),
  },
  [KnownTokenId.Stacks.aBTC]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsDeployerMainnet,
      contractName: "token-abtc",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsDeployerTestnet,
      contractName: "token-abtc",
    }),
  },
  [KnownTokenId.Stacks.sUSDT]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsDeployerMainnet,
      contractName: "token-susdt",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsDeployerTestnet,
      contractName: "token-susdt",
    }),
  },
  [KnownTokenId.Stacks.sLUNR]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsDeployerMainnet,
      contractName: "token-slunr",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsDeployerTestnet,
      contractName: "token-slunr",
    }),
  },
  [KnownTokenId.Stacks.sSKO]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsDeployerMainnet,
      contractName: "token-ssko",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsDeployerTestnet,
      contractName: "token-ssko",
    }),
  },
  [KnownTokenId.Stacks.vLiSTX]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: alexContractDeployerMainnet,
      contractName: "token-wvlqstx",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: alexContractDeployerTestnet,
      contractName: "token-wvlqstx",
    }),
  },
  [KnownTokenId.Stacks.vLiALEX]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: alexContractDeployerMainnet,
      contractName: "token-wvlialex",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: alexContractDeployerTestnet,
      contractName: "token-wvlialex",
    }),
  },
  [KnownTokenId.Stacks.vLiaBTC]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: alexContractMultisigMainnet,
      contractName: "token-wvliabtc",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: alexContractDeployerTestnet,
      contractName: "token-wvliabtc",
    }),
  },
  [KnownTokenId.Stacks.uBTC]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: "token-ubtc",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsDeployerTestnet,
      contractName: "token-ubtc",
    }),
  },
  [KnownTokenId.Stacks.DB20]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: legacyAlexContractDeployerMainnet,
      contractName: "brc20-db20",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: legacyAlexContractDeployerTestnet,
      contractName: "brc20-db20",
    }),
  },
  [KnownTokenId.Stacks.DOG]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: legacyAlexContractDeployerMainnet,
      contractName: "runes-dog",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: legacyAlexContractDeployerTestnet,
      contractName: "runes-dog",
    }),
  },
  [KnownTokenId.Stacks.STX]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: alexContractDeployerMainnet,
      contractName: "token-wstx-v2",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: alexContractDeployerTestnet,
      contractName: "token-wstx-v2",
    }),
  },
  [KnownTokenId.Stacks.TRUMP]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: "runes-trump",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: "runes-trump",
    }),
  },
  [KnownTokenId.Stacks.GHIBLICZ]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: "bsc-ghiblicz",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: "bsc-ghiblicz",
    }),
  },
  [KnownTokenId.Stacks.ETH]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: "token-eth",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: "token-eth",
    }),
  },
  [KnownTokenId.Stacks.SOL]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: "token-sol",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: "token-sol",
    }),
  },
  [KnownTokenId.Stacks.LINK]: {
    [KnownChainId.Stacks.Mainnet]: wrapContractAddress("mainnet", {
      deployerAddress: contractsMultisigMainnet,
      contractName: "token-link",
    }),
    [KnownChainId.Stacks.Testnet]: wrapContractAddress("testnet", {
      deployerAddress: contractsMultisigTestnet,
      contractName: "token-link",
    }),
  },
}
