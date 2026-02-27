import { create } from "zustand";
import { useDBStore } from "./db.store";
import { useMessagingStore } from "./messaging.store";
import { BlockedAddress } from "./repository/blocked-address.repository";
import { v4 } from "uuid";

interface BlocklistState {
  blockedAddresses: Set<string>;
  blockedAddressList: BlockedAddress[];
  isLoaded: boolean;

  loadBlockedAddresses: () => Promise<void>;
  blockAddressAndDeleteData: (
    address: string,
    reason?: string
  ) => Promise<void>;
  unblockAddress: (address: string) => Promise<void>;
  isBlocked: (address: string) => boolean;
  reset: () => void;

  // broadcast display settings
  broadcastBlockedDisplayMode: "hide" | "placeholder";
  setBroadcastBlockedDisplayMode: (mode: "hide" | "placeholder") => void;
}

const BROADCAST_DISPLAY_MODE_KEY = "kasia_broadcast_blocked_display_mode";

// get initial display mode from localStorage
const getInitialDisplayMode = (): "hide" | "placeholder" => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(BROADCAST_DISPLAY_MODE_KEY);
    if (saved === "hide" || saved === "placeholder") {
      return saved;
    }
  }
  return "placeholder"; // default to placeholder
};

export const useBlocklistStore = create<BlocklistState>((set, get) => ({
  blockedAddresses: new Set<string>(),
  blockedAddressList: [],
  isLoaded: false,

  loadBlockedAddresses: async () => {
    try {
      const repositories = useDBStore.getState().repositories;
      if (!repositories) {
        console.warn(
          "Repositories not initialized, cannot load blocked addresses"
        );
        return;
      }

      const blockedAddresses =
        await repositories.blockedAddressRepository.getBlockedAddresses();

      const addressSet = new Set(
        blockedAddresses.map((addr) => addr.kaspaAddress)
      );

      set({
        blockedAddresses: addressSet,
        blockedAddressList: blockedAddresses,
        isLoaded: true,
      });
    } catch (error) {
      console.error("Failed to load blocked addresses:", error);
      set({
        blockedAddresses: new Set(),
        blockedAddressList: [],
        isLoaded: true,
      });
    }
  },

  blockAddressAndDeleteData: async (address: string, reason?: string) => {
    try {
      const repositories = useDBStore.getState().repositories;
      if (!repositories) {
        throw new Error("Repositories not initialized");
      }

      // First block the address
      {
        // check if already blocked
        if (get().blockedAddresses.has(address)) {
          console.log(`Address ${address} is already blocked`);
        } else {
          const newBlockedAddress: Omit<BlockedAddress, "tenantId"> = {
            id: v4(),
            kaspaAddress: address,
            timestamp: new Date(),
            reason,
          };

          await repositories.blockedAddressRepository.saveBlockedAddress(
            newBlockedAddress
          );

          // update in-memory state
          set((state) => {
            const newSet = new Set(state.blockedAddresses);
            newSet.add(address);
            return {
              blockedAddresses: newSet,
              blockedAddressList: [
                ...state.blockedAddressList,
                { ...newBlockedAddress, tenantId: repositories.tenantId },
              ],
            };
          });

          console.log(`Blocked address: ${address}`);
        }
      }

      // Try to find a contact with this address
      const contact = await repositories.contactRepository
        .getContactByKaspaAddress(address)
        .catch(() => null);

      if (contact) {
        // Delete all messages, conversation, and contact data
        await repositories.deleteAllDataForContact(contact.id, {
          deleteConversation: true,
          deleteContact: true,
        });

        // Remove the conversation from in-memory store
        useMessagingStore.setState((state) => ({
          oneOnOneConversations: state.oneOnOneConversations.filter(
            (conversation) => conversation.contact.id !== contact.id
          ),
        }));

        // clear conversation manager's in-memory (non db) state for this address
        const conversationManager =
          useMessagingStore.getState().conversationManager;
        conversationManager?.clearConversationByAddress(address);

        console.log(
          `Blocked address and deleted all data for contact: ${address}`
        );
      } else {
        console.log(`Blocked address (no contact found to delete): ${address}`);
      }
    } catch (error) {
      console.error("Failed to block address and delete data:", error);
      throw error;
    }
  },

  unblockAddress: async (address: string) => {
    try {
      const repositories = useDBStore.getState().repositories;
      if (!repositories) {
        throw new Error("Repositories not initialized");
      }

      await repositories.blockedAddressRepository.deleteBlockedAddress(address);

      // update in-memory state
      set((state) => {
        const newSet = new Set(state.blockedAddresses);
        newSet.delete(address);
        return {
          blockedAddresses: newSet,
          blockedAddressList: state.blockedAddressList.filter(
            (addr) => addr.kaspaAddress !== address
          ),
        };
      });

      console.log(`Unblocked address: ${address}`);
    } catch (error) {
      console.error("Failed to unblock address:", error);
      throw error;
    }
  },

  isBlocked: (address: string) => {
    return get().blockedAddresses.has(address);
  },

  reset: () => {
    set({
      blockedAddresses: new Set(),
      blockedAddressList: [],
      isLoaded: false,
    });
  },

  // broadcast display settings
  broadcastBlockedDisplayMode: getInitialDisplayMode(),

  setBroadcastBlockedDisplayMode: (mode: "hide" | "placeholder") => {
    set({ broadcastBlockedDisplayMode: mode });
    localStorage.setItem(BROADCAST_DISPLAY_MODE_KEY, mode);
  },
}));
