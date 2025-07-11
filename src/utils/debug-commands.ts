import { useMessagingStore } from "../store/messaging.store";

export async function inspectConversations() {
  const messagingStore = useMessagingStore.getState();
  const activeConversations = await messagingStore.getActiveConversations();
  const pendingConversations = await messagingStore.getPendingConversations();

  console.log("=== ACTIVE CONVERSATIONS ===");
  activeConversations.forEach((conv) => {
    console.log({
      status: conv.status,
      address: conv.kaspaAddress,
      myAlias: conv.myAlias,
      theirAlias: conv.theirAlias,
      initiatedByMe: conv.initiatedByMe,
      conversationId: conv.conversationId,
      createdAt: new Date(conv.createdAt).toLocaleString(),
      lastActivity: new Date(conv.lastActivity).toLocaleString(),
    });
  });

  console.log("\n=== PENDING CONVERSATIONS ===");
  pendingConversations.forEach((conv) => {
    console.log({
      status: conv.status,
      address: conv.kaspaAddress,
      myAlias: conv.myAlias,
      theirAlias: conv.theirAlias,
      initiatedByMe: conv.initiatedByMe,
      conversationId: conv.conversationId,
      createdAt: new Date(conv.createdAt).toLocaleString(),
      lastActivity: new Date(conv.lastActivity).toLocaleString(),
    });
  });
}

// Add to window for console access
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).inspectConversations = inspectConversations;
