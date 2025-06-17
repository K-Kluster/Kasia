import { ChangeEvent, FC, useCallback, useState } from "react";
import { sendTransaction } from "../service/account-service";
import { WalletBalance } from "../types/wallet.type";

export const WalletWithdrawal: FC<{ walletBalance: WalletBalance }> = ({
  walletBalance,
}) => {
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const inputAmountUpdated = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (/^-?\d*\.?\d*$/.test(event.target.value) === false) {
        return;
      }

      setWithdrawAmount(event.target.value);
    },
    []
  );

  const handleWithdraw = useCallback(async () => {
    try {
      setWithdrawError("");
      setIsSending(true);

      if (!withdrawAddress || !withdrawAmount) {
        throw new Error("Please enter both address and amount");
      }

      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Use mature balance directly since it's already in KAS
      const matureBalanceKAS = walletBalance?.mature || 0;
      console.log("Balance check:", {
        amount,
        matureBalanceKAS,
        walletBalance,
      });

      if (amount > matureBalanceKAS) {
        throw new Error(
          `Insufficient balance. Available: ${matureBalanceKAS.toFixed(8)} KAS`
        );
      }

      await sendTransaction(withdrawAddress, amount);
      setWithdrawAddress("");
      setWithdrawAmount("");
    } catch (error) {
      setWithdrawError(
        error instanceof Error ? error.message : "Failed to send transaction"
      );
    } finally {
      setIsSending(false);
    }
  }, [walletBalance, withdrawAddress, withdrawAmount]);

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
          <input
            type="text"
            value={withdrawAmount}
            onChange={inputAmountUpdated}
            placeholder="Amount (KAS)"
            style={{
              flex: 1,
              padding: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              color: "white",
            }}
          />
          <button
            onClick={handleWithdraw}
            disabled={isSending}
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
      </div>
    </>
  );
};
