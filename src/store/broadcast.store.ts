import { create } from "zustand";
import { TransactionStatus } from "../types/all";
import { useDBStore } from "./db.store";
import { BroadcastChannel } from "./repository/broadcast-channel.repository";
import { v4 } from "uuid";
import { useFeatureFlagsStore, FeatureFlags } from "./featureflag.store";
import { validateAndNormalizeChannelName } from "../utils/channel-validator";

export type BroadcastMessage = {
  id: string;
  channelName: string;
  senderAddress: string;
  content: string;
  timestamp: Date;
  transactionId: string | null;
  status: TransactionStatus;
};

// Add normalization utility at the top level
const normalizeChannel = (s: string | null) =>
  s ? s.trim().toLowerCase() : null;

interface BroadcastState {
  channels: BroadcastChannel[];
  loadChannels: () => Promise<void>;
  addChannel: (channelName: string, channelValue: string) => Promise<void>;
  deleteChannel: (channelName: string) => Promise<void>;

  messages: BroadcastMessage[];
  messageById: Map<string, BroadcastMessage>;
  messageByTxId: Map<string, BroadcastMessage>;
  addMessage: (
    message: Omit<BroadcastMessage, "id"> | BroadcastMessage
  ) => void;
  addPendingMessage: (
    message: Omit<BroadcastMessage, "id" | "status" | "transactionId">
  ) => string;
  updateMessageStatus: (
    messageId: string,
    status: "confirmed" | "failed",
    transactionId?: string
  ) => void;
  findMessageByTxId: (transactionId: string) => BroadcastMessage | undefined;

  clearAllMessages: () => void;
  clearChannelMessages: (channelName: string) => void;
  reset: () => void;

  selectedChannelName: string | null;
  setSelectedChannel: (channelName: string | null) => void;

  isBroadcastMode: boolean;
  setIsBroadcastMode: (enabled: boolean) => void;

  selectedParticipant: {
    address: string;
    nickname?: string;
  } | null;
  setSelectedParticipant: (
    participant: { address: string; nickname?: string } | null
  ) => void;

  shouldProcessBroadcasts: () => boolean;
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  channels: [],

  messages: [],
  messageById: new Map(),
  messageByTxId: new Map(),

  loadChannels: async () => {
    try {
      const repositories = useDBStore.getState().repositories;
      const channels =
        await repositories.broadcastChannelRepository.getBroadcastChannels();
      set({ channels });
    } catch (error) {
      console.error("Failed to load broadcast channels:", error);
      set({ channels: [] });
    }
  },

  addChannel: async (channelName: string, channelValue: string) => {
    try {
      const repositories = useDBStore.getState().repositories;

      const normalizedName = validateAndNormalizeChannelName(channelName);

      // check if channel already exists
      const existingChannel = get().channels.find(
        (channel) => channel.channelName === normalizedName
      );

      if (existingChannel) {
        throw new Error(`Channel "${channelName}" is already added`);
      }

      const newChannel: Omit<BroadcastChannel, "tenantId"> = {
        id: v4(),
        channelName: normalizedName,
        channelValue,
        timestamp: new Date(),
      };

      await repositories.broadcastChannelRepository.saveBroadcastChannel(
        newChannel
      );
      await get().loadChannels();
    } catch (error) {
      console.error("Failed to add broadcast channel:", error);
      throw error;
    }
  },

  deleteChannel: async (channelName: string) => {
    try {
      const repositories = useDBStore.getState().repositories;
      const normalizedName = validateAndNormalizeChannelName(channelName);

      await repositories.broadcastChannelRepository.deleteBroadcastChannelByName(
        normalizedName
      );

      // clear messages for this channel
      get().clearChannelMessages(normalizedName);

      // if this was the selected channel, clear selection
      if (get().selectedChannelName === normalizedName) {
        set({ selectedChannelName: null });
      }

      await get().loadChannels();
    } catch (error) {
      console.error("Failed to delete broadcast channel:", error);
      throw error;
    }
  },

  addMessage: (message: Omit<BroadcastMessage, "id"> | BroadcastMessage) => {
    const hasId = "id" in message;
    const newMessage: BroadcastMessage = hasId
      ? { ...message, channelName: normalizeChannel(message.channelName)! }
      : {
          ...message,
          id: v4(),
          status: "confirmed",
          channelName: normalizeChannel(message.channelName)!,
        };

    const existingMessage = newMessage.transactionId
      ? get().messageByTxId.get(newMessage.transactionId)
      : get().messageById.get(newMessage.id);

    if (!existingMessage) {
      set((state) => {
        const insertIndex = state.messages.findIndex(
          (msg) => msg.timestamp.getTime() > newMessage.timestamp.getTime()
        );
        const newMessages =
          insertIndex === -1
            ? [...state.messages, newMessage]
            : [
                ...state.messages.slice(0, insertIndex),
                newMessage,
                ...state.messages.slice(insertIndex),
              ];

        const newMessageById = new Map(state.messageById);
        const newMessageByTxId = new Map(state.messageByTxId);
        newMessageById.set(newMessage.id, newMessage);
        if (newMessage.transactionId) {
          newMessageByTxId.set(newMessage.transactionId, newMessage);
        }

        return {
          messages: newMessages,
          messageById: newMessageById,
          messageByTxId: newMessageByTxId,
        };
      });
    }
  },

