import { create } from "zustand";
import { Contact, Message } from "../types/all";
import {
  encrypt_message,
  decrypt_with_secret_key,
  EncryptedMessage,
} from "cipher";
import { WalletStorage } from "../utils/wallet-storage";
import { Address, NetworkType } from "kaspa-wasm";
import { ConversationManager } from "../utils/conversation-manager";
import { useWalletStore } from "./wallet.store";
import {
  ActiveConversation,
  Conversation,
  ConversationEvents,
  PendingConversation,
} from "src/types/messaging.types";
import { UnlockedWallet } from "src/types/wallet.type";
import {
  loadLegacyMessages,
  saveMessages,
  saveMessagesForAddress,
  loadMessagesForAddress,
  loadMessagesFromMultipleAddresses,
  migrateToPerAddressStorage,
} from "../utils/storage-encryption";

// Define the HandshakeState interface
interface HandshakeState {
  conversationId: string;
  myAlias: string;
  theirAlias: string | null;
  kaspaAddress: string;
  status: "pending" | "active" | "rejected";
  createdAt: number;
  lastActivity: number;
  initiatedByMe: boolean;
}

// Helper function to determine network type from address
function getNetworkTypeFromAddress(address: string): NetworkType {
  if (address.startsWith("kaspatest:")) {
    return NetworkType.Testnet;
  } else if (address.startsWith("kaspadev:")) {
    return NetworkType.Devnet;
  }
  return NetworkType.Mainnet;
}

interface MessagingState {
  isLoaded: boolean;
  isCreatingNewChat: boolean;
  contacts: Contact[];
  messages: Message[];
  messagesOnOpenedRecipient: Message[];
  handshakes: HandshakeState[];
  addMessages: (messages: Message[]) => void;
  flushWalletHistory: (address: string) => void;
  addContacts: (contacts: Contact[]) => void;
  loadMessages: (address: string) => Message[];
  setIsLoaded: (isLoaded: boolean) => void;
  storeMessage: (message: Message, walletAddress: string) => void;
  exportMessages: (wallet: UnlockedWallet, password: string) => Promise<Blob>;
  importMessages: (
    file: File,
    wallet: UnlockedWallet,
    password: string
  ) => Promise<void>;

  openedRecipient: string | null;
  setOpenedRecipient: (contact: string | null) => void;
  refreshMessagesOnOpenedRecipient: () => void;
  setIsCreatingNewChat: (isCreatingNewChat: boolean) => void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connectAccountService: (accountService: any) => void;

  conversationManager: ConversationManager | null;
  initializeConversationManager: (address: string) => void;
  initiateHandshake: (
    recipientAddress: string,
    customAmount?: bigint
  ) => Promise<{
    payload: string;
    conversation: Conversation;
  }>;
  processHandshake: (
    senderAddress: string,
    payload: string
  ) => Promise<unknown>;
  getActiveConversations: () => Conversation[];
  getPendingConversations: () => PendingConversation[];

  // New function to manually respond to a handshake
  respondToHandshake: (handshake: HandshakeState) => Promise<string>;

  // Nickname management
  setContactNickname: (address: string, nickname: string) => void;
  removeContactNickname: (address: string) => void;
  getLastMessageForContact: (contactAddress: string) => Message | null;

  // Last opened recipient management
  restoreLastOpenedRecipient: (walletAddress: string) => void;
}

