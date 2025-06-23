import React, { useState } from "react";
import { useMessagingStore } from "../store/messaging.store";
import "../styles/HandshakeResponse.css";
import {
  PendingConversation,
  RejectedConversation,
} from "src/types/messaging.types";

export const HandshakeResponse: React.FC<{
  conversation: PendingConversation | RejectedConversation;
}> = ({ conversation }) => {
  const messagingStore = useMessagingStore();
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRespond = async () => {
    try {
      setIsResponding(true);
      setError(null);
      await messagingStore.respondToHandshake({
        conversationId: conversation.conversationId,
        myAlias: conversation.myAlias,
        theirAlias: conversation.theirAlias,
        kaspaAddress: conversation.kaspaAddress,
        status:
          conversation.status === "rejected" ? "pending" : conversation.status,
        createdAt: conversation.createdAt,
        lastActivity: conversation.lastActivity,
        initiatedByMe: conversation.initiatedByMe,
      });
    } catch (error) {
      console.error("Error responding to handshake:", error);
      setError(
        error instanceof Error ? error.message : "Failed to send response"
      );
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <div className="handshake-response">
      <div className="handshake-info">
        <p>Handshake received from: {conversation.kaspaAddress}</p>
        <p>Their alias: {conversation.theirAlias}</p>
        <p>Status: {conversation.status}</p>
        {error && <p className="error">{error}</p>}
      </div>
      {!conversation.initiatedByMe && conversation.status === "pending" && (
        <button
          onClick={handleRespond}
          className="respond-button"
          disabled={isResponding}
        >
          {isResponding ? "Sending Response..." : "Accept & Send Response"}
        </button>
      )}
    </div>
  );
};
