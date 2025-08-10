import React, { useState } from "react";
import { useMessagingStore } from "../store/messaging.store";
import {
  PendingConversation,
  RejectedConversation,
} from "../store/repository/conversation.repository";
import { Contact } from "../store/repository/contact.repository";

export const HandshakeResponse: React.FC<{
  conversation: PendingConversation | RejectedConversation;
  contact: Contact;
  handshakeId: string;
}> = ({ conversation, contact, handshakeId }) => {
  const messagingStore = useMessagingStore();
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRespond = async () => {
    try {
      setIsResponding(true);
      setError(null);
      await messagingStore.respondToHandshake(handshakeId);
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
            {contact.kaspaAddress}
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
          {error && <p className="mt-2 text-[var(--accent-red)]">{error}</p>}
        </div>
        <div className="ml-2 flex flex-col items-center justify-center select-none">
          <img
            src="/kasia-logo.png"
            alt="Kasia Logo"
            className="h-32 w-32 object-contain opacity-60"
          />
        </div>
      </div>
      {!conversation.initiatedByMe && conversation.status === "pending" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRespond();
          }}
          className="cursor-pointer rounded border-none bg-[var(--button-primary)] px-4 py-2 text-sm text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--button-primary)]/80 disabled:cursor-not-allowed disabled:bg-gray-500"
          disabled={isResponding}
        >
          {isResponding ? "Sending Response..." : "Accept & Send Response"}
        </button>
      )}
    </div>
  );
};
