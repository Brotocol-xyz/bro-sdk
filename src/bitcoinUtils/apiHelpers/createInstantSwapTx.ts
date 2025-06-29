import { SDKGlobalContext } from "../../sdkUtils/types.internal"
import { requestAPI } from "../../utils/apiHelpers"
import {
  InstantSwapTransactionCreationFailedError,
  InstantSwapTransactionCreationFailedReasonCode,
} from "../../utils/errors"
import { decodeHex, encodeZeroPrefixedHex } from "../../utils/hexHelpers"
import { sleep } from "../../utils/promiseHelpers"
import { checkNever } from "../../utils/typeHelpers"
import { getChainIdNetworkType, KnownChainId } from "../../utils/types/knownIds"
import { getTxId } from "../bitcoinHelpers"
import { BitcoinAddress } from "../btcAddresses"
import {
  InstantSwapOrder,
  InstantSwapOrderSerialized,
  serializeInstantSwapOrder,
} from "./InstantSwapOrder"

enum InstantSwapJobStatus {
  Initialized = "initialized",
  MarketMakerSigned = "market_maker_signed",
  Broadcasting = "broadcasting",
  Broadcasted = "broadcasted",
  Failed = "failed",
}

export enum InstantSwapJobFailedReasonCode {
  Timeout = "timeout",
  BroadcastFailed = "broadcast_failed",
}

type InstantSwapJob = {
  jobId: string
  instantSwapOrder: InstantSwapOrderSerialized
} & (
  | {
      status: InstantSwapJobStatus.Initialized
      initialPsbtHex: `0x${string}`
    }
  | {
      status: InstantSwapJobStatus.MarketMakerSigned
      marketMakerSignedPsbtHex: `0x${string}`
    }
  | {
      status: InstantSwapJobStatus.Broadcasting
      finalizedTxHex: `0x${string}`
    }
  | {
      status: InstantSwapJobStatus.Broadcasted
      finalizedTxHex: `0x${string}`
    }
  | {
      status: InstantSwapJobStatus.Failed
      reasonCode: InstantSwapJobFailedReasonCode
      reasonDetails: string
    }
)

async function getJob(
  sdkContext: SDKGlobalContext,
  params: {
    network: "mainnet" | "testnet"
    jobId: string
  },
): Promise<{ jobs: InstantSwapJob[] }> {
  return await requestAPI<{ jobs: InstantSwapJob[] }>(sdkContext, {
    path: `/2024-10-01/instant-swap/jobs`,
    method: "GET",
    query: {
      network: params.network,
      ["jobIds[]"]: params.jobId,
    },
  })
}

async function initializeJob(
  sdkContext: SDKGlobalContext,
  params: {
    network: "mainnet" | "testnet"
    instantSwapOrder: InstantSwapOrderSerialized
    psbt: Uint8Array
  },
): Promise<{ jobId: string }> {
  return await requestAPI<{ jobId: string }>(sdkContext, {
    path: `/2024-10-01/instant-swap/jobs`,
    method: "POST",
    body: {
      network: params.network,
      instantSwapOrder: params.instantSwapOrder,
      psbtHex: encodeZeroPrefixedHex(params.psbt),
    },
  })
}

export type SendFinalizeJobRequest = (info: {
  tx: Uint8Array
  orderData: Uint8Array
  orderOutputIndex: number
  orderOutputSatoshiAmount: bigint
  revealToAddress: BitcoinAddress
}) => Promise<{ txid: string }>
async function sendFinalizeJobRequestFactory(
  sdkContext: SDKGlobalContext,
  params: {
    network: "mainnet" | "testnet"
    jobId: string
  },
): Promise<SendFinalizeJobRequest> {
  return async info => {
    return await requestAPI<{ txid: string }>(sdkContext, {
      path: `/2024-10-01/instant-swap/jobs/${params.jobId}/broadcasters`,
      method: "POST",
      body: {
        network: params.network,
        transactionHex: encodeZeroPrefixedHex(info.tx),
        revealToAddress: info.revealToAddress.address,
        orderDataHex: encodeZeroPrefixedHex(info.orderData),
        orderOutputIndex: info.orderOutputIndex,
        orderOutputSatoshiAmount: String(info.orderOutputSatoshiAmount),
      },
    })
  }
}

export async function createInstantSwapTx(
  sdkContext: SDKGlobalContext,
  info: {
    fromChain: KnownChainId.BitcoinChain | KnownChainId.RunesChain
    instantSwapOrder: InstantSwapOrder
    psbt: Uint8Array
    finalizeJob: (info: {
      marketMakerSignedPSBT: Uint8Array
      sendFinalizeJobRequest: SendFinalizeJobRequest
    }) => Promise<{ txid: string; tx: Uint8Array }>
  },
): Promise<{
  txid: string
  tx: Uint8Array
}> {
  const network =
    getChainIdNetworkType(info.fromChain) === "mainnet" ? "mainnet" : "testnet"

  const instantSwapOrder = await serializeInstantSwapOrder(
    network,
    info.instantSwapOrder,
  )
  if (instantSwapOrder == null) {
    throw new TypeError("Failed to serialize instant swap order", {
      cause: {
        fromChain: info.fromChain,
        instantSwapOrder: info.instantSwapOrder,
      },
    })
  }

  const createdJob = await initializeJob(sdkContext, {
    network,
    instantSwapOrder,
    psbt: info.psbt,
  })

  while (true) {
    const jobs = await getJob(sdkContext, {
      network,
      jobId: createdJob.jobId,
    })

    const job = jobs.jobs.find(job => job.jobId === createdJob.jobId)

    if (job == null || job.status === InstantSwapJobStatus.Initialized) {
      await sleep(1000)
      continue
    }

    if (
      job.status === InstantSwapJobStatus.Broadcasting ||
      job.status === InstantSwapJobStatus.Broadcasted
    ) {
      const tx = decodeHex(job.finalizedTxHex)
      return { txid: getTxId(tx), tx }
    }

    if (job.status === InstantSwapJobStatus.Failed) {
      throw new InstantSwapTransactionCreationFailedError(
        job.reasonCode as unknown as InstantSwapTransactionCreationFailedReasonCode,
        job.reasonDetails,
      )
    }

    if (job.status === InstantSwapJobStatus.MarketMakerSigned) {
      const sendFinalizeJobRequest = await sendFinalizeJobRequestFactory(
        sdkContext,
        {
          network,
          jobId: createdJob.jobId,
        },
      )
      return await info.finalizeJob({
        marketMakerSignedPSBT: decodeHex(job.marketMakerSignedPsbtHex),
        sendFinalizeJobRequest,
      })
    }

    checkNever(job)
  }
}
