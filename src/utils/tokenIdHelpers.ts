import { deserializeCV, serializeCVBytes } from "@stacks/transactions"
import { listT, traitT, uintT } from "clarity-codegen"
import { getBRC20SupportedRoutes } from "../metaUtils/apiHelpers/getBRC20SupportedRoutes"
import { getRunesSupportedRoutes } from "../metaUtils/apiHelpers/getRunesSupportedRoutes"
import { parseRuneId } from "../runesHelpers"
import { SDKGlobalContext } from "../sdkUtils/types.internal"
import {
  getStacksToken,
  getStacksTokenContractInfo,
} from "../stacksUtils/contractHelpers"
import { decodeHex, encodeHex } from "./hexHelpers"
import { deserializeAssetIdentifier } from "./stacksHelpers"
import { checkNever } from "./typeHelpers"
import { KnownChainId, KnownTokenId } from "./types/knownIds"

export async function tokenIdFromBuffer(
  ctx: SDKGlobalContext,
  chain: KnownChainId.KnownChain,
  buffer: Uint8Array,
): Promise<undefined | KnownTokenId.KnownToken> {
  if (KnownChainId.isStacksChain(chain)) {
    try {
      const cv = deserializeCV(buffer)
      const decoded = traitT.decode(cv)
      const deserialized = deserializeAssetIdentifier(decoded)
      if (deserialized == null) return
      return getStacksToken(ctx, chain, deserialized)
    } catch (e) {
      return undefined
    }
  }

  if (KnownChainId.isBitcoinChain(chain)) {
    return KnownTokenId.Bitcoin.BTC
  }

  if (KnownChainId.isBRC20Chain(chain)) {
    const tick = stringFromBuffer(buffer)
    const routes = await getBRC20SupportedRoutes(ctx, chain)
    return routes.find(r => r.brc20Tick === tick)?.brc20Token
  }

  if (KnownChainId.isRunesChain(chain)) {
    const cv = deserializeCV(buffer)
    const [blockHeight, txIndex] = listT(uintT).decode(cv)
    if (blockHeight == null || txIndex == null) return
    const routes = await getRunesSupportedRoutes(ctx, chain)
    const runesId = `${blockHeight}:${txIndex}`
    return routes.find(r => r.runesId === runesId)?.runesToken
  }

  if (
    KnownChainId.isEVMChain(chain) ||
    KnownChainId.isTronChain(chain) ||
    KnownChainId.isSolanaChain(chain)
  ) {
    throw new TypeError("[tokenIdFromBuffer] Unsupported chain: " + chain)
  }

  checkNever(chain)
  throw new TypeError("[addressFromBuffer] Unsupported chain: " + chain)
}

export async function tokenIdToBuffer(
  ctx: SDKGlobalContext,
  chain: KnownChainId.KnownChain,
  tokenId: KnownTokenId.KnownToken,
): Promise<undefined | Uint8Array> {
  if (KnownChainId.isStacksChain(chain)) {
    if (!KnownTokenId.isStacksToken(tokenId)) return
    const address = await getStacksTokenContractInfo(ctx, chain, tokenId)
    if (address == null) return

    const cv = traitT.encode(
      `${address.deployerAddress}.${address.contractName}`,
    )
    return serializeCVBytes(cv)
  }

  if (KnownChainId.isBitcoinChain(chain)) {
    return new Uint8Array()
  }

  if (KnownChainId.isBRC20Chain(chain)) {
    const routes = await getBRC20SupportedRoutes(ctx, chain)
    const route = routes.find(r => r.brc20Token === tokenId)
    if (route == null) return
    return stringToBuffer(route.brc20Tick)
  }

  if (KnownChainId.isRunesChain(chain)) {
    const routes = await getRunesSupportedRoutes(ctx, chain)
    const route = routes.find(r => r.runesToken === tokenId)
    if (route == null) return

    const { blockHeight, txIndex } = parseRuneId(route.runesId)
    const cv = listT(uintT).encode([blockHeight, txIndex])
    return serializeCVBytes(cv)
  }

  if (
    KnownChainId.isEVMChain(chain) ||
    KnownChainId.isTronChain(chain) ||
    KnownChainId.isSolanaChain(chain)
  ) {
    throw new TypeError("[tokenIdToBuffer] Unsupported chain: " + chain)
  }

  checkNever(chain)
  throw new TypeError("[addressToBuffer] Unsupported chain: " + chain)
}

function stringToBuffer(string: string): Uint8Array {
  return new TextEncoder().encode(string)
}
function stringFromBuffer(buffer: Uint8Array): string {
  return new TextDecoder().decode(buffer)
}

function bigintToBuffer(bigint: bigint): Uint8Array {
  return decodeHex(bigint.toString(16))
}
function bigintFromBuffer(buffer: Uint8Array): bigint {
  return BigInt(`0x${encodeHex(buffer)}`)
}
