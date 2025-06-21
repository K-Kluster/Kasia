// src/components/AddressSection.tsx
import React, { FC, useState, useEffect, useCallback } from "react";
import { toDataURL } from "qrcode";

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

  return (
    <div className="relative mb-5">
      <div className="address-section">
        <strong>Address:</strong>
        <div className="address-row">
          <div className="address-info">
            <span
              className="address"
              id="wallet-address"
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
          <div className="address-actions">
            <button
              className="copy-button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Copy button clicked");
                handleCopyAddress();
              }}
              title="Copy address to clipboard"
              type="button"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button
              className="qr-button"
              onClick={toggleQRCode}
              title="Show QR code"
              type="button"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="5" height="5"></rect>
                <rect x="16" y="3" width="5" height="5"></rect>
                <rect x="3" y="16" width="5" height="5"></rect>
                <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>
                <path d="M21 21v.01"></path>
                <path d="M12 7v3a2 2 0 0 1-2 2H7"></path>
                <path d="M3 12h.01"></path>
                <path d="M12 3h.01"></path>
                <path d="M12 16v.01"></path>
                <path d="M16 12h1"></path>
                <path d="M21 12v.01"></path>
                <path d="M12 21v-1"></path>
              </svg>
            </button>
          </div>
        </div>
        {copyNotification && (
          <div className="copy-notification">{copyNotification}</div>
        )}
        {showQRCode && address && qrCodeURL && (
          <div className="qr-code-section">
            <h4>QR Code for Address</h4>
            <div className="qr-code-container">
              <img
                src={qrCodeURL}
                alt="QR Code for wallet address"
                className="qr-code-image"
                onLoad={() => console.log("QR code image loaded successfully")}
                onError={(e) => {
                  console.error("QR code image failed to load:", e);
                  console.log("Failed URL:", qrCodeURL);
                }}
              />
              <p className="qr-code-text">Scan to get wallet address</p>
            </div>
          </div>
        )}
      </div>

      <style>
        {`
        .address-section {
          margin-bottom: 20px;
        }
        .address-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .address-info {
          flex: 1;
          min-width: 0;
        }
        .address {
          cursor: pointer;
          padding: 8px 12px;
          border-radius: 6px;
          transition: background-color 0.2s;
          user-select: all;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-family: monospace;
          font-size: 13px;
          word-break: break-all;
          line-height: 1.4;
          width: 100%;
          display: block;
          height: 40px;
          display: flex;
          align-items: center;
        }
        .address:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .address-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-shrink: 0;
        }
        .address-actions .copy-button, 
        .address-actions .qr-button {
          background-color: #2196f3 !important;
          background: #2196f3 !important;
          border: 1px solid #2196f3 !important;
          border-radius: 4px;
          color: white !important;
          cursor: pointer !important;
          padding: 0 !important;
          margin: 0 !important;
          transition: all 0.2s ease;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: 40px !important;
          height: 40px !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          outline: none;
          position: relative;
          z-index: 10;
          pointer-events: auto !important;
          flex-shrink: 0;
          opacity: 1 !important;
        }
        .address-actions .copy-button:hover, 
        .address-actions .qr-button:hover {
          background-color: #1976d2 !important;
          background: #1976d2 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          border-color: #1976d2 !important;
        }
        .address-actions .copy-button:active, 
        .address-actions .qr-button:active {
          transform: translateY(0) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          background-color: #1565c0 !important;
          background: #1565c0 !important;
        }
        .address-actions .copy-button:focus, 
        .address-actions .qr-button:focus {
          outline: 2px solid rgba(33, 150, 243, 0.5);
          outline-offset: 2px;
        }
        .address-actions .copy-button svg, 
        .address-actions .qr-button svg {
          width: 18px;
          height: 18px;
          stroke: white !important;
          fill: none !important;
          opacity: 1;
          color: white !important;
        }
        .copy-notification {
          position: absolute;
          top: 100%;
          left: 0;
          background: #4caf50;
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 1000;
          animation: fadeInOut 3s ease-in-out;
          white-space: nowrap;
        }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(-10px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        .qr-code-section {
          margin-top: 20px;
          padding: 15px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .qr-code-section h4 {
          margin: 0 0 15px 0;
          color: white;
          text-align: center;
        }
        .qr-code-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .qr-code-image {
          background: white;
          padding: 10px;
          border-radius: 8px;
          max-width: 200px;
          height: auto;
        }
        .qr-code-text {
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          margin: 0;
          text-align: center;
        }
        `}
      </style>
    </div>
  );
};
