import { KaspaClient } from "src/utils/all-in-one";
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
