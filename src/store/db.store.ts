import { create } from "zustand";
import { KasiaDB, openDatabase, Repositories } from "./repository/db";
import { Contact } from "./repository/contact.repository";
import { UnlockedWallet } from "../types/wallet.type";
import { WalletStorage } from "../utils/wallet-storage";
import { useWalletStore } from "./wallet.store";
import { v4 } from "uuid";
import { DecryptionCache } from "../utils/decryption-cache";
import {
  loadLegacyMessages,
  loadMessagesForAddress,
} from "../utils/storage-encryption";
import { PAYMENT_PREFIX, PROTOCOL_PREFIX } from "../config/protocol";
import { Message } from "./repository/message.repository";
import { Handshake } from "./repository/handshake.repository";
import { Payment } from "./repository/payment.repository";

interface DBState {
  db: KasiaDB | undefined;
  isDbOpening: boolean;
  repositories: Repositories;
  unlockedWallet: UnlockedWallet;

  contacts: Contact[];

  /**
   * Opens the database (indexdb) and sets the `db` state
   */
  initDB: () => Promise<void>;
  /**
   * @param unlockedWallet wallet
   * @param walletPassword used for encryption and decription of locally stored sensitive data
   */
  initRepositories: (
    unlockedWallet: UnlockedWallet,
    walletPassword: string
  ) => void;
  loadContacts: () => Promise<void>;
  migrateStorage: () => Promise<void>;
}

