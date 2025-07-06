import { FeeSource, ITransaction } from "kaspa-wasm";

export type Message = {
  transactionId: string;
  senderAddress: string;
  recipientAddress: string;
  timestamp: number;
  content: string;
  amount: number;
  fee?: number;
  payload: string;
  fileData?: {
    type: string;
    name: string;
    size: number;
    mimeType: string;
    content: string;
  };
};

export type Contact = {
  address: string;
  lastMessage: Message;
  messages: Message[];
  status?: "active" | "pending" | "rejected";
  nickname?: string;
};

export type NetworkType = "mainnet" | "testnet-10" | "testnet-11" | "devnet";

export interface BlockAddedData {
  type: string;
  data: Data;
}

interface Data {
  block: Block;
}

interface Block {
  header: Header;
  transactions: ITransaction[];
  verboseData: VerboseData3;
}

interface Header {
  hash: string;
  version: number;
  parentsByLevel: string[][];
  hashMerkleRoot: string;
  acceptedIdMerkleRoot: string;
  utxoCommitment: string;
  timestamp: string;
  bits: number;
  nonce: string;
  daaScore: string;
  blueWork: string;
  blueScore: string;
  pruningPoint: string;
}

export interface Transaction {
  // SDK fields
  version?: number;
  inputs: Input[];
  outputs: Output[];
  lockTime?: string;
  subnetworkId?: string;
  gas?: string;
  payload: string;
  mass?: string;
  verboseData?: VerboseData2;

  // API fields
  transaction_id: string;
  block_time: number;
}

export interface Input {
  previousOutpoint: PreviousOutpoint;
  signatureScript: string;
  sequence: string;
  sigOpCount: number;
  previous_outpoint_address?: string;
}

export interface PreviousOutpoint {
  transactionId: string;
  index: number;
}

export interface Output {
  value: string;
  scriptPublicKey: string;
  verboseData: VerboseData;
  amount?: number;
  script_public_key_address?: string;
}

export interface VerboseData {
  scriptPublicKeyType: string;
  scriptPublicKeyAddress: string;
}

export interface VerboseData2 {
  transactionId: string;
  hash: string;
  computeMass: string;
  blockHash: string;
  blockTime: string;
}

export interface VerboseData3 {
  hash: string;
  difficulty: number;
  selectedParentHash: string;
  transactionIds: string[];
  isHeaderOnly: boolean;
  blueScore: string;
  childrenHashes: never[];
  mergeSetBluesHashes: string[];
  mergeSetRedsHashes: never[];
  isChainBlock: boolean;
}

export interface FeeBucket {
  label: string;
  description: string;
  amount: bigint;
  feerate?: number; // Fee rate in sompi per gram (from network)
  estimatedSeconds?: number; // Estimated confirmation time
}

export interface PriorityFeeConfig {
  amount: bigint;
  source: FeeSource;
  feerate?: number; // Store the fee rate used for calculation
}
