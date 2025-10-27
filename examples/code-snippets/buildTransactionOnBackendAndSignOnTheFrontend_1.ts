/**
 * This example shows how to build a transaction on the backend and sign it on the frontend.
 *
 * The backend will build the transaction and return the sign info to the frontend.
 * The frontend will sign the transaction and submit the signed transaction to the backend.
 *
 * The backend will broadcast the transaction on the backend as well.
 */

import {
  BridgeFromBitcoinInput,
  BridgeFromBitcoinOutput,
  BroSDK,
} from "../../src/BroSDK"

export type SignInfo = Parameters<BridgeFromBitcoinInput["signPsbt"]>[0]

export class TransactionBuilder {
  constructor(private readonly sdk: BroSDK) {}

  private inProgressRequests = new Map<
    /* requestId */ string,
    {
      signedTxDefer: Deferred<Uint8Array>
      bridgingResult: Promise<BridgeFromBitcoinOutput>
    }
  >()

  private generateGUID = genGUIDFactory()

  async buildTransactionFromBitcoin(
    inputs: Omit<BridgeFromBitcoinInput, "signPsbt" | "sendTransaction">,
  ): Promise<SignInfo> {
    const requestId = this.generateGUID()

    const signTxArgsDefer = deferred<SignInfo>()
    const signedTxDefer = deferred<Uint8Array>()

    const signPsbt: BridgeFromBitcoinInput["signPsbt"] = async signInfo => {
      signTxArgsDefer.resolve(signInfo)
      return { psbt: await signedTxDefer.promise }
    }

    const bridgingResult = this.sdk.bridgeFromBitcoin({
      ...inputs,
      signPsbt,
      sendTransaction: this.sendTransactionFactory(requestId),
    })

    this.inProgressRequests.set(requestId, {
      signedTxDefer,
      bridgingResult,
    })

    return signTxArgsDefer.promise
  }

  async continueBridgeFromBitcoin(
    requestId: string,
    signedTx: Uint8Array,
  ): Promise<BridgeFromBitcoinOutput> {
    const request = this.inProgressRequests.get(requestId)
    if (request == null) throw new Error("Request not found")
    request.signedTxDefer.resolve(signedTx)
    return request.bridgingResult
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

const genGUIDFactory = () => {
  let guid = 0
  return () => {
    guid++
    return guid.toString()
  }
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: any) => void
}
const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void
  let reject: (reason?: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}
