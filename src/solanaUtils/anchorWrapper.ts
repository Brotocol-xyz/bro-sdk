import './solanaLibraryBufferFix';
import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import { getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from 'buffer';
import { BigNumber } from "../utils/BigNumber";
import { numberFromSolanaContractNumber, numberToSolanaContractNumber } from "./contractHelpers";
import { BridgeEndpoint } from "./idl/bridge_endpoint";
import bridgeEndpointIdl from "./idl/bridge_endpoint.idl.json";
import { BridgeRegistry } from "./idl/bridge_registry";
import bridgeRegistryIdl from "./idl/bridge_registry.idl.json";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { SDKNumber } from '../sdkUtils/types';

export interface TokenConfigAccount {
  mint: PublicKey;
  feePct: BigNumber;
  minFee: BigNumber;
  minAmount: BigNumber;
  maxAmount: BigNumber;
}

export interface SendMessageWithTokenParams {
  mint: string;
  amount: SDKNumber;
  payload: Uint8Array;
  sender: string;
  senderTokenAccount: string;
}

export class AnchorWrapper {
  private registryProgram: Program<BridgeRegistry>;
  private endpointProgram: Program<BridgeEndpoint>;
  private provider: AnchorProvider;

  constructor(
    rpcEndpoint: string,
    registryProgramId: string,
    endpointProgramId: string
  ) {
    // Create a dummy wallet since we're only reading data
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: () => Promise.reject(),
      signAllTransactions: () => Promise.reject(),
    };

    const connection = new Connection(rpcEndpoint);

    this.provider = new AnchorProvider(
      connection,
      dummyWallet,
      { commitment: "confirmed" }
    );

    // Initialize the registry program with the bridge registry IDL
    this.registryProgram = new Program<BridgeRegistry>(
      {
        ...bridgeRegistryIdl,
        address: registryProgramId,
      },
      this.provider
    );

    // Initialize the endpoint program with the bridge endpoint IDL
    this.endpointProgram = new Program<BridgeEndpoint>(
      {
        ...bridgeEndpointIdl,
        address: endpointProgramId,
      },
      this.provider
    );
  }

  /**
   * Get the token config account for a specific token mint
   * @param mintAddress The mint address of the token
   * @returns The token config account data with BigNumber values
   */
  async getTokenConfigAccount(mintAddress: string): Promise<TokenConfigAccount> {
    const [tokenConfigPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_config"),
        new PublicKey(mintAddress).toBuffer(),
      ],
      this.registryProgram.programId
    );

    try {
      const tokenConfigAccount = await this.registryProgram.account.tokenConfigAccount.fetch(tokenConfigPda);
      
      // Map BN values to BigNumber
      return {
        mint: tokenConfigAccount.tokenMint,
        feePct: numberFromSolanaContractNumber(tokenConfigAccount.feePct),
        minFee: numberFromSolanaContractNumber(tokenConfigAccount.minFee),
        minAmount: numberFromSolanaContractNumber(tokenConfigAccount.minAmount),
        maxAmount: numberFromSolanaContractNumber(tokenConfigAccount.maxAmount),
      };
    } catch (error) {
      throw new Error(`Failed to fetch token config account: ${error}`);
    }
  }

  /**
   * Creates a transaction for sending a message with token transfer/burn
   * @param params Parameters for the send message with token transaction
   * @returns The transaction object (not broadcast)
   */
  async createSendMessageWithTokenTx(params: SendMessageWithTokenParams): Promise<web3.Transaction> {
    const {
      amount,
      payload,
    } = params;
    const mint = new PublicKey(params.mint);
    const sender = new PublicKey(params.sender);
    const senderTokenAccount = new PublicKey(params.senderTokenAccount);

    console.log(`Using mint: ${mint.toString()}`);
    console.log(`Sender: ${sender.toString()}`);
    console.log(`Sender token account: ${senderTokenAccount.toString()}`);

    // Get the bridge registry PDA
    const [bridgeRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridge_registry")],
      this.registryProgram.programId
    );
    console.log(`Bridge Registry: ${bridgeRegistryPda.toString()}`);

    // Get the bridge endpoint PDA
    const [bridgeEndpointPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridge_endpoint")],
      this.endpointProgram.programId
    );
    console.log(`Bridge Endpoint: ${bridgeEndpointPda.toString()}`);

    const bridgeEndpoint = await this.endpointProgram.account.bridgeEndpoint.fetch(bridgeEndpointPda);
    const pegInAddress = bridgeEndpoint.pegInAddress;
    console.log(`Peg In Address: ${pegInAddress.toString()}`);

    const tokenProgramId = await getTokenProgramId(this.provider.connection, mint);
    console.log(`Token program ID: ${tokenProgramId.toString()}`);

    // Get registry fee ATA
    const registryFeeAta = getAssociatedTokenAddressSync(mint, bridgeRegistryPda, true, tokenProgramId);
    console.log(`Registry fee ATA: ${registryFeeAta.toString()}`);

    // Create the instruction
    const ix = await this.endpointProgram.methods
      .sendMessageWithToken(
        new BN(numberToSolanaContractNumber(amount)),
        Buffer.from(payload)
      )
      .accounts({
        sender: sender,
        mint: mint,
        senderTokenAccount: senderTokenAccount,
        tokenProgram: tokenProgramId,
        bridgeRegistryProgram: this.registryProgram.programId,
        pegInAddress: pegInAddress,
        // @ts-ignore - registryFeeAta is defined in IDL but not in TypeScript types
        registryFeeAta: registryFeeAta,
      })
      .instruction();

    // Create and return the transaction
    const tx = new web3.Transaction().add(ix);
    return tx;
  }
} 

async function getTokenProgramId(
  connection: Connection,
  mintAddress: PublicKey,
) {
  const mintInfo = await connection.getAccountInfo(mintAddress)
  if (mintInfo == null) {
    throw new Error(`Mint address ${mintAddress.toString()} not found`)
  }
  const owner = mintInfo.owner.toString()

  if (owner === TOKEN_PROGRAM_ID.toString()) {
    return TOKEN_PROGRAM_ID
  } else if (owner === TOKEN_2022_PROGRAM_ID.toString()) {
    return TOKEN_2022_PROGRAM_ID
  } else {
    throw new Error("Unknown token program")
  }
}

// if (require.main === module) {
//   (async () => {
//     const anchorWrapper = new AnchorWrapper(
//       new Connection("https://api.devnet.solana.com"),
//       "7ek62Vb634rwMhe44XC4FAs6Kff7MqrGx4XvSdsnDNoU"
//     );

//     const tokenConfigAccount = await anchorWrapper.getTokenConfigAccount(new PublicKey("8hS2fqr3Zk1LNJ3Q8iiQD49goH5zVkQZvmk4tW3HNXmo"));
//     console.log(tokenConfigAccount);
//   })();
// }