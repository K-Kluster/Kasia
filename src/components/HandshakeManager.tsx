import React from 'react';
import { useMessagingStore } from '../store/messaging.store';
import { useWalletStore } from '../store/wallet.store';
import { Address } from 'kaspa-wasm';
import './HandshakeManager.css';
import { HandshakeState } from '../types/messaging.types';
import { Conversation } from '../utils/conversation-manager';

const HandshakeManager: React.FC = () => {
  const messagingStore = useMessagingStore();
  const walletStore = useWalletStore();
  const pendingConversations = messagingStore.getPendingConversations();

  const handleAcceptHandshake = async (conversation: Conversation) => {
    try {
      if (!conversation.kaspaAddress) {
        throw new Error('Invalid conversation: missing kaspaAddress');
      }

      // Convert Conversation to HandshakeState
      const handshakeState: HandshakeState = {
        conversationId: conversation.conversationId,
        myAlias: conversation.myAlias || 'Anonymous',
        theirAlias: conversation.theirAlias || null,
        senderAddress: conversation.kaspaAddress,
        kaspaAddress: conversation.kaspaAddress,
        status: conversation.status,
        createdAt: conversation.createdAt,
        lastActivity: conversation.lastActivity,
        initiatedByMe: conversation.initiatedByMe,
        handshakeTimeout: conversation.handshakeTimeout
      };

      await messagingStore.respondToHandshake(handshakeState);
    } catch (error) {
      console.error('Error accepting handshake:', error);
    }
  };

  if (pendingConversations.length === 0) {
    return null;
  }

  return (
    <div className="handshake-manager">
      <h3>Pending Handshakes</h3>
      <div className="handshake-list">
        {pendingConversations.map(conv => (
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