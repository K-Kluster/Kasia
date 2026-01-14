import { create } from "zustand";
import { Group } from "./repository/group.repository";
import { GroupMessage } from "./repository/group-message.repository";
import {
  GroupManagerService,
  GroupControlPayload,
  GroupEpochPayload,
} from "../service/group-manager-service";
import { UnlockedWallet } from "../types/wallet.type";
import { useDBStore } from "./db.store";
import { useWalletStore } from "./wallet.store";
import { ConversationManagerService } from "../service/conversation-manager-service";

export type GroupWithMessages = {
  group: Group;
  messages: GroupMessage[];
  lastMessage?: GroupMessage;
  unreadCount: number;
};

interface GroupState {
  isLoaded: boolean;
  groups: Group[];
  groupMessages: Map<string, GroupMessage[]>;
  groupManager: GroupManagerService | null;

  // ui state
  selectedGroupId: string | null;

  selectedGroupParticipant: {
    address: string;
    nickname?: string;
    isAdmin?: boolean;
  } | null;
  setSelectedGroupParticipant: (
    participant: {
      address: string;
      nickname?: string;
      isAdmin?: boolean;
    } | null
  ) => void;

  // actions
  load: (
    address: string,
    unlockedWallet: UnlockedWallet,
    conversationManager: ConversationManagerService
  ) => Promise<void>;
  stop: () => void;

