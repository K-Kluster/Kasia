import { openDB, DBSchema, IDBPDatabase } from "idb";
import { Message, Contact } from "../types/all";
import { Conversation } from "../types/messaging.types";

// Define the database schema with proper TypeScript types
interface KasiaDB extends DBSchema {
  messages: {
    key: string; // `${walletAddress}_${timestamp}_${transactionId}`
    value: {
      key: string;
      walletAddress: string;
      conversationId?: string;
      timestamp: number;
      // Message fields
      transactionId: string;
      senderAddress: string;
      recipientAddress: string;
      content: string;
      amount: number;
      fee?: number;
      payload: string;
      fileData?: {
        type: string;
        name: string;
        size: number;
        mimeType: string;
        content: string;
      };
    };
    indexes: {
      "by-wallet": string; // wallet address
      "by-conversation": string; // conversation ID
      "by-timestamp": number; // timestamp
      "by-conversation-timestamp": [string, number]; // conversation ID and timestamp
    };
  };
  conversations: {
    key: string; // conversation ID
    value: {
      conversationId: string;
      walletAddress: string;
      status: string;
      lastActivity: number;
      // Conversation fields
      myAlias: string;
      theirAlias: string | null;
      kaspaAddress: string;
      createdAt: number;
      initiatedByMe: boolean;
    };
    indexes: {
      "by-wallet": string; // wallet address
      "by-status": string; // status
      "by-timestamp": number; // lastActivity
    };
  };
  decryptionCache: {
    key: string; // `${walletAddress}_${txId}`
    value: {
      key: string;
      txId: string;
      walletAddress: string;
      timestamp: number;
      ttl: number;
    };
    indexes: {
      "by-wallet": string; // wallet address
      "by-timestamp": number; // timestamp
    };
  };
  nicknames: {
    key: string; // `${walletAddress}_${contactAddress}`
    value: {
      key: string;
      walletAddress: string;
      contactAddress: string;
      nickname: string;
      timestamp: number;
    };
    indexes: {
      "by-wallet": string; // wallet address
    };
  };
}

// Database instance
let dbPromise: Promise<IDBPDatabase<KasiaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<KasiaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KasiaDB>("kasia-db", 2, {
      upgrade(db, oldVersion, newVersion) {
        console.log(
          `Upgrading database from version ${oldVersion} to ${newVersion}`
        );

        // If upgrading from version 1 or creating new database
        if (oldVersion < 2) {
          // Delete existing stores if they exist (to ensure clean recreation)
          if (db.objectStoreNames.contains("messages")) {
            db.deleteObjectStore("messages");
          }
          if (db.objectStoreNames.contains("conversations")) {
            db.deleteObjectStore("conversations");
          }
          if (db.objectStoreNames.contains("decryptionCache")) {
            db.deleteObjectStore("decryptionCache");
          }
          if (db.objectStoreNames.contains("nicknames")) {
            db.deleteObjectStore("nicknames");
          }
        }

        // Create object stores with indexes
        const messagesStore = db.createObjectStore("messages", {
          keyPath: "key",
        });
        messagesStore.createIndex("by-wallet", "walletAddress");
        messagesStore.createIndex("by-conversation", "conversationId");
        messagesStore.createIndex("by-timestamp", "timestamp");
        messagesStore.createIndex("by-conversation-timestamp", [
          "conversationId",
          "timestamp",
        ]);

        const conversationsStore = db.createObjectStore("conversations", {
          keyPath: "conversationId",
        });
        conversationsStore.createIndex("by-wallet", "walletAddress");
        conversationsStore.createIndex("by-status", "status");
        conversationsStore.createIndex("by-timestamp", "lastActivity");

        const decryptionCacheStore = db.createObjectStore("decryptionCache", {
          keyPath: "key",
        });
        decryptionCacheStore.createIndex("by-wallet", "walletAddress");
        decryptionCacheStore.createIndex("by-timestamp", "timestamp");

        const nicknamesStore = db.createObjectStore("nicknames", {
          keyPath: "key",
        });
        nicknamesStore.createIndex("by-wallet", "walletAddress");

        console.log("Database schema created successfully with all indexes");
      },
    });
  }
  return dbPromise;
}

