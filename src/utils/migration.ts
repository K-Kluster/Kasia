import { databaseService } from "./database";
import { Message } from "../types/all";
import { Conversation } from "../types/messaging.types";

export interface MigrationResult {
  success: boolean;
  migratedItems: {
    messages: number;
    conversations: number;
    decryptionCache: number;
    nicknames: number;
  };
  errors: string[];
  warnings: string[];
}

class MigrationService {
  private migrationFlagKey = "kasia_indexeddb_migration_complete";

  /**
   * Check if migration has already been completed
   */
  isMigrationComplete(): boolean {
    return localStorage.getItem(this.migrationFlagKey) === "true";
  }

  /**
   * Set migration as complete
   */
  setMigrationComplete(): void {
    localStorage.setItem(this.migrationFlagKey, "true");
  }

  /**
   * Reset migration flag (for debugging/testing)
   */
  resetMigrationFlag(): void {
    localStorage.removeItem(this.migrationFlagKey);
  }

  /**
   * Migrate data from localStorage to IndexedDB
   */
  async migrateFromLocalStorage(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedItems: {
        messages: 0,
        conversations: 0,
        decryptionCache: 0,
        nicknames: 0,
      },
      errors: [],
      warnings: [],
    };

    try {
      // Check if migration is already complete
      if (this.isMigrationComplete()) {
        result.success = true;
        result.warnings.push("Migration already completed");
        return result;
      }

      console.log("Starting migration from localStorage to IndexedDB...");

      // Get current wallet address
      const currentWallet = this.getCurrentWalletAddress();
      if (!currentWallet) {
        result.errors.push("No wallet address found for migration");
        return result;
      }

      // Migrate messages
      try {
        const messages = this.getLocalStorageMessages(currentWallet);
        for (const message of messages) {
          await databaseService.saveMessage(message as Message, currentWallet);
        }
        result.migratedItems.messages = messages.length;
        console.log(`Migrated ${messages.length} messages`);
      } catch (error) {
        result.errors.push(`Failed to migrate messages: ${error}`);
      }

      // Migrate conversations
      try {
        const conversations = this.getLocalStorageConversations(currentWallet);
        for (const conversation of conversations) {
          await databaseService.saveConversation(
            conversation as Conversation,
            currentWallet
          );
        }
        result.migratedItems.conversations = conversations.length;
        console.log(`Migrated ${conversations.length} conversations`);
      } catch (error) {
        result.errors.push(`Failed to migrate conversations: ${error}`);
      }

      // Migrate decryption cache
      try {
        const cacheEntries = this.getLocalStorageDecryptionCache(currentWallet);
        for (const [txId, timestamp] of Object.entries(cacheEntries)) {
          await databaseService.setDecryptionCache(currentWallet, txId, 300000);
        }
        result.migratedItems.decryptionCache = Object.keys(cacheEntries).length;
        console.log(
          `Migrated ${Object.keys(cacheEntries).length} cache entries`
        );
      } catch (error) {
        result.errors.push(`Failed to migrate decryption cache: ${error}`);
      }

      // Migrate nicknames
      try {
        const nicknames = this.getLocalStorageNicknames(currentWallet);
        for (const [address, nickname] of Object.entries(nicknames)) {
          await databaseService.setNickname(currentWallet, address, nickname);
        }
        result.migratedItems.nicknames = Object.keys(nicknames).length;
        console.log(`Migrated ${Object.keys(nicknames).length} nicknames`);
      } catch (error) {
        result.errors.push(`Failed to migrate nicknames: ${error}`);
      }

      // Mark migration as complete
      this.setMigrationComplete();
      result.success = true;

      console.log("Migration completed successfully");
    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
    }

    return result;
  }

  /**
   * Get current wallet address from localStorage
   */
  private getCurrentWalletAddress(): string | null {
    try {
      const walletData = localStorage.getItem("kasia_wallet");
      if (walletData) {
        const wallet = JSON.parse(walletData);
        return wallet.address || null;
      }
    } catch (error) {
      console.warn("Failed to get wallet address:", error);
    }
    return null;
  }

  /**
   * Get messages from localStorage
   */
  private getLocalStorageMessages(walletAddress: string): unknown[] {
    try {
      const messagesKey = `kasia_messages_${walletAddress}`;
      const messagesData = localStorage.getItem(messagesKey);
      if (messagesData) {
        return JSON.parse(messagesData);
      }
    } catch (error) {
      console.warn("Failed to get messages from localStorage:", error);
    }
    return [];
  }

  /**
   * Get conversations from localStorage
   */
  private getLocalStorageConversations(walletAddress: string): unknown[] {
    try {
      const conversationsKey = `kasia_conversations_${walletAddress}`;
      const conversationsData = localStorage.getItem(conversationsKey);
      if (conversationsData) {
        return JSON.parse(conversationsData);
      }
    } catch (error) {
      console.warn("Failed to get conversations from localStorage:", error);
    }
    return [];
  }

  /**
   * Get decryption cache from localStorage
   */
  private getLocalStorageDecryptionCache(
    walletAddress: string
  ): Record<string, number> {
    try {
      const cacheKey = `kasia_decryption_cache_${walletAddress}`;
      const cacheData = localStorage.getItem(cacheKey);
      if (cacheData) {
        return JSON.parse(cacheData);
      }
    } catch (error) {
      console.warn("Failed to get decryption cache from localStorage:", error);
    }
    return {};
  }

  /**
   * Get nicknames from localStorage
   */
  private getLocalStorageNicknames(
    walletAddress: string
  ): Record<string, string> {
    try {
      const nicknamesKey = `kasia_nicknames_${walletAddress}`;
      const nicknamesData = localStorage.getItem(nicknamesKey);
      if (nicknamesData) {
        return JSON.parse(nicknamesData);
      }
    } catch (error) {
      console.warn("Failed to get nicknames from localStorage:", error);
    }
    return {};
  }
}

export const migrationService = new MigrationService();
