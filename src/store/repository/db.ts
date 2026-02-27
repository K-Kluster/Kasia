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
import {
  DbSavedHandshake,
  SavedHandhshakeRepository,
} from "./saved-handshake.repository";
import {
  DbBroadcastChannel,
  BroadcastChannelRepository,
} from "./broadcast-channel.repository";
import { MetaRespository } from "./meta.repository";
import {
  DbBlockedAddress,
  BlockedAddressRepository,
} from "./blocked-address.repository";

const CURRENT_DB_VERSION = 5;

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
      "by-id": string;
      "by-tenant-id": string;
      "by-tenant-id-conversation-id": [string, string];
      "by-tenant-id-created-at": [string, Date];
      "by-tenant-id-conversation-id-created-at": [string, string, Date];
    };
  };
  payments: {
    key: string;
    value: DbPayment;
    indexes: {
      "by-id": string;
      "by-tenant-id": string;
      "by-tenant-id-conversation-id": [string, string];
      "by-tenant-id-created-at": [string, Date];
      "by-tenant-id-conversation-id-created-at": [string, string, Date];
    };
  };
  handshakes: {
    key: string;
    value: DbHandshake;
    indexes: {
      "by-id": string;
      "by-tenant-id": string;
      "by-tenant-id-conversation-id": [string, string];
      "by-tenant-id-created-at": [string, Date];
      "by-tenant-id-conversation-id-created-at": [string, string, Date];
    };
  };
  conversations: {
    key: string;
    value: DbConversation;
    indexes: {
      "by-tenant-id": string;
      "by-tenant-id-status": [string, ConversationStatus];
      "by-tenant-id-last-activity": [string, Date];
      "by-tenant-id-status-last-activity": [string, ConversationStatus, Date];
      "by-contact-id": string;
    };
  };
  decryptionTrials: {
    key: string;
    value: DbDecryptionTrial;
    indexes: {
      "by-id": string;
      "by-tenant-id": string;
      "by-tenant-id-timestamp": [string, Date];
    };
  };
  contacts: {
    key: string;
    value: DbContact;
    indexes: {
      "by-tenant-id": string;
      "by-tenant-id-timestamp": [string, Date];
    };
  };
  savedHandshakes: {
    key: string;
    value: DbSavedHandshake;
    indexes: {
      "by-id": string;
      "by-tenant-id": string;
      "by-tenant-id-created-at": [string, Date];
    };
  };
  broadcastChannels: {
    key: string;
    value: DbBroadcastChannel;
    indexes: {
      "by-tenant-id": string;
    };
  };
  blockedAddresses: {
    key: string;
    value: DbBlockedAddress;
    indexes: {
      "by-tenant-id": string;
      "by-tenant-id-timestamp": [string, Date];
    };
  };
}

export type KasiaDB = IDBPDatabase<KasiaDBSchema>;

