import React, { useState } from 'react';
import { useMessagingStore } from '../store/messaging.store';
import { useWalletStore } from '../store/wallet.store';
import styles from './NewChatForm.module.css';

interface NewChatFormProps {
  onClose: () => void;
}

export const NewChatForm: React.FC<NewChatFormProps> = ({ onClose }) => {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!walletStore.unlockedWallet?.password) {
        throw new Error("Please unlock your wallet first");
      }

      // Validate address format
      if (!recipientAddress.startsWith('kaspa:') && !recipientAddress.startsWith('kaspatest:')) {
        throw new Error("Invalid Kaspa address format. Must start with 'kaspa:' or 'kaspatest:'");
      }

      // Check if we already have an active conversation
      const existingConversations = messageStore.getActiveConversations();
      const existingConv = existingConversations.find(conv => conv.kaspaAddress === recipientAddress);
      if (existingConv) {
        throw new Error("You already have an active conversation with this address");
      }

      // Initiate handshake
      const { payload, conversation } = await messageStore.initiateHandshake(recipientAddress);

      // Create transaction with handshake payload
      // You'll need to implement the actual transaction creation here
      // This might involve using your existing transaction creation methods

      // Close the form
      onClose();
    } catch (error) {
      console.error('Failed to create new chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to create new chat');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles['new-chat-form']}>
      <h3 className={styles.title}>Start New Conversation</h3>
      <form onSubmit={handleSubmit}>
        <div className={styles['form-group']}>
          <label className={styles.label} htmlFor="recipientAddress">
            Recipient Address (kaspa: or kaspatest:)
          </label>
          <input
            className={styles.input}
            type="text"
            id="recipientAddress"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="kaspa:... or kaspatest:..."
            disabled={isLoading}
            required
          />
        </div>
        {error && (
          <div className={styles['error-message']}>
            {error}
          </div>
        )}
        <div className={styles['form-actions']}>
          <button
            type="button"
            className={styles['cancel-button']}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles['submit-button']}
            disabled={isLoading}
          >
            {isLoading ? 'Initiating...' : 'Start Chat'}
          </button>
        </div>
      </form>
    </div>
  );
}; 