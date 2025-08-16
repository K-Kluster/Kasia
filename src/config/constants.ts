import { FeeBucket } from "../types/all";

export const ONE_MINUTE_IN_MS = 60 * 1000;

export const FEE_ESTIMATE_POLLING_INTERVAL_IN_MS = 2 * ONE_MINUTE_IN_MS;

export const ALIAS_LENGTH = 6; // 6 bytes = 12 hex characters

// Placeholder alias for fee estimation and testing (12 hex chars = 6 bytes)
export const PLACEHOLDER_ALIAS = "000000000000";

// Maximum priority fee (2 KAS)
export const MAX_PRIORITY_FEE = BigInt(2 * 100_000_000);
// Maximum fee pre sign and submit (max priority plus 10% buffer)
export const MAX_TX_FEE = (MAX_PRIORITY_FEE * BigInt(11)) / BigInt(10);

// Standard transaction mass in grams (typical Kaspa transaction)
export const STANDARD_TRANSACTION_MASS = 2036;

export const MAX_PAYLOAD_SIZE = 19 * 1024;

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

// message composer height constants
export const MESSAGE_COMPOSER_MIN_HEIGHT = 47;
export const MESSAGE_COMPOSER_MAX_ROWS = 3;
export const MESSAGE_COMPOSER_MAX_HEIGHT =
  MESSAGE_COMPOSER_MIN_HEIGHT * MESSAGE_COMPOSER_MAX_ROWS;