/**
 * Force database recreation by clearing the cache and deleting the database
 */
export async function forceDatabaseRecreation(): Promise<void> {
  // Clear the cached database instance
  dbPromise = null;

  // Delete the existing database
  const dbName = "kasia-db";
  const deleteRequest = indexedDB.deleteDatabase(dbName);

  return new Promise((resolve, reject) => {
    deleteRequest.onsuccess = () => {
      console.log(
        "Database deleted successfully, will be recreated on next access"
      );
      resolve();
    };
    deleteRequest.onerror = () => {
      console.error("Failed to delete database");
      reject(new Error("Failed to delete database"));
    };
  });
}

/**
 * Handle database errors by recreating the database if needed
 */
async function handleDatabaseError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("index was not found")
    ) {
      console.warn("Database index error detected, recreating database...");

      // Force database recreation
      await forceDatabaseRecreation();

      // Clear the cached database instance to force recreation
      dbPromise = null;

      // Reset migration flag to allow re-migration
      const { migrationService } = await import("./migration");
      migrationService.resetMigrationFlag();

      // Wait a moment for the database to be fully deleted
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Retry the operation with a fresh database instance
      return await operation();
    }
    throw error;
  }
}

// Type-safe database operations
export class DatabaseService {
  private db: Promise<IDBPDatabase<KasiaDB>>;

  constructor() {
    this.db = getDB();
  }

  // Message operations
  async getMessagesByWallet(walletAddress: string): Promise<Message[]> {
    return handleDatabaseError(async () => {
      const db = await this.db;
      const tx = db.transaction("messages", "readonly");
      const index = tx.store.index("by-wallet");
      const messagesWithIndexes = await index.getAll(walletAddress);

      // Convert to Message objects by removing index fields
      return messagesWithIndexes.map(
        ({ key, walletAddress: _, conversationId: __, ...message }) =>
          message as Message
      );
    });
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    const db = await this.db;
    const tx = db.transaction("messages", "readonly");
    const index = tx.store.index("by-conversation");
    const messagesWithIndexes = await index.getAll(conversationId);

    return messagesWithIndexes.map(
      ({ key, walletAddress: _, conversationId: __, ...message }) =>
        message as Message
    );
  }

  async saveMessage(
    message: Message,
    walletAddress: string,
    conversationId?: string
  ): Promise<void> {
    return handleDatabaseError(async () => {
      const db = await this.db;
      const key = `${walletAddress}_${message.timestamp}_${message.transactionId}`;
      const messageWithIndexes = {
        key,
        walletAddress,
        conversationId,
        ...message,
      };
      await db.put("messages", messageWithIndexes);
    });
  }

  async deleteMessagesByWallet(walletAddress: string): Promise<void> {
    const db = await this.db;
    const tx = db.transaction("messages", "readwrite");
    const index = tx.store.index("by-wallet");
    const keys = await index.getAllKeys(walletAddress);
    await Promise.all(keys.map((key) => tx.store.delete(key)));
    await tx.done;
  }

  async getMessageByTransactionId(
    walletAddress: string,
    transactionId: string
  ): Promise<Message | null> {
    const db = await this.db;
    const tx = db.transaction("messages", "readonly");
    const index = tx.store.index("by-wallet");
    const messages = await index.getAll(walletAddress);
    const message = messages.find((m) => m.transactionId === transactionId);
    if (!message) return null;

    // Remove the index fields and return clean Message object
    const {
      key,
      walletAddress: _,
      conversationId: __,
      ...cleanMessage
    } = message;
    return cleanMessage as Message;
  }