export const openDatabase = async (): Promise<KasiaDB> => {
  return openDB<KasiaDBSchema>("kasia-db", CURRENT_DB_VERSION, {
    async upgrade(db, oldVersion, newVersion, transaction) {
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
        messagesStore.createIndex("by-id", "id", { unique: true });
        messagesStore.createIndex("by-tenant-id", "tenantId");
        messagesStore.createIndex("by-tenant-id-created-at", [
          "tenantId",
          "createdAt",
        ]);
        messagesStore.createIndex("by-tenant-id-conversation-id-created-at", [
          "tenantId",
          "conversationId",
          "createdAt",
        ]);
        messagesStore.createIndex("by-tenant-id-conversation-id", [
          "tenantId",
          "conversationId",
        ]);

        // PAYMENTS
        const paymentsStore = db.createObjectStore("payments", {
          keyPath: "id",
        });
        paymentsStore.createIndex("by-id", "id", { unique: true });
        paymentsStore.createIndex("by-tenant-id", "tenantId");
        paymentsStore.createIndex("by-tenant-id-conversation-id-created-at", [
          "tenantId",
          "conversationId",
          "createdAt",
        ]);
        paymentsStore.createIndex("by-tenant-id-created-at", [
          "tenantId",
          "createdAt",
        ]);
        paymentsStore.createIndex("by-tenant-id-conversation-id", [
          "tenantId",
          "conversationId",
        ]);

        // HANDSHAKES
        const handshakesStore = db.createObjectStore("handshakes", {
          keyPath: "id",
        });
        handshakesStore.createIndex("by-id", "id", { unique: true });
        handshakesStore.createIndex("by-tenant-id", "tenantId");
        handshakesStore.createIndex("by-tenant-id-conversation-id-created-at", [
          "tenantId",
          "conversationId",
          "createdAt",
        ]);
        handshakesStore.createIndex("by-tenant-id-created-at", [
          "tenantId",
          "createdAt",
        ]);
        handshakesStore.createIndex("by-tenant-id-conversation-id", [
          "tenantId",
          "conversationId",
        ]);

        // CONVERSATIONS
        const conversationsStore = db.createObjectStore("conversations", {
          keyPath: "id",
        });
        conversationsStore.createIndex("by-tenant-id", "tenantId");
        conversationsStore.createIndex("by-tenant-id-status", [
          "tenantId",
          "status",
        ]);
        conversationsStore.createIndex("by-tenant-id-last-activity", [
          "tenantId",
          "lastActivityAt",
        ]);
        conversationsStore.createIndex("by-contact-id", "contactId");
        conversationsStore.createIndex("by-tenant-id-status-last-activity", [
          "tenantId",
          "status",
          "lastActivityAt",
        ]);

        // DECRYPTION TRIALS
        const decryptionTrialsStore = db.createObjectStore("decryptionTrials", {
          keyPath: "id",
        });
        decryptionTrialsStore.createIndex("by-id", "id", { unique: true });
        decryptionTrialsStore.createIndex("by-tenant-id", "tenantId");
        decryptionTrialsStore.createIndex("by-tenant-id-timestamp", [
          "tenantId",
          "timestamp",
        ]);

        // CONTACTS
        const contactsStore = db.createObjectStore("contacts", {
          keyPath: "id",
        });
        contactsStore.createIndex("by-tenant-id", "tenantId");
        contactsStore.createIndex("by-tenant-id-timestamp", [
          "tenantId",
          "timestamp",
        ]);

        // SAVED HANDSHAKES
        const savedHandshakesStore = db.createObjectStore("savedHandshakes", {
          keyPath: "id",
        });
        savedHandshakesStore.createIndex("by-id", "id", { unique: true });
        savedHandshakesStore.createIndex("by-tenant-id-created-at", [
          "tenantId",
          "createdAt",
        ]);

        console.log("Database schema initiated to v1");
      }

      if (oldVersion <= 1) {
        const savedHandshakesStore = transaction.objectStore("savedHandshakes");
        if (!savedHandshakesStore.indexNames.contains("by-tenant-id")) {
          savedHandshakesStore.createIndex("by-tenant-id", "tenantId");
        }
      }

      if (oldVersion <= 2) {
        const broadcastChannelsStore = db.createObjectStore(
          "broadcastChannels",
          {
            keyPath: "id",
          }
        );
        broadcastChannelsStore.createIndex("by-tenant-id", "tenantId");

        console.log("Database schema initiated to v1");
      }

      if (oldVersion <= 3) {
        // blocked addresses
        const blockedAddressesStore = db.createObjectStore("blockedAddresses", {
          keyPath: "id",
        });
        blockedAddressesStore.createIndex("by-tenant-id", "tenantId");
        blockedAddressesStore.createIndex("by-tenant-id-timestamp", [
          "tenantId",
          "timestamp",
        ]);

        console.log("Database schema upgraded to v4 - blocked addresses");
      }

      if (oldVersion <= 4) {
        // Migration to v4: Add status field to existing messages and payments
        const messagesStore = transaction.objectStore("messages");
        let cursor = await messagesStore.openCursor();

        while (cursor) {
          const message = cursor.value;
          // add default status to existing messages that don't have it
          if (!message.status) {
            message.status = "confirmed";
            await cursor.update(message);
          }
          cursor = await cursor.continue();
        }

        const paymentsStore = transaction.objectStore("payments");
        let paymentCursor = await paymentsStore.openCursor();

        while (paymentCursor) {
          const payment = paymentCursor.value;
          // add default status to existing payments that don't have it
          if (!payment.status) {
            payment.status = "confirmed";
            await paymentCursor.update(payment);
          }
          paymentCursor = await paymentCursor.continue();
        }

        console.log(
          "[DB] - Migrated to v4: Added status field to messages and payments"
        );
      }
      if (oldVersion <= 5) {
        // HERE next migration, first increase CURRENT_DB_VERSION then implement with oldVersion <= CURRENT_DB_VERSION - 1
        // add more if branching for each next version
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
  public readonly savedHandshakeRepository: SavedHandhshakeRepository;
  public readonly broadcastChannelRepository: BroadcastChannelRepository;
  public readonly blockedAddressRepository: BlockedAddressRepository;
  public readonly metadataRepository: MetaRespository;

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

    // no wallet password there is no encryption/decryption
    this.savedHandshakeRepository = new SavedHandhshakeRepository(db, tenantId);
    this.broadcastChannelRepository = new BroadcastChannelRepository(
      db,
      tenantId,
      walletPassword
    );

    this.blockedAddressRepository = new BlockedAddressRepository(
      db,
      tenantId,
      walletPassword
    );

    this.metadataRepository = new MetaRespository(tenantId);
  }

  async getKasiaEventsByConversationId(
    conversationId: string
  ): Promise<KasiaConversationEvent[]> {
    const [messages, payments, handshakes] = await Promise.all([
      this.messageRepository.getMessagesByConversationId(conversationId),
      this.paymentRepository.getPaymentsByConversationId(conversationId),
      this.handshakeRepository.getHanshakesByConversationId(conversationId),
    ]);
    return [...messages, ...payments, ...handshakes].sort((a, b) => {
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  async doesKasiaEventExistsById(id: string): Promise<boolean> {
    const [message, payment, handshake] = await Promise.all([
      this.messageRepository
        .doesExistsById(`${this.tenantId}_${id}`)
        .catch(() => false),
      this.paymentRepository
        .doesExistsById(`${this.tenantId}_${id}`)
        .catch(() => false),
      this.handshakeRepository
        .doesExistsById(`${this.tenantId}_${id}`)
        .catch(() => false),
      this.savedHandshakeRepository
        .doesExistsById(`${this.tenantId}_${id}`)
        .catch(() => false),
    ]);
    return !!message || !!payment || !!handshake;
  }

  /**
   * delete all messages, payments, handshakes and optionally conversation and contact for a given contact
   */
  async deleteAllDataForContact(
    contactId: string,
    options?: { deleteConversation?: boolean; deleteContact?: boolean }
  ): Promise<void> {
    try {
      // get the conversation for this contact
      const conversation = await this.conversationRepository
        .getConversationByContactId(contactId)
        .catch(() => null);

      if (conversation) {
        // delete all messages, payments, and handshakes for this conversation
        const [messages, payments, handshakes] = await Promise.all([
          this.messageRepository.getMessagesByConversationId(conversation.id),
          this.paymentRepository.getPaymentsByConversationId(conversation.id),
          this.handshakeRepository.getHanshakesByConversationId(
            conversation.id
          ),
        ]);

        // delete all events
        await Promise.all([
          ...messages.map((m) => this.messageRepository.deleteMessage(m.id)),
          ...payments.map((p) => this.paymentRepository.deletePayment(p.id)),
          ...handshakes.map((h) =>
            this.handshakeRepository.deleteHandshake(h.id)
          ),
        ]);

        // delete conversation if requested
        if (options?.deleteConversation) {
          await this.conversationRepository.deleteConversation(conversation.id);
        }
      }

      // delete contact if requested
      if (options?.deleteContact) {
        await this.contactRepository.deleteContact(contactId);
      }

      console.log(`Deleted all data for contact ${contactId}`);
    } catch (error) {
      console.error("Error deleting contact data:", error);
      throw error;
    }
  }
}
