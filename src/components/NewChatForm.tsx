import React, { useState, useCallback, useEffect } from 'react';
import { useMessagingStore } from '../store/messaging.store';
import { useWalletStore } from '../store/wallet.store';
import { kaspaToSompi, sompiToKaspaString } from 'kaspa-wasm';
import styles from './NewChatForm.module.css';

interface NewChatFormProps {
  onClose: () => void;
}

export const NewChatForm: React.FC<NewChatFormProps> = ({ onClose }) => {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [handshakeAmount, setHandshakeAmount] = useState('0.2');
  const [error, setError] = useState<string | null>(null);
  const [recipientWarning, setRecipientWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const balance = useWalletStore((state) => state.balance);

  // Handle clicking outside to close
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const checkRecipientBalance = useCallback(async (address: string) => {
    if (!address || (!address.startsWith('kaspa:') && !address.startsWith('kaspatest:'))) {
      setRecipientWarning(null);
      return;
    }

    setIsCheckingRecipient(true);
    setRecipientWarning(null);

    try {
      // Use the Kaspa API to check recipient balance
      const networkId = walletStore.accountService?.networkId || 'mainnet';
      const baseUrl = networkId === "mainnet" 
        ? "https://api.kaspa.org" 
        : "https://api-tn10.kaspa.org";
      
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(`${baseUrl}/addresses/${encodedAddress}/balance`);
      
      if (!response.ok) {
        setRecipientWarning('Could not verify recipient balance. They may not be able to respond if they have no KAS.');
        return;
      }

      const balanceData = await response.json();
      const balance = BigInt(balanceData.balance || 0);
      
      if (balance === BigInt(0)) {
        setRecipientWarning('⚠️ Warning: Recipient has zero KAS balance and will not be able to respond to your handshake. Consider sending a higher amount.');
      } else {
        setRecipientWarning(null);
      }
    } catch (error) {
      console.warn('Could not check recipient balance:', error);
      setRecipientWarning('Could not verify recipient balance. They may not be able to respond if they have no KAS.');
    } finally {
      setIsCheckingRecipient(false);
    }
  }, [walletStore.accountService]);

  // Debounced recipient balance check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (recipientAddress) {
        checkRecipientBalance(recipientAddress);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [recipientAddress, checkRecipientBalance]);

  const handleAmountChange = useCallback((value: string) => {
    // Allow decimal numbers
    if (/^\d*\.?\d*$/.test(value)) {
      setHandshakeAmount(value);
    }
  }, []);

  const handleQuickAmount = useCallback((amount: string) => {
    setHandshakeAmount(amount);
  }, []);

  const validateAndPrepareHandshake = useCallback(() => {
    setError(null);

    if (!walletStore.unlockedWallet?.password) {
      setError("Please unlock your wallet first");
      return false;
    }

    // Validate address format
    if (!recipientAddress.startsWith('kaspa:') && !recipientAddress.startsWith('kaspatest:')) {
      setError("Invalid Kaspa address format. Must start with 'kaspa:' or 'kaspatest:'");
      return false;
    }

    // Check if we already have an active conversation
    const existingConversations = messageStore.getActiveConversations();
    const existingConv = existingConversations.find(conv => conv.kaspaAddress === recipientAddress);
    if (existingConv) {
      setError("You already have an active conversation with this address");
      return false;
    }

    // Validate amount
    const amountSompi = kaspaToSompi(handshakeAmount);
    if (!amountSompi) {
      setError("Invalid handshake amount");
      return false;
    }

    // Check minimum amount
    const minAmount = kaspaToSompi("0.2");
    if (amountSompi < minAmount!) {
      setError("Handshake amount must be at least 0.2 KAS");
      return false;
    }

    // Check balance
    if (!balance?.mature || balance.mature < amountSompi) {
      setError(`Insufficient balance. Need ${handshakeAmount} KAS, have ${balance?.matureDisplay || "0"} KAS`);
      return false;
    }

    return true;
  }, [recipientAddress, handshakeAmount, balance, messageStore, walletStore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAndPrepareHandshake()) {
      return;
    }

    setShowConfirmation(true);
  };

  const confirmHandshake = async () => {
    setError(null);
    setIsLoading(true);
    setShowConfirmation(false);

    try {
      const amountSompi = kaspaToSompi(handshakeAmount);
      
      // Initiate handshake with custom amount
      await messageStore.initiateHandshake(recipientAddress, amountSompi);

      // Close the form
      onClose();
    } catch (error) {
      console.error('Failed to create new chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to create new chat');
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className={styles['new-chat-form']} onClick={(e) => e.stopPropagation()}>
          <h3 className={styles.title}>Confirm Handshake</h3>
          <div className={styles['confirmation-details']}>
            <p><strong>Recipient:</strong> {recipientAddress}</p>
            <p><strong>Amount:</strong> {handshakeAmount} KAS</p>
            <p><strong>Your Balance:</strong> {balance?.matureDisplay || "0"} KAS</p>
            {parseFloat(handshakeAmount) > 0.2 && (
              <p className={styles['info-text']}>
                The extra amount ({(parseFloat(handshakeAmount) - 0.2).toFixed(8)} KAS) helps the recipient respond even if they have no KAS.
              </p>
            )}
            {/* Only show warning if user is NOT sending extra amount */}
            {recipientWarning && parseFloat(handshakeAmount) <= 0.2 && (
              <p className={styles['warning-text']}>
                {recipientWarning}
              </p>
            )}
            <p>This will initiate a handshake conversation. Continue?</p>
          </div>
          <div className={styles['form-actions']}>
            <button
              type="button"
              className={styles['cancel-button']}
              onClick={() => setShowConfirmation(false)}
              disabled={isLoading}
            >
              Back
            </button>
            <button
              type="button"
              className={styles['submit-button']}
              onClick={confirmHandshake}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Confirm & Send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={styles['new-chat-form']} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Start New Conversation</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles['form-group']}>
            <label className={styles.label} htmlFor="recipientAddress">
              Recipient Address
            </label>
            <input
              className={styles.input}
              type="text"
              id="recipientAddress"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="kaspa:..."
              disabled={isLoading}
              required
            />
            {isCheckingRecipient && (
              <div className={styles['checking-text']}>
                Checking recipient balance...
              </div>
            )}
            {recipientWarning && (
              <div className={styles['warning-message']}>
                {recipientWarning}
              </div>
            )}
          </div>

          <div className={styles['form-group']}>
            <label className={styles.label} htmlFor="handshakeAmount">
              Handshake Amount (KAS)
            </label>
            <input
              className={styles['amount-input']}
              type="text"
              id="handshakeAmount"
              value={handshakeAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.2"
              disabled={isLoading}
            />
            <div className={styles['amount-buttons']}>
              <button
                type="button"
                className={`${styles['amount-button']} ${handshakeAmount === '0.2' ? styles['active'] : ''}`}
                onClick={() => handleQuickAmount('0.2')}
                disabled={isLoading}
              >
                0.2
              </button>
              <button
                type="button"
                className={`${styles['amount-button']} ${handshakeAmount === '0.5' ? styles['active'] : ''}`}
                onClick={() => handleQuickAmount('0.5')}
                disabled={isLoading}
              >
                0.5
              </button>
              <button
                type="button"
                className={`${styles['amount-button']} ${handshakeAmount === '1' ? styles['active'] : ''}`}
                onClick={() => handleQuickAmount('1')}
                disabled={isLoading}
              >
                1
              </button>
            </div>
            <div className={styles['info-text']}>
              Default: 0.2 KAS. Higher amounts help recipients respond even if they have no KAS.
              This creates a better experience for newcomers to Kasia.
            </div>
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
    </div>
  );
}; 