  // Conversation operations
  async getConversationsByWallet(
    walletAddress: string
  ): Promise<Conversation[]> {
    return handleDatabaseError(async () => {
      const db = await this.db;
      const tx = db.transaction("conversations", "readonly");
      const index = tx.store.index("by-wallet");
      const conversationsWithIndexes = await index.getAll(walletAddress);

      return conversationsWithIndexes.map(
        ({ walletAddress: _, ...conversation }) => conversation as Conversation
      );
    });
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const db = await this.db;
    const conversationWithIndexes = await db.get("conversations", id);
    if (!conversationWithIndexes) return undefined;

    const { walletAddress: _, ...conversation } = conversationWithIndexes;
    return conversation as Conversation;
  }

  async saveConversation(
    conversation: Conversation,
    walletAddress: string
  ): Promise<void> {
    const db = await this.db;
    const conversationWithIndexes = {
      conversationId: conversation.conversationId,
      walletAddress,
      status: conversation.status,
      lastActivity: conversation.lastActivity,
      myAlias: conversation.myAlias,
      theirAlias: conversation.theirAlias,
      kaspaAddress: conversation.kaspaAddress,
      createdAt: conversation.createdAt,
      initiatedByMe: conversation.initiatedByMe,
    };
    await db.put("conversations", conversationWithIndexes);
  }

  async deleteConversation(id: string): Promise<void> {
    const db = await this.db;
    await db.delete("conversations", id);
  }

  async getConversationsByStatus(
    walletAddress: string,
    status: string
  ): Promise<Conversation[]> {
    const db = await this.db;
    const tx = db.transaction("conversations", "readonly");
    const index = tx.store.index("by-status");
    const conversationsWithIndexes = await index.getAll(status);

    // Filter by wallet address and remove index fields
    return conversationsWithIndexes
      .filter((conv) => conv.walletAddress === walletAddress)
      .map(
        ({ walletAddress: _, ...conversation }) => conversation as Conversation
      );
  }

  // Decryption cache operations
  async getDecryptionCache(
    walletAddress: string,
    txId: string
  ): Promise<boolean> {
    const db = await this.db;
    const key = `${walletAddress}_${txId}`;
    const cached = await db.get("decryptionCache", key);

    if (!cached) return false;

    // Check if cache is expired
    if (Date.now() > cached.timestamp + cached.ttl) {
      await db.delete("decryptionCache", key);
      return false;
    }

    return true;
  }

  async setDecryptionCache(
    walletAddress: string,
    txId: string,
    ttl: number = 300000
  ): Promise<void> {
    const db = await this.db;
    const key = `${walletAddress}_${txId}`;
    await db.put("decryptionCache", {
      key,
      txId,
      walletAddress,
      timestamp: Date.now(),
      ttl,
    });
  }

  async removeDecryptionCache(
    walletAddress: string,
    txId: string
  ): Promise<void> {
    const db = await this.db;
    const key = `${walletAddress}_${txId}`;
    await db.delete("decryptionCache", key);
  }

  async clearDecryptionCache(walletAddress: string): Promise<void> {
    const db = await this.db;
    const tx = db.transaction("decryptionCache", "readwrite");
    const index = tx.store.index("by-wallet");
    const keys = await index.getAllKeys(walletAddress);
    await Promise.all(keys.map((key) => tx.store.delete(key)));
    await tx.done;
  }

  async getDecryptionCacheStats(
    walletAddress: string
  ): Promise<{ size: number }> {
    return handleDatabaseError(async () => {
      const db = await this.db;
      const tx = db.transaction("decryptionCache", "readonly");
      const index = tx.store.index("by-wallet");
      const keys = await index.getAllKeys(walletAddress);
      return { size: keys.length };
    });
  }

  // Nickname operations
  async getNickname(
    walletAddress: string,
    contactAddress: string
  ): Promise<string | null> {
    const db = await this.db;
    const key = `${walletAddress}_${contactAddress}`;
    const nickname = await db.get("nicknames", key);
    return nickname?.nickname || null;
  }

