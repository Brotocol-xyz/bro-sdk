import { describe, expect, it } from "vitest"
import { addressToBuffer } from "../utils/addressHelpers"
import { InvalidMethodParametersError } from "../utils/errors"
import { KnownChainId } from "../utils/types/knownIds"
import { resolveBitcoinDestinationScriptPubKey } from "./bitcoinDestinationHelpers"

describe("resolveBitcoinDestinationScriptPubKey", () => {
  it("converts toAddress to a scriptPubKey", () => {
    const toAddress = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT"
    const scriptPubKey = resolveBitcoinDestinationScriptPubKey(
      "bridgeInfoFromEVM",
      KnownChainId.Bitcoin.Mainnet,
      { toAddress },
    )

    expect(scriptPubKey).toEqual(
      addressToBuffer(KnownChainId.Bitcoin.Mainnet, toAddress),
    )
  })

  it("returns the provided scriptPubKey when no address is provided", () => {
    const scriptPubKey = Uint8Array.of(0x6a)

    expect(
      resolveBitcoinDestinationScriptPubKey(
        "bridgeInfoFromEVM",
        KnownChainId.Bitcoin.Mainnet,
        { toAddressScriptPubKey: scriptPubKey },
      ),
    ).toBe(scriptPubKey)
  })

  it("rejects mismatched address and scriptPubKey", () => {
    expect(() =>
      resolveBitcoinDestinationScriptPubKey(
        "bridgeInfoFromEVM",
        KnownChainId.Bitcoin.Mainnet,
        {
          toAddress: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
          toAddressScriptPubKey: Uint8Array.of(0x6a),
        },
      ),
    ).toThrow(InvalidMethodParametersError)
  })
})
