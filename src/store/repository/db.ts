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
import { GroupRepository, DbGroup, GroupStatus } from "./group.repository";
import {
  GroupMessageRepository,
  DbGroupMessage,
} from "./group-message.repository";

const CURRENT_DB_VERSION = 4;

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
  groups: {
    key: string;
    value: DbGroup;
    indexes: {
      "by-tenant-id": string;
      "by-tenant-id-status": [string, GroupStatus];
      "by-tenant-id-last-activity": [string, Date];
      "by-tenant-id-status-last-activity": [string, GroupStatus, Date];
    };
  };
  groupMessages: {
    key: string;
    value: DbGroupMessage;
    indexes: {
      "by-id": string;
      "by-tenant-id": string;
      "by-tenant-id-group-id": [string, string];
      "by-tenant-id-group-id-epoch": [string, string, number];
      "by-tenant-id-created-at": [string, Date];
      "by-tenant-id-group-id-created-at": [string, string, Date];
    };
  };
}

export type KasiaDB = IDBPDatabase<KasiaDBSchema>;

export const openDatabase = async (): Promise<KasiaDB> => {
  return openDB<KasiaDBSchema>("kasia-db", CURRENT_DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
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

      if (oldVersion < 4) {
        // VERSION 4: Add groups and group messages tables
        const groupsStore = db.createObjectStore("groups", {
          keyPath: "id",
        });
        groupsStore.createIndex("by-tenant-id", "tenantId");
        groupsStore.createIndex("by-tenant-id-status", ["tenantId", "status"]);
        groupsStore.createIndex("by-tenant-id-last-activity", [
          "tenantId",
          "lastActivityAt",
        ]);
        groupsStore.createIndex("by-tenant-id-status-last-activity", [
          "tenantId",
          "status",
          "lastActivityAt",
        ]);

        // GROUP MESSAGES
        const groupMessagesStore = db.createObjectStore("groupMessages", {
          keyPath: "id",
        });
        groupMessagesStore.createIndex("by-id", "id", { unique: true });
        groupMessagesStore.createIndex("by-tenant-id", "tenantId");
        groupMessagesStore.createIndex("by-tenant-id-group-id", [
          "tenantId",
          "groupId",
        ]);
        groupMessagesStore.createIndex("by-tenant-id-group-id-epoch", [
          "tenantId",
          "groupId",
          "epoch",
        ]);
        groupMessagesStore.createIndex("by-tenant-id-created-at", [
          "tenantId",
          "createdAt",
        ]);
        groupMessagesStore.createIndex("by-tenant-id-group-id-created-at", [
          "tenantId",
          "groupId",
          "createdAt",
        ]);

        console.log(
          "Database schema updated to v4 (groups and group messages)"
        );
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
  public readonly metadataRepository: MetaRespository;
  public readonly groupRepository: GroupRepository;
  public readonly groupMessageRepository: GroupMessageRepository;

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

    this.metadataRepository = new MetaRespository(tenantId);

    this.groupRepository = new GroupRepository(db, tenantId, walletPassword);

    this.groupMessageRepository = new GroupMessageRepository(
      db,
      tenantId,
      walletPassword
    );
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
}
