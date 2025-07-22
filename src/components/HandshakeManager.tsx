import React from "react";
import { useMessagingStore } from "../store/messaging.store";
import "./HandshakeManager.css";
import { HandshakeState } from "../types/messaging.types";
import { PendingConversation } from "../store/repository/conversation.repository";
import { Contact } from "../store/repository/contact.repository";

const HandshakeManager: React.FC = () => {
  const messagingStore = useMessagingStore();
  const pendingConversationsWithContact =
    messagingStore.getPendingConversationsWithContact();

  const handleAcceptHandshake = async ({
    contact,
    conversation,
  }: {
    conversation: PendingConversation;
    contact: Contact;
  }) => {
    try {
      if (!contact.kaspaAddress) {
        throw new Error("Invalid conversation: missing kaspaAddress");
      }

      // Convert Conversation to HandshakeState
      const handshakeState: HandshakeState = {
        conversationId: conversation.id,
        myAlias: conversation.myAlias || "Anonymous",
        theirAlias: conversation.theirAlias || null,
        senderAddress: contact.kaspaAddress,
        kaspaAddress: contact.kaspaAddress,
        status: conversation.status,
        lastActivity: conversation.lastActivityAt.getTime(),
        initiatedByMe: conversation.initiatedByMe,
        createdAt: Date.now(),
      };

      await messagingStore.respondToHandshake(handshakeState);
    } catch (error) {
      console.error("Error accepting handshake:", error);
    }
  };

  if (pendingConversationsWithContact.length === 0) {
    return null;
  }

  return (
    <div className="handshake-manager">
      <h3>Pending Handshakes</h3>
      <div className="handshake-list">
        {pendingConversationsWithContact.map(({ conversation, contact }) => (
          <div key={contact.kaspaAddress} className="handshake-item">
            <div className="handshake-info">
              <p className="address">From: {contact.kaspaAddress}</p>
              {conversation.theirAlias && (
                <p className="alias">Their Alias: {conversation.theirAlias}</p>
              )}
              <p className="status">Status: {conversation.status}</p>
            </div>
            {!conversation.initiatedByMe && (
              <button
                onClick={() => handleAcceptHandshake({ contact, conversation })}
                className="accept-button"
              >
                Accept & Send Response
              </button>
            )}
            {conversation.initiatedByMe && (
              <p className="waiting-text">Waiting for their response...</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HandshakeManager;
