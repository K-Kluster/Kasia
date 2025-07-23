import { DBSchema, IDBPDatabase, openDB } from "idb";
import { DbMessage, MessageRepository } from "./message.repository";
import {
  ConversationRepository,
  ConversationStatus,
  DbConversation,
} from "./conversation.repository";
import {
  DbDecryptionTrial,
  DecryptionTrialRepository,
} from "./decryption-trial.repository";
import { ContactRepository, DbContact } from "./contact.repository";
import { DbHandshake, HandshakeRepository } from "./handshake.repository";
import { DbPayment, PaymentRepository } from "./payment.repository";
import { KasiaConversationEvent } from "../../types/all";

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
      "by-created-at": number;
      "by-conversation-created-at": [string, number];
    };
  };
  payments: {
    key: string;
    value: DbPayment;
    indexes: {
      "by-tenant-id": string;
      "by-conversation-id": string;
      "by-created-at": number;
      "by-conversation-created-at": [string, number];
    };
  };
  handshakes: {
    key: string;
    value: DbHandshake;
    indexes: {
      "by-tenant-id": string;
      "by-conversation-id": string;
      "by-created-at": number;
      "by-conversation-created-at": [string, number];
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
          keyPath: "id",
        });
        messagesStore.createIndex("by-tenant-id", "tenantId");
        messagesStore.createIndex("by-conversation-id", "conversationId");
        messagesStore.createIndex("by-created-at", "createdAt");
        messagesStore.createIndex("by-conversation-created-at", [
          "conversationId",
          "createdAt",
        ]);

        // PAYMENTS
        const paymentsStore = db.createObjectStore("payments", {
          keyPath: "id",
        });
        paymentsStore.createIndex("by-tenant-id", "tenantId");
        paymentsStore.createIndex("by-conversation-id", "conversationId");
        paymentsStore.createIndex("by-created-at", "createdAt");
        paymentsStore.createIndex("by-conversation-created-at", [
          "conversationId",
          "createdAt",
        ]);

        // HANDSHAKES
        const handshakesStore = db.createObjectStore("handshakes", {
          keyPath: "id",
        });
        handshakesStore.createIndex("by-tenant-id", "tenantId");
        handshakesStore.createIndex("by-conversation-id", "conversationId");
        handshakesStore.createIndex("by-created-at", "createdAt");
        handshakesStore.createIndex("by-conversation-created-at", [
          "conversationId",
          "createdAt",
        ]);

        // CONVERSATIONS
        const conversationsStore = db.createObjectStore("conversations", {
          keyPath: "id",
        });
        conversationsStore.createIndex("by-tenant-id", "tenantId");
        conversationsStore.createIndex("by-status", "status");
        conversationsStore.createIndex("by-last-activity", "lastActivityAt");
        conversationsStore.createIndex("by-contact-id", "contactId");
        conversationsStore.createIndex("by-status-last-activity", [
          "status",
          "lastActivityAt",
        ]);

        // DECRYPTION TRIALS
        const decryptionTrialsStore = db.createObjectStore("decryptionTrials", {
          keyPath: "id",
        });
        decryptionTrialsStore.createIndex("by-tenant-id", "tenantId");
        decryptionTrialsStore.createIndex("by-timestamp", "timestamp");

        // CONTACTS
        const contactsStore = db.createObjectStore("contacts", {
          keyPath: "id",
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
  public readonly contactRepository: ContactRepository;
  public readonly decryptionTrialRepository: DecryptionTrialRepository;
  public readonly paymentRepository: PaymentRepository;
  public readonly messageRepository: MessageRepository;
  public readonly handshakeRepository: HandshakeRepository;

  constructor(
    readonly db: KasiaDB,
    readonly walletPassword: string,
    readonly tenantId: string
  ) {
    this.conversationRepository = new ConversationRepository(
      db,
      tenantId,
      walletPassword
    );

    this.contactRepository = new ContactRepository(
      db,
      tenantId,
      walletPassword
    );

    this.decryptionTrialRepository = new DecryptionTrialRepository(
      db,
      tenantId,
      walletPassword
    );

    this.paymentRepository = new PaymentRepository(
      db,
      tenantId,
      walletPassword
    );

    this.messageRepository = new MessageRepository(
      db,
      tenantId,
      walletPassword
    );

    this.handshakeRepository = new HandshakeRepository(
      db,
      tenantId,
      walletPassword
    );
  }

  getKasiaEventsByConversationId(
    conversationId: string
  ): Promise<KasiaConversationEvent[]> {
    return Promise.all([
      this.messageRepository.getMessagesByConversationId(conversationId),
      this.paymentRepository.getPaymentsByConversationId(conversationId),
      this.handshakeRepository.getHanshakesByConversationId(conversationId),
    ]).then(([messages, payments, handshakes]) => {
      return [...messages, ...payments, ...handshakes].sort((a, b) => {
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    });
  }
}
