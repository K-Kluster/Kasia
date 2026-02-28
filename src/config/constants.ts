import { FeeBucket } from "../types/all";

export const KASPA_DONATION_ADDRESS =
  "kaspa:prx5q93j3m96htms5s4rkhk3awkf86jrrkcl2ssgsqdx4thyqcfmgjpgq2rj9"; // kasias generated multi-sig address
export const ONE_MINUTE_IN_MS = 60 * 1000;

export const FEE_ESTIMATE_POLLING_INTERVAL_IN_MS = 3 * 1000;

export const ALIAS_LENGTH = 6; // 6 bytes = 12 hex characters

// Placeholder alias for fee estimation and testing (12 hex chars = 6 bytes)
export const PLACEHOLDER_ALIAS = "000000000000";

// Maximum priority fee (2 KAS)
export const MAX_PRIORITY_FEE = BigInt(2 * 100_000_000);
// Maximum fee pre sign and submit (max priority plus 10% buffer)
export const MAX_TX_FEE = (MAX_PRIORITY_FEE * BigInt(11)) / BigInt(10);

// UTXO related constants
export const HIGH_UTXO_THRESHOLD = 20; // Threshold for showing high UTXO warning
export const UTXO_MIN_COMPOUND_COUNT = 2;

// Standard transaction mass in grams (typical Kaspa transaction)
export const STANDARD_TRANSACTION_MASS = 2036;

// basic kb limit
export const MAX_PAYLOAD_SIZE = 17.7 * 1024;
// rough (heuristic) for char limit on messages
export const MAX_CHAT_INPUT_CHAR = 18000;

// broadcast channel name length limit, at 36 due to having parity with a uuid char length
export const MAX_BROADCAST_CHANNEL_NAME = 36;

export const MARKDOWN_PREFIX = "§";

// Triggers a warn in the wallet to withdraw to cold storage.
// Settings at 30KAS
export const BALANCE_WARN = BigInt(30 * 100_000_000);

export const DEFAULT_FEE_BUCKETS: FeeBucket[] = [
  {
    label: "Low",
    description: "Standard processing time",
    amount: BigInt(0),
  },
  {
    label: "Normal",
    description: "Faster during busy times",
    amount: BigInt(1000), // 0.00001 KAS (fallback)
  },
  {
    label: "Priority",
    description: "Fastest processing",
    amount: BigInt(10000), // 0.0001 KAS (fallback)
  },
];

// Network fee constants
export const MIN_NETWORK_FEE = BigInt(20000000); // ~0.2 KAS minimum network fee

// message composer height constants
export const MESSAGE_COMPOSER_MIN_HEIGHT = 47;
export const MESSAGE_COMPOSER_MAX_ROWS = 3;
export const MESSAGE_COMPOSER_MAX_HEIGHT =
  MESSAGE_COMPOSER_MIN_HEIGHT * MESSAGE_COMPOSER_MAX_ROWS;
