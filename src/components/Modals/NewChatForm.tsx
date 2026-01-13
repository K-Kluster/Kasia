import { useMessagingStore } from "../../store/messaging.store";
import { useWalletStore } from "../../store/wallet.store";
import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { kaspaToSompi } from "kaspa-wasm";
import clsx from "clsx";
import { knsIntegrationService_getDomainResolution } from "../../service/integrations/kns-integration-service";
import { unknownErrorToErrorLike } from "../../utils/errors";
import { KaspaAddress } from "../KaspaAddress";
import { Textarea } from "@headlessui/react";
import { Button } from "../Common/Button";
import { StringCopy } from "../Common/StringCopy";
import { Clipboard, QrCode, AlertTriangle } from "lucide-react";
import { useUiStore } from "../../store/ui.store";
import { cameraPermissionService } from "../../service/camera-permission-service";
import {
  useFeatureFlagsStore,
  FeatureFlags,
} from "../../store/featureflag.store";
import { pasteFromClipboard } from "../../utils/clipboard";

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
  const [recipientWarning, setRecipientWarning] =
    useState<React.ReactNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  const [discreteMode, setDiscreteMode] = useState(false);

  // kns related
  const [isResolvingKns, setIsResolvingKns] = useState(false);
  const [knsError, setKnsError] = useState<string | null>(null);
  const [knsDomainId, setKnsDomainId] = useState<string | null>(null);
  const knsDomainRef = useRef<string>("");

  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const balance = useWalletStore((state) => state.balance);
  const rpc = useWalletStore((s) => s.rpc);

  const openModal = useUiStore((s) => s.openModal);
  const setQrScannerCallback = useUiStore((s) => s.setQrScannerCallback);

  // Check if camera feature is enabled
  const { flags } = useFeatureFlagsStore();
  const cameraEnabled = flags[FeatureFlags.ENABLED_CAMERA];

  const handleQrScan = async () => {
    // Check camera access through the service
    const hasAccess = await cameraPermissionService.requestCamera();
    if (!hasAccess) return;

    // Set the callback to handle scanned data
    setQrScannerCallback((data: string) => {
      setRecipientInputValue(data.toLowerCase());
    });

    // Open the QR scanner modal
    openModal("qr-scanner");
  };

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

  const recipientInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus the address input on mount only (not ever render)
  useEffect(() => {
    if (recipientInputRef.current) {
      recipientInputRef.current.focus();
    }
  }, []);

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
  }, [
    detectedRecipientInputValueFormat,
    recipientInputValue,
    walletStore.selectedNetwork,
  ]);

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
        const participantAddressBalance = await rpc?.getBalanceByAddress({
          address: address,
        });

        if (!participantAddressBalance) {
          setRecipientWarning(
            <>
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              Could not verify recipient balance. They may not be able to
              respond if they have no KAS.
            </>
          );
          return;
        }

        const balance = participantAddressBalance.balance;

        if (balance === BigInt(0)) {
          setRecipientWarning(
            <>
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              Warning: Recipient has zero KAS balance and will not be able to
              respond to your handshake. Consider sending a higher amount.
            </>
          );
        } else {
          setRecipientWarning(null);
        }
      } catch (error) {
        console.warn("Could not check recipient balance:", error);
        setRecipientWarning(
          <>
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            Could not verify recipient balance. They may not be able to respond
            if they have no KAS.
          </>
        );
      } finally {
        setIsCheckingRecipient(false);
      }
    },
    [rpc]
  );

  useEffect(() => {
    if (discreteMode) {
      setRecipientWarning(null);
      setIsCheckingRecipient(false);
    }
  }, [discreteMode]);

  // Debounced recipient balance check (use knsRecipientAddress)
  useEffect(() => {
    if (discreteMode) {
      return;
    }
    const timeoutId = setTimeout(() => {
      if (knsRecipientAddress) {
        checkRecipientBalance(knsRecipientAddress);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [knsRecipientAddress, checkRecipientBalance, discreteMode]);

  const handleAmountChange = (value: string) => {
    // Allow decimal numbers
    if (/^\d*\.?\d*$/.test(value)) {
      setHandshakeAmount(value);
    }
  };

  const handleQuickAmount = (amount: string) => {
    setHandshakeAmount(amount);
  };

  const handlePaste = async () => {
    const text = await pasteFromClipboard();
    setRecipientInputValue(text.toLowerCase());
  };

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
    const existingConversationWithContact = messageStore
      .getConversationsWithContacts()
      .find((oooc) => oooc.contact.kaspaAddress === knsRecipientAddress);

    if (existingConversationWithContact) {
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

    // For discrete mode, skip handshake validation and create directly
    if (discreteMode) {
      await createDiscreteConversation();
    } else {
      // Only validate handshake for regular mode
      if (!validateAndPrepareHandshake()) {
        return;
      }
      setShowConfirmation(true);
    }
  };

  // Create discrete conversation without handshake
  const createDiscreteConversation = async () => {
    setError(null);

    // Basic validation for discrete mode
    if (!knsRecipientAddress) {
      setError("Please enter a valid Kaspa address");
      return;
    }

    // Check if conversation already exists
    const existingConversationWithContact = messageStore
      .getConversationsWithContacts()
      .find((oooc) => oooc.contact.kaspaAddress === knsRecipientAddress);

    if (existingConversationWithContact) {
      setError("You already have an active conversation with this address");
      return;
    }

    setIsLoading(true);
    try {
      await messageStore.createDiscreteConversation(knsRecipientAddress);
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

      onClose();
    } catch (error) {
      console.error("Failed to create discrete conversation:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create discrete conversation"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm and send handshake transaction
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
        <h3 className="m-0 mb-5 text-[1.2rem] font-bold">Confirm Handshake</h3>
        <div className="mb-5 text-sm leading-normal">
          <div>
            <strong>Recipient:</strong>
            <div className="flex justify-start break-all">
              {recipientDisplay}
            </div>
          </div>
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
          <p className="mt-1">
            <strong>Your Balance:</strong> {balance?.matureDisplay || "0"} KAS
          </p>
          {parseFloat(handshakeAmount) > 0.2 && (
            <p className="text-sm text-[var(--text-secondary)]">
              The extra amount ({(parseFloat(handshakeAmount) - 0.2).toFixed(8)}{" "}
              KAS) helps the recipient respond even if they have no KAS.
            </p>
          )}
          {/* Only show warning if user is NOT sending extra amount */}
          {recipientWarning && parseFloat(handshakeAmount) <= 0.2 && (
            <p className="my-2 text-sm leading-[1.4] text-[#ffc107]">
              {recipientWarning}
            </p>
          )}
          <p className="mt-1">
            This will initiate a handshake conversation. Continue?
          </p>
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
      <h3 className="mb-5 text-base font-semibold">Start New Conversation</h3>
      <form onSubmit={handleSubmit}>
        <div className={"mb-5"}>
          <label
            className="mb-[5px] block text-[14px] font-bold"
            htmlFor="recipientAddress"
          >
            Recipient Address
          </label>
          <div className="relative">
            <Textarea
              ref={recipientInputRef}
              className="bg-primary-bg border-primary-border w-full resize-none rounded-lg border p-2 pr-24 text-base text-[var(--text-primary)] placeholder-gray-400 focus:border-[var(--button-primary)]/80 focus:ring-2 focus:outline-none"
              rows={3}
              id="recipientAddress"
              value={recipientInputValue}
              onChange={(e) =>
                setRecipientInputValue(e.target.value.toLowerCase())
              }
              placeholder="Kaspa address or KNS domain"
              disabled={isLoading}
              required
              autoComplete="off"
            />
            <div className="absolute right-2 bottom-2 flex gap-1 pb-1">
              <button
                type="button"
                onClick={handlePaste}
                className="bg-kas-secondary/10 border-kas-secondary cursor-pointer rounded-lg border px-1.5 py-1 transition-colors"
                title="Paste from clipboard"
                disabled={isLoading}
              >
                <Clipboard size={16} />
              </button>
              {cameraEnabled && (
                <button
                  type="button"
                  className="bg-kas-secondary/10 border-kas-secondary cursor-pointer rounded-lg border p-1"
                  onClick={handleQrScan}
                  title="Scan QR code"
                  disabled={isLoading}
                >
                  <QrCode className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {isResolvingKns && detectedRecipientInputValueFormat === "kns" && (
            <div className="font-italic mt-1.5 text-xs text-[rgba(255,255,255,0.6)]">
              Resolving KNS domain...
            </div>
          )}
          {resolvedRecipientAddress &&
            detectedRecipientInputValueFormat === "kns" &&
            !isResolvingKns &&
            !knsError && (
              <div className="mt-2 mb-4 flex justify-start break-all">
                <KaspaAddress address={resolvedRecipientAddress} />
                <StringCopy
                  text={resolvedRecipientAddress}
                  alertText="Address Copied"
                  titleText="Copy Address"
                  className="ml-2"
                />
              </div>
            )}
          {knsError &&
            detectedRecipientInputValueFormat === "kns" &&
            !isResolvingKns && (
              <div className="mt-2 mb-4 rounded-lg border border-[rgba(255,68,68,0.3)] bg-[rgba(255,68,68,0.1)] p-2.5 text-sm text-[var(--accent-red)]">
                {knsError}
              </div>
            )}
          {!discreteMode && isCheckingRecipient && (
            <div className="font-italic mt-1.5 text-xs text-[rgba(255,255,255,0.6)]">
              Checking recipient balance...
            </div>
          )}
          {!discreteMode && recipientWarning && (
            <div className="text-accent-yellow mt-2 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-2 text-[13px] leading-[1.4]">
              {recipientWarning}
            </div>
          )}
        </div>

        {/* Discrete Conversation Mode Toggle */}
        <div className="mb-5">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={discreteMode}
              onChange={(e) => setDiscreteMode(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[var(--button-primary)] focus:ring-2 focus:ring-[var(--button-primary)]"
            />
            <span className="text-sm font-medium">
              Discrete Conversation (no handshake required)
            </span>
          </label>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Start monitoring for messages immediately without sending an
            on-chain handshake. Both parties can communicate using deterministic
            aliases derived from your wallet addresses.
          </p>
        </div>

        <div className={clsx("mb-5", discreteMode && "opacity-50")}>
          <label
            className="mb-[5px] block text-[14px] font-bold"
            htmlFor="handshakeAmount"
          >
            Handshake Amount (KAS)
          </label>
          <input
            className="border-primary-border focus:ring-kas-secondary/80 bg-input-bg mb-2 box-border flex h-10 w-full items-center rounded-lg border px-3 py-2 text-base focus:ring-2 focus:outline-none disabled:cursor-not-allowed"
            type="text"
            id="handshakeAmount"
            value={handshakeAmount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.2"
            disabled={discreteMode || isLoading}
          />
          <div className="mb-2.5 flex gap-2">
            <button
              type="button"
              className={clsx(
                "flex h-9 flex-1 cursor-pointer items-center justify-center rounded-3xl border border-[var(--button-primary)] bg-[var(--button-primary)]/20 px-2 py-1 text-sm font-medium transition-all duration-200 ease-in-out hover:-translate-y-px hover:border-[var(--button-primary)]/60 hover:bg-[var(--button-primary)]/30 disabled:transform-none disabled:cursor-not-allowed disabled:border-[var(--button-primary)]/20 disabled:bg-[var(--button-primary)]/10 disabled:text-[var(--button-primary)]/30",
                {
                  "border-[var(--button-primary)] !bg-[var(--button-primary)] text-[var(--text-primary)]":
                    handshakeAmount === "0.2",
                }
              )}
              style={{
                color:
                  handshakeAmount !== "0.2"
                    ? "var(--button-primary)"
                    : undefined,
              }}
              onClick={() => handleQuickAmount("0.2")}
              disabled={discreteMode || isLoading}
            >
              0.2
            </button>
            <button
              type="button"
              className={clsx(
                "flex h-9 flex-1 cursor-pointer items-center justify-center rounded-3xl border border-[var(--button-primary)] bg-[var(--button-primary)]/20 px-2 py-1 text-sm font-medium transition-all duration-200 ease-in-out hover:-translate-y-px hover:border-[var(--button-primary)]/60 hover:bg-[var(--button-primary)]/30 disabled:transform-none disabled:cursor-not-allowed disabled:border-[var(--button-primary)]/20 disabled:bg-[var(--button-primary)]/10 disabled:text-[var(--button-primary)]/30",
                {
                  "border-[var(--button-primary)] !bg-[var(--button-primary)] text-[var(--text-primary)]":
                    handshakeAmount === "0.5",
                }
              )}
              style={{
                color:
                  handshakeAmount !== "0.5"
                    ? "var(--button-primary)"
                    : undefined,
              }}
              onClick={() => handleQuickAmount("0.5")}
              disabled={discreteMode || isLoading}
            >
              0.5
            </button>
            <button
              type="button"
              className={clsx(
                "flex h-9 flex-1 cursor-pointer items-center justify-center rounded-3xl border border-[var(--button-primary)] bg-[var(--button-primary)]/20 px-2 py-1 text-sm font-medium transition-all duration-200 ease-in-out hover:-translate-y-px hover:border-[var(--button-primary)]/60 hover:bg-[var(--button-primary)]/30 disabled:transform-none disabled:cursor-not-allowed disabled:border-[var(--button-primary)]/20 disabled:bg-[var(--button-primary)]/10 disabled:text-[var(--button-primary)]/30",
                {
                  "border-[var(--button-primary)] !bg-[var(--button-primary)] text-[var(--text-primary)]":
                    handshakeAmount === "1",
                }
              )}
              style={{
                color:
                  handshakeAmount !== "1" ? "var(--button-primary)" : undefined,
              }}
              onClick={() => handleQuickAmount("1")}
              disabled={discreteMode || isLoading}
            >
              1
            </button>
          </div>
          <div className="mt-4 text-xs text-[var(--text-secondary)]">
            Default: 0.2 KAS. Higher amounts help recipients respond even if
            they have no KAS. This creates a better experience for newcomers to
            Kasia.
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-[rgba(255,68,68,0.3)] bg-[rgba(255,68,68,0.1)] p-2.5 text-sm text-[#ff4444]">
            {error}
          </div>
        )}

        <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
          <Button type="submit" disabled={isLoading} variant="primary">
            {isLoading
              ? discreteMode
                ? "Creating..."
                : "Initiating..."
              : discreteMode
                ? "Start Discrete Chat"
                : "Start Chat"}
          </Button>
          <Button onClick={onClose} disabled={isLoading} variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};
