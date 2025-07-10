import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { kaspaToSompi } from "kaspa-wasm";
import styles from "../components/NewChatForm.module.css";
import { knsIntegrationService_getDomainResolution } from "../service/integrations/kns-integration-service";
import { unknownErrorToErrorLike } from "../utils/errors";
import { KaspaAddress } from "./KaspaAddress";
import { Textarea } from "@headlessui/react";
import { Button } from "./Common/Button";
import { QrScanner } from "./QrScanner";

interface NewChatFormProps {
  onClose: () => void;
}

export const NewChatForm: React.FC<NewChatFormProps> = ({ onClose }) => {
  const [recipientInputValue, setRecipientInputValue] = useState("");
  const [resolvedRecipientAddress, setResolvedRecipientAddress] = useState<
    string | null
  >(null);
  const [handshakeAmount, setHandshakeAmount] = useState("0.2");
  const [error, setError] = useState<string | null>(null);
  const [recipientWarning, setRecipientWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);

  // kns related
  const [isResolvingKns, setIsResolvingKns] = useState(false);
  const [knsError, setKnsError] = useState<string | null>(null);
  const [knsDomainId, setKnsDomainId] = useState<string | null>(null);
  const knsDomainRef = useRef<string>("");

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const balance = useWalletStore((state) => state.balance);

  const detectedRecipientInputValueFormat = useMemo<
    "address" | "kns" | "undetermined"
  >(() => {
    if (
      recipientInputValue.startsWith("kaspa:") ||
      recipientInputValue.startsWith("kaspatest:")
    ) {
      return "address";
    } else if (recipientInputValue.length > 0) {
      return "kns";
    } else {
      return "undetermined";
    }
  }, [recipientInputValue]);

  const useRecipientInputRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      if (node) {
        node.focus();
      }
    },
    []
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
    // format changed to not kns related, reset kns related states
    if (!(detectedRecipientInputValueFormat === "kns")) {
      setResolvedRecipientAddress(null);
      setKnsDomainId(null);
      setKnsError(null);
      return;
    }

    // prepare kns related states for resolution
    setIsResolvingKns(true);
    setKnsError(null);

    // Convert to domain format for API calls
    const domainWithSuffix = recipientInputValue.trim().endsWith(".kas")
      ? recipientInputValue.trim()
      : recipientInputValue.trim() + ".kas";
    knsDomainRef.current = domainWithSuffix;

    const timeoutId = setTimeout(async () => {
      try {
        const domainResution = await knsIntegrationService_getDomainResolution(
          walletStore.selectedNetwork,
          domainWithSuffix
        );

        if (domainResution) {
          setResolvedRecipientAddress(domainResution.ownerAddress);
          setKnsDomainId(domainResution.id || null);
          setKnsError(null);
        } else {
          setResolvedRecipientAddress(null);
          setKnsDomainId(null);
          setKnsError("Username does not exist (KNS domain not found)");
        }
      } catch (error) {
        setResolvedRecipientAddress(null);
        setKnsDomainId(null);
        setKnsError(unknownErrorToErrorLike(error).message);
      } finally {
        setIsResolvingKns(false);
      }
    }, 750);

    // clear timeout if the component unmounts or the input value changes
    return () => clearTimeout(timeoutId);
  }, [detectedRecipientInputValueFormat, recipientInputValue]);

  // Use the resolved address for all backend logic
  const knsRecipientAddress = resolvedRecipientAddress || recipientInputValue;

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

      // Use the Kaspa API to check recipient balance
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

      // Initiate handshake with custom amount

      await messageStore.initiateHandshake(knsRecipientAddress, amountSompi);
      messageStore.setOpenedRecipient(knsRecipientAddress);

      if (
        detectedRecipientInputValueFormat === "kns" &&
        resolvedRecipientAddress
      ) {
        messageStore.setContactNickname(
          resolvedRecipientAddress,
          recipientInputValue
        );
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

  if (showConfirmation) {
    let recipientDisplay;
    if (
      detectedRecipientInputValueFormat === "kns" &&
      resolvedRecipientAddress
    ) {
      recipientDisplay = (
        <div className="mb-2 inline">
          <span>{recipientInputValue}</span>
          <div className="flex justify-start break-all">
            <KaspaAddress address={resolvedRecipientAddress} />
          </div>
        </div>
      );
    } else {
      recipientDisplay = <KaspaAddress address={knsRecipientAddress} />;
    }

    return (
      <>
        <h3 className="m-0 mb-5 text-[1.2rem] text-white">Confirm Handshake</h3>
        <div className="mb-5 text-sm leading-normal text-white/80">
          <p>
            <strong>Recipient:</strong>
            <div className="flex justify-start break-all">
              {recipientDisplay}
            </div>
          </p>
          {detectedRecipientInputValueFormat === "kns" &&
            resolvedRecipientAddress &&
            knsDomainId && (
              <p>
                <strong>Domain ID:</strong> {knsDomainId}
              </p>
            )}
          <p className="my-2">
            <strong>Amount:</strong> {handshakeAmount} KAS
          </p>
          <p className="my-2">
            <strong>Your Balance:</strong> {balance?.matureDisplay || "0"} KAS
          </p>
          {parseFloat(handshakeAmount) > 0.2 && (
            <p className={styles["info-text"]}>
              The extra amount ({(parseFloat(handshakeAmount) - 0.2).toFixed(8)}{" "}
              KAS) helps the recipient respond even if they have no KAS.
            </p>
          )}
          {/* Only show warning if user is NOT sending extra amount */}
          {recipientWarning && parseFloat(handshakeAmount) <= 0.2 && (
            <p className={styles["warning-text"]}>{recipientWarning}</p>
          )}
          <p>This will initiate a handshake conversation. Continue?</p>
        </div>
        <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
          <Button
            type="button"
            onClick={confirmHandshake}
            disabled={isLoading}
            variant="primary"
          >
            {isLoading ? "Sending..." : "Confirm & Send"}
          </Button>
          <Button
            type="button"
            onClick={() => setShowConfirmation(false)}
            disabled={isLoading}
            variant="secondary"
          >
            Back
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <h3 className="mb-5 text-base font-semibold text-white">
        Start New Conversation
      </h3>
      <form onSubmit={handleSubmit}>
        <div className={"mb-5"}>
          <label
            className="mb-[5px] block text-[14px] font-bold text-white"
            htmlFor="recipientAddress"
          >
            Recipient Address
          </label>
          <div className="flex items-center gap-2">
            <Textarea
              ref={useRecipientInputRef}
              className="box-border flex w-full resize-none items-center rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-base leading-[1.4] text-white lowercase placeholder-white/50 transition-colors duration-200 hover:border-white/20 hover:bg-white/10 focus:border-white/20 focus:bg-white/10 focus:outline-none disabled:bg-black/50 disabled:text-white/30"
              rows={3}
              id="recipientAddress"
              value={recipientInputValue}
              onChange={(e) =>
                setRecipientInputValue(e.target.value.toLowerCase())
              }
              placeholder="Kaspa address or Kns domain"
              disabled={isLoading}
              required
              autoComplete="off"
            />
            <QrScanner
              onScan={(data: string) => {
                setRecipientInputValue(data.toLowerCase());
              }}
            />
          </div>
          {isResolvingKns && detectedRecipientInputValueFormat === "kns" && (
            <div className={styles["checking-text"]}>
              Resolving KNS domain...
            </div>
          )}
          {resolvedRecipientAddress &&
            detectedRecipientInputValueFormat === "kns" &&
            !isResolvingKns &&
            !knsError && (
              <div className="mt-2 mb-4 flex justify-start break-all">
                <KaspaAddress address={resolvedRecipientAddress} />
              </div>
            )}
          {knsError &&
            detectedRecipientInputValueFormat === "kns" &&
            !isResolvingKns && (
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
            <div className={styles["warning-message"]}>{recipientWarning}</div>
          )}
        </div>

        <div className={"mb-5"}>
          <label
            className="mb-[5px] block text-[14px] font-bold text-white"
            htmlFor="handshakeAmount"
          >
            Handshake Amount (KAS)
          </label>
          <input
            className="mb-2 box-border flex h-10 w-full items-center rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-base leading-1.5 text-white placeholder-white/50 transition-colors duration-200 hover:border-white/20 hover:bg-white/10 focus:border-white/20 focus:bg-white/10 focus:outline-none"
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
            they have no KAS. This creates a better experience for newcomers to
            Kasia.
          </div>
        </div>

        {error && <div className={styles["error-message"]}>{error}</div>}

        <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
          <Button type="submit" disabled={isLoading} variant="primary">
            {isLoading ? "Initiating..." : "Start Chat"}
          </Button>
          <Button onClick={onClose} disabled={isLoading} variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};
