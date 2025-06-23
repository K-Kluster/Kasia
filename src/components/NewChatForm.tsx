import React, { useState, useCallback, useEffect, useRef } from "react";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { kaspaToSompi, sompiToKaspaString } from "kaspa-wasm";
import styles from "./NewChatForm.module.css";

interface NewChatFormProps {
  onClose: () => void;
}

export const NewChatForm: React.FC<NewChatFormProps> = ({ onClose }) => {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [handshakeAmount, setHandshakeAmount] = useState("0.2");
  const [error, setError] = useState<string | null>(null);
  const [recipientWarning, setRecipientWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isResolvingKns, setIsResolvingKns] = useState(false);
  const [knsError, setKnsError] = useState<string | null>(null);
  const [knsDomainId, setKnsDomainId] = useState<string | null>(null);
  const knsDomainRef = useRef<string>("");

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const balance = useWalletStore((state) => state.balance);

  // Handle clicking outside to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // KNS domain resolution effect
  useEffect(() => {
    if (recipientAddress.endsWith(".kas")) {
      setIsResolvingKns(true);
      setKnsError(null);
      knsDomainRef.current = recipientAddress;
      const timeoutId = setTimeout(async () => {
        try {
          const domain = recipientAddress.trim();
          const response = await fetch(
            `https://api.knsdomains.org/mainnet/api/v1/${encodeURIComponent(
              domain
            )}/owner`
          );
          const data = await response.json();
          if (data.success && data.data && data.data.owner) {
            setResolvedAddress(data.data.owner);
            setKnsDomainId(data.data.id || null);
            setKnsError(null);
          } else {
            setResolvedAddress(null);
            setKnsDomainId(null);
            setKnsError("KNS domain does not exist");
          }
        } catch (e) {
          setResolvedAddress(null);
          setKnsDomainId(null);
          setKnsError("Failed to resolve KNS domain");
        } finally {
          setIsResolvingKns(false);
        }
      }, 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setResolvedAddress(null);
      setKnsDomainId(null);
      setKnsError(null);
    }
  }, [recipientAddress]);

  // Use the resolved address for all backend logic
  const knsRecipientAddress = resolvedAddress || recipientAddress;

  // Update checkRecipientBalance and validation to use knsRecipientAddress
  const checkRecipientBalance = useCallback(
    async (address: string) => {
      if (
        !address ||
        (!address.startsWith("kaspa:") && !address.startsWith("kaspatest:"))
      ) {
        setRecipientWarning(null);
        return;
      }
      setIsCheckingRecipient(true);
      setRecipientWarning(null);
      try {
        const networkId = walletStore.accountService?.networkId || "mainnet";
        const baseUrl =
          networkId === "mainnet"
            ? "https://api.kaspa.org"
            : "https://api-tn10.kaspa.org";
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(
          `${baseUrl}/addresses/${encodedAddress}/balance`
        );
        if (!response.ok) {
          setRecipientWarning(
            "Could not verify recipient balance. They may not be able to respond if they have no KAS."
          );
          return;
        }
        const balanceData = await response.json();
        const balance = BigInt(balanceData.balance || 0);
        if (balance === BigInt(0)) {
          setRecipientWarning(
            "⚠️ Warning: Recipient has zero KAS balance and will not be able to respond to your handshake. Consider sending a higher amount."
          );
        } else {
          setRecipientWarning(null);
        }
      } catch (error) {
        console.warn("Could not check recipient balance:", error);
        setRecipientWarning(
          "Could not verify recipient balance. They may not be able to respond if they have no KAS."
        );
      } finally {
        setIsCheckingRecipient(false);
      }
    },
    [walletStore.accountService]
  );

  // Debounced recipient balance check (use knsRecipientAddress)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (knsRecipientAddress) {
        checkRecipientBalance(knsRecipientAddress);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [knsRecipientAddress, checkRecipientBalance]);

  const handleAmountChange = useCallback((value: string) => {
    // Allow decimal numbers
    if (/^\d*\.?\d*$/.test(value)) {
      setHandshakeAmount(value);
    }
  }, []);

  const handleQuickAmount = useCallback((amount: string) => {
    setHandshakeAmount(amount);
  }, []);

  // Update validation to use knsRecipientAddress
  const validateAndPrepareHandshake = useCallback(() => {
    setError(null);
    if (!walletStore.unlockedWallet?.password) {
      setError("Please unlock your wallet first");
      return false;
    }
    if (
      !knsRecipientAddress.startsWith("kaspa:") &&
      !knsRecipientAddress.startsWith("kaspatest:")
    ) {
      setError(
        "Invalid Kaspa address format. Must start with 'kaspa:' or 'kaspatest:' or be a valid KNS domain."
      );
      return false;
    }
    const existingConversations = messageStore.getActiveConversations();
    const existingConv = existingConversations.find(
      (conv) => conv.kaspaAddress === knsRecipientAddress
    );
    if (existingConv) {
      setError("You already have an active conversation with this address");
      return false;
    }
    const amountSompi = kaspaToSompi(handshakeAmount);
    if (!amountSompi) {
      setError("Invalid handshake amount");
      return false;
    }
    const minAmount = kaspaToSompi("0.2");
    if (amountSompi < minAmount!) {
      setError("Handshake amount must be at least 0.2 KAS");
      return false;
    }
    if (!balance?.mature || balance.mature < amountSompi) {
      setError(
        `Insufficient balance. Need ${handshakeAmount} KAS, have ${
          balance?.matureDisplay || "0"
        } KAS`
      );
      return false;
    }
    return true;
  }, [
    knsRecipientAddress,
    handshakeAmount,
    balance,
    messageStore,
    walletStore,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAndPrepareHandshake()) {
      return;
    }

    setShowConfirmation(true);
  };

  // Update confirmHandshake to use knsRecipientAddress
  const confirmHandshake = async () => {
    setError(null);
    setIsLoading(true);
    setShowConfirmation(false);
    try {
      const amountSompi = kaspaToSompi(handshakeAmount);
      await messageStore.initiateHandshake(knsRecipientAddress, amountSompi);
      if (recipientAddress.endsWith(".kas") && resolvedAddress) {
        messageStore.setContactNickname(resolvedAddress, recipientAddress);
      }
      onClose();
    } catch (error) {
      console.error("Failed to create new chat:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create new chat"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to format kaspa address for display
  function formatKaspaAddress(addr: string) {
    if (!addr.startsWith("kaspa:")) return addr;
    const core = addr.slice(6);
    if (core.length <= 6) return addr;
    return `kaspa:${core.slice(0, 3)}.....${core.slice(-3)}`;
  }

  if (showConfirmation) {
    let recipientDisplay;
    if (recipientAddress.endsWith(".kas") && resolvedAddress) {
      recipientDisplay = (
        <>
          {recipientAddress}
          <span className={styles["resolved-address"]}>
            {" "}
            ({formatKaspaAddress(resolvedAddress)})
          </span>
        </>
      );
    } else {
      recipientDisplay = knsRecipientAddress;
    }
    return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div
          className={styles["new-chat-form"]}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className={styles.title}>Confirm Handshake</h3>
          <div className={styles["confirmation-details"]}>
            <p>
              <strong>Recipient:</strong> {recipientDisplay}
            </p>
            {recipientAddress.endsWith(".kas") &&
              resolvedAddress &&
              knsDomainId && (
                <p>
                  <strong>Domain ID:</strong> {knsDomainId}
                </p>
              )}
            <p>
              <strong>Amount:</strong> {handshakeAmount} KAS
            </p>
            <p>
              <strong>Your Balance:</strong> {balance?.matureDisplay || "0"} KAS
            </p>
            {parseFloat(handshakeAmount) > 0.2 && (
              <p className={styles["info-text"]}>
                The extra amount (
                {(parseFloat(handshakeAmount) - 0.2).toFixed(8)} KAS) helps the
                recipient respond even if they have no KAS.
              </p>
            )}
            {/* Only show warning if user is NOT sending extra amount */}
            {recipientWarning && parseFloat(handshakeAmount) <= 0.2 && (
              <p className={styles["warning-text"]}>{recipientWarning}</p>
            )}
            <p>This will initiate a handshake conversation. Continue?</p>
          </div>
          <div className={styles["form-actions"]}>
            <button
              type="button"
              className={styles["cancel-button"]}
              onClick={() => setShowConfirmation(false)}
              disabled={isLoading}
            >
              Back
            </button>
            <button
              type="button"
              className={styles["submit-button"]}
              onClick={confirmHandshake}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Confirm & Send"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className={styles["new-chat-form"]}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.title}>Start New Conversation</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles["form-group"]}>
            <label className={styles.label} htmlFor="recipientAddress">
              Recipient Address
            </label>
            <input
              className={styles.input}
              type="text"
              id="recipientAddress"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="KNS Domain or kaspa:..."
              disabled={isLoading}
              required
              autoComplete="off"
            />
            {isResolvingKns && recipientAddress.endsWith(".kas") && (
              <div className={styles["checking-text"]}>
                Resolving KNS domain...
              </div>
            )}
            {resolvedAddress &&
              recipientAddress.endsWith(".kas") &&
              !isResolvingKns &&
              !knsError && (
                <div className={styles["resolved-address"]}>
                  <span style={{ fontFamily: "monospace", userSelect: "all" }}>
                    {resolvedAddress}
                  </span>
                </div>
              )}
            {knsError &&
              recipientAddress.endsWith(".kas") &&
              !isResolvingKns && (
                <div className={styles["error-message"]}>{knsError}</div>
              )}
            {isCheckingRecipient && (
              <div className={styles["checking-text"]}>
                Checking recipient balance...
              </div>
            )}
            {recipientWarning && (
              <div className={styles["warning-message"]}>
                {recipientWarning}
              </div>
            )}
          </div>

          <div className={styles["form-group"]}>
            <label className={styles.label} htmlFor="handshakeAmount">
              Handshake Amount (KAS)
            </label>
            <input
              className={styles["amount-input"]}
              type="text"
              id="handshakeAmount"
              value={handshakeAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.2"
              disabled={isLoading}
            />
            <div className={styles["amount-buttons"]}>
              <button
                type="button"
                className={`${styles["amount-button"]} ${
                  handshakeAmount === "0.2" ? styles["active"] : ""
                }`}
                onClick={() => handleQuickAmount("0.2")}
                disabled={isLoading}
              >
                0.2
              </button>
              <button
                type="button"
                className={`${styles["amount-button"]} ${
                  handshakeAmount === "0.5" ? styles["active"] : ""
                }`}
                onClick={() => handleQuickAmount("0.5")}
                disabled={isLoading}
              >
                0.5
              </button>
              <button
                type="button"
                className={`${styles["amount-button"]} ${
                  handshakeAmount === "1" ? styles["active"] : ""
                }`}
                onClick={() => handleQuickAmount("1")}
                disabled={isLoading}
              >
                1
              </button>
            </div>
            <div className={styles["info-text"]}>
              Default: 0.2 KAS. Higher amounts help recipients respond even if
              they have no KAS. This creates a better experience for newcomers
              to Kasia.
            </div>
          </div>

          {error && <div className={styles["error-message"]}>{error}</div>}
          <div className={styles["form-actions"]}>
            <button
              type="button"
              className={styles["cancel-button"]}
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles["submit-button"]}
              disabled={isLoading}
            >
              {isLoading ? "Initiating..." : "Start Chat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
