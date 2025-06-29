import { FeeBucket } from "../types/all";

export const ONE_MINUTE_IN_MS = 60 * 1000;

export const FEE_ESTIMATE_POLLING_INTERVAL_IN_MS = 2 * ONE_MINUTE_IN_MS;

// Maximum priority fee (5 KAS) - Originally 10 but lowering for intial release
export const MAX_PRIORITY_FEE = BigInt(5 * 100_000_000);

// Standard transaction mass in grams (typical Kaspa transaction)
export const STANDARD_TRANSACTION_MASS = 2036;

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
