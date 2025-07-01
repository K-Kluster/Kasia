// src/components/AddressSection.tsx
import { FC, useState, useEffect, useCallback } from "react";
import { toDataURL } from "qrcode";
import { DocumentDuplicateIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import { Button } from "../Common/Button";
import { toast } from "../../utils/toast";

type AddressSectionProps = {
  address?: string;
};

export const WalletAddressSection: FC<AddressSectionProps> = ({
  address = "",
}) => {
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeURL, setQRCodeURL] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    toDataURL(address, (err, uri) => {
      if (!err) {
        setQRCodeURL(uri);
        console.log("QR code generated successfully");
      }
    });
  }, [address]);

  const handleCopyAddress = useCallback(async () => {
    if (!address) {
      toast.error("No address available");
      console.log("No address to copy");
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      try {
        console.log("Using modern clipboard API");
        await navigator.clipboard.writeText(address);
        console.log("Address copied using modern clipboard API");
        toast.info("Address copied to clipboard");
        return;
      } catch (error) {
        console.log("Modern clipboard API failed:", error);
      }
    }
    console.log("Using fallback copy method");
    try {
      const textarea = document.createElement("textarea");
      textarea.value = address;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.info("Address copied to clipboard");
      console.log("Fallback copy successful");
    } catch {
      toast.error("Copy failed");
      console.log("Fallback copy failed");
    }
  }, [address]);

  const toggleQRCode = useCallback(() => {
    setShowQRCode((prev) => !prev);
    console.log("QR code visibility toggled");
  }, []);

  if (!address) return null;
  return (
    <div className="relative">
      <div className="mb-2">
        <strong>Address:</strong>
        <div className="address-actions my-1 flex flex-col items-center gap-2 sm:flex-row">
          <div className="flex">
            <span
              id="wallet-address"
              className="flex w-full cursor-pointer items-center rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-[13px] leading-[1.4] break-all text-white transition-colors select-all hover:border-white/20 hover:bg-white/10"
              onClick={() => {
                console.log("Address text selected");
                // Select the text when clicked
                const selection = window.getSelection();
                const range = document.createRange();
                const addressElement =
                  document.getElementById("wallet-address");
                if (addressElement && selection) {
                  range.selectNodeContents(addressElement);
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
              }}
              title="Click to select address"
            >
              {address}
            </span>
          </div>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
            <Button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Copy button clicked");
                handleCopyAddress();
              }}
              title="Copy address to clipboard"
              type="button"
              variant="primary"
              className="flex h-16 w-full items-center justify-center p-0"
            >
              <DocumentDuplicateIcon className="h-7 w-7 sm:h-5 sm:w-5" />
            </Button>
            <Button
              onClick={toggleQRCode}
              title="Show QR code"
              type="button"
              variant="primary"
              className="flex h-16 w-full items-center justify-center p-0"
            >
              <QrCodeIcon className="h-7 w-7 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>

        {showQRCode && qrCodeURL && (
          <div className="mt-2 flex w-full flex-col items-center rounded-lg border border-white/10 bg-black/30 p-4 transition-opacity duration-300 sm:w-auto">
            <h4 className="mb-4 text-center text-white">QR Code for Address</h4>
            <div className="flex flex-col items-center gap-4">
              <img
                src={qrCodeURL}
                alt="QR Code for wallet address"
                className="h-auto max-w-[200px] rounded-lg bg-white p-2"
                onLoad={() => console.log("QR code image loaded successfully")}
                onError={(e) => {
                  console.error("QR code image failed to load:", e);
                  console.log("Failed URL:", qrCodeURL);
                }}
              />
              <p className="text-center text-sm text-white/70">
                Scan to get wallet address
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