export const useMessagingStore = create<MessagingState>((set, g) => ({
  isLoaded: false,
  isCreatingNewChat: false,
  openedRecipient: null,
  contacts: [],
  messages: [],

  messagesOnOpenedRecipient: [],
  handshakes: [],
  addContacts: (contacts) => {
    const fullContacts = [...g().contacts, ...contacts];
    fullContacts.sort(
      (a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp
    );
    set({ contacts: [...g().contacts, ...contacts] });
  },
  addMessages: (messages) => {
    const fullMessages = [...g().messages, ...messages];
    fullMessages.sort((a, b) => a.timestamp - b.timestamp);

    set({ messages: fullMessages });

    // Update contacts with new messages
    const state = g();
    const walletStore = useWalletStore.getState();
    const walletAddress = walletStore.address?.toString();

    if (walletAddress) {
      messages.forEach((message) => {
        const otherParty =
          message.senderAddress === walletAddress
            ? message.recipientAddress
            : message.senderAddress;

        // Update existing contact if found
        const existingContactIndex = state.contacts.findIndex(
          (c) => c.address === otherParty
        );

        if (existingContactIndex !== -1) {
          const existingContact = state.contacts[existingContactIndex];
          // Only update if this message is newer than the current lastMessage
          if (message.timestamp > existingContact.lastMessage.timestamp) {
            const updatedContacts = [...state.contacts];
            updatedContacts[existingContactIndex] = {
              ...existingContact,
              lastMessage: message,
              messages: [...existingContact.messages, message].sort(
                (a, b) => a.timestamp - b.timestamp
              ),
            };

            // Sort contacts by most recent message timestamp
            const sortedContacts = updatedContacts.sort(
              (a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp
            );

            set({ contacts: sortedContacts });
          }
        } else {
          // create new contact if it doesn't exist
          const newContact = {
            address: otherParty,
            lastMessage: message,
            messages: [message],
          };

          const updatedContacts = [...state.contacts, newContact].sort(
            (a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp
          );

          set({ contacts: updatedContacts });
        }
      });
    }

    g().refreshMessagesOnOpenedRecipient();
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

    // 1. loop through all and delete
    const prefix = `msg_${walletId.substring(0, 8)}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }

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
      contacts: [],
      messages: [],
      messagesOnOpenedRecipient: [],
      handshakes: [],
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
  loadMessages: (address): Message[] => {
    const walletStore = useWalletStore.getState();
    const password = walletStore.unlockedWallet?.password;
    const walletId = walletStore.selectedWalletId;

    if (!password) {
      console.error("Wallet password not available for loading messages.");
      return [];
    }

    if (!walletId) {
      console.error("No wallet selected for loading messages.");
      return [];
    }

    let messages: Message[] = [];

    // load legacy messages first, try to migrate if they exist
    // we can remove this in v0.4.0
    const legacyMessages: Record<string, Message[]> =
      loadLegacyMessages(walletId);

    if (Object.keys(legacyMessages).length > 0) {
      // we have legacy messages - use them and migrate
      messages = legacyMessages[address] || [];

      // migrate the dogs to the new system
      try {
        migrateToPerAddressStorage(walletId, password, [address]);
      } catch (migrationError) {
        console.error(
          "Failed to migrate to per-address storage:",
          migrationError
        );
      }
    } else {
      // no legacy messages, lets load them with encryption
      try {
        const walletIdPrefix = walletId.substring(0, 8);
        const contactAddresses: string[] = [];

        // find all storage keys for this wallet that might contain contact messages
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`msg_${walletIdPrefix}_`)) {
            // extract the address from the storage key
            const addressSuffix = key.replace(`msg_${walletIdPrefix}_`, "");
            // try to reconstruct the full address
            const fullAddress = `kaspa:${addressSuffix}`;
            contactAddresses.push(fullAddress);
          }
        }

        // always load from multiple addresses since messages are stored per-contact
        if (contactAddresses.length > 0) {
          messages = loadMessagesFromMultipleAddresses(
            walletId,
            contactAddresses,
            password
          );
        } else {
          // fallback to single address only if no contact addresses found
          messages = loadMessagesForAddress(walletId, address, password);
        }
      } catch (error) {
        console.error("Error loading encrypted messages:", error);
        messages = [];
      }
    }

    const contacts = new Map();
    // process messages and organize by conversation
    messages.forEach((msg: Message) => {
      // ensure fileData is properly loaded if it exists
      if (msg.fileData) {
        msg.content = `[File: ${msg.fileData.name}]`;
      }

      // Determine if this is a message we should handle
      const isSender = msg.senderAddress === address;
      const isRecipient = msg.recipientAddress === address;
      const isHandshakeMessage =
        msg.content?.includes(":handshake:") ||
        msg.payload?.includes(":handshake:");

      // Skip messages that don't involve us
      if (!isSender && !isRecipient) {
        return;
      }

      // For messages where we are the sender, only create a conversation with the recipient
      // For messages where we are the recipient, only create a conversation with the sender
      const otherParty = isSender ? msg.recipientAddress : msg.senderAddress;

      // Allow self-messages
      if (msg.senderAddress === msg.recipientAddress) {
        if (!isHandshakeMessage) {
          // Create or update contact for self-messages
          const selfParty = msg.senderAddress;
          if (!contacts.has(selfParty)) {
            contacts.set(selfParty, {
              address: selfParty,
              lastMessage: msg,
              messages: [],
            });
          }
          const contact = contacts.get(selfParty);
          contact.messages.push(msg);
          if (msg.timestamp > contact.lastMessage.timestamp) {
            contact.lastMessage = msg;
          }
          return;
        }
        // For handshake messages, ensure we only show them in one conversation
        if (msg.senderAddress === address) {
          return;
        }
      }

      // Create or update contact
      if (!contacts.has(otherParty)) {
        contacts.set(otherParty, {
          address: otherParty,
          lastMessage: msg,
          messages: [],
        });
      }

      const contact = contacts.get(otherParty);
      contact.messages.push(msg);

      // Update last message if this message is more recent
      if (msg.timestamp > contact.lastMessage.timestamp) {
        contact.lastMessage = msg;
      }
    });
    // Sort messages within each contact by timestamp
    contacts.forEach((contact) => {
      contact.messages.sort(
        (a: Message, b: Message) => a.timestamp - b.timestamp
      );
    });

    // Load saved nicknames
    const storageKey = `contact_nicknames_${address}`;
    const savedNicknames = JSON.parse(localStorage.getItem(storageKey) || "{}");

    // Update state with sorted contacts and messages
    const sortedContacts = [...contacts.values()]
      .map((contact) => ({
        ...contact,
        nickname: savedNicknames[contact.address] || undefined,
      }))
      .sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);

    set({
      contacts: sortedContacts,
      messages: messages.sort(
        (a: Message, b: Message) => a.timestamp - b.timestamp
      ),
    });

    // Refresh the currently opened conversation
    g().refreshMessagesOnOpenedRecipient();

    return g().messages;
  },
  storeMessage: (message: Message, walletAddress: string) => {
    const manager = g().conversationManager;

    // Check if this is a handshake message
    if (
      message.content.startsWith("ciph_msg:") &&
      message.content.includes(":handshake:")
    ) {
      try {
        // Parse the handshake payload
        const parts = message.content.split(":");
        const jsonPart = parts.slice(3).join(":");
        const handshakePayload = JSON.parse(jsonPart);

        // Skip handshake processing if it's a self-message
        if (
          message.senderAddress === walletAddress &&
          message.recipientAddress === walletAddress
        ) {
          console.log("Skipping self-handshake message");
          return;
        }

        // Move handshake message from content to payload
        message.payload = message.content;
        message.content = handshakePayload.isResponse
          ? "Handshake response received"
          : "Handshake message received";

        // Process handshake if we're the recipient or if this is a response to our handshake
        if (
          message.recipientAddress === walletAddress || // received handshake
          handshakePayload.recipientAddress === walletAddress || // legacy safety
          (handshakePayload.isResponse &&
            message.senderAddress === walletAddress) // our own response
        ) {
          console.log("Processing handshake message:", {
            senderAddress: message.senderAddress,
            recipientAddress: message.recipientAddress,
            isResponse: handshakePayload.isResponse,
            handshakePayload,
          });
          g()
            .processHandshake(message.senderAddress, message.payload)
            .catch((error) => {
              if (error.message === "Cannot create conversation with self") {
                console.log("Skipping self-conversation handshake");
                return;
              }
              console.error("Error processing handshake:", error);
            });
        }
      } catch (error) {
        console.error("Error processing handshake message:", error);
      }
    }

    // If we have an active conversation, update its last activity
    if (manager) {
      const conv = manager.getConversationByAddress(
        message.senderAddress === walletAddress
          ? message.recipientAddress
          : message.senderAddress
      );
      if (conv) {
        manager.updateLastActivity(conv.conversationId);
      }
    }

    const walletStore = useWalletStore.getState();
    const password = walletStore.unlockedWallet?.password;
    const walletId = walletStore.selectedWalletId;

    if (!password) {
      console.error("Wallet password not available for storing message.");
      return;
    }

    if (!walletId) {
      console.error("No wallet selected for storing message.");
      return;
    }

    // Load existing messages for this address
    let existingMessages: Message[] = [];
    try {
      existingMessages = loadMessagesForAddress(
        walletId,
        walletAddress,
        password
      );
    } catch (error) {
      console.log(
        "Failed to load messages using per-address system, using empty array:",
        error
      );
    }

    // Check if we already have a message with this transaction ID
    const existingMessageIndex = existingMessages.findIndex(
      (m: Message) => m.transactionId === message.transactionId
    );

    if (existingMessageIndex !== -1) {
      // Merge the messages, preferring non-empty values
      const existingMessage = existingMessages[existingMessageIndex];
      const mergedMessage = {
        ...message,
        content: message.content || existingMessage.content,
        payload: message.payload || existingMessage.payload,
        // Use the earliest timestamp if both exist
        timestamp: Math.min(message.timestamp, existingMessage.timestamp),
        // Preserve fileData if it exists in either message
        fileData: message.fileData || existingMessage.fileData,
        // Ensure we have both addresses
        senderAddress: message.senderAddress || existingMessage.senderAddress,
        recipientAddress:
          message.recipientAddress || existingMessage.recipientAddress,
      };
      existingMessages[existingMessageIndex] = mergedMessage;
    } else {
      // For outgoing messages with file content, try to parse and store fileData
      if (!message.fileData && message.content) {
        try {
          const parsedContent = JSON.parse(message.content);
          if (parsedContent.type === "file") {
            message.fileData = {
              type: parsedContent.type,
              name: parsedContent.name,
              size: parsedContent.size,
              mimeType: parsedContent.mimeType,
              content: parsedContent.content,
            };
          }
        } catch (e) {
          // Not a file message, ignore
          void e;
        }
      }
      // Add new message
      existingMessages.push(message);
    }

    // Save messages using the new per-address system
    saveMessagesForAddress(existingMessages, walletId, walletAddress, password);

    // Update contacts and conversations
    const state = g();
    const otherParty =
      message.senderAddress === walletAddress
        ? message.recipientAddress
        : message.senderAddress;

    // Update or create contact
    const existingContactIndex = state.contacts.findIndex(
      (c) => c.address === otherParty
    );
    if (existingContactIndex !== -1) {
      // Update existing contact
      const updatedContact = {
        ...state.contacts[existingContactIndex],
        lastMessage: message,
        messages: [...state.contacts[existingContactIndex].messages, message],
      };
      const newContacts = [...state.contacts];
      newContacts[existingContactIndex] = updatedContact;
      set({ contacts: newContacts });
    } else {
      // Create new contact
      const newContact = {
        address: otherParty,
        lastMessage: message,
        messages: [message],
      };
      set({ contacts: [...state.contacts, newContact] });
    }

    // Sort contacts by most recent message
    const sortedContacts = [...g().contacts].sort(
      (a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp
    );
    set({ contacts: sortedContacts });
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

    g().refreshMessagesOnOpenedRecipient();
  },
  refreshMessagesOnOpenedRecipient: () => {
    const { openedRecipient, messagesOnOpenedRecipient } = g();

    if (!openedRecipient) {
      if (messagesOnOpenedRecipient.length) {
        set({ messagesOnOpenedRecipient: [] });
      }
      return;
    }

    const filtered = g().messages.filter((msg) => {
      return (
        msg.senderAddress === openedRecipient ||
        msg.recipientAddress === openedRecipient
      );
    });

    // deduplicate by transactionId
    const deduped = Object.values(
      filtered.reduce(
        (acc, msg) => {
          acc[msg.transactionId] = acc[msg.transactionId]
            ? msg.timestamp > acc[msg.transactionId].timestamp
              ? msg
              : acc[msg.transactionId]
            : msg;
          return acc;
        },
        {} as Record<string, Message>
      )
    );

    set({ messagesOnOpenedRecipient: deduped });
  },
  setIsCreatingNewChat: (isCreatingNewChat) => {
    set({ isCreatingNewChat });
  },
  exportMessages: async (wallet) => {
    try {
      console.log("Starting message export process...");

      const password = useWalletStore.getState().unlockedWallet?.password;
      if (!password) {
        throw new Error(
          "Wallet password not available for exporting messages."
        );
      }

      const walletId = useWalletStore.getState().selectedWalletId;
      if (!walletId) {
        throw new Error("No wallet selected for exporting messages.");
      }

      console.log("Getting private key generator...");
      const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
        wallet,
        password
      );

      console.log("Getting receive key...");
      const receiveKey = privateKeyGenerator.receiveKey(0);

      const walletStore = useWalletStore.getState();
      const networkType = walletStore.selectedNetwork || NetworkType.Mainnet;
      const receiveAddress = receiveKey.toAddress(networkType);
      const walletAddress = receiveAddress.toString();
      console.log("Using receive address:", walletAddress);

      // collect all messages from the current store state and per-address storage
      const messagesMap: Record<string, Message[]> = {};

      // First, try to load legacy messages and migrate them if needed
      const legacyMessages = loadLegacyMessages();
      if (Object.keys(legacyMessages).length > 0) {
        console.log(
          "Found legacy messages, migrating to per-address storage..."
        );
        migrateToPerAddressStorage(walletId, password, [walletAddress]);
        // after migration, the messages will be available in per-address storage
      }

      // get all messages from the current store state
      const currentMessages = g().messages;
      if (currentMessages.length > 0) {
        // group messages by the other party (not the current wallet)
        const messagesByAddress: Record<string, Message[]> = {};

        currentMessages.forEach((message) => {
          const otherParty =
            message.senderAddress === walletAddress
              ? message.recipientAddress
              : message.senderAddress;

          if (!messagesByAddress[otherParty]) {
            messagesByAddress[otherParty] = [];
          }
          messagesByAddress[otherParty].push(message);
        });

        // also include messages where the current wallet is both sender and recipient
        if (messagesByAddress[walletAddress]) {
          messagesMap[walletAddress] = messagesByAddress[walletAddress];
        }

        // add messages for each contact
        Object.entries(messagesByAddress).forEach(([address, messages]) => {
          if (address !== walletAddress) {
            messagesMap[address] = messages;
          }
        });
      }

      // if we still don't have messages, try loading from per-address storage
      if (Object.keys(messagesMap).length === 0) {
        console.log("No messages in store, trying per-address storage...");
        const storedMessages = loadMessagesForAddress(
          walletId,
          walletAddress,
          password
        );
        if (storedMessages.length > 0) {
          messagesMap[walletAddress] = storedMessages;
        }
      }

      console.log("Collected messages:", messagesMap);

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

      console.log("Processing imported messages...");
      // Use only the imported data, don't merge with legacy storage
      const mergedMessages = decryptedData.data;

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

      // process all imported messages and add them to the store
      console.log("Processing imported messages...");
      const allImportedMessages: Message[] = [];

      Object.entries(mergedMessages).forEach(([address, messages]) => {
        const typedMessages = messages as Message[];
        console.log(
          `Processing ${typedMessages.length} messages for address: ${address}`
        );
        allImportedMessages.push(...typedMessages);
      });

      // add all messages to the store
      if (allImportedMessages.length > 0) {
        console.log(`Adding ${allImportedMessages.length} messages to store`);
        g().addMessages(allImportedMessages);
      }

      // save imported messages to localStorage for persistence
      console.log("Saving imported messages to localStorage...");
      const walletStore = useWalletStore.getState();
      const importPassword = walletStore.unlockedWallet?.password;
      const walletId = walletStore.selectedWalletId;

      if (importPassword && walletId) {
        // save messages under each contact address to maintain per-contact organization
        Object.entries(mergedMessages).forEach(([contactAddress, messages]) => {
          const typedMessages = messages as Message[];
          if (typedMessages.length > 0) {
            // save messages under the contact's address, not the wallet address
            saveMessagesForAddress(
              typedMessages,
              walletId,
              contactAddress,
              importPassword
            );
          }
        });
      } else {
        console.error(
          "Cannot save to localStorage: missing password or walletId"
        );
      }

      // // set flag to trigger API fetching after next account service start
      localStorage.setItem("kasia_fetch_api_on_start", "true");

      console.log("Import completed successfully");
      console.log(
        "Set flag to fetch API messages on next wallet service start"
      );

      // After restoring nicknames in localStorage, update UI. Otherwise we need to wait till next login
      const nicknameStorageKey = `contact_nicknames_${currentAddress}`;
      const savedNicknames = JSON.parse(
        localStorage.getItem(nicknameStorageKey) || "{}"
      );

      // build the full contacts array (including new ones from import)
      const contacts = [...g().contacts];
      Object.entries(mergedMessages).forEach(([address, messages]) => {
        const typedMessages = messages as Message[];
        if (
          !contacts.some((c) => c.address === address) &&
          typedMessages.length > 0
        ) {
          const lastMessage = typedMessages.reduce((a, b) =>
            a.timestamp > b.timestamp ? a : b
          );
          contacts.push({
            address,
            lastMessage,
            messages: typedMessages,
            nickname: savedNicknames[address] || undefined,
          });
        }
      });

      // update all contacts with nicknames
      const updatedContacts = contacts.map((contact) => ({
        ...contact,
        nickname: savedNicknames[contact.address] || undefined,
      }));

      set({ contacts: updatedContacts });
    } catch (error: unknown) {
      console.error("Error importing messages:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to import messages: ${error.message}`);
      }
      throw new Error("Failed to import messages: Unknown error");
    }
  },
  connectAccountService: (accountService) => {
    // Make the store available globally for the account service
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).messagingStore = g();

    // Listen for new messages from the account service
    accountService.on("messageReceived", (message: Message) => {
      const state = g();

      // Store the message
      state.storeMessage(message, message.senderAddress);

      // Add the message to our state
      state.addMessages([message]);

      // Refresh the UI if this message is for the currently opened chat
      if (
        state.openedRecipient === message.senderAddress ||
        state.openedRecipient === message.recipientAddress
      ) {
        state.refreshMessagesOnOpenedRecipient();
      }

      // Update contacts if needed
      const otherParty =
        message.senderAddress === state.openedRecipient
          ? message.recipientAddress
          : message.senderAddress;

      const existingContact = state.contacts.find(
        (c) => c.address === otherParty
      );
      if (!existingContact) {
        state.addContacts([
          {
            address: otherParty,
            lastMessage: message,
            messages: [message],
          },
        ]);
      }
    });
  },
  conversationManager: null,
  initializeConversationManager: (address: string) => {
    const events: Partial<ConversationEvents> = {
      onHandshakeInitiated: (conversation) => {
        console.log("Handshake initiated:", conversation);
        // You might want to update UI or state here
      },
      onHandshakeCompleted: (conversation) => {
        console.log("Handshake completed:", conversation);
        // Update contacts list
        const contact: Contact = {
          address: conversation.kaspaAddress,
          lastMessage: {
            content: "Handshake completed",
            timestamp: conversation.lastActivity,
            senderAddress: address,
            recipientAddress: conversation.kaspaAddress,
            transactionId: "",
            payload: "",
            amount: 0,
          },
          messages: [],
        };
        g().addContacts([contact]);
      },
      onHandshakeExpired: (conversation) => {
        console.log("Handshake expired:", conversation);
        // You might want to update UI or state here
      },
      onError: (error) => {
        console.error("Conversation error:", error);
        // You might want to show error in UI
      },
    };

    const manager = new ConversationManager(address, events);
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
    const { payload, conversation } =
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
      const message: Message = {
        transactionId: txId,
        senderAddress: walletStore.address.toString(),
        recipientAddress: recipientAddress,
        timestamp: Date.now(),
        content: "Handshake initiated",
        amount: Number(customAmount || 20000000n) / 100000000, // Convert bigint to KAS number
        payload: payload,
      };

      // Store the handshake message
      g().storeMessage(message, walletStore.address.toString());
      g().addMessages([message]);

      return { payload, conversation };
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
  getActiveConversations: () => {
    const manager = g().conversationManager;
    return manager ? manager.getActiveConversations() : [];
  },
  getPendingConversations: () => {
    const manager = g().conversationManager;
    return manager ? manager.getPendingConversations() : [];
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
  setContactNickname: (address: string, nickname: string) => {
    const contacts = g().contacts;
    const contactIndex = contacts.findIndex((c) => c.address === address);

    if (contactIndex !== -1) {
      const updatedContacts = [...contacts];
      updatedContacts[contactIndex] = {
        ...updatedContacts[contactIndex],
        nickname: nickname.trim() || undefined,
      };
      set({ contacts: updatedContacts });

      // Save to localStorage
      const walletStore = useWalletStore.getState();
      if (walletStore.address) {
        const storageKey = `contact_nicknames_${walletStore.address.toString()}`;
        const nicknames = JSON.parse(localStorage.getItem(storageKey) || "{}");
        if (nickname.trim()) {
          nicknames[address] = nickname.trim();
        } else {
          delete nicknames[address];
        }
        localStorage.setItem(storageKey, JSON.stringify(nicknames));
      }
    }
  },

  removeContactNickname: (address: string) => {
    g().setContactNickname(address, "");
  },

  getLastMessageForContact: (contactAddress: string) => {
    const messages = g().messages;
    const relevant = messages.filter(
      (msg) =>
        msg.senderAddress === contactAddress ||
        msg.recipientAddress === contactAddress
    );
    return relevant.length
      ? relevant.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
      : null;
  },

  // Last opened recipient management
  restoreLastOpenedRecipient: (walletAddress: string) => {
    try {
      const lastOpenedRecipient = localStorage.getItem(
        `kasia_last_opened_recipient_${walletAddress}`
      );

      if (lastOpenedRecipient) {
        // Check if the contact still exists in the current contacts list
        const state = g();
        const contactExists = state.contacts.some(
          (contact) => contact.address === lastOpenedRecipient
        );

        if (contactExists) {
          set({ openedRecipient: lastOpenedRecipient });
          g().refreshMessagesOnOpenedRecipient();
        } else {
          // Contact no longer exists, clear the stored value
          localStorage.removeItem(
            `kasia_last_opened_recipient_${walletAddress}`
          );

          // Fallback: select the first available contact
          if (state.contacts.length > 0) {
            const firstContact = state.contacts[0];
            set({ openedRecipient: firstContact.address });
            g().refreshMessagesOnOpenedRecipient();
          }
        }
      } else {
        // Fallback: select the first available contact if we have contacts
        const state = g();
        if (state.contacts.length > 0) {
          const firstContact = state.contacts[0];
          set({ openedRecipient: firstContact.address });
          g().refreshMessagesOnOpenedRecipient();
        }
      }
    } catch (error) {
      console.error("Error restoring last opened recipient:", error);
    }
  },
}));
