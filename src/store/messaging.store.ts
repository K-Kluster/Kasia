import { create } from "zustand";
import {
  KasiaConversationEvent,
  KasiaTransaction,
  OneOnOneConversation,
} from "../types/all";
import { Contact } from "./repository/contact.repository";
import {
  encrypt_message,
  decrypt_with_secret_key,
  EncryptedMessage,
} from "cipher";
import { WalletStorage } from "../utils/wallet-storage";
import { Address, NetworkType } from "kaspa-wasm";
import { ConversationManager } from "../utils/conversation-manager";
import { useWalletStore } from "./wallet.store";
import { ConversationEvents, HandshakeState } from "src/types/messaging.types";
import { UnlockedWallet } from "src/types/wallet.type";
import { useDBStore } from "./db.store";
import {
  PendingConversation,
  ActiveConversation,
} from "./repository/conversation.repository";
import { loadLegacyMessages, saveMessages } from "../utils/storage-encryption";
import { PROTOCOL_PREFIX, PAYMENT_PREFIX } from "../config/protocol";
import { Payment } from "./repository/payment.repository";
import { Message } from "./repository/message.repository";
import { AccountService } from "../service/account-service";
import { Handshake } from "./repository/handshake.repository";

// Helper function to determine network type from address
function getNetworkTypeFromAddress(address: string): NetworkType {
  if (address.startsWith("kaspatest:")) {
    return NetworkType.Mainnet;
  } else if (address.startsWith("kaspadev:")) {
    return NetworkType.Devnet;
  }
  return NetworkType.Mainnet;
}

interface MessagingState {
  isLoaded: boolean;
  isCreatingNewChat: boolean;
  oneOnOneConversations: OneOnOneConversation[];
  eventsOnOpenedRecipient: KasiaConversationEvent[];
  storeKasiaTransactions: (transactions: KasiaTransaction[]) => Promise<void>;
  flushWalletHistory: (address: string) => void;
  addOneOnOneConversation: (oneOnOneConversation: OneOnOneConversation) => void;
  setIsLoaded: (isLoaded: boolean) => void;
  exportMessages: (wallet: UnlockedWallet, password: string) => Promise<Blob>;
  importMessages: (
    file: File,
    wallet: UnlockedWallet,
    password: string
  ) => Promise<void>;

  openedRecipient: string | null;
  setOpenedRecipient: (contact: string | null) => void;
  setIsCreatingNewChat: (isCreatingNewChat: boolean) => void;

  connectAccountService: (accountService: AccountService) => void;

  conversationManager: ConversationManager | null;
  initializeConversationManager: (address: string) => void;
  initiateHandshake: (
    recipientAddress: string,
    customAmount?: bigint
  ) => Promise<void>;
  processHandshake: (
    senderAddress: string,
    payload: string
  ) => Promise<unknown>;
  getActiveConversationsWithContacts: () => {
    contact: Contact;
    conversation: ActiveConversation;
  }[];
  getPendingConversationsWithContact: () => {
    contact: Contact;
    conversation: PendingConversation;
  }[];

  // New function to manually respond to a handshake
  respondToHandshake: (handshake: HandshakeState) => Promise<string>;

  // Nickname management
  setContactNickname: (address: string, nickname?: string) => Promise<void>;
  removeContactNickname: (address: string) => Promise<void>;

  // Last opened recipient management
  restoreLastOpenedRecipient: (walletAddress: string) => void;

  // Hydration
  hydrateOneonOneConversations: () => Promise<void>;
}

