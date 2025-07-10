import { Popover, PopoverButton, PopoverPanel, Input } from "@headlessui/react";
import clsx from "clsx";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { KasIcon } from "../components/icons/KasCoin";
import { sompiToKaspaString, kaspaToSompi } from "kaspa-wasm";
import { useWalletStore } from "../store/wallet.store";
import { useMessagingStore } from "../store/messaging.store";
import { encrypt_message } from "cipher";
import { Address } from "kaspa-wasm";

export const SendPayment: FC<{
  address: string;
  onPaymentSent: () => void;
}> = ({ address, onPaymentSent }) => {
  // Pay functionality state
  const [payAmount, setPayAmount] = useState("");
  const [payMessage, setPayMessage] = useState("");
  const [isSendingPayment, setIsSendingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const balance = useWalletStore((s) => s.balance);
  const walletStore = useWalletStore();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const popoverPanelRef = useCallback(
    (panel: HTMLDivElement | null) => {
      if (panel) {
        // delay to next tick to avoid focus being overridden by popover
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    },
    [inputRef]
  );

  // Reset pay form when recipient changes
  useEffect(() => {
    setPayAmount("");
    setPayMessage("");
    setPaymentError(null);
  }, [address]);

  const handlePayAmountChange = useCallback((value: string) => {
    // Allow decimal numbers
    if (/^\d*\.?\d*$/.test(value)) {
      setPayAmount(value);
      setPaymentError(null);
    }
  }, []);

  const handlePayMessageChange = useCallback((value: string) => {
    setPayMessage(value);
    setPaymentError(null);
  }, []);

  const handleMaxPayClick = useCallback(() => {
    if (balance?.mature) {
      const maxAmount = sompiToKaspaString(balance.mature);
      setPayAmount(maxAmount);
      setPaymentError(null);
    }
  }, [balance]);

  // New function to send payment with encrypted message using payment protocol
  const sendPaymentWithMessage = useCallback(
    async (recipientAddress: string, amountSompi: bigint, message?: string) => {
      if (
        !walletStore.unlockedWallet?.password ||
        !walletStore.accountService
      ) {
        throw new Error("Wallet not unlocked or account service not running");
      }

      // Create simplified payment payload without aliases
      const paymentPayload = {
        type: "payment",
        message: message,
        amount: Number(amountSompi) / 100000000, // Convert sompi to KAS for payload
        timestamp: Date.now(),
        version: 1,
      };

      // Encrypt the payment message for the recipient
      const encryptedMessage = await encrypt_message(
        recipientAddress,
        JSON.stringify(paymentPayload)
      );

      if (!encryptedMessage) {
        throw new Error("Failed to encrypt payment message");
      }

      // Create the simplified payment protocol payload (no alias needed)
      const prefix = "ciph_msg";
      const version = "1";
      const messageType = "payment";
      const payload = `${prefix}:${version}:${messageType}:${encryptedMessage.to_hex()}`;

      // Convert the payload to hex
      const payloadHex = payload
        .split("")
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");

      // Send payment directly to recipient with message payload using new method
      const txId = await walletStore.accountService.createPaymentWithMessage(
        {
          address: new Address(recipientAddress),
          amount: amountSompi,
          payload: payloadHex,
          originalMessage: message, // Pass the original message for outgoing record
        },
        walletStore.unlockedWallet.password
      );

      // Create and store outgoing payment message record (simplified)
      const paymentContent = JSON.stringify({
        type: "payment",
        message: message ?? "",
        amount: Number(amountSompi) / 100000000,
        timestamp: Date.now(),
        version: 1,
      });

      if (!walletStore.address) {
        throw new Error("Wallet address not available");
      }

      const outgoingMessage = {
        transactionId: txId,
        senderAddress: walletStore.address.toString(),
        recipientAddress: recipientAddress,
        timestamp: Date.now(),
        content: paymentContent,
        amount: Number(amountSompi) / 100000000,
        payload: payloadHex,
      };

      // Store the outgoing message
      const messageStore = useMessagingStore.getState();
      messageStore.storeMessage(
        outgoingMessage,
        walletStore.address.toString()
      );
      messageStore.loadMessages(walletStore.address.toString());

      return txId;
    },
    [
      walletStore.accountService,
      walletStore.address,
      walletStore.unlockedWallet?.password,
    ]
  );

  const handleSendPayment = useCallback(async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      setPaymentError("Please enter a valid amount");
      return;
    }

    const amountSompi = kaspaToSompi(payAmount);
    if (!amountSompi) {
      setPaymentError("Invalid amount format");
      return;
    }

    // Check minimum amount (0.19 KAS dust limit)
    const minAmount = kaspaToSompi("0.19");
    if (amountSompi < minAmount!) {
      setPaymentError("Amount must be greater than 0.19 KAS");
      return;
    }

    // Check balance
    if (!balance?.mature || balance.mature < amountSompi) {
      setPaymentError(
        `Insufficient balance. Available: ${balance?.matureDisplay || "0"} KAS`
      );
      return;
    }

    if (!walletStore.unlockedWallet?.password) {
      setPaymentError("Wallet is locked. Please unlock your wallet first.");
      return;
    }

    try {
      setIsSendingPayment(true);
      setPaymentError(null);

      // Always use payment protocol to ensure chat visibility
      // Use the provided message, or an empty space if no message provided
      const messageToSend = payMessage.trim() || " ";

      // Send payment with encrypted message using the simplified payment protocol
      await sendPaymentWithMessage(address, amountSompi, messageToSend);

      // Reset forms on success
      setPayAmount("");
      setPayMessage("");

      // Close both panels
      onPaymentSent?.();

      console.log(
        `Payment of ${payAmount} KAS${
          payMessage ? ` with message "${payMessage}"` : " (no message)"
        } sent successfully to ${address}`
      );
      onPaymentSent();
    } catch (error) {
      console.error("Error sending payment:", error);
      setPaymentError(
        error instanceof Error ? error.message : "Failed to send payment"
      );
    } finally {
      setIsSendingPayment(false);
    }
  }, [
    payAmount,
    balance?.mature,
    balance?.matureDisplay,
    walletStore.unlockedWallet?.password,
    payMessage,
    onPaymentSent,
    address,
    sendPaymentWithMessage,
  ]);

  // Check if user can send messages with payments (now simplified - no conversation required)
  const canSendMessageWithPayment = true; // Anyone can send payment messages now

  return (
    <Popover className="relative">
      <PopoverButton>
        <button
          className="flex w-full items-center gap-2 rounded p-2 hover:bg-white/5"
          title="Send Kaspa payment to recipient"
        >
          <KasIcon
            className="h-10 w-10"
            circleClassName="fill-kas-primary"
            kClassName="fill-gray-800"
          />
        </button>
      </PopoverButton>
      <PopoverPanel
        ref={popoverPanelRef}
        anchor={{ to: "top end", gap: "24px" }}
        className="absolute z-50 mt-3 mb-20 block rounded-lg border border-[var(--border-color)] bg-[var(--secondary-bg)] p-4 transition duration-200 ease-out data-closed:scale-95 data-closed:opacity-0"
        transition
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-medium text-[var(--text-primary)]">
            Send Payment
          </h4>
        </div>

        <div className="flex flex-col gap-3">
          {/* Message input field */}
          <div className="w-full">
            <Input
              type="text"
              value={payMessage}
              onChange={(e) => handlePayMessageChange(e.target.value)}
              placeholder={
                canSendMessageWithPayment
                  ? "Message (optional)"
                  : "Complete handshake to send messages"
              }
              disabled={!canSendMessageWithPayment}
              className={clsx(
                "w-full rounded-md border border-[var(--border-color)] bg-[var(--primary-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-transparent focus:ring-2 focus:ring-[#70C7BA] focus:outline-none",
                {
                  "cursor-not-allowed opacity-50": !canSendMessageWithPayment,
                }
              )}
            />
            {!canSendMessageWithPayment && (
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                Complete a handshake to send encrypted messages with payments
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 md:flex-row md:items-start">
            <div className="w-full flex-1">
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  value={payAmount}
                  onChange={(e) => handlePayAmountChange(e.target.value)}
                  placeholder="Amount (KAS)"
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--primary-bg)] px-3 py-2 pr-12 text-sm text-[var(--text-primary)] focus:border-transparent focus:ring-2 focus:ring-[#70C7BA] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleMaxPayClick}
                  className="border-kas-primary absolute top-1/2 right-2 -translate-y-1/2 transform cursor-pointer rounded-sm border px-1 py-0.5 text-xs font-medium text-[#70C7BA] hover:opacity-80"
                >
                  Max
                </button>
              </div>
              {balance?.matureDisplay && (
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  Available: {balance.matureDisplay} KAS
                </div>
              )}
            </div>

            <button
              onClick={handleSendPayment}
              disabled={isSendingPayment || !payAmount}
              className={clsx(
                "h-10 w-full rounded-md px-4 py-2 text-sm font-medium transition duration-200",
                "bg-[#70C7BA] text-white hover:bg-[#5fb5a3] focus:ring-2 focus:ring-[#70C7BA] focus:outline-none",
                "self-center md:w-auto md:self-auto",
                {
                  "cursor-not-allowed opacity-50":
                    isSendingPayment || !payAmount,
                  "cursor-pointer": payAmount && !isSendingPayment,
                }
              )}
            >
              {isSendingPayment ? "Sending…" : "Send KAS"}
            </button>
            {paymentError && (
              <div className="mt-2 text-sm text-red-500">{paymentError}</div>
            )}
          </div>
        </div>
      </PopoverPanel>
    </Popover>
  );
};
