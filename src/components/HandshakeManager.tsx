import React from "react";
import { useMessagingStore } from "../store/messaging.store";
import "./HandshakeManager.css";
import { HandshakeState, PendingConversation } from "../types/messaging.types";

const HandshakeManager: React.FC = () => {
  const messagingStore = useMessagingStore();
  const pendingConversations = messagingStore.getPendingConversations();

  const handleAcceptHandshake = async (
    pendingConversation: PendingConversation
  ) => {
    try {
      if (!pendingConversation.kaspaAddress) {
        throw new Error("Invalid conversation: missing kaspaAddress");
      }

      // Convert Conversation to HandshakeState
      const handshakeState: HandshakeState = {
        conversationId: pendingConversation.conversationId,
        myAlias: pendingConversation.myAlias || "Anonymous",
        theirAlias: pendingConversation.theirAlias || null,
        senderAddress: pendingConversation.kaspaAddress,
        kaspaAddress: pendingConversation.kaspaAddress,
        status: pendingConversation.status,
        createdAt: pendingConversation.createdAt,
        lastActivity: pendingConversation.lastActivity,
        initiatedByMe: pendingConversation.initiatedByMe,
      };

      await messagingStore.respondToHandshake(handshakeState);
    } catch (error) {
      console.error("Error accepting handshake:", error);
    }
  };

  if (pendingConversations.length === 0) {
    return null;
  }

  return (
    <div className="handshake-manager">
      <h3>Pending Handshakes</h3>
      <div className="handshake-list">
        {pendingConversations.map((conv) => (
          <div key={conv.kaspaAddress} className="handshake-item">
            <div className="handshake-info">
              <p className="address">From: {conv.kaspaAddress}</p>
              {conv.theirAlias && (
                <p className="alias">Their Alias: {conv.theirAlias}</p>
              )}
              <p className="status">Status: {conv.status}</p>
            </div>
            {!conv.initiatedByMe && (
              <button
                onClick={() => handleAcceptHandshake(conv)}
                className="accept-button"
              >
                Accept & Send Response
              </button>
            )}
            {conv.initiatedByMe && (
              <p className="waiting-text">Waiting for their response...</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HandshakeManager;