export const useMessagingStore = create<MessagingState>((set, g) => ({
  isLoaded: false,
  isCreatingNewChat: false,
  openedRecipient: null,
  oneOnOneConversations: [],
  eventsOnOpenedRecipient: [],
  addOneOnOneConversation: (conversationWithContact) => {
    const oneOnOneConversations = [
      ...g().oneOnOneConversations,
      conversationWithContact,
    ];
    oneOnOneConversations.sort(
      (a, b) =>
        b.conversation.lastActivityAt.getTime() -
        a.conversation.lastActivityAt.getTime()
    );
    set({ oneOnOneConversations: oneOnOneConversations });
  },
  hydrateOneonOneConversations: async () => {
    const repositories = useDBStore.getState().repositories;

    const contacts = await repositories.contactRepository.getContacts();
    const conversations =
      await repositories.conversationRepository.getConversations();

    const oneOnOneConversationPromises = conversations.map(
      async (conversation): Promise<OneOnOneConversation | null> => {
        const contact = contacts.find((c) => c.id === conversation.contactId);

        if (!contact) {
          return null;
        }

        const events = await repositories.getKasiaEventsByConversationId(
          conversation.id
        );

        return { conversation, contact, events };
      }
    );
    const oneOnOneConversations = await Promise.all(
      oneOnOneConversationPromises
    );
    set({
      oneOnOneConversations: oneOnOneConversations.filter((c) => c !== null),
    });
  },
  storeKasiaTransactions: async (transactions) => {
    // Update contacts with new messages
    const state = g();
    const walletStore = useWalletStore.getState();
    const unlockedWallet = walletStore.unlockedWallet;
    const repositories = useDBStore.getState().repositories;

    if (!unlockedWallet) {
      throw new Error("Wallet is not unlocked");
    }

    // cannot use `walletStore.address` because it is not always already populated
    const address = WalletStorage.getPrivateKeyGenerator(
      unlockedWallet,
      unlockedWallet.password
    )
      .receiveKey(0)
      .toAddress(useWalletStore.getState().selectedNetwork)
      .toString();

    if (!address) {
      throw new Error("Address is not available");
    }

    for (const transaction of transactions) {
      const isFromMe = transaction.senderAddress === address.toString();
      const participantAddress = isFromMe
        ? transaction.recipientAddress
        : transaction.senderAddress;

      console.log("Processing transaction: ", {
        ...transaction,
        isFromMe,
        participantAddress,
      });

      // HANDSHAKE
      if (
        transaction.content.startsWith("ciph_msg:") &&
        transaction.content.includes(":handshake:")
      ) {
        try {
          // Parse the handshake payload
          const parts = transaction.content.split(":");
          const jsonPart = parts.slice(3).join(":");
          const handshakePayload = JSON.parse(jsonPart);

          // Skip handshake processing if it's a self-message
          if (
            transaction.senderAddress === address.toString() &&
            transaction.recipientAddress === address.toString()
          ) {
            console.log("Skipping self-handshake message");
            return;
          }

          // Process handshake if we're the recipient or if this is a response to our handshake
          if (
            transaction.recipientAddress === address.toString() || // received handshake
            (handshakePayload.isResponse &&
              transaction.senderAddress === address.toString()) // our own response
          ) {
            console.log("Processing handshake message:", {
              senderAddress: transaction.senderAddress,
              recipientAddress: transaction.recipientAddress,
              isResponse: handshakePayload.isResponse,
              handshakePayload,
            });
            await g()
              .processHandshake(transaction.senderAddress, transaction.content)
              .catch((error) => {
                if (error.message === "Cannot create conversation with self") {
                  console.log("Skipping self-conversation handshake");
                  return;
                }
                console.error("Error processing handshake:", error);
              });

            const conversationWithContact =
              g().conversationManager?.getConversationWithContactByAddress(
                transaction.senderAddress
              );

            // persist in-memory & db kasia events
            if (conversationWithContact) {
              const handshake: Handshake = {
                __type: "handshake",
                amount: transaction.amount,
                contactId: conversationWithContact.contact.id,
                content: transaction.content,
                conversationId: conversationWithContact.conversation.id,
                createdAt: transaction.createdAt,
                fromMe: isFromMe,
                id: `${unlockedWallet.id}_${transaction.transactionId}`,
                tenantId: unlockedWallet.id,
                transactionId: transaction.transactionId,
                fee: transaction.fee,
              };
              await repositories.handshakeRepository.saveHandshake(handshake);

              // if already exists in memory, add even in place else add new one on one conversation
              const existingConversationIndex =
                g().oneOnOneConversations.findIndex(
                  (c) =>
                    c.conversation.id ===
                    conversationWithContact.conversation.id
                );

              if (existingConversationIndex !== -1) {
                const updatedConversations = [...g().oneOnOneConversations];
                updatedConversations[existingConversationIndex] = {
                  ...updatedConversations[existingConversationIndex],
                  events: [
                    ...updatedConversations[existingConversationIndex].events,
                    handshake,
                  ],
                };
                set({ oneOnOneConversations: updatedConversations });
              } else {
                set({
                  oneOnOneConversations: [
                    ...g().oneOnOneConversations,
                    {
                      contact: conversationWithContact.contact,
                      events: [handshake],
                      conversation: conversationWithContact.conversation,
                    },
                  ],
                });
              }
            }
            return;
          }
        } catch (error) {
          console.error("Error processing handshake message:", error);
          throw error;
        }
      }

      const existingConversationWithContactIndex =
        state.oneOnOneConversations.findIndex(
          (c) => c.contact.kaspaAddress === participantAddress
        );

      if (existingConversationWithContactIndex === -1) {
        throw new Error("Conversation not found, ignoring message");
      }

      const existingConversationWithContact =
        state.oneOnOneConversations[existingConversationWithContactIndex];

      const isTransactionAlreadyIngested =
        existingConversationWithContact.events.some(
          (e) => e.transactionId === transaction.transactionId
        );

      if (isTransactionAlreadyIngested) {
        console.warn("Transaction already ingested, ignoring message");
        return;
      }

      let kasiaEvent: KasiaConversationEvent | null = null;

      // PAYMENT
      if (
        transaction.payload.startsWith(PROTOCOL_PREFIX) &&
        transaction.payload.includes(PAYMENT_PREFIX)
      ) {
        const payment: Payment = {
          __type: "payment",
          amount: transaction.amount,
          contactId: existingConversationWithContact.contact.id,
          conversationId: existingConversationWithContact.conversation.id,
          content: transaction.content ?? "",
          createdAt: transaction.createdAt,
          fromMe: transaction.senderAddress === address.toString(),
          id: `${unlockedWallet.id}_${transaction.transactionId}`,
          tenantId: unlockedWallet.id,
          transactionId: transaction.transactionId,
          fee: transaction.fee,
        };

        await repositories.paymentRepository.savePayment(payment);

        kasiaEvent = payment;
      } else {
        // considering the transaction is a message

        const message: Message = {
          __type: "message",
          amount: transaction.amount,
          contactId: existingConversationWithContact.contact.id,
          conversationId: existingConversationWithContact.conversation.id,
          content: transaction.content ?? "",
          createdAt: transaction.createdAt,
          fromMe: transaction.senderAddress === address.toString(),
          id: `${unlockedWallet.id}_${transaction.transactionId}`,
          tenantId: unlockedWallet.id,
          transactionId: transaction.transactionId,
          fee: transaction.fee,
        };

        await repositories.messageRepository.saveMessage(message);

        kasiaEvent = message;
      }

      // touch conversation last activity
      await repositories.conversationRepository.updateLastActivity(
        existingConversationWithContact.conversation.id,
        transaction.createdAt
      );

      const updatedConversationWithContacts = [...state.oneOnOneConversations];
      updatedConversationWithContacts[existingConversationWithContactIndex] = {
        contact: existingConversationWithContact.contact,
        conversation: {
          ...existingConversationWithContact.conversation,
          lastActivityAt: transaction.createdAt,
        },
        events: [...existingConversationWithContact.events, kasiaEvent].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        ),
      };

      set({ oneOnOneConversations: updatedConversationWithContacts });
    }
  },
  flushWalletHistory: (address: string) => {
    // 1. Clear wallet messages from localStorage using new per-address system
    const walletStore = useWalletStore.getState();
    const password = walletStore.unlockedWallet?.password;
    const walletId = walletStore.selectedWalletId;

    if (!password) {
      console.error("Wallet password not available for flushing history.");
      return;
    }

    if (!walletId) {
      console.error("No wallet selected for flushing history.");
      return;
    }

    // Remove the specific address storage key
    const storageKey = `msg_${walletId.substring(0, 8)}_${address.replace(/^kaspa[test]?:/, "").slice(-10)}`;
    localStorage.removeItem(storageKey);

    // 2. Clear nickname mappings for this wallet
    const nicknameKey = `contact_nicknames_${address}`;
    localStorage.removeItem(nicknameKey);

    // 3. Clear conversation manager data for this wallet
    const conversationKey = `encrypted_conversations_${address}`;
    localStorage.removeItem(conversationKey);

    // 4. Clear last opened recipient for this wallet
    const lastOpenedRecipientKey = `kasia_last_opened_recipient_${address}`;
    localStorage.removeItem(lastOpenedRecipientKey);

    // 5. Reset all UI state immediately
    set({
      oneOnOneConversations: [],
      openedRecipient: null,
      isCreatingNewChat: false,
    });

    // 6. Clear and reinitialize conversation manager
    const manager = g().conversationManager;
    if (manager) {
      // Reinitialize fresh conversation manager
      g().initializeConversationManager(address);
    }

    console.log("Complete history clear completed - all data wiped");
  },
  setIsLoaded: (isLoaded) => {
    set({ isLoaded });
  },
  setOpenedRecipient(contact) {
    set({ openedRecipient: contact });

    // Save or clear the last opened recipient to localStorage for persistence
    const walletStore = useWalletStore.getState();
    const walletAddress = walletStore.address?.toString();
    if (walletAddress) {
      if (contact) {
        localStorage.setItem(
          `kasia_last_opened_recipient_${walletAddress}`,
          contact
        );
      } else {
        localStorage.removeItem(`kasia_last_opened_recipient_${walletAddress}`);
      }
    }
  },
  setIsCreatingNewChat: (isCreatingNewChat) => {
    set({ isCreatingNewChat });
  },
  exportMessages: async (wallet, password) => {
    try {
      console.log("Starting message export process...");

      const password = useWalletStore.getState().unlockedWallet?.password;
      if (!password) {
        throw new Error(
          "Wallet password not available for exporting messages."
        );
      }

      const messagesMap = loadLegacyMessages(password);

      console.log("Getting private key generator...");
      const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
        wallet,
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
        // contacts: g().conversationManager.get,
        conversations: {
          active: g().conversationManager?.getActiveConversations() || [],
          pending: g().conversationManager?.getPendingConversations() || [],
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
    } catch (error: unknown) {
      console.error("Error exporting messages:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to create backup: ${errorMessage}`);
    }
  },
  importMessages: async (file, wallet, password) => {
    try {
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
        wallet,
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
      if (
        !decryptedData.version ||
        !decryptedData.type ||
        !decryptedData.data
      ) {
        throw new Error("Invalid backup data structure");
      }

      console.log("Merging with existing messages...");
      // Merge with existing messages
      const currentPassword =
        useWalletStore.getState().unlockedWallet?.password;
      if (!currentPassword) {
        throw new Error(
          "Wallet password not available for importing messages."
        );
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

        localStorage.setItem(
          nicknameStorageKey,
          JSON.stringify(mergedNicknames)
        );
        console.log("Nicknames restored:", mergedNicknames);
      }

      // Restore conversations if they exist in the backup
      if (decryptedData.conversations) {
        console.log("Restoring conversations...");
        const { active = [], pending = [] } = decryptedData.conversations;

        // Initialize conversation manager if needed
        if (!g().conversationManager) {
          g().initializeConversationManager(currentAddress);
        }

        // Restore active conversations
        active.forEach((conv: ActiveConversation) => {
          if (g().conversationManager?.isValidConversation(conv)) {
            g().conversationManager?.restoreConversation(conv);
          } else {
            console.error("Invalid conversation object in backup:", conv);
          }
        });

        // Restore pending conversations
        pending.forEach((conv: PendingConversation) => {
          if (isValidConversation(conv)) {
            g().conversationManager?.restoreConversation(conv);
          } else {
            console.error("Invalid conversation object in backup:", conv);
          }
        });
      }

      // Reload messages using the current address
      g().loadMessages(currentAddress);

      // Set flag to trigger API fetching after next account service start
      localStorage.setItem("kasia_fetch_api_on_start", "true");

      console.log("Import completed successfully");
      console.log(
        "Set flag to fetch API messages on next wallet service start"
      );
    } catch (error: unknown) {
      console.error("Error importing messages:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to import messages: ${error.message}`);
      }
      throw new Error("Failed to import messages: Unknown error");
    }
  },
  connectAccountService: (accountService) => {
    // Listen for new messages from the account service
    accountService.on(
      "messageReceived",
      (kasiaTransaction: KasiaTransaction) => {
        const state = g();

        // Store the message
        state.storeKasiaTransactions([kasiaTransaction]);
      }
    );
  },
  conversationManager: null,
  initializeConversationManager: (address: string) => {
    const events: Partial<ConversationEvents> = {
      onHandshakeInitiated: (conversation, contact) => {
        console.log("Handshake initiated:", conversation);
        // You might want to update UI or state here
      },
      onHandshakeCompleted: (conversation, contact) => {
        console.log("Handshake completed:", conversation);
      },
      onHandshakeExpired: (conversation, contact) => {
        console.log("Handshake expired:", conversation);
        // You might want to update UI or state here
      },
      onError: (error) => {
        console.error("Conversation error:", error);
        // You might want to show error in UI
      },
    };

    const manager = new ConversationManager(
      address,
      useDBStore.getState().repositories,
      events
    );
    set({ conversationManager: manager });
  },
  initiateHandshake: async (
    recipientAddress: string,
    customAmount?: bigint
  ) => {
    const manager = g().conversationManager;
    if (!manager) {
      throw new Error("Conversation manager not initialized");
    }

    // Get the wallet store for sending the message
    const walletStore = useWalletStore.getState();
    if (!walletStore.unlockedWallet || !walletStore.address) {
      throw new Error("Wallet not unlocked");
    }

    // Create the handshake payload
    const { payload, contact, conversation } =
      await manager.initiateHandshake(recipientAddress);

    // Send the handshake message
    console.log("Sending handshake message to:", recipientAddress);
    try {
      const txId = await walletStore.sendMessage({
        message: payload,
        toAddress: new Address(recipientAddress),
        password: walletStore.unlockedWallet.password,
        customAmount,
      });

      console.log("Handshake message sent, transaction ID:", txId);

      // Create a message object for the handshake
      const kasiaTransaction: KasiaTransaction = {
        transactionId: txId,
        senderAddress: walletStore.address.toString(),
        recipientAddress: recipientAddress,
        createdAt: new Date(),
        // @TODO(indexdb): fix this to use the correct fee
        fee: 0,
        content: "Handshake initiated",
        amount: Number(customAmount || 20000000n) / 100000000, // Convert bigint to KAS number
        payload: payload,
      };

      const handshake: Handshake = {
        __type: "handshake",
        id: `${walletStore.unlockedWallet.id}_${txId}`,
        tenantId: walletStore.unlockedWallet.id,
        amount: kasiaTransaction.amount,
        contactId: contact.id,
        conversationId: conversation.id,
        content: kasiaTransaction.content,
        createdAt: kasiaTransaction.createdAt,
        fromMe: true,
        transactionId: kasiaTransaction.transactionId,
        fee: kasiaTransaction.fee,
      };

      const repositories = useDBStore.getState().repositories;

      await repositories.handshakeRepository.saveHandshake(handshake);

      const oneOnOneConversations = g().oneOnOneConversations;

      // push at the beginning of the array
      oneOnOneConversations.unshift({
        conversation,
        contact,
        events: [handshake],
      });

      set({
        oneOnOneConversations,
      });
    } catch (error) {
      console.error("Error sending handshake message:", error);
      throw error;
    }
  },
  processHandshake: async (senderAddress: string, payload: string) => {
    const manager = g().conversationManager;
    if (!manager) {
      throw new Error("Conversation manager not initialized");
    }
    return await manager.processHandshake(senderAddress, payload);
  },
  getActiveConversationsWithContacts: () => {
    const manager = g().conversationManager;
    return manager ? manager.getActiveConversationsWithContact() : [];
  },
  getPendingConversationsWithContact: () => {
    const manager = g().conversationManager;
    return manager ? manager.getPendingConversationsWithContact() : [];
  },
  // New function to manually respond to a handshake
  respondToHandshake: async (handshake: HandshakeState) => {
    try {
      if (!handshake || !handshake.kaspaAddress) {
        throw new Error("Invalid handshake data: missing kaspaAddress");
      }

      const manager = g().conversationManager;
      if (!manager) {
        throw new Error("Conversation manager not initialized");
      }

      console.log("Sending handshake response to:", handshake.kaspaAddress);

      // Use the address exactly as provided - do not modify it
      const recipientAddress = handshake.kaspaAddress;

      // Ensure we have the correct prefix
      if (
        !recipientAddress.startsWith("kaspa:") &&
        !recipientAddress.startsWith("kaspatest:")
      ) {
        throw new Error(
          "Invalid address format: must start with kaspa: or kaspatest:"
        );
      }

      console.log("Using recipient address:", recipientAddress);

      // Create handshake response
      const handshakeResponse = {
        type: "handshake",
        alias: handshake.myAlias,
        timestamp: Date.now(),
        conversationId: handshake.conversationId,
        version: 1,
        recipientAddress: recipientAddress,
        sendToRecipient: true,
        isResponse: true,
      };

      // Get wallet info
      const walletStore = useWalletStore.getState();
      if (!walletStore.unlockedWallet?.password || !walletStore.address) {
        throw new Error("Wallet not unlocked");
      }

      // Format the message with the correct prefix and type
      const messageContent = `ciph_msg:1:handshake:${JSON.stringify(
        handshakeResponse
      )}`;

      try {
        // Create a valid Kaspa address - use the address exactly as is
        const kaspaAddress = new Address(recipientAddress);
        console.log("Valid Kaspa address created:", kaspaAddress.toString());

        // Send the handshake response
        const txId = await walletStore.sendMessage({
          message: messageContent,
          toAddress: kaspaAddress,
          password: walletStore.unlockedWallet.password,
        });

        // Update the conversation in the manager
        const conversation = manager.getConversationByAddress(recipientAddress);
        if (conversation) {
          conversation.status = "active";
          conversation.lastActivity = Date.now();
          manager.updateConversation({
            ...conversation,
            status: "active",
          });
        }

        // Update the handshake status in the store
        set((state) => ({
          ...state,
          handshakes: state.handshakes.map((h) =>
            h.conversationId === handshake.conversationId
              ? {
                  ...h,
                  status: "active",
                  lastActivity: Date.now(),
                }
              : h
          ),
        }));

        // Create a message object for the handshake response
        const message: Message = {
          transactionId: txId,
          senderAddress: walletStore.address.toString(),
          recipientAddress: recipientAddress,
          timestamp: Date.now(),
          content: "Handshake response sent",
          amount: 0.2, // Default 0.2 KAS for handshake responses
          payload: messageContent,
        };

        // Store the handshake response message
        g().storeMessage(message, walletStore.address.toString());
        g().addMessages([message]);

        return txId;
      } catch (error: unknown) {
        console.error("Error creating Kaspa address:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Invalid Kaspa address format: ${errorMessage}`);
      }
    } catch (error: unknown) {
      console.error("Error sending handshake response:", error);
      throw error;
    }
  },

  // Nickname management functions
  setContactNickname: async (address: string, nickname?: string) => {
    const oneOnOneConversationIndex = g().oneOnOneConversations.findIndex(
      (oooc) => oooc.contact.kaspaAddress === address
    );

    if (oneOnOneConversationIndex === -1) {
      throw new Error("Conversation not found");
    }

    const copiedOneOnOneConversations = [...g().oneOnOneConversations];

    copiedOneOnOneConversations[oneOnOneConversationIndex] = {
      ...copiedOneOnOneConversations[oneOnOneConversationIndex],
      contact: {
        ...copiedOneOnOneConversations[oneOnOneConversationIndex].contact,
        name: nickname?.trim(),
      },
    };

    set({ oneOnOneConversations: copiedOneOnOneConversations });

    await useDBStore.getState().repositories.contactRepository.saveContact({
      ...copiedOneOnOneConversations[oneOnOneConversationIndex].contact,
      name: nickname?.trim(),
    });
  },

  removeContactNickname: async (address: string) => {
    return g().setContactNickname(address, undefined);
  },

  // Last opened recipient management
  restoreLastOpenedRecipient: (walletAddress: string) => {
    try {
      const lastOpenedRecipient = localStorage.getItem(
        `kasia_last_opened_recipient_${walletAddress}`
      );

      const state = g();

      if (lastOpenedRecipient) {
        // Check if the contact still exists in the current contacts list
        const contactExists = state.oneOnOneConversations.some(
          (oooc) => oooc.contact.kaspaAddress === lastOpenedRecipient
        );

        if (contactExists) {
          set({ openedRecipient: lastOpenedRecipient });
          return;
        } else {
          // Contact no longer exists, clear the stored value
          localStorage.removeItem(
            `kasia_last_opened_recipient_${walletAddress}`
          );
        }
      }

      // Fallback: select the first available contact
      const firstContact = state.oneOnOneConversations[0]?.contact;
      set({ openedRecipient: firstContact.kaspaAddress });
    } catch (error) {
      console.error("Error restoring last opened recipient:", error);
    }
  },
}));
