/**
 * **WARNING**: this approach is not compatible with the instant swap, use the
 *   `buildTransactionOnBackendAndSignOnTheFrontend_1.ts` instead.
 *
 * This example shows how to build a transaction on the backend and sign it on the frontend.
 *
 * The backend will build the transaction and return the sign info to the frontend.
 * The frontend will sign the transaction and submit the signed transaction to the backend.
 *
 * The backend will broadcast the transaction on the backend as well.
 */

import { UTXOSpendable } from "../../src/bitcoinHelpers"
import {
  BridgeFromBitcoinInput,
  BridgeFromBitcoinOutput,
  BroSDK,
} from "../../src/BroSDK"

export type SignInfo = Parameters<BridgeFromBitcoinInput["signPsbt"]>[0]

export class TransactionBuilder {
  constructor(private readonly sdk: BroSDK) {}

  /**
   * This is a cache of the request parameters for the transaction builder.
   * All data inside are serializable, so it can even be persisted into some
   * persistent storage.
   */
  private cachedRequestParameters = new Map<
    /* requestId */ string,
    {
      sdkInputs: Omit<
        BridgeFromBitcoinInput,
        "signPsbt" | "sendTransaction" | "reselectSpendableUTXOs"
      >
      signInfo: SignInfo
      preparedUTXOs: UTXOSpendable[]
    }
  >()

  private generateGUID = genGUIDFactory()

  async buildTransactionFromBitcoin(
    sdkInputs: Omit<
      BridgeFromBitcoinInput,
      "signPsbt" | "sendTransaction" | "reselectSpendableUTXOs"
    >,
    otherInfos: {
      preparedUTXOs: UTXOSpendable[]
    },
  ): Promise<SignInfo> {
    const requestId = this.generateGUID()

    let signInfo: undefined | SignInfo

    await this.sdk
      .bridgeFromBitcoin({
        ...sdkInputs,
        reselectSpendableUTXOs: async () => otherInfos.preparedUTXOs,
        signPsbt: async _signInfo => {
          signInfo = _signInfo
          throw new JumpOutException()
        },
        sendTransaction: () => {
          // this method will never be called
          throw new TypeError("This method should never be called")
        },
      })
      .catch(e => {
        if (e instanceof JumpOutException) return
        throw e
      })

    if (signInfo == null) {
      throw new Error("Sign info is not set")
    }

    this.cachedRequestParameters.set(requestId, {
      sdkInputs,
      signInfo,
      preparedUTXOs: otherInfos.preparedUTXOs,
    })

    return signInfo
  }

  async continueBridgeFromBitcoin(
    requestId: string,
    signedTx: Uint8Array,
  ): Promise<BridgeFromBitcoinOutput> {
    const request = this.cachedRequestParameters.get(requestId)
    if (request == null) throw new Error("Request not found")

    /**
     * By using the same arguments, we can re-build the same transaction
     */
    return this.sdk.bridgeFromBitcoin({
      ...request.sdkInputs,
      reselectSpendableUTXOs: async () => request.preparedUTXOs,
      signPsbt: async signInfo => {
        this.assertSameSignInfo(signInfo, request.signInfo)
        return { psbt: signedTx }
      },
      sendTransaction: this.sendTransactionFactory(requestId),
    })
  }

  private assertSameSignInfo(signInfo1: SignInfo, signInfo2: SignInfo): void {
    if (!equalBytes(signInfo1.psbt, signInfo2.psbt)) {
      throw new Error("The psbt is not the same")
    }
    if (!equalArray(signInfo1.signInputs, signInfo2.signInputs)) {
      throw new Error("The signInputs is not the same")
    }
  }

  private sendTransactionFactory(
    _requestId: string,
  ): BridgeFromBitcoinInput["sendTransaction"] {
    return async () => {
      // broadcast the transaction on the backend as well
      return { txid: "123" }
    }
  }
}

class JumpOutException extends Error {
  constructor() {
    super("Jump out")
  }
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export function equalArray<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

const genGUIDFactory = () => {
  let guid = 0
  return () => {
    guid++
    return guid.toString()
  }
}
