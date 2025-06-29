export function makeBytes(
  byteArray: number[],
  actualLength: number,
): Uint8Array {
  const buffer = new Uint8Array(actualLength)
  buffer.set(byteArray)
  return buffer
}
