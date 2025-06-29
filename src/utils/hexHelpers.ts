import { BroSDKErrorBase } from "./errors"

/**
 * https://github.com/wevm/viem/blob/d2f93e726df1ab1ff86098d68a4406f6fae315b8/src/utils/encoding/toBytes.ts#L150-L175
 */
export function decodeHex(hex: string): Uint8Array {
  let hexString = hex.startsWith("0x") ? hex.slice(2) : hex
  if (hexString.length % 2) hexString = `0${hexString}`

  const length = hexString.length / 2
  const bytes = new Uint8Array(length)
  for (let index = 0, j = 0; index < length; index++) {
    const nibbleLeft = charCodeToBase16(hexString.charCodeAt(j++))
    const nibbleRight = charCodeToBase16(hexString.charCodeAt(j++))
    if (nibbleLeft === undefined || nibbleRight === undefined) {
      throw new BroSDKErrorBase(
        `Invalid byte sequence ("${hexString[j - 2]}${
          hexString[j - 1]
        }" in "${hexString}").`,
      )
    }
    bytes[index] = nibbleLeft * 16 + nibbleRight
  }
  return bytes
}
const charCodeMap = {
  zero: 48,
  nine: 57,
  A: 65,
  F: 70,
  a: 97,
  f: 102,
} as const
function charCodeToBase16(char: number): undefined | number {
  if (char >= charCodeMap.zero && char <= charCodeMap.nine)
    return char - charCodeMap.zero
  if (char >= charCodeMap.A && char <= charCodeMap.F)
    return char - (charCodeMap.A - 10)
  if (char >= charCodeMap.a && char <= charCodeMap.f)
    return char - (charCodeMap.a - 10)
  return undefined
}

/**
 * https://github.com/wevm/viem/blob/d2f93e726df1ab1ff86098d68a4406f6fae315b8/src/utils/encoding/toHex.ts#L131-L143
 */
export function encodeHex(value: Uint8Array): string {
  let string = ""
  for (let i = 0; i < value.length; i++) {
    string += hexes[value[i]]
  }
  return string
}
const hexes = Array.from({ length: 256 }, (_v, i) =>
  i.toString(16).padStart(2, "0"),
)

export function encodeZeroPrefixedHex(value: Uint8Array): `0x${string}` {
  return `0x${encodeHex(value)}`
}
