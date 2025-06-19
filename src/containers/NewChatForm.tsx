import React, { useState, useCallback } from "react";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { Address, kaspaToSompi, sompiToKaspaString } from "kaspa-wasm";
import { Conversation } from "src/types/messaging.types";

export const NewChatForm: React.FC = () => {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [handshakeAmount, setHandshakeAmount] = useState("0.2");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const messagingStore = useMessagingStore();
  const balance = useWalletStore((state) => state.balance);

  // Get pending handshakes
  const pendingHandshakes = messagingStore.getPendingConversations();

  const handleAmountChange = useCallback((value: string) => {
    // Allow decimal numbers
    if (/^\d*\.?\d*$/.test(value)) {
      setHandshakeAmount(value);
    }
  }, []);

  const handleMaxClick = useCallback(() => {
    if (balance?.mature) {
      const maxAmount = sompiToKaspaString(balance.mature);
      setHandshakeAmount(maxAmount);
    }
  }, [balance]);

  const validateAndPrepareHandshake = useCallback(() => {
    setError(null);

    try {
      // Validate address
      new Address(recipientAddress);
    } catch {
      setError("Invalid Kaspa address format");
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
  }, [recipientAddress, handshakeAmount, balance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAndPrepareHandshake()) {
      return;
    }

    setShowConfirmation(true);
  };

  const confirmHandshake = async () => {
    try {
      setError(null);
      setShowConfirmation(false);

      const amountSompi = kaspaToSompi(handshakeAmount);
      
      // Initiate handshake with custom amount
      await messagingStore.initiateHandshake(recipientAddress, amountSompi);

      // Clear form
      setRecipientAddress("");
      setHandshakeAmount("0.2");
      setShowAdvanced(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRespondToHandshake = async (handshake: Conversation) => {
    try {
      setError(null);
      await messagingStore.respondToHandshake(handshake);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="new-chat-container">
      <style>{`
        .new-chat-container {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .new-chat-form {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .form-section {
          margin-bottom: 15px;
        }
        
        .form-section label {
          display: block;
          color: white;
          font-weight: bold;
          margin-bottom: 5px;
          font-size: 14px;
        }
        
        .address-input, .amount-input {
          width: 100%;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: white;
          font-family: monospace;
          font-size: 13px;
          box-sizing: border-box;
        }
        
        .address-input::placeholder, .amount-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        
        .address-input:focus, .amount-input:focus {
          outline: none;
          border-color: #2196f3;
          box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
        }
        
        .amount-section {
          position: relative;
        }
        
        .amount-input {
          padding-right: 50px;
        }
        
        .max-button {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #2196f3;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          padding: 0;
        }
        
        .max-button:hover {
          color: #1976d2;
        }
        
        .advanced-toggle {
          background: none;
          border: none;
          color: #2196f3;
          cursor: pointer;
          font-size: 13px;
          text-decoration: underline;
          margin-bottom: 15px;
        }
        
        .advanced-toggle:hover {
          color: #1976d2;
        }
        
        .advanced-section {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 15px;
          margin-top: 15px;
        }
        
        .info-text {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          margin-top: 5px;
          line-height: 1.4;
        }
        
        .submit-button, .confirm-button, .cancel-button {
          background: #2196f3;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          transition: background-color 0.2s;
          margin-right: 10px;
        }
        
        .submit-button:hover, .confirm-button:hover {
          background: #1976d2;
        }
        
        .cancel-button {
          background: #666;
        }
        
        .cancel-button:hover {
          background: #555;
        }
        
        .submit-button:disabled {
          background: #666;
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .error-message {
          background: rgba(255, 68, 68, 0.1);
          color: #ff4444;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid rgba(255, 68, 68, 0.3);
          margin-bottom: 15px;
          font-size: 14px;
        }
        
        .confirmation-dialog {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .confirmation-dialog h4 {
          color: white;
          margin: 0 0 15px 0;
          font-size: 16px;
        }
        
        .confirmation-details {
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        
        .confirmation-details strong {
          color: white;
        }
        
        .pending-handshakes {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 20px;
        }
        
        .pending-handshakes h3 {
          color: white;
          margin: 0 0 15px 0;
          font-size: 16px;
        }
        
        .handshake-item {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .handshake-item span {
          color: rgba(255, 255, 255, 0.8);
          font-family: monospace;
          font-size: 13px;
        }
        
        .respond-button {
          background: #4caf50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: background-color 0.2s;
        }
        
        .respond-button:hover {
          background: #45a049;
        }
      `}</style>

      <form onSubmit={handleSubmit} className="new-chat-form">
        <div className="form-section">
          <label>Recipient Address (kaspa: or kaspatest:)</label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="Enter Kaspa address"
            className="address-input"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="advanced-toggle"
        >
          {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
        </button>

        {showAdvanced && (
          <div className="advanced-section">
            <div className="form-section">
              <label>Handshake Amount (KAS)</label>
              <div className="amount-section">
                <input
                  type="text"
                  value={handshakeAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.2"
                  className="amount-input"
                />
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="max-button"
                >
                  Max
                </button>
              </div>
              <div className="info-text">
                Default: 0.2 KAS. Higher amounts help recipients respond even if they have no KAS.
                This creates a better experience for newcomers to Kaspa messaging.
              </div>
            </div>
          </div>
        )}

        <button type="submit" className="submit-button">
          Start New Chat
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {showConfirmation && (
        <div className="confirmation-dialog">
          <h4>Confirm Handshake</h4>
          <div className="confirmation-details">
            <strong>Recipient:</strong> {recipientAddress}<br/>
            <strong>Amount:</strong> {handshakeAmount} KAS<br/>
            <strong>Your Balance:</strong> {balance?.matureDisplay || "0"} KAS<br/>
            <br/>
            {parseFloat(handshakeAmount) > 0.2 && (
              <>The extra amount ({(parseFloat(handshakeAmount) - 0.2).toFixed(8)} KAS) helps the recipient respond even if they have no KAS.<br/><br/></>
            )}
            This will initiate a handshake conversation. Continue?
          </div>
          <button onClick={confirmHandshake} className="confirm-button">
            Confirm & Send
          </button>
          <button onClick={() => setShowConfirmation(false)} className="cancel-button">
            Cancel
          </button>
        </div>
      )}

      {/* Pending Handshakes Section */}
      {pendingHandshakes.length > 0 && (
        <div className="pending-handshakes">
          <h3>Pending Handshakes</h3>
          {pendingHandshakes.map((handshake) => (
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
