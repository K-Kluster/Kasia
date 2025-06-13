import React, { useState } from 'react';
import { useMessagingStore } from '../store/messaging.store';
import { Address } from 'kaspa-wasm';
import { Conversation } from 'src/utils/conversation-manager';

export const NewChatForm: React.FC = () => {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagingStore = useMessagingStore();

  // Get pending handshakes
  const pendingHandshakes = messagingStore.getPendingConversations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate address
      new Address(recipientAddress);
      
      // Initiate handshake
      await messagingStore.initiateHandshake(recipientAddress);
      
      // Clear form
      setRecipientAddress('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRespondToHandshake = async (handshake: Conversation) => {
    try {
      await messagingStore.respondToHandshake(handshake);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="new-chat-container">
      <form onSubmit={handleSubmit} className="new-chat-form">
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Enter Kaspa address"
          className="address-input"
        />
        <button type="submit" className="submit-button">
          Start New Chat
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {/* Pending Handshakes Section */}
      {pendingHandshakes.length > 0 && (
        <div className="pending-handshakes">
          <h3>Pending Handshakes</h3>
          {pendingHandshakes.map(handshake => (
            <div key={handshake.conversationId} className="handshake-item">
              <span>From: {handshake.kaspaAddress}</span>
              {!handshake.initiatedByMe && (
                <button 
                  onClick={() => handleRespondToHandshake(handshake)}
                  className="respond-button"
                >
                  Accept & Respond
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 