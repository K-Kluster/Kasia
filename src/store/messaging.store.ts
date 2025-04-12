import { create } from "zustand";
import { Contact, Message } from "../type/all";

interface MessagingState {
  isLoaded: boolean;
  isCreatingNewChat: boolean;
  contacts: Contact[];
  messages: Message[];
  messagesOnOpenedRecipient: Message[];
  addMessages: (messages: Message[]) => void;
  flushCache: () => void;
  addContacts: (contacts: Contact[]) => void;
  loadMessages: (address: string) => Message[];
  setIsLoaded: (isLoaded: boolean) => void;
  storeMessage: (message: Message, walletAddress: string) => void;

  openedRecipient: string | null;
  setOpenedRecipient: (contact: string | null) => void;
  refreshMessagesOnOpenedRecipient: () => void;
  setIsCreatingNewChat: (isCreatingNewChat: boolean) => void;
}

export const useMessagingStore = create<MessagingState>((set, g) => ({
  isLoaded: false,
  isCreatingNewChat: false,
  openedRecipient: null,
  contacts: [],
  messages: [],
  messagesOnOpenedRecipient: [],
  addContacts: (contacts) => {
    const fullContacts = [...g().contacts, ...contacts];
    fullContacts.sort(
      (a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp
    );
    set({ contacts: [...g().contacts, ...contacts] });
  },
  addMessages: (messages) => {
    const fullMessages = [...g().messages, ...messages];
    fullMessages.sort((a, b) => b.timestamp - a.timestamp);

    set({ messages: fullMessages });

    g().refreshMessagesOnOpenedRecipient();
  },
  flushCache: () => {
    // @TODO: implement
  },
  loadMessages: (address): Message[] => {
    const messages: Record<string, Message[]> = JSON.parse(
      localStorage.getItem("kaspa_messages_by_wallet") || "{}"
    );

    const contacts = new Map();

    messages[address]?.forEach((msg) => {
      const otherParty =
        msg.senderAddress === address
          ? msg.recipientAddress
          : msg.senderAddress;

      if (!contacts.has(otherParty)) {
        contacts.set(otherParty, {
          address: otherParty,
          lastMessage: msg,
          messages: [],
        });
      }
      contacts.get(otherParty).messages.push(msg);
    });

    set({
      contacts: [...contacts.values()].sort(
        (a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp
      ),
      messages: (messages[address] || []).sort(
        (a: Message, b: Message) => a.timestamp - b.timestamp
      ),
    });
    g().refreshMessagesOnOpenedRecipient();

    return g().messages;
  },
  storeMessage: (message: Message, walletAddress: string) => {
    const messagesMap = JSON.parse(
      localStorage.getItem("kaspa_messages_by_wallet") || "{}"
    );
    if (!messagesMap[walletAddress]) {
      messagesMap[walletAddress] = [];
    }
    messagesMap[walletAddress].push(message);
    localStorage.setItem(
      "kaspa_messages_by_wallet",
      JSON.stringify(messagesMap)
    );
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

    if (isCreatingNewChat) {
      set({ openedRecipient: null, messagesOnOpenedRecipient: [] });
    }
  },
}));
