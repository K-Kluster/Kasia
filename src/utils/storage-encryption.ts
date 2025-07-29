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

export function loadLegacyMessages(): Record<string, Message[]> {
  const messages = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!messages) return {};

  try {
    return JSON.parse(messages);
  } catch {
    console.error("Failed to parse legacy messages:", messages);
    return {};
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
    const legacyMessages = loadLegacyMessages();

    // for each address in the legacy storage, create a separate storage entry
    for (const [address, messages] of Object.entries(legacyMessages)) {
      if (messages && messages.length > 0) {
        saveMessagesForAddress(messages, walletId, address, password);
      }
    }

    // set migration success flag for tracking
    const walletIdPrefix = walletId.substring(0, 10);
    localStorage.setItem(`success_migrated_${walletIdPrefix}`, "true");

    // check if all wallets have been migrated
    checkAndCleanupLegacyStorage();

    console.log("Successfully migrated to per-address storage format");
  } catch (error) {
    console.error("Error during migration to per-address storage:", error);
  }
}

// helper function to check if all wallets are migrated and cleanup legacy storage
function checkAndCleanupLegacyStorage(): void {
  try {
    // get all wallets from localStorage
    const walletsData = localStorage.getItem("wallets");
    if (!walletsData) return;

    const wallets = JSON.parse(walletsData);
    if (!Array.isArray(wallets)) return;

    // check if all wallets have migration success flags
    let allWalletsMigrated = true;
    for (const wallet of wallets) {
      const walletIdPrefix = wallet.id.substring(0, 10);
      const migrationFlag = localStorage.getItem(
        `success_migrated_${walletIdPrefix}`
      );
      if (!migrationFlag) {
        allWalletsMigrated = false;
        break;
      }
    }

    // if all wallets are migrated, delete legacy storage and cleanup flags
    if (allWalletsMigrated) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      // clean up all migration flags
      for (const wallet of wallets) {
        const walletIdPrefix = wallet.id.substring(0, 10);
        localStorage.removeItem(`success_migrated_${walletIdPrefix}`);
      }

      console.log(
        "All wallets migrated - legacy storage and migration flags deleted"
      );
    }
  } catch (error) {
    console.error("Error checking migration status:", error);
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

// reencrypt all messages for a wallet when password changes
export async function reencryptMessagesForWallet(
  walletId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  try {
    // get all storage keys for this wallet
    const walletIdPrefix = walletId.substring(0, 8);
    const storageKeys: string[] = [];

    // find all storage keys that belong to this wallet
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`msg_${walletIdPrefix}_`)) {
        storageKeys.push(key);
      }
    }

    // reencrypt each address's messages
    for (const storageKey of storageKeys) {
      try {
        // extract the address from the storage key
        const addressSuffix = storageKey.replace(`msg_${walletIdPrefix}_`, "");

        // load messages with old password
        const messages = loadMessagesForAddress(
          walletId,
          addressSuffix,
          oldPassword
        );

        if (messages.length > 0) {
          // save messages with new password
          saveMessagesForAddress(
            messages,
            walletId,
            addressSuffix,
            newPassword
          );
          console.log(
            `Reencrypted ${messages.length} messages for address suffix: ${addressSuffix}`
          );
        }
      } catch (error) {
        console.error(
          `Failed to reencrypt messages for storage key ${storageKey}:`,
          error
        );
        // continue with other addresses even if one fails
      }
    }

    // also handle legacy storage if it exists
    try {
      const legacyMessages = loadLegacyMessages();
      if (Object.keys(legacyMessages).length > 0) {
        // save legacy messages with new password
        saveMessages(legacyMessages, newPassword);
        console.log("Reencrypted legacy messages");
      }
    } catch (error) {
      console.error("Failed to reencrypt legacy messages:", error);
    }

    console.log(`Successfully reencrypted messages for wallet ${walletId}`);
  } catch (error) {
    console.error("Error during message reencryption:", error);
    throw new Error("Failed to reencrypt messages with new password");
  }
}
