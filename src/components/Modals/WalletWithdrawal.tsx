import { ChangeEvent, FC, useCallback, useState } from "react";
import { kaspaToSompi, sompiToKaspaString } from "kaspa-wasm";
import { useWalletStore } from "../../store/wallet.store";
import { Button } from "../Common/Button";
import { toast } from "../../utils/toast-helper";
import { pasteFromClipboard } from "../../utils/clipboard";
import { Clipboard, QrCode } from "lucide-react";
import { useUiStore } from "../../store/ui.store";
import { Address, FeeSource } from "kaspa-wasm";
import { cameraPermissionService } from "../../service/camera-permission-service";
import {
  useFeatureFlagsStore,
  FeatureFlags,
} from "../../store/featureflag.store";
import { MIN_NETWORK_FEE } from "../../config/constants";

const minAmount = MIN_NETWORK_FEE;

export const WalletWithdrawal: FC = () => {
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [amountInputError, setAmountInputError] = useState<string | null>(null);

  const closeModal = useUiStore((s) => s.closeModal);
  const openModal = useUiStore((s) => s.openModal);
  const setQrScannerCallback = useUiStore((s) => s.setQrScannerCallback);

  const accountService = useWalletStore((store) => store.accountService);
  const balance = useWalletStore((store) => store.balance);

  // Check if camera feature is enabled
  const { flags } = useFeatureFlagsStore();
  const cameraEnabled = flags[FeatureFlags.ENABLED_CAMERA];

  const inputAmountUpdated = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (
        /^[+]?([0-9]+(?:[.][0-9]*)?|\.[0-9]+)$/.test(event.target.value) ===
        false
      ) {
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
      if (validatedAmountAsSompi < minAmount) {
        setAmountInputError("Amount must be greater than 0.2 KAS.");
        return;
      }

      // Amount is valid
      setAmountInputError(null);
      return;
    },
    [balance]
  );

  const handleMaxClick = () => {
    const matureBalance = balance?.mature ?? BigInt(0);
    const maxAmount = sompiToKaspaString(matureBalance);
    setWithdrawAmount(maxAmount);
    // Clear any existing errors since max amount is always valid
    setAmountInputError(null);
  };

  const handlePaste = async () => {
    const text = await pasteFromClipboard();
    setWithdrawAddress(text.toLowerCase());
  };

  const handleQrScan = async () => {
    // Request camera access through the service
    const hasAccess = await cameraPermissionService.requestCamera();
    if (!hasAccess) return;

    // Set the callback to handle scanned data
    setQrScannerCallback((data: string) => {
      setWithdrawAddress(data.toLowerCase());
    });

    // Open the QR scanner modal
    openModal("qr-scanner");
  };

  const handleWithdraw = async () => {
    if (amountInputError !== null) {
      return;
    }

    try {
      setIsSending(true);

      if (!accountService) {
        return;
      }

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

      const txId = await accountService.createWithdrawTransaction({
        address: new Address(withdrawAddress),
        amount: amount,
        priorityFee: { amount: BigInt(0), source: FeeSource.SenderPays },
      }); //withdrawAddress, amount);
      console.log(`UTXO Compounding succeed, txid: ${txId}`);
      setWithdrawAddress("");
      setWithdrawAmount("");
      toast.success("Withdraw Success");
      closeModal("withdraw");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send transaction"
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <h4 className="text-lg font-semibold">Withdraw KAS</h4>
      <div className="mt-2">
        <div className="relative mb-2">
          <textarea
            value={withdrawAddress}
            onChange={(e) => setWithdrawAddress(e.target.value)}
            placeholder="Enter Kaspa address"
            rows={3}
            className="border-primary-border focus:ring-kas-secondary/80 bg-primary-bg w-full resize-none rounded-lg border p-2 pr-24 text-base break-words whitespace-pre-wrap focus:ring-2 focus:outline-none sm:text-sm"
          />
          <div className="absolute right-2 bottom-2 flex gap-1 pb-1">
            <button
              type="button"
              onClick={handlePaste}
              className="bg-kas-secondary/10 border-kas-secondary cursor-pointer rounded-lg border px-1.5 py-1 transition-colors"
              title="Paste from clipboard"
            >
              <Clipboard size={16} />
            </button>
            {cameraEnabled && (
              <button
                type="button"
                className="bg-kas-secondary/10 border-kas-secondary cursor-pointer rounded-lg border p-1"
                onClick={handleQrScan}
                title="Scan QR code"
              >
                <QrCode className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            value={withdrawAmount}
            onChange={inputAmountUpdated}
            placeholder="Amount (KAS)"
            className="border-primary-border focus:ring-kas-secondary/80 bg-primary-bg box-border w-full rounded-lg border py-2 pr-14 pl-2 focus:ring-2 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleMaxClick}
            className="border-kas-secondary bg-kas-secondary/10 text-kas-secondary hover:text-kas-secondary/80 absolute top-1/2 right-2 -translate-y-1/2 transform cursor-pointer rounded-lg border px-1.5 text-sm font-semibold"
          >
            Max
          </button>
        </div>
        <div className="mt-0.5 flex items-start justify-start">
          <span className="text-text-secondary me-2">Funds Available:</span>
          <span className="text-text-secondary">
            {balance?.matureDisplay} KAS
          </span>
        </div>
        <div className="mt-2 flex flex-col-reverse justify-center gap-2 sm:flex-row sm:gap-4">
          <Button
            onClick={() => {
              closeModal("withdraw");
              openModal("walletInfo");
            }}
            variant="secondary"
            className="!w-full sm:w-auto"
          >
            Back to Wallet
          </Button>

          <Button
            onClick={handleWithdraw}
            disabled={isSending || amountInputError !== null}
            variant="primary"
            className="!w-full sm:w-auto"
          >
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
        {amountInputError && (
          <div className="text-accent-red mt-2 text-center text-sm">
            {amountInputError}
          </div>
        )}
      </div>
    </>
  );
};