  async setNickname(
    walletAddress: string,
    contactAddress: string,
    nickname: string
  ): Promise<void> {
    const db = await this.db;
    const key = `${walletAddress}_${contactAddress}`;
    await db.put("nicknames", {
      key,
      walletAddress,
      contactAddress,
      nickname,
      timestamp: Date.now(),
    });
  }

  async removeNickname(
    walletAddress: string,
    contactAddress: string
  ): Promise<void> {
    const db = await this.db;
    const key = `${walletAddress}_${contactAddress}`;
    await db.delete("nicknames", key);
  }

  async getAllNicknames(
    walletAddress: string
  ): Promise<Record<string, string>> {
    const db = await this.db;
    const tx = db.transaction("nicknames", "readonly");
    const index = tx.store.index("by-wallet");
    const nicknames = await index.getAll(walletAddress);

    const result: Record<string, string> = {};
    nicknames.forEach((nickname) => {
      result[nickname.contactAddress] = nickname.nickname;
    });

    return result;
  }

  async clearNicknames(walletAddress: string): Promise<void> {
    const db = await this.db;
    const tx = db.transaction("nicknames", "readwrite");
    const index = tx.store.index("by-wallet");
    const keys = await index.getAllKeys(walletAddress);
    await Promise.all(keys.map((key) => tx.store.delete(key)));
    await tx.done;
  }

  // Utility operations
  async clearWalletData(walletAddress: string): Promise<void> {
    await Promise.all([
      this.deleteMessagesByWallet(walletAddress),
      this.clearDecryptionCache(walletAddress),
      this.clearNicknames(walletAddress),
    ]);

    // Clear conversations for this wallet
    const db = await this.db;
    const tx = db.transaction("conversations", "readwrite");
    const index = tx.store.index("by-wallet");
    const keys = await index.getAllKeys(walletAddress);
    await Promise.all(keys.map((key) => tx.store.delete(key)));
    await tx.done;
  }

  async getDatabaseStats(): Promise<{
    messages: number;
    conversations: number;
    decryptionCache: number;
    nicknames: number;
  }> {
    return handleDatabaseError(async () => {
      const db = await this.db;
      const [messages, conversations, decryptionCache, nicknames] =
        await Promise.all([
          db.count("messages"),
          db.count("conversations"),
          db.count("decryptionCache"),
          db.count("nicknames"),
        ]);

      return {
        messages,
        conversations,
        decryptionCache,
        nicknames,
      };
    });
  }

  // Fetch messages for a conversation using the compound index, with optional pagination
  async getMessagesByConversationPaginated(
    conversationId: string,
    options?: { limit?: number; before?: number; after?: number }
  ): Promise<Message[]> {
    const db = await this.db;
    const index = db
      .transaction("messages", "readonly")
      .store.index("by-conversation-timestamp");
    const lowerBound = [conversationId, options?.after ?? 0];
    const upperBound = [conversationId, options?.before ?? Date.now()];
    const range = IDBKeyRange.bound(lowerBound, upperBound);
    const messages: Message[] = [];
    let cursor = await index.openCursor(range, "next");
    while (cursor && (!options?.limit || messages.length < options.limit)) {
      const {
        key,
        walletAddress: _,
        conversationId: __,
        ...message
      } = cursor.value;
      messages.push(message as Message);
      cursor = await cursor.continue();
    }
    return messages;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();

// Global function for manual database recreation (for debugging)
declare global {
  interface Window {
    forceKasiaDatabaseRecreation: () => Promise<void>;
  }
}

window.forceKasiaDatabaseRecreation = async () => {
  console.log("Manually forcing database recreation...");
  await forceDatabaseRecreation();
  dbPromise = null;

  // Reset migration flag
  const { migrationService } = await import("./migration");
  migrationService.resetMigrationFlag();

  console.log("Database recreation completed. Please refresh the page.");
};
