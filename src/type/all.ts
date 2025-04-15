export type Message = {
  content: string;
  payload: string;
  transactionId: string;
  senderAddress: string;
  recipientAddress: string;
  amount: number;
  timestamp: number;
};

export type Contact = {
  address: string;
  lastMessage: Message;
  messages: Message[];
};

export type NetworkType = "mainnet" | "testnet-10" | "testnet-11" | "devnet";

export interface BlockAddedData {
  type: string;
  data: Data;
}

export interface Data {
  block: Block;
}

export interface Block {
  header: Header;
  transactions: Transaction[];
  verboseData: VerboseData3;
}

export interface Header {
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
  version: number;
  inputs: Input[];
  outputs: Output[];
  lockTime: string;
  subnetworkId: string;
  gas: string;
  payload: string;
  mass: string;
  verboseData: VerboseData2;
}

export interface Input {
  previousOutpoint: PreviousOutpoint;
  signatureScript: string;
  sequence: string;
  sigOpCount: number;
}

export interface PreviousOutpoint {
  transactionId: string;
  index: number;
}

export interface Output {
  value: string;
  scriptPublicKey: string;
  verboseData: VerboseData;
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
