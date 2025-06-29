import { ChangeEvent, FC, useCallback, useState } from "react";
import { createWithdrawTransaction } from "../../service/account-service";
import { kaspaToSompi, sompiToKaspaString } from "kaspa-wasm";
import { useWalletStore } from "../../store/wallet.store";
import { Button } from "../Common/Button";
import { toast } from "../../utils/toast";

const maxDustAmount = kaspaToSompi("0.19")!;

export const WalletWithdrawal: FC = () => {
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [amountInputError, setAmountInputError] = useState<string | null>(null);

  const balance = useWalletStore((store) => store.balance);
  const inputAmountUpdated = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (/^-?\d*\.?\d*$/.test(event.target.value) === false) {
        return;
      }

      // update input value
      setWithdrawAmount(event.target.value);

      const unValidatedAmountAsSompi = kaspaToSompi(event.target.value);

      if (unValidatedAmountAsSompi === undefined) {
        setAmountInputError("Invalid amount.");
      }

      const validatedAmountAsSompi = unValidatedAmountAsSompi ?? BigInt(0);
      const matureBalanceAmount = balance?.mature ?? BigInt(0);

      // if value is empty, clear any errors
      if (validatedAmountAsSompi === BigInt(0)) {
        setAmountInputError(null);
        return;
      }

      // Check if amount exceeds balance first
      if (validatedAmountAsSompi > matureBalanceAmount) {
        setAmountInputError("Amount exceeds available balance.");
        return;
      }

      // Check if amount is too small
      if (validatedAmountAsSompi < maxDustAmount) {
        setAmountInputError("Amount must be greater than 0.19 KAS.");
        return;
      }

      // Amount is valid
      setAmountInputError(null);
      return;
    },
    [balance]
  );

  const handleMaxClick = useCallback(() => {
    const matureBalance = balance?.mature ?? BigInt(0);
    const maxAmount = sompiToKaspaString(matureBalance);
    setWithdrawAmount(maxAmount);
    // Clear any existing errors since max amount is always valid
    setAmountInputError(null);
  }, [balance]);

  const handleWithdraw = useCallback(async () => {
    if (amountInputError !== null) {
      return;
    }

    try {
      setIsSending(true);

      if (!withdrawAddress || !withdrawAmount) {
        throw new Error("Please enter both Address and Amount");
      }
      if (!withdrawAddress.toLowerCase().startsWith("kaspa")) {
        throw new Error("Address must be of type Kaspa");
      }

      const amount = kaspaToSompi(withdrawAmount);
      if (amount === undefined) {
        throw new Error("Please enter a valid amount");
      }

      // Use mature balance directly since it's already in KAS
      const matureSompiBalance = balance?.mature || BigInt(0);
      console.log("Balance check:", {
        amount,
        matureSompiBalance,
        storeBalance: balance,
      });

      if (amount > matureSompiBalance) {
        throw new Error(
          `Insufficient balance. Available: ${sompiToKaspaString(
            matureSompiBalance
          )} KAS`
        );
      }

      await createWithdrawTransaction(withdrawAddress, amount);
      setWithdrawAddress("");
      setWithdrawAmount("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send transaction"
      );
    } finally {
      setIsSending(false);
    }
  }, [withdrawAddress, withdrawAmount, amountInputError, balance]);

  return (
    <>
      <h4 className="text-lg font-semibold">Withdraw KAS</h4>
      <div className="mt-2">
        <textarea
          value={withdrawAddress}
          onChange={(e) => setWithdrawAddress(e.target.value)}
          placeholder="Enter Kaspa address"
          rows={2}
          className="mb-2 w-full resize-none rounded-md border border-white/20 bg-black/30 p-2 break-words whitespace-pre-wrap text-white"
        />

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={withdrawAmount}
              onChange={inputAmountUpdated}
              placeholder="Amount (KAS)"
              className="box-border w-full rounded-md border border-white/10 bg-black/30 pr-14 pl-2 text-white"
            />
            <button
              type="button"
              onClick={handleMaxClick}
              className="absolute top-1/2 right-2 -translate-y-1/2 transform cursor-pointer text-sm font-semibold text-blue-500 hover:text-blue-600"
            >
              Max
            </button>
          </div>
          <Button
            onClick={handleWithdraw}
            disabled={isSending || amountInputError !== null}
            variant="primary"
            className="!w-fit !py-2.5"
          >
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>

        {amountInputError && (
          <div className="mt-2 text-center text-sm text-red-500">
            {amountInputError}
          </div>
        )}
      </div>
    </>
  );
};
