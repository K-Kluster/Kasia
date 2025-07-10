import { KaspaClient } from "src/utils/kaspa-client";
import { PublicKeyGenerator } from "wasm/kaspa";

export type Wallet = {
  id: string;
  name: string;
  createdAt: string;
  derivationType?: WalletDerivationType;
};

export type WalletDerivationType = "legacy" | "standard";

export type UnlockedWallet = {
  id: string;
  name: string;
  activeAccount: 1;
  publicKeyGenerator: PublicKeyGenerator;
  encryptedXPrv: string;
  password: string;
  client?: KaspaClient;
  // Add derivation type to unlocked wallet
  derivationType: WalletDerivationType;
};

export type StoredWallet = {
  id: string;
  name: string;
  encryptedPhrase: string;
  createdAt: string;
  accounts: { name: string }[];
  // Add derivation type to track wallet standard
  derivationType?: WalletDerivationType; // Optional for backward compatibility
};

export type WalletBalance = {
  mature: bigint;
  pending: bigint;
  outgoing: bigint;
  matureDisplay: string;
  pendingDisplay: string;
  outgoingDisplay: string;
  matureUtxoCount: number;
  pendingUtxoCount: number;
} | null;
