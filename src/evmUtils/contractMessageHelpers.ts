import { parseAbi } from "viem"

export const sendMessageAbi = parseAbi([
  "function transferToLaunchpad(uint256 launchId, bytes calldata destAddress) pure returns (uint256)",
  "function transferToEVM(uint256 destChainId, address destToken, address destAddress) pure returns (uint256)",
  "function transferToStacks(string calldata to) pure returns (uint256)",
  "function transferToBTC(bytes calldata btcAddress) pure returns (uint256)",
  "function transferToBRC20(bytes calldata btcAddress, string calldata destStacksTokenAddress) pure returns (uint256)",
  "function transferToRunes(bytes calldata btcAddress, string calldata destStacksTokenAddress) pure returns (uint256)",
  "function transferToSolana(bytes calldata recipient, bytes calldata mint) pure returns (bytes)",
])
