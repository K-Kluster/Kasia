import { Popover, PopoverButton, PopoverPanel, Input } from "@headlessui/react";
import clsx from "clsx";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { KasIcon } from "../components/icons/KasCoin";
import { sompiToKaspaString, kaspaToSompi } from "kaspa-wasm";
import { createWithdrawTransaction } from "../service/account-service";
import { useWalletStore } from "../store/wallet.store";

export const SendPayment: FC<{ address: string }> = ({ address }) => {
  // Pay functionality state
  const [payAmount, setPayAmount] = useState("");
  const [isSendingPayment, setIsSendingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const balance = useWalletStore((s) => s.balance);
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
    setPaymentError(null);
  }, [address]);

  const handlePayAmountChange = useCallback((value: string) => {
    // Allow decimal numbers
    if (/^\d*\.?\d*$/.test(value)) {
      setPayAmount(value);
      setPaymentError(null);
    }
  }, []);

  const handleMaxPayClick = useCallback(() => {
    if (balance?.mature) {
      const maxAmount = sompiToKaspaString(balance.mature);
      setPayAmount(maxAmount);
      setPaymentError(null);
    }
  }, [balance]);

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

    try {
      setIsSendingPayment(true);
      setPaymentError(null);

      // @TODO: create a separate function for this logic
      //        we probably want to create an unsigned transaction and let the user confirms it before broadcasting it
      await createWithdrawTransaction(address, amountSompi);

      // Reset forms on success
      setPayAmount("");

      // Show success feedback (optional - you can remove this if you don't want any feedback)
      console.log(
        `Payment of ${payAmount} KAS sent successfully to ${address}`
      );
    } catch (error) {
      console.error("Error sending payment:", error);
      setPaymentError(
        error instanceof Error ? error.message : "Failed to send payment"
      );
    } finally {
      setIsSendingPayment(false);
    }
  }, [address, payAmount, balance]);

  return (
    <Popover className="relative">
      <PopoverButton>
        <button
          className="p-2 w-full rounded hover:bg-white/5 flex items-center gap-2"
          title="Send Kaspa payment to recipient"
        >
          <KasIcon
            className="w-10 h-10"
            circleClassName="fill-kas-primary"
            kClassName="fill-gray-800"
          />
        </button>
      </PopoverButton>
      <PopoverPanel
        ref={popoverPanelRef}
        anchor={{ to: "top end", gap: "24px" }}
        className="absolute mb-20 block z-50 mt-3 p-4 bg-[var(--secondary-bg)] border border-[var(--border-color)] rounded-lg transition duration-200 ease-out data-closed:scale-95 data-closed:opacity-0"
        transition
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-[var(--text-primary)]">
            Send Payment
          </h4>
        </div>

        <div className="flex flex-col items-center gap-2 md:flex-row md:items-start">
          <div className="flex-1 w-full">
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                value={payAmount}
                onChange={(e) => handlePayAmountChange(e.target.value)}
                placeholder="Amount (KAS)"
                className="w-full px-3 py-2 pr-12 bg-[var(--primary-bg)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[#70C7BA] focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleMaxPayClick}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#70C7BA] hover:opacity-80 font-medium text-xs border border-kas-primary rounded-sm px-1 py-0.5"
              >
                Max
              </button>
            </div>
            {balance?.matureDisplay && (
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                Available: {balance.matureDisplay} KAS
              </div>
            )}
          </div>

          <button
            onClick={handleSendPayment}
            disabled={isSendingPayment || !payAmount}
            className={clsx(
              "px-4 py-2 w-full md:w-auto rounded-md font-medium text-sm transition-all duration-200 h-10",
              "bg-[#70C7BA] text-white hover:bg-[#5fb5a3] focus:outline-none focus:ring-2 focus:ring-[#70C7BA]",
              {
                "opacity-50 cursor-not-allowed": isSendingPayment || !payAmount,
              },
              "self-center md:self-auto"
            )}
          >
            {isSendingPayment ? "Sending..." : "Send KAS"}
          </button>
        </div>

        {paymentError && (
          <div className="mt-2 text-sm text-red-500">{paymentError}</div>
        )}
      </PopoverPanel>
    </Popover>
  );
};
