import { ChangeEvent, FC, useCallback, useState } from "react"
import { createWithdrawTransaction } from "../service/account-service"
import { kaspaToSompi, sompiToKaspaString } from "kaspa-wasm"
import { useWalletStore } from "../store/wallet.store"

const maxDustAmount = kaspaToSompi("0.19")!

export const WalletWithdrawal: FC = () => {
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawError, setWithdrawError] = useState("")
  const [isSending, setIsSending] = useState(false)

  const [amountInputError, setAmountInputError] = useState<string | null>(null)

  const balance = useWalletStore((store) => store.balance)
  const inputAmountUpdated = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (/^-?\d*\.?\d*$/.test(event.target.value) === false) {
        return
      }

      // update input value
      setWithdrawAmount(event.target.value)

      const unValidatedAmountAsSompi = kaspaToSompi(event.target.value)

      if (unValidatedAmountAsSompi === undefined) {
        setAmountInputError("Invalid amount.")
      }

      const validatedAmountAsSompi = unValidatedAmountAsSompi ?? BigInt(0)
      const matureBalanceAmount = balance?.mature ?? BigInt(0)

      // if value is empty, clear any errors
      if (validatedAmountAsSompi === BigInt(0)) {
        setAmountInputError(null)
        return
      }

      // Check if amount exceeds balance first
      if (validatedAmountAsSompi > matureBalanceAmount) {
        setAmountInputError("Amount exceeds available balance.")
        return
      }

      // Check if amount is too small
      if (validatedAmountAsSompi < maxDustAmount) {
        setAmountInputError("Amount must be greater than 0.19 KAS.")
        return
      }

      // Amount is valid
      setAmountInputError(null)
      return
    },
    [balance]
  )

  const handleMaxClick = useCallback(() => {
    const matureBalance = balance?.mature ?? BigInt(0)
    const maxAmount = sompiToKaspaString(matureBalance)
    setWithdrawAmount(maxAmount)
    // Clear any existing errors since max amount is always valid
    setAmountInputError(null)
  }, [balance])

  const handleWithdraw = useCallback(async () => {
    if (amountInputError !== null) {
      return
    }

    try {
      setWithdrawError("")
      setIsSending(true)

      if (!withdrawAddress || !withdrawAmount) {
        throw new Error("Please enter both address and amount")
      }

      const amount = kaspaToSompi(withdrawAmount)
      if (amount === undefined) {
        throw new Error("Please enter a valid amount")
      }

      // Use mature balance directly since it's already in KAS
      const matureSompiBalance = balance?.mature || BigInt(0)
      console.log("Balance check:", {
        amount,
        matureSompiBalance,
        storeBalance: balance,
      })

      if (amount > matureSompiBalance) {
        throw new Error(
          `Insufficient balance. Available: ${sompiToKaspaString(
            matureSompiBalance
          )} KAS`
        )
      }

      await createWithdrawTransaction(withdrawAddress, amount)
      setWithdrawAddress("")
      setWithdrawAmount("")
    } catch (error) {
      setWithdrawError(
        error instanceof Error ? error.message : "Failed to send transaction"
      )
    } finally {
      setIsSending(false)
    }
  }, [withdrawAddress, withdrawAmount, amountInputError, balance])

  return (
    <>
      <h4 className="font-semibold text-lg">Withdraw KAS</h4>
      <div className="mt-2">
        <textarea
          value={withdrawAddress}
          onChange={(e) => setWithdrawAddress(e.target.value)}
          placeholder="Enter Kaspa address"
          rows={2}
          className="w-full p-2 mb-2 bg-black/30 border border-white/20 rounded-md text-white resize-none break-words whitespace-pre-wrap"
        />

        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={withdrawAmount}
              onChange={inputAmountUpdated}
              placeholder="Amount (KAS)"
              className="w-full p-2 pl-2 pr-14 bg-black/30 border border-white/10 rounded-md text-white box-border"
            />
            <button
              type="button"
              onClick={handleMaxClick}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-600 font-semibold text-sm cursor-pointer"
            >
              Max
            </button>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={isSending || amountInputError !== null}
            className={`px-4 py-2 bg-blue-500 text-white rounded-md cursor-pointer transition-opacity duration-200 ${
              isSending || amountInputError ? "opacity-70" : "opacity-100"
            }`}
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
        {withdrawError && (
          <div className="text-red-500 mt-2 text-sm text-center">
            {withdrawError}
          </div>
        )}

        {amountInputError && (
          <div className="text-red-500 mt-2 text-sm text-center">
            {amountInputError}
          </div>
        )}
      </div>
    </>
  )
}
