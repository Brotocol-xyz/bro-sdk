import {
  UnsupportedChainError,
  UnsupportedContractAssignedChainIdError,
} from "../utils/errors"
import { assertExclude, checkNever } from "../utils/typeHelpers"
import { KnownChainId } from "../utils/types/knownIds"

export type KnownChainIdWithAssignedId =
  | KnownChainId.EVMChain
  | KnownChainId.BitcoinChain
  | KnownChainId.BRC20Chain
  | KnownChainId.RunesChain
  | KnownChainId.TronChain
  | KnownChainId.SolanaChain

export function contractAssignedChainIdFromKnownChain(
  chain: KnownChainIdWithAssignedId,
): bigint {
  switch (chain) {
    case KnownChainId.Bitcoin.Mainnet:
    case KnownChainId.Bitcoin.Testnet:
      return 0n
    case KnownChainId.EVM.Ethereum:
    case KnownChainId.EVM.Sepolia:
      return 1n
    case KnownChainId.EVM.BSC:
    case KnownChainId.EVM.BSCTestnet:
      return 2n
    case KnownChainId.EVM.CoreDAO:
    case KnownChainId.EVM.CoreDAOTestnet:
      return 3n
    case KnownChainId.EVM.Bsquared:
      return 4n
    case KnownChainId.EVM.BOB:
    case KnownChainId.EVM.BlifeTestnet:
      return 5n
    case KnownChainId.EVM.Bitlayer:
    case KnownChainId.EVM.BitboyTestnet:
      return 6n
    case KnownChainId.EVM.Lorenzo:
    case KnownChainId.EVM.BeraTestnet:
      return 7n
    case KnownChainId.EVM.Merlin:
      return 8n
    case KnownChainId.EVM.AILayer:
      return 9n
    case KnownChainId.EVM.Mode:
      return 10n
    case KnownChainId.EVM.XLayer:
      return 11n
    case KnownChainId.EVM.Arbitrum:
      return 12n
    case KnownChainId.EVM.Aurora:
      return 13n
    case KnownChainId.EVM.Manta:
      return 14n
    case KnownChainId.EVM.Linea:
      return 15n
    case KnownChainId.EVM.Base:
      return 16n
    case KnownChainId.EVM.Avalanche:
      return 17n
    case KnownChainId.EVM.Mezo:
      return 18n
    case KnownChainId.Solana.Mainnet:
      return 19n
    case KnownChainId.Solana.Testnet:
      return 6n // for testing
    case KnownChainId.Tron.Mainnet:
    case KnownChainId.Tron.Testnet:
      return 20n
    case KnownChainId.BRC20.Mainnet:
    case KnownChainId.BRC20.Testnet:
      return 1001n
    case KnownChainId.Runes.Mainnet:
    case KnownChainId.Runes.Testnet:
      return 1002n
    default:
      checkNever(chain)
      throw new UnsupportedChainError(chain)
  }
}

export function contractAssignedChainIdToKnownChain(
  chainId: bigint,
): [mainnet: KnownChainIdWithAssignedId, testnet?: KnownChainIdWithAssignedId] {
  const resPossibilities = assertExclude.i<KnownChainIdWithAssignedId>()

  if (chainId === 0n) {
    return [KnownChainId.Bitcoin.Mainnet, KnownChainId.Bitcoin.Testnet]
  }
  assertExclude(resPossibilities, KnownChainId.Bitcoin.Mainnet)
  assertExclude(resPossibilities, KnownChainId.Bitcoin.Testnet)

  if (chainId === 1n) {
    return [KnownChainId.EVM.Ethereum, KnownChainId.EVM.Sepolia]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Ethereum)
  assertExclude(resPossibilities, KnownChainId.EVM.Sepolia)

  if (chainId === 2n) {
    return [KnownChainId.EVM.BSC, KnownChainId.EVM.BSCTestnet]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.BSC)
  assertExclude(resPossibilities, KnownChainId.EVM.BSCTestnet)

  if (chainId === 3n) {
    return [KnownChainId.EVM.CoreDAO, KnownChainId.EVM.CoreDAOTestnet]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.CoreDAO)
  assertExclude(resPossibilities, KnownChainId.EVM.CoreDAOTestnet)

  if (chainId === 4n) {
    return [KnownChainId.EVM.Bsquared]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Bsquared)
  // assertExclude(resPossibilities, KnownChainId.EVM.BsquaredTestnet)

  if (chainId === 5n) {
    return [KnownChainId.EVM.BOB, KnownChainId.EVM.BlifeTestnet]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.BOB)
  assertExclude(resPossibilities, KnownChainId.EVM.BlifeTestnet)

  if (chainId === 6n) {
    return [KnownChainId.EVM.Bitlayer, KnownChainId.EVM.BitboyTestnet]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Bitlayer)
  assertExclude(resPossibilities, KnownChainId.EVM.BitboyTestnet)

  if (chainId === 7n) {
    return [KnownChainId.EVM.Lorenzo, KnownChainId.EVM.BeraTestnet]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Lorenzo)
  assertExclude(resPossibilities, KnownChainId.EVM.BeraTestnet)

  if (chainId === 8n) {
    return [KnownChainId.EVM.Merlin]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Merlin)

  if (chainId === 9n) {
    return [KnownChainId.EVM.AILayer]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.AILayer)

  if (chainId === 10n) {
    return [KnownChainId.EVM.Mode]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Mode)

  if (chainId === 11n) {
    return [KnownChainId.EVM.XLayer]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.XLayer)

  if (chainId === 12n) {
    return [KnownChainId.EVM.Arbitrum]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Arbitrum)

  if (chainId === 13n) {
    return [KnownChainId.EVM.Aurora]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Aurora)

  if (chainId === 14n) {
    return [KnownChainId.EVM.Manta]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Manta)

  if (chainId === 15n) {
    return [KnownChainId.EVM.Linea]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Linea)

  if (chainId === 16n) {
    return [KnownChainId.EVM.Base]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Base)

  if (chainId === 17n) {
    return [KnownChainId.EVM.Avalanche]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Avalanche)

  if (chainId === 18n) {
    return [KnownChainId.EVM.Mezo]
  }
  assertExclude(resPossibilities, KnownChainId.EVM.Mezo)

  if (chainId === 1001n) {
    return [KnownChainId.BRC20.Mainnet, KnownChainId.BRC20.Testnet]
  }
  assertExclude(resPossibilities, KnownChainId.BRC20.Mainnet)
  assertExclude(resPossibilities, KnownChainId.BRC20.Testnet)

  if (chainId === 1002n) {
    return [KnownChainId.Runes.Mainnet, KnownChainId.Runes.Testnet]
  }
  assertExclude(resPossibilities, KnownChainId.Runes.Mainnet)
  assertExclude(resPossibilities, KnownChainId.Runes.Testnet)

  if (chainId === 19n) {
    return [KnownChainId.Solana.Mainnet, KnownChainId.Solana.Testnet]
  }
  assertExclude(resPossibilities, KnownChainId.Solana.Mainnet)
  assertExclude(resPossibilities, KnownChainId.Solana.Testnet)

  // TBD
  if (chainId === 999n) {
    return [KnownChainId.Tron.Mainnet, KnownChainId.Tron.Testnet]
  }
  assertExclude(resPossibilities, KnownChainId.Tron.Mainnet)
  assertExclude(resPossibilities, KnownChainId.Tron.Testnet)

  checkNever(resPossibilities)
  throw new UnsupportedContractAssignedChainIdError(chainId)
}
