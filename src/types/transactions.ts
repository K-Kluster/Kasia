export type TransactionId = string;

// EXPLORER API

export interface ExplorerTransaction {
  subnetwork_id: string;
  transaction_id: string;
  hash: string;
  mass: string;
  payload: string;
  block_hash: string[];
  block_time: number;
  is_accepted: boolean;
  accepting_block_hash: string;
  accepting_block_blue_score: number;
  accepting_block_time: number;
  inputs: ExplorerInput[];
  outputs: ExplorerOutput[];
}

export interface ExplorerInput {
  transaction_id: string;
  index: number;
  previous_outpoint_hash: string;
  previous_outpoint_index: string;
  previous_outpoint_address: string | null;
  previous_outpoint_amount: string | null;
  signature_script: string;
  sig_op_count: string;
}

export interface ExplorerOutput {
  transaction_id: string;
  index: number;
  amount: number;
  script_public_key: string;
  script_public_key_address: string;
  script_public_key_type: string;
}

// Type guards and helper functions for ITransaction | ExplorerTransaction
import { ITransaction } from "kaspa-wasm";

export function isExplorerTransaction(
  tx: ITransaction | ExplorerTransaction
): tx is ExplorerTransaction {
  return "transaction_id" in tx && "block_hash" in tx;
}

export function isITransaction(
  tx: ITransaction | ExplorerTransaction
): tx is ITransaction {
  return "verboseData" in tx && !("transaction_id" in tx);
}

// Helper functions for consistent access
export function getTransactionId(
  tx: ITransaction | ExplorerTransaction
): string | undefined {
  return isExplorerTransaction(tx)
    ? tx.transaction_id
    : tx.verboseData?.transactionId;
}

export function getTransactionPayload(
  tx: ITransaction | ExplorerTransaction
): string {
  return tx.payload;
}

export function getBlockTime(tx: ITransaction | ExplorerTransaction): number {
  return isExplorerTransaction(tx)
    ? tx.block_time
    : Number(tx.verboseData?.blockTime);
}
