import { useMessagingStore } from "../store/messaging.store";

export function inspectConversations() {
  const messagingStore = useMessagingStore.getState();
  const activeConversations = messagingStore.getActiveConversations();
  const pendingConversations = messagingStore.getPendingConversations();

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
(window as any).inspectConversations = inspectConversations;
