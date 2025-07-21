import {
  decrypt_with_secret_key,
  encrypt_message,
  EncryptedMessage,
} from "cipher";
import { NetworkType } from "kaspa-wasm";
import { UnlockedWallet } from "../types/wallet.type";
import { loadLegacyMessages, saveMessages } from "../utils/storage-encryption";
import { WalletStorage } from "../utils/wallet-storage";
import { getNetworkTypeFromAddress } from "../utils/network";
import { ConversationManager } from "../utils/conversation-manager";
import { useWalletStore } from "../store/wallet.store";
import {
  Conversation,
  ActiveConversation,
  PendingConversation,
} from "../types/messaging.types";

export class ExportImportService {
  static VERSION = "1.0";
  static TYPE = "kaspa-messages-backup";

  async exportAllForWallet(
    unlockedWallet: UnlockedWallet,
    password: string,
    conversationManager: ConversationManager
  ) {
    console.log("Starting message export process...");

    const messagesMap = loadLegacyMessages(password);

    console.log("Getting private key generator...");
    const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
      unlockedWallet,
      password
    );

    console.log("Getting receive key...");
    const receiveKey = privateKeyGenerator.receiveKey(0);

    // Get the current network type from the first message's address
    let networkType = NetworkType.Mainnet; // Default to mainnet
    const addresses = Object.keys(messagesMap);
    if (addresses.length > 0) {
      networkType = getNetworkTypeFromAddress(addresses[0]);
    }
    console.log("Using network type:", networkType);

    const receiveAddress = receiveKey.toAddress(networkType);
    const walletAddress = receiveAddress.toString();
    console.log("Using receive address:", walletAddress);

    // Export nicknames for this wallet
    const nicknameStorageKey = `contact_nicknames_${walletAddress}`;
    const nicknames = JSON.parse(
      localStorage.getItem(nicknameStorageKey) || "{}"
    );
    console.log("Exporting nicknames:", nicknames);

    // Create backup object with metadata
    const backup = {
      version: "1.0",
      timestamp: Date.now(),
      type: "kaspa-messages-backup",
      data: messagesMap,
      nicknames: nicknames,
      conversations: {
        active: conversationManager.getActiveConversations() || [],
        pending: conversationManager.getPendingConversations() || [],
      },
    };

    console.log("Converting backup to string...");
    const backupStr = JSON.stringify(backup);

    console.log("Encrypting backup data...");
    try {
      const encryptedData = await encrypt_message(
        receiveAddress.toString(),
        backupStr
      );

      // Create a Blob with the encrypted data wrapped in JSON
      const backupFile = {
        type: "kaspa-messages-backup",
        data: encryptedData.to_hex(),
      };

      const blob = new Blob([JSON.stringify(backupFile)], {
        type: "application/json",
      });

      return blob;
    } catch (error: unknown) {
      console.error("Detailed export error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to create backup: ${errorMessage}`);
    }
  }

  async importForWallet(
    file: File,
    unlockedWallet: UnlockedWallet,
    password: string,
    conversationManager: ConversationManager
  ) {
    console.log("Starting import process...");

    // Read and parse file content
    const fileContent = await file.text();
    console.log("Parsing backup file...");
    const backupFile = JSON.parse(fileContent);

    // Validate backup file format
    if (
      !backupFile.type ||
      backupFile.type !== "kaspa-messages-backup" ||
      !backupFile.data
    ) {
      throw new Error("Invalid backup file format");
    }

    console.log("Getting private key for decryption...");
    const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
      unlockedWallet,
      password
    );
    const privateKey = privateKeyGenerator.receiveKey(0);

    // Get private key bytes
    const privateKeyBytes = WalletStorage.getPrivateKeyBytes(privateKey);
    if (!privateKeyBytes) {
      throw new Error("Failed to get private key bytes");
    }

    console.log("Creating EncryptedMessage from hex...");
    const encryptedMessage = new EncryptedMessage(backupFile.data);

    console.log("Decrypting backup data...");
    const decryptedStr = await decrypt_with_secret_key(
      encryptedMessage,
      privateKeyBytes
    );

    console.log("Parsing decrypted data...");
    const decryptedData = JSON.parse(decryptedStr);

    // Validate decrypted data structure
    if (!decryptedData.version || !decryptedData.type || !decryptedData.data) {
      throw new Error("Invalid backup data structure");
    }

    console.log("Merging with existing messages...");
    // Merge with existing messages
    const currentPassword = useWalletStore.getState().unlockedWallet?.password;
    if (!currentPassword) {
      throw new Error("Wallet password not available for importing messages.");
    }

    const existingMessages = loadLegacyMessages(currentPassword);

    const mergedMessages = {
      ...existingMessages,
      ...decryptedData.data,
    };

    // Save merged messages
    saveMessages(mergedMessages, currentPassword);

    // Get network type and current address first
    let networkType = NetworkType.Mainnet; // Default to mainnet
    const addresses = Object.keys(mergedMessages);
    if (addresses.length > 0) {
      networkType = getNetworkTypeFromAddress(addresses[0]);
    }
    console.log("Using network type:", networkType);

    // Get the current address from the private key using detected network type
    const receiveAddress = privateKey.toAddress(networkType);
    const currentAddress = receiveAddress.toString();
    console.log("Using receive address:", currentAddress);

    // Restore nicknames if they exist in the backup
    if (decryptedData.nicknames) {
      console.log("Restoring nicknames...");
      const nicknameStorageKey = `contact_nicknames_${currentAddress}`;
      const existingNicknames = JSON.parse(
        localStorage.getItem(nicknameStorageKey) || "{}"
      );

      // Merge existing nicknames with backup nicknames (backup takes precedence)
      const mergedNicknames = {
        ...existingNicknames,
        ...decryptedData.nicknames,
      };

      localStorage.setItem(nicknameStorageKey, JSON.stringify(mergedNicknames));
      console.log("Nicknames restored:", mergedNicknames);
    }

    // Restore conversations if they exist in the backup
    if (decryptedData.conversations) {
      console.log("Restoring conversations...");
      const { active = [], pending = [] } = decryptedData.conversations;

      // Type guard to validate conversation objects
      const isValidConversation = (
        conv: Conversation
      ): conv is Conversation => {
        return (
          typeof conv === "object" &&
          typeof conv.conversationId === "string" &&
          typeof conv.myAlias === "string" &&
          (conv.theirAlias === null || typeof conv.theirAlias === "string") &&
          typeof conv.kaspaAddress === "string" &&
          ["pending", "active", "rejected"].includes(conv.status) &&
          typeof conv.createdAt === "number" &&
          typeof conv.lastActivity === "number" &&
          typeof conv.initiatedByMe === "boolean"
        );
      };

      // Restore active conversations
      active.forEach((conv: ActiveConversation) => {
        if (isValidConversation(conv)) {
          conversationManager.restoreConversation(conv);
        } else {
          console.error("Invalid conversation object in backup:", conv);
        }
      });

      // Restore pending conversations
      pending.forEach((conv: PendingConversation) => {
        if (isValidConversation(conv)) {
          conversationManager.restoreConversation(conv);
        } else {
          console.error("Invalid conversation object in backup:", conv);
        }
      });
    }

    // Set flag to trigger API fetching after next account service start
    localStorage.setItem("kasia_fetch_api_on_start", "true");

    console.log("Import completed successfully");
  }
}
