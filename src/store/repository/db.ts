import { DBSchema, IDBPDatabase, openDB } from "idb";
import { DbMessage } from "./message.repository";
import {
  ConversationRepository,
  ConversationStatus,
  DbConversation,
} from "./conversation.repository";
import { DbDecryptionTrial } from "./decryption-trial.repository";
import { DbContact } from "./contact.repository";
import { DbHandshake } from "./handshake.repository";
import { DbPayment } from "./payment.repository";

const CURRENT_DB_VERSION = 1;

export class DBNotFoundException extends Error {
  constructor() {
    super("DB not found");
    this.name = "DBNotFoundException";
    this.stack = new Error().stack;
  }
}

export interface KasiaDBSchema extends DBSchema {
  messages: {
    key: string;
    value: DbMessage;
    indexes: {
      "by-tenant-id": string;
      "by-conversation-id": string;
      "by-timestamp": number;
      "by-conversation-timestamp": [string, number];
    };
  };
  payments: {
    key: string;
    value: DbPayment;
    indexes: {
      "by-tenant-id": string;
      "by-conversation-id": string;
      "by-timestamp": number;
      "by-conversation-timestamp": [string, number];
    };
  };
  handshakes: {
    key: string;
    value: DbHandshake;
    indexes: {
      "by-tenant-id": string;
      "by-conversation-id": string;
      "by-timestamp": number;
      "by-conversation-timestamp": [string, number];
    };
  };
  conversations: {
    key: string;
    value: DbConversation;
    indexes: {
      "by-tenant-id": string;
      "by-status": ConversationStatus;
      "by-last-activity": number;
      "by-status-last-activity": [ConversationStatus, number];
      "by-contact-id": string;
    };
  };
  decryptionTrials: {
    key: string;
    value: DbDecryptionTrial;
    indexes: {
      "by-tenant-id": string;
      "by-timestamp": number;
    };
  };
  contacts: {
    key: string;
    value: DbContact;
    indexes: {
      "by-tenant-id": string;
      "by-contact-id": string;
    };
  };
}

export type KasiaDB = IDBPDatabase<KasiaDBSchema>;

export const openDatabase = async (): Promise<KasiaDB> => {
  return openDB<KasiaDBSchema>("kasia-db", CURRENT_DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      console.log(
        `[DB] - Identity database upgrade from version ${oldVersion} to ${newVersion}`
      );

      // first time creation
      if (oldVersion < 1) {
        console.log("[DB] - Creating new database");

        // MESSAGES
        const messagesStore = db.createObjectStore("messages", {
          keyPath: "key",
        });
        messagesStore.createIndex("by-tenant-id", "tenantId");
        messagesStore.createIndex("by-conversation-id", "conversationId");
        messagesStore.createIndex("by-timestamp", "timestamp");
        messagesStore.createIndex("by-conversation-timestamp", [
          "conversationId",
          "timestamp",
        ]);

        // PAYMENTS
        const paymentsStore = db.createObjectStore("payments", {
          keyPath: "key",
        });
        paymentsStore.createIndex("by-tenant-id", "tenantId");
        paymentsStore.createIndex("by-conversation-id", "conversationId");
        paymentsStore.createIndex("by-timestamp", "timestamp");
        paymentsStore.createIndex("by-conversation-timestamp", [
          "conversationId",
          "timestamp",
        ]);

        // HANDSHAKES
        const handshakesStore = db.createObjectStore("handshakes", {
          keyPath: "key",
        });
        handshakesStore.createIndex("by-tenant-id", "tenantId");
        handshakesStore.createIndex("by-conversation-id", "conversationId");
        handshakesStore.createIndex("by-timestamp", "timestamp");
        handshakesStore.createIndex("by-conversation-timestamp", [
          "conversationId",
          "timestamp",
        ]);

        // CONVERSATIONS
        const conversationsStore = db.createObjectStore("conversations", {
          keyPath: "id",
        });
        conversationsStore.createIndex("by-tenant-id", "tenantId");
        conversationsStore.createIndex("by-status", "status");
        conversationsStore.createIndex("by-last-activity", "lastActivity");
        conversationsStore.createIndex("by-contact-id", "contactId");
        conversationsStore.createIndex("by-status-last-activity", [
          "status",
          "lastActivity",
        ]);

        // DECRYPTION TRIALS
        const decryptionTrialsStore = db.createObjectStore("decryptionTrials", {
          keyPath: "key",
        });
        decryptionTrialsStore.createIndex("by-tenant-id", "tenantId");
        decryptionTrialsStore.createIndex("by-timestamp", "timestamp");

        // CONTACTS
        const contactsStore = db.createObjectStore("contacts", {
          keyPath: "key",
        });
        contactsStore.createIndex("by-tenant-id", "tenantId");
        contactsStore.createIndex("by-contact-id", "contactId");

        console.log("Database schema created successfully with all indexes");
      }
    },
  });
};

export class Repositories {
  public readonly conversationRepository: ConversationRepository;

  constructor(
    readonly tenantId: string,
    readonly db: KasiaDB
  ) {
    this.conversationRepository = new ConversationRepository(db, tenantId);
  }
}