  addPendingMessage: (
    message: Omit<BroadcastMessage, "id" | "status" | "transactionId">
  ) => {
    const tempId = v4();
    const newMessage: BroadcastMessage = {
      ...message,
      id: tempId,
      transactionId: null,
      status: "pending",
      channelName: normalizeChannel(message.channelName)!,
    };

    set((state) => {
      const insertIndex = state.messages.findIndex(
        (msg) => msg.timestamp.getTime() > newMessage.timestamp.getTime()
      );
      const newMessages =
        insertIndex === -1
          ? [...state.messages, newMessage]
          : [
              ...state.messages.slice(0, insertIndex),
              newMessage,
              ...state.messages.slice(insertIndex),
            ];

      const newMessageById = new Map(state.messageById);
      newMessageById.set(newMessage.id, newMessage);

      return {
        messages: newMessages,
        messageById: newMessageById,
      };
    });

    return tempId;
  },

  updateMessageStatus: (
    messageId: string,
    status: "confirmed" | "failed",
    transactionId?: string
  ) => {
    set((state) => {
      const message = state.messageById.get(messageId);
      if (!message) return state;

      const updatedMessage = {
        ...message,
        status,
        ...(transactionId && { transactionId }),
      };

      const messageIndex = state.messages.findIndex(
        (msg) => msg.id === messageId
      );
      if (messageIndex === -1) return state;

      const newMessages = [...state.messages];
      newMessages[messageIndex] = updatedMessage;

      const newMessageById = new Map(state.messageById);
      const newMessageByTxId = new Map(state.messageByTxId);
      newMessageById.set(messageId, updatedMessage);

      if (transactionId) {
        newMessageByTxId.set(transactionId, updatedMessage);
      } else if (message.transactionId) {
        newMessageByTxId.delete(message.transactionId);
      }

      return {
        messages: newMessages,
        messageById: newMessageById,
        messageByTxId: newMessageByTxId,
      };
    });
  },

  // Renamed and updated: now finds by txId regardless of status
  // Note: Pending messages may not have a txId until confirmed, so this often returns undefined for pendings
  findMessageByTxId: (transactionId: string) => {
    const state = get();
    return state.messageByTxId.get(transactionId);
  },

  // unused - but we might use in the future (so remove this comment if you use it!)
  clearAllMessages: () => {
    set({
      messages: [],
      messageById: new Map(),
      messageByTxId: new Map(),
    });
  },

  clearChannelMessages: (channelName: string) => {
    const normalizedChannelName = normalizeChannel(channelName);
    if (!normalizedChannelName) return;

    set((state) => {
      const filteredMessages = state.messages.filter(
        (msg) => msg.channelName !== normalizedChannelName
      );

      const newMessageById = new Map();
      const newMessageByTxId = new Map();

      filteredMessages.forEach((msg) => {
        newMessageById.set(msg.id, msg);
        if (msg.transactionId) {
          newMessageByTxId.set(msg.transactionId, msg);
        }
      });

      return {
        messages: filteredMessages,
        messageById: newMessageById,
        messageByTxId: newMessageByTxId,
      };
    });
  },

  reset: () => {
    set({
      channels: [],
      messages: [],
      messageById: new Map(),
      messageByTxId: new Map(),
      selectedChannelName: null,
      isBroadcastMode: false,
      selectedParticipant: null,
    });
  },

  // UI state
  selectedChannelName: null,
  setSelectedChannel: (channelName: string | null) => {
    set({ selectedChannelName: normalizeChannel(channelName) });
  },

  // Broadcast mode state
  isBroadcastMode: false,
  setIsBroadcastMode: (enabled: boolean) => {
    set({ isBroadcastMode: enabled });
  },

  // Participant info state
  selectedParticipant: null,
  setSelectedParticipant: (
    participant: { address: string; nickname?: string } | null
  ) => {
    set({ selectedParticipant: participant });
  },

  shouldProcessBroadcasts: () => {
    const isBroadcastEnabled =
      useFeatureFlagsStore.getState().flags[FeatureFlags.BROADCAST];
    return isBroadcastEnabled && get().channels.length > 0;
  },
}));
