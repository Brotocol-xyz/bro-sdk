import { BigNumber, type BigNumberSource } from "../utils/BigNumber"

const SOLANA_CONTRACT_COMMON_NUMBER_SCALE = 9

export const numberFromSolanaContractNumber = (
  num: bigint,
  decimals?: number,
): BigNumber => {
  return BigNumber.leftMoveDecimals(
    decimals ?? SOLANA_CONTRACT_COMMON_NUMBER_SCALE,
    num,
  )
}

export const numberToSolanaContractNumber = (
  num: BigNumberSource,
  decimals?: number,
): bigint => {
  return BigNumber.toBigInt(
    {},
    BigNumber.rightMoveDecimals(decimals ?? SOLANA_CONTRACT_COMMON_NUMBER_SCALE, num),
  )
}
