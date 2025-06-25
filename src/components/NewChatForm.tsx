import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { kaspaToSompi, sompiToKaspaString } from "kaspa-wasm";
import { KaspaAddress } from "./KaspaAddress";
import styles from "../components/NewChatForm.module.css";

interface NewChatFormProps {
  onClose: () => void;
  prefilledRecipient?: string;
  prefilledResolvedAddress?: string;
  prefilledDomainId?: string;
}

export const NewChatForm: React.FC<NewChatFormProps> = ({
  onClose,
  prefilledRecipient = "",
  prefilledResolvedAddress = "",
  prefilledDomainId = "",
}) => {
  const [recipientAddress, setRecipientAddress] = useState(prefilledRecipient);
  const [handshakeAmount, setHandshakeAmount] = useState("0.2");
  const [error, setError] = useState<string | null>(null);
  const [recipientWarning, setRecipientWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(
    !!(prefilledRecipient && prefilledResolvedAddress)
  );
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);

  // kns related
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(
    prefilledResolvedAddress || null
  );
  const [isResolvingKns, setIsResolvingKns] = useState(false);
  const [knsError, setKnsError] = useState<string | null>(null);
  const [knsDomainId, setKnsDomainId] = useState<string | null>(
    prefilledDomainId || null
  );
  const knsDomainRef = useRef<string>("");

  // Helper to determine if input is a Kaspa address
  const isKaspaAddress =
    recipientAddress.startsWith("kaspa:") ||
    recipientAddress.startsWith("kaspatest:");

  // Helper to determine if input could be a username
  const couldBeUsername = !isKaspaAddress && recipientAddress.length > 0;

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const balance = useWalletStore((state) => state.balance);

  const useRecipientAddressRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (node) {
        node.focus();
      }
    },
    []
  );

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
    // Only check for KNS domains if input could be a username
    if (!couldBeUsername) {
      setResolvedAddress(null);
      setKnsDomainId(null);
      setKnsError(null);
      return;
    }

    // Check if input could be a KNS domain (not a Kaspa address)
    const isKnsDomain = recipientAddress.endsWith(".kas");

    if (isKnsDomain || couldBeUsername) {
      setIsResolvingKns(true);
      setKnsError(null);

      // Convert to domain format for API calls
      let domainForApi = recipientAddress;
      if (recipientAddress.endsWith(".kas")) {
        domainForApi = recipientAddress;
        knsDomainRef.current = recipientAddress;
      } else {
        // Assume it's a username and append .kas
        domainForApi = recipientAddress + ".kas";
        knsDomainRef.current = domainForApi;
      }

      const timeoutId = setTimeout(async () => {
        try {
          const domain = domainForApi.trim();
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
            setKnsError("Username does not exist (KNS domain not found)");
          }
        } catch (e) {
          setResolvedAddress(null);
          setKnsDomainId(null);
          setKnsError("Failed to resolve KNS domain");
        } finally {
          setIsResolvingKns(false);
        }
      }, 750);
      return () => clearTimeout(timeoutId);
    } else {
      setResolvedAddress(null);
      setKnsDomainId(null);
      setKnsError(null);
    }
  }, [recipientAddress, couldBeUsername]);

  // Use the resolved address for all backend logic
  const knsRecipientAddress = resolvedAddress || recipientAddress;

  // Check recipient balance and set warning if zero
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

    // Validate recipient
    if (!knsRecipientAddress) {
      setError("Please enter a recipient address or username");
      return false;
    }

    // Check if it's a valid Kaspa address
    const isKaspaAddress =
      knsRecipientAddress.startsWith("kaspa:") ||
      knsRecipientAddress.startsWith("kaspatest:");

    if (!isKaspaAddress) {
      setError("Please enter a valid Kaspa address");
      return false;
    }

    // Check if we have a resolved address for username mode
    if (couldBeUsername && !resolvedAddress) {
      setError("Please wait for username resolution to complete");
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
    resolvedAddress,
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

      // Initiate handshake with custom amount
      await messageStore.initiateHandshake(knsRecipientAddress, amountSompi);
      messageStore.setOpenedRecipient(recipientAddress);

      if (
        (recipientAddress.endsWith(".kas") ||
          (!isKaspaAddress && recipientAddress.length > 0)) &&
        resolvedAddress
      ) {
        // Convert to @username format for nickname
        let nickname = recipientAddress;
        if (recipientAddress.endsWith(".kas")) {
          nickname = "@" + recipientAddress.slice(0, -4); // Remove .kas and add @
        } else {
          nickname = "@" + recipientAddress; // Add @ to username
        }
        messageStore.setContactNickname(resolvedAddress, nickname);
      }
      // Close the form
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

  // Auto-show confirmation if pre-filled values are provided
  useEffect(() => {
    if (prefilledRecipient && prefilledResolvedAddress) {
      setShowConfirmation(true);
    }
  }, [prefilledRecipient, prefilledResolvedAddress]);

  // Also check on initial mount if values are already set
  useEffect(() => {
    if (recipientAddress && resolvedAddress) {
      setShowConfirmation(true);
    }
  }, []);

  if (showConfirmation) {
    let recipientDisplay;
    const isKnsDomain =
      recipientAddress.endsWith(".kas") ||
      (!isKaspaAddress && recipientAddress.length > 0);

    if (isKnsDomain && resolvedAddress) {
      let username = recipientAddress;
      if (recipientAddress.endsWith(".kas")) {
        username = recipientAddress.slice(0, -4); // Remove .kas
      }
      recipientDisplay = `@${username} (${username}.kas)`;
    } else {
      recipientDisplay = knsRecipientAddress;
    }

    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
        onClick={handleOverlayClick}
      >
        <div
          className={styles["new-chat-form"]}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className={styles.title}>Confirm Handshake</h3>
          <div className={styles["confirmation-details"]}>
            <p>
              <strong>Recipient:</strong> {recipientDisplay}
            </p>
            {knsDomainId && (
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
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      onClick={handleOverlayClick}
    >
      <div
        className={styles["new-chat-form"]}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.title}>Start New Conversation</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles["form-group"]}>
            <label className={styles.label} htmlFor="recipientAddress">
              Recipient
            </label>

            {/* Smart Input Field */}
            <div className={styles["input-container"]}>
              {!recipientAddress.startsWith("kaspa:") &&
                !recipientAddress.startsWith("kaspatest:") &&
                recipientAddress.length > 0 &&
                !recipientAddress.endsWith(".kas") && (
                  <span className={styles["at-prefix"]}>@</span>
                )}
              <input
                ref={useRecipientAddressRef}
                className={`${styles.input} ${
                  !recipientAddress.startsWith("kaspa:") &&
                  !recipientAddress.startsWith("kaspatest:") &&
                  recipientAddress.length > 0 &&
                  !recipientAddress.endsWith(".kas")
                    ? styles["username-input"]
                    : ""
                }`}
                type="text"
                id="recipientAddress"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="kaspa:... or username (KNS domain)"
                disabled={isLoading}
                required
                autoComplete="off"
              />
            </div>
            {isResolvingKns && couldBeUsername && (
              <div className={styles["checking-text"]}>
                Resolving KNS domain...
              </div>
            )}
            {resolvedAddress &&
              couldBeUsername &&
              !isResolvingKns &&
              !knsError && (
                <div className={styles["resolved-address"]}>
                  <div className="flex items-center gap-2">
                    <KaspaAddress address={resolvedAddress} />
                  </div>
                </div>
              )}
            {knsError && couldBeUsername && !isResolvingKns && (
              <div className={`mt-2 ${styles["error-message"]}`}>
                {knsError}
              </div>
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
