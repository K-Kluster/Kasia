import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "kaspa-wasm";
import { Message } from "../types/all";

// legacy storage key for backward compatibility
const LEGACY_STORAGE_KEY = "kaspa_messages_by_wallet";

// new per-address storage key format: msg_{8char wallet id}_{last 10kas address (sender)}
export function generateStorageKey(walletId: string, address: string): string {
  const walletIdPrefix = walletId.substring(0, 8);
  const addressSuffix = address.replace(/^kaspa[test]?:/, "").slice(-10);
  return `msg_${walletIdPrefix}_${addressSuffix}`;
}

// legacy function for backward compatibility - loads all messages for a wallet
export function loadLegacyMessages(
  password: string
): Record<string, Message[]> {
  const encrypted = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!encrypted) return {};
  try {
    const decrypted = decryptXChaCha20Poly1305(encrypted, password);
    return JSON.parse(decrypted);
  } catch {
    // try to parse as plaintext, sorta makes this backwards compatible
    try {
      return JSON.parse(encrypted);
    } catch {
      return {};
    }
  }
}

// new per-address storage functions
export function saveMessagesForAddress(
  messages: Message[],
  walletId: string,
  address: string,
  password: string
) {
  const storageKey = generateStorageKey(walletId, address);
  const encrypted = encryptXChaCha20Poly1305(
    JSON.stringify(messages),
    password
  );
  localStorage.setItem(storageKey, encrypted);
}

export function loadMessagesForAddress(
  walletId: string,
  address: string,
  password: string
): Message[] {
  const storageKey = generateStorageKey(walletId, address);
  const encrypted = localStorage.getItem(storageKey);
  if (!encrypted) return [];

  try {
    const decrypted = decryptXChaCha20Poly1305(encrypted, password);
    return JSON.parse(decrypted);
  } catch {
    // try to parse as plaintext for backward compatibility
    try {
      return JSON.parse(encrypted);
    } catch {
      return [];
    }
  }
}

// migration function to convert from legacy format to new per-address format
export function migrateToPerAddressStorage(
  walletId: string,
  password: string
): void {
  try {
    const legacyMessages = loadLegacyMessages(password);

    // for each address in the legacy storage, create a separate storage entry
    for (const [address, messages] of Object.entries(legacyMessages)) {
      if (messages && messages.length > 0) {
        saveMessagesForAddress(messages, walletId, address, password);
      }
    }

    // we cannot remove the entire legacy storage as it may contain other wallets
    // set migration success flag for tracking
    const walletIdPrefix = walletId.substring(0, 10);
    localStorage.setItem(`success_migrated_${walletIdPrefix}`, "true");
    console.log("Successfully migrated to per-address storage format");
  } catch (error) {
    console.error("Error during migration to per-address storage:", error);
  }
}

// legacy function for backward compatibility
export function saveMessages(
  messages: Record<string, Message[]>,
  password: string
) {
  const encrypted = encryptXChaCha20Poly1305(
    JSON.stringify(messages),
    password
  );
  localStorage.setItem(LEGACY_STORAGE_KEY, encrypted);
}