export const useDBStore = create<DBState>((set, get) => ({
  db: undefined,
  isDbOpening: false,
  repositories: undefined!,
  unlockedWallet: undefined!,
  contacts: [],
  initDB: async () => {
    const db = await openDatabase();
    set({ db });
  },
  initRepositories: (unlockedWallet, walletPassword) => {
    const db = get().db;
    if (!db) {
      throw new Error("DB not initialized");
    }

    if (!unlockedWallet?.id || !walletPassword) {
      throw new Error("Tenant ID and wallet password are required");
    }

    console.log({
      unlockedWallet,
    });

    const repositories = new Repositories(
      db,
      walletPassword,
      unlockedWallet.id
    );
    set({ repositories, unlockedWallet });
  },
  loadContacts: async () => {
    const repositories = get().repositories;

    const contacts = await repositories.contactRepository.getContacts();

    set({
      contacts,
    });
  },
  migrateStorage: async () => {
    const repositories = get().repositories;
    const unlockedWallet = get().unlockedWallet;

    // migrate to storage v2
    if (!localStorage.getItem(`${unlockedWallet.id}_migrate_storage_v2`)) {
      const address = WalletStorage.getPrivateKeyGenerator(
        unlockedWallet,
        unlockedWallet.password
      )
        .receiveKey(0)
        .toAddress(useWalletStore.getState().selectedNetwork);

      // CONVERSATION and CONTACT
      const conversationString = localStorage.getItem(
        `encrypted_conversations_${address.toString()}`
      );
      if (conversationString) {
        const conversations: {
          conversationId: string;
          myAlias: string;
          theirAlias: string | null;
          kaspaAddress: string;
          createdAt: number;
          lastActivity: number;
          status: "pending" | "rejected" | "active";
          initiatedByMe: boolean;
        }[] = JSON.parse(conversationString);

        // loosely fetch nicknames
        const nicknameStorageKey = `contact_nicknames_${address.toString()}`;
        const nicknames = JSON.parse(
          localStorage.getItem(nicknameStorageKey) || "{}"
        );

        for (const conversation of conversations) {
          const contactKey = await repositories.contactRepository.saveContact({
            id: v4(),
            kaspaAddress: conversation.kaspaAddress,
            timestamp: new Date(conversation.createdAt),
            name: nicknames[conversation.kaspaAddress],
          });

          await repositories.conversationRepository.saveConversation({
            id: v4(),
            contactId: contactKey,
            initiatedByMe: conversation.initiatedByMe,
            lastActivityAt: new Date(conversation.lastActivity),
            myAlias: conversation.myAlias,
            theirAlias: conversation.theirAlias,
            status: conversation.status,
          });
        }
      }

      // DECRYPTION TRIAL
      const decryptionFailedEntries = DecryptionCache.initCache(
        address.toString()
      );
      for (const decryptionFailedEntry of decryptionFailedEntries) {
        await repositories.decryptionTrialRepository.saveDecryptionTrial({
          id: decryptionFailedEntry,
        });
      }

      // MESSAGES
      const legacyMessagesByWallet = loadLegacyMessages(
        unlockedWallet.password
      );
      const legacyMessages = legacyMessagesByWallet[address.toString()] ?? [];
      const messagesv1 = loadMessagesForAddress(
        unlockedWallet.id,
        address.toString(),
        unlockedWallet.password
      );

      const mergedDeduplicatedMessages = [
        ...legacyMessages,
        ...messagesv1,
      ].filter((message, index, self) => {
        return (
          index ===
          self.findIndex((m) => m.transactionId === message.transactionId)
        );
      });

      const contacts = await repositories.contactRepository.getContacts();

      const messageEntities: {
        payments: Payment[];
        handshakes: Handshake[];
        messages: Message[];
      } = { payments: [], handshakes: [], messages: [] };

      for (const m of mergedDeduplicatedMessages) {
        const partnerAddress =
          m.senderAddress === address.toString()
            ? m.recipientAddress
            : m.senderAddress;
        const foundContact = contacts.find(
          (c) => c.kaspaAddress === partnerAddress
        );

        if (!foundContact) {
          continue;
        }

        const foundConversation = await repositories.conversationRepository
          .getConversationByContactId(foundContact.id)
          .catch(() => null);

        if (!foundConversation) {
          continue;
        }

        // PAYMENT
        if (
          m.payload.startsWith(PROTOCOL_PREFIX) &&
          m.payload.includes(PAYMENT_PREFIX)
        ) {
          messageEntities.payments.push({
            amount: m.amount,
            id: `${unlockedWallet.id}_${m.transactionId}`,
            tenantId: unlockedWallet.id,
            contactId: foundContact.id,
            conversationId: foundConversation.id,
            createdAt: new Date(m.timestamp),
            transactionId: m.transactionId,
            fee: m.fee,
            content: m.content ?? "",
            __type: "payment",
          });
          continue;
        }

        // HANDSHAKE
        if (m.payload.startsWith("ciph_msg:1:handshake")) {
          messageEntities.handshakes.push({
            amount: m.amount,
            id: `${unlockedWallet.id}_${m.transactionId}`,
            tenantId: unlockedWallet.id,
            contactId: foundContact.id,
            conversationId: foundConversation.id,
            createdAt: new Date(m.timestamp),
            transactionId: m.transactionId,
            fee: m.fee,
            content: m.content ?? "",
            __type: "handshake",
          });
          continue;
        }

        // ASSUME MESSAGE IF NOTHING ELSE MATCHES
        messageEntities.messages.push({
          amount: m.amount,
          id: `${unlockedWallet.id}_${m.transactionId}`,
          tenantId: unlockedWallet.id,
          contactId: foundContact.id,
          conversationId: foundConversation.id,
          createdAt: new Date(m.timestamp),
          transactionId: m.transactionId,
          fee: m.fee,
          fileData: m.fileData,
          content: m.content ?? "",
          __type: "message",
        });

        continue;
      }

      for (const message of messageEntities.messages) {
        await repositories.messageRepository.saveMessage(message);
      }

      for (const payment of messageEntities.payments) {
        await repositories.paymentRepository.savePayment(payment);
      }

      for (const handshake of messageEntities.handshakes) {
        await repositories.handshakeRepository.saveHandshake(handshake);
      }
    }

    localStorage.setItem(`${unlockedWallet.id}_migrate_storage_v2`, "true");
  },
}));
