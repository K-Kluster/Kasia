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
