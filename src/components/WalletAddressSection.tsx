// src/components/AddressSection.tsx
import React, { FC, useState, useEffect, useCallback } from "react";
import { toDataURL } from "qrcode";
import { DocumentDuplicateIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

type AddressSectionProps = {
  address?: string;
};

export const WalletAddressSection: FC<AddressSectionProps> = ({
  address = "",
}) => {
  const [copyNotification, setCopyNotification] = useState("");
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
      setCopyNotification("No address available");
      console.log("No address to copy");
      setTimeout(() => setCopyNotification(""), 3000);
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        console.log("Using modern clipboard API");
        await navigator.clipboard.writeText(address);
        setCopyNotification("Address copied to clipboard");
        console.log("Address copied using modern clipboard API");
        setTimeout(() => setCopyNotification(""), 3000);
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
      setCopyNotification("Address copied to clipboard");
      console.log("Fallback copy successful");
    } catch {
      setCopyNotification("Copy failed");
      console.log("Fallback copy failed");
    } finally {
      setTimeout(() => setCopyNotification(""), 3000);
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
        <div
          className="flex items-center
         gap-2 my-1"
        >
          <div className="flex">
            <span
              className="cursor-pointer px-3 py-6 rounded-md transition-colors select-all bg-black/30 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-mono text-[13px] break-all leading-[1.4] w-full h-10 flex items-center"
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
          <div className="flex gap-2 items-center address-actions">
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Copy button clicked");
                handleCopyAddress();
              }}
              title="Copy address to clipboard"
              type="button"
              className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 focus:outline focus:outline-blue-300 border border-blue-500 text-white rounded flex items-center justify-center w-12 h-12 shadow transition-all duration-200"
            >
              <DocumentDuplicateIcon className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={toggleQRCode}
              title="Show QR code"
              type="button"
              className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 focus:outline focus:outline-blue-300 border border-blue-500 text-white rounded flex items-center justify-center w-12 h-12 shadow transition-all duration-200"
            >
              <QrCodeIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        <div
          className={clsx(
            "select-none absolute top-full left-0 bg-green-600 text-white px-3 py-2 rounded text-sm z-[1000] whitespace-nowrap transition-opacity duration-300",
            {
              "opacity-100": copyNotification,
              "opacity-0": !copyNotification,
            }
          )}
        >
          {copyNotification}
        </div>
        {showQRCode && address && qrCodeURL && (
          <div className="mt-2 p-4 bg-black/30 border border-white/10 rounded-lg flex flex-col items-center transition-opacity duration-300">
            <h4 className="text-white text-center mb-4">QR Code for Address</h4>
            <div className="flex flex-col items-center gap-4">
              <img
                src={qrCodeURL}
                alt="QR Code for wallet address"
                className="bg-white p-2 rounded-lg max-w-[200px] h-auto"
                onLoad={() => console.log("QR code image loaded successfully")}
                onError={(e) => {
                  console.error("QR code image failed to load:", e);
                  console.log("Failed URL:", qrCodeURL);
                }}
              />
              <p className="text-white/70 text-center text-sm">
                Scan to get wallet address
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
