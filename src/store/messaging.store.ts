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
    return NetworkType.Mainnet;
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
        }
      });
    }

    g().refreshMessagesOnOpenedRecipient();
  },
  flushWalletHistory: (address: string) => {
    // 1. Clear wallet messages from localStorage
    const messagesOnWallet = JSON.parse(
      localStorage.getItem("kaspa_messages_by_wallet") || "{}"
    );

    delete messagesOnWallet[address];

    localStorage.setItem(
      "kaspa_messages_by_wallet",
      JSON.stringify(messagesOnWallet)
    );

    // 2. Clear nickname mappings for this wallet
    const nicknameKey = `contact_nicknames_${address}`;
    localStorage.removeItem(nicknameKey);

    // 3. Clear conversation manager data for this wallet
    const conversationKey = `encrypted_conversations_${address}`;
    localStorage.removeItem(conversationKey);

    // 4. Reset all UI state immediately
    set({
      contacts: [],
      messages: [],
      messagesOnOpenedRecipient: [],
      handshakes: [],
      openedRecipient: null,
      isCreatingNewChat: false,
    });

    // 5. Clear and reinitialize conversation manager
    const manager = g().conversationManager;
    if (manager) {
      // Reinitialize fresh conversation manager
      g().initializeConversationManager(address);
    }

    console.log("Complete history clear completed - all data wiped");
  },
  loadMessages: (address): Message[] => {
    const messages: Record<string, Message[]> = JSON.parse(
      localStorage.getItem("kaspa_messages_by_wallet") || "{}"
    );

    const contacts = new Map();

    // Process messages and organize by conversation
    messages[address]?.forEach((msg) => {
      // Ensure fileData is properly loaded if it exists
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
      messages: (messages[address] || []).sort(
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

    const messagesMap = JSON.parse(
      localStorage.getItem("kaspa_messages_by_wallet") || "{}"
    );
    if (!messagesMap[walletAddress]) {
      messagesMap[walletAddress] = [];
    }

    // Check if we already have a message with this transaction ID
    const existingMessageIndex = messagesMap[walletAddress].findIndex(
      (m: Message) => m.transactionId === message.transactionId
    );

    if (existingMessageIndex !== -1) {
      // Merge the messages, preferring non-empty values
      const existingMessage = messagesMap[walletAddress][existingMessageIndex];
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
      messagesMap[walletAddress][existingMessageIndex] = mergedMessage;
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
        }
      }
      // Add new message
      messagesMap[walletAddress].push(message);
    }

    localStorage.setItem(
      "kaspa_messages_by_wallet",
      JSON.stringify(messagesMap)
    );

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

    const messages = g().messages.filter((msg) => {
      return (
        msg.senderAddress === openedRecipient ||
        msg.recipientAddress === openedRecipient
      );
    });

    set({ messagesOnOpenedRecipient: messages });
  },
  setIsCreatingNewChat: (isCreatingNewChat) => {
    set({ isCreatingNewChat });
  },
  exportMessages: async (wallet, password) => {
    try {
      console.log("Starting message export process...");

      const messagesMap = JSON.parse(
        localStorage.getItem("kaspa_messages_by_wallet") || "{}"
      );

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
      const existingMessages = JSON.parse(
        localStorage.getItem("kaspa_messages_by_wallet") || "{}"
      );

      const mergedMessages = {
        ...existingMessages,
        ...decryptedData.data,
      };

      // Save merged messages
      localStorage.setItem(
        "kaspa_messages_by_wallet",
        JSON.stringify(mergedMessages)
      );

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
    // Make the store available globally for the account service
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
}));
