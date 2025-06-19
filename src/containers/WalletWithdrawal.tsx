import { ChangeEvent, FC, useCallback, useState } from "react";
import { createWithdrawTransaction } from "../service/account-service";
import { WalletBalance } from "../types/wallet.type";
import { kaspaToSompi, sompiToKaspaString } from "kaspa-wasm";
import { useWalletStore } from "../store/wallet.store";

const maxDustAmount = kaspaToSompi("0.19")!;

export const WalletWithdrawal: FC<{ walletBalance: WalletBalance }> = ({
  walletBalance,
}) => {
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
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
      setWithdrawError("");
      setIsSending(true);

      if (!withdrawAddress || !withdrawAmount) {
        throw new Error("Please enter both address and amount");
      }

      const amount = kaspaToSompi(withdrawAmount);
      if (amount === undefined) {
        throw new Error("Please enter a valid amount");
      }

      // Use mature balance directly since it's already in KAS
      const matureSompiBalance = walletBalance?.mature || BigInt(0);
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
      setWithdrawError(
        error instanceof Error ? error.message : "Failed to send transaction"
      );
    } finally {
      setIsSending(false);
    }
  }, [walletBalance, withdrawAddress, withdrawAmount, amountInputError, balance]);

  return (
    <>
      <h3>Withdraw KAS</h3>
      <div className="withdraw-section" style={{ marginTop: "10px" }}>
        <input
          type="text"
          value={withdrawAddress}
          onChange={(e) => setWithdrawAddress(e.target.value)}
          placeholder="Enter Kaspa address"
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "8px",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "4px",
            color: "white",
          }}
        />
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              value={withdrawAmount}
              onChange={inputAmountUpdated}
              placeholder="Amount (KAS)"
              style={{
                width: "100%",
                padding: "8px 50px 8px 8px", // Add right padding for Max button
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                color: "white",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={handleMaxClick}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#2196f3",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "bold",
                padding: "0",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#1976d2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#2196f3";
              }}
            >
              Max
            </button>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={isSending || amountInputError !== null}
            style={{
              padding: "8px 16px",
              backgroundColor: "#2196f3",
              border: "none",
              borderRadius: "4px",
              color: "white",
              cursor: "pointer",
              opacity: isSending ? 0.7 : 1,
            }}
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
        {withdrawError && (
          <div
            style={{
              color: "#ff4444",
              marginTop: "8px",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            {withdrawError}
          </div>
        )}
        {amountInputError && (
          <div
            style={{
              color: "#ff4444",
              marginTop: "8px",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            {amountInputError}
          </div>
        )}
      </div>
    </>
  );
};