  // group management
  createGroup: (
    name: string,
    initialMemberAddresses: string[]
  ) => Promise<string>;
  addMember: (groupId: string, memberAddress: string) => Promise<void>;
  removeMember: (groupId: string, memberAddress: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  rotateRoot: (groupId: string) => Promise<void>;
  redistributeRoot: (groupId: string) => Promise<{
    success: string[];
    failed: { address: string; error: string }[];
  }>;

  // messaging
  sendGroupMessage: (
    groupId: string,
    message: string,
    attachment?: {
      type: string;
      name: string;
      mimeType: string;
      content: string;
      size: number;
    }
  ) => Promise<string>;
  processReceivedGroupMessage: (groupMessage: GroupMessage) => void;
  processRootDistribution: (
    payload: GroupControlPayload,
    senderAddress: string
  ) => Promise<void>;
  processEpochChange: (
    payload: GroupEpochPayload,
    senderAddress: string
  ) => Promise<void>;

  // ui helpers
  setSelectedGroup: (groupId: string | null) => void;
  getGroupWithMessages: (groupId: string) => GroupWithMessages | null;
  getAllGroupsWithMessages: () => GroupWithMessages[];
  markGroupAsRead: (groupId: string) => void;

  // hydration
  hydrateGroups: () => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  isLoaded: false,
  groups: [],
  groupMessages: new Map(),
  groupManager: null,
  selectedGroupId: null,
  selectedGroupParticipant: null,

  load: async (
    address: string,
    unlockedWallet: UnlockedWallet,
    conversationManager: ConversationManagerService
  ) => {
    try {
      const repositories = useDBStore.getState().repositories;

      // create group manager
      const groupManager = new GroupManagerService(
        repositories,
        address,
        unlockedWallet,
        conversationManager
      );

      set({
        groupManager,
        isLoaded: true,
      });

      // load existing groups
      await get().hydrateGroups();
    } catch (error) {
      console.error("Failed to load group store:", error);
      set({ isLoaded: false });
    }
  },

  stop: () => {
    set({
      isLoaded: false,
      groups: [],
      groupMessages: new Map(),
      groupManager: null,
      selectedGroupId: null,
      selectedGroupParticipant: null,
    });
  },

  createGroup: async (name: string, initialMemberAddresses: string[]) => {
    const { groupManager } = get();
    if (!groupManager) {
      throw new Error("Group manager not initialized");
    }

    const { groupId } = await groupManager.createGroup(
      name,
      initialMemberAddresses
    );

    // refresh groups
    await get().hydrateGroups();

    return groupId;
  },

  addMember: async (groupId: string, memberAddress: string) => {
    const { groupManager } = get();
    if (!groupManager) {
      throw new Error("Group manager not initialized");
    }

    await groupManager.addMember(groupId, memberAddress);

    // refresh groups
    await get().hydrateGroups();
  },

  removeMember: async (groupId: string, memberAddress: string) => {
    const { groupManager } = get();
    if (!groupManager) {
      throw new Error("Group manager not initialized");
    }

    await groupManager.removeMember(groupId, memberAddress);

    // refresh groups
    await get().hydrateGroups();
  },

  leaveGroup: async (groupId: string) => {
    const { groupManager } = get();
    if (!groupManager) {
      throw new Error("Group manager not initialized");
    }

    await groupManager.leaveGroup(groupId);

    // refresh groups
    await get().hydrateGroups();
  },

  rotateRoot: async (groupId: string) => {
    const { groupManager } = get();
    if (!groupManager) {
      throw new Error("Group manager not initialized");
    }

    await groupManager.rotateRoot(groupId);

    // refresh groups
    await get().hydrateGroups();
  },

  redistributeRoot: async (groupId: string) => {
    const { groupManager } = get();
    if (!groupManager) {
      throw new Error("Group manager not initialized");
    }

    const result = await groupManager.distributeRootToAllMembers(groupId);
    return result;
  },

  sendGroupMessage: async (
    groupId: string,
    message: string,
    attachment?: {
      type: string;
      name: string;
      mimeType: string;
      content: string;
      size: number;
    }
  ) => {
    const { groupManager, groups } = get();
    if (!groupManager) {
      throw new Error("Group manager not initialized");
    }

    const group = groups.find((g) => g.id === groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // send via account service
    const walletStore = useWalletStore.getState();
    if (!walletStore.accountService) {
      throw new Error("Account service not available");
    }

    // get next msg_counter for deterministic msg_id
    const { counter, deviceId } = await groupManager.getNextMsgCounter(groupId);

    const txId = await walletStore.accountService.sendGroupMessage({
      groupId,
      groupRootEpoch: group.groupRootEpoch,
      blindingKey: group.blindingKey,
      epoch: group.currentEpoch,
      deviceId,
      msgCounter: counter,
      message,
      attachment,
      priorityFee: undefined,
    });

    // store the message locally for immediate UI feedback
    const repositories = useDBStore.getState().repositories;
    const senderAddressString =
      walletStore.address?.toString() ||
      walletStore.unlockedWallet?.receivePublicKey
        .toAddress(walletStore.selectedNetwork)
        .toString() ||
      "";

    // Store the appropriate content (attachment file data JSON if present, otherwise text message)
    // Use attachment.content (the fileMessage) just like direct messages do
    const contentToStore = attachment ? attachment.content : message;

    const groupMessage: GroupMessage = {
      id: `${repositories.tenantId}_${txId}`,
      tenantId: repositories.tenantId,
      groupId,
      senderAddress: senderAddressString,
      epoch: group.currentEpoch,
      messageId: "", // will be filled when confirmed
      transactionId: txId,
      createdAt: new Date(),
      content: contentToStore,
      isFromMe: true,
    };

    get().processReceivedGroupMessage(groupMessage);

    return txId;
  },

  processReceivedGroupMessage: (groupMessage: GroupMessage) => {
    const { groupMessages } = get();

    // add to group messages (avoid duplicates)
    const existingMessages = groupMessages.get(groupMessage.groupId) || [];

    // check if message already exists by id
    if (existingMessages.some((m) => m.id === groupMessage.id)) {
      return; // already have this message
    }

    const updatedMessages = [...existingMessages, groupMessage].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    groupMessages.set(groupMessage.groupId, updatedMessages);

    set({ groupMessages: new Map(groupMessages) });
  },

  processRootDistribution: async (
    payload: GroupControlPayload,
    senderAddress: string
  ) => {
    const { groupManager } = get();
    if (!groupManager) {
      console.error("Group manager not initialized for root distribution");
      return;
    }

    try {
      await groupManager.processRootDistribution(payload, senderAddress);

      // refresh groups to reflect updated root secrets
      await get().hydrateGroups();
    } catch (error) {
      console.error("Error processing root distribution:", error);
    }
  },

  processEpochChange: async (
    payload: GroupEpochPayload,
    senderAddress: string
  ) => {
    const { groupManager } = get();
    if (!groupManager) {
      console.error("Group manager not initialized for epoch change");
      return;
    }

    try {
      await groupManager.processEpochChange(payload, senderAddress);

      // refresh groups to reflect updated epoch and root secrets
      await get().hydrateGroups();
    } catch (error) {
      console.error("Error processing epoch change:", error);
    }
  },

  setSelectedGroup: (groupId: string | null) => {
    set({ selectedGroupId: groupId });
  },

  setSelectedGroupParticipant: (
    participant: {
      address: string;
      nickname?: string;
      isAdmin?: boolean;
    } | null
  ) => {
    set({ selectedGroupParticipant: participant });
  },

  getGroupWithMessages: (groupId: string): GroupWithMessages | null => {
    const { groups, groupMessages } = get();

    const group = groups.find((g) => g.id === groupId);
    if (!group) return null;

    const messages = groupMessages.get(groupId) || [];
    const lastMessage = messages[messages.length - 1];
    const unreadCount = messages.filter((m) => !m.isFromMe).length; // simple unread logic

    return {
      group,
      messages,
      lastMessage,
      unreadCount,
    };
  },

  getAllGroupsWithMessages: (): GroupWithMessages[] => {
    const { groups } = get();

    return groups
      .map((group) => get().getGroupWithMessages(group.id))
      .filter((gwm): gwm is GroupWithMessages => gwm !== null)
      .sort((a, b) => {
        // sort by last activity
        const aTime =
          a.lastMessage?.createdAt.getTime() ||
          a.group.lastActivityAt.getTime();
        const bTime =
          b.lastMessage?.createdAt.getTime() ||
          b.group.lastActivityAt.getTime();
        return bTime - aTime;
      });
  },

  markGroupAsRead: (groupId: string) => {
    // implement read status tracking if needed
    console.log(`Marked group ${groupId} as read`);
  },

  hydrateGroups: async () => {
    try {
      const repositories = useDBStore.getState().repositories;

      // load groups
      const groups = await repositories.groupRepository.getActiveGroups();

      // load messages for each group
      const groupMessages = new Map<string, GroupMessage[]>();

      for (const group of groups) {
        const messages =
          await repositories.groupMessageRepository.getGroupMessages(group.id);
        groupMessages.set(group.id, messages);
      }

      set({
        groups,
        groupMessages,
      });
    } catch (error) {
      console.error("Error hydrating groups:", error);
    }
  },
}));
