import React, { useState } from "react";
import { useMessagingStore } from "../store/messaging.store";
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
    <div className="my-2 rounded-lg border border-[var(--border-color)] bg-[var(--primary-bg)] p-4">
      <div className="flex">
        <div className="mb-3 flex-1">
          <p className="my-1 font-semibold text-[var(--text-secondary)]">
            Handshake received from:
          </p>
          <p className="my-1 ml-2 break-all text-[var(--text-primary)]">
            {conversation.kaspaAddress}
          </p>
          <p className="my-1 font-semibold text-[var(--text-secondary)]">
            Their alias:
          </p>
          <p className="my-1 ml-2 text-[var(--text-primary)]">
            {conversation.theirAlias}
          </p>
          <p className="my-1 font-semibold text-[var(--text-secondary)]">
            Status:
          </p>
          <p className="my-1 ml-2 text-[var(--text-primary)]">
            {conversation.status}
          </p>
          {error && <p className="mt-2 text-red-500">{error}</p>}
        </div>
        <div className="ml-2 flex flex-col items-center justify-center">
          <img
            src="/kasia-logo.png"
            alt="Kasia Logo"
            className="h-32 w-32 object-contain opacity-60"
          />
        </div>
      </div>
      {!conversation.initiatedByMe && conversation.status === "pending" && (
        <button
          onClick={handleRespond}
          className="bg-kas-primary hover:bg-kas-secondary cursor-pointer rounded border-none px-4 py-2 text-sm text-white transition-colors duration-200 disabled:cursor-not-allowed disabled:bg-gray-500"
          disabled={isResponding}
        >
          {isResponding ? "Sending Response..." : "Accept & Send Response"}
        </button>
      )}
    </div>
  );
};
