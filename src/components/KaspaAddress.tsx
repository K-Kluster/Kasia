import React, { FC, useMemo, useState, useEffect, useRef, Ref } from "react";
import { Square2StackIcon, CheckIcon } from "@heroicons/react/24/outline";

interface KaspaAddressProps {
  address: string | { toString: () => string };
}

export const KaspaAddress: FC<KaspaAddressProps> = ({ address }) => {
  const [isFullAddress, setIsFullAddress] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const addressRef = useRef<HTMLSpanElement>(null);

  const [firstSubPart, secondSubPart] = useMemo(() => {
    const asString = typeof address === "string" ? address : address.toString();

    if (asString.length < 10) {
      return [asString, ""];
    }

    const indexOfColon = asString.indexOf(":");
    // keep the prefix, can be either kaspa or kaspatest
    const prefix = asString.slice(0, indexOfColon);

    // shorten the address to the first 5 and last 5 characters
    return [
      `${prefix}:${asString.slice(indexOfColon + 1, indexOfColon + 6)}`,
      `${asString.slice(-5)}`,
    ];
  }, [address]);

  const handleClickOutside = (event: MouseEvent) => {
    if (
      addressRef.current &&
      !addressRef.current.contains(event.target as Node)
    ) {
      setIsFullAddress(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggle = () => {
    setIsFullAddress(!isFullAddress);
  };

  const handleCopy = async () => {
    const asString = typeof address === "string" ? address : address.toString();

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(asString);
        console.log("Address copied successfully via clipboard API");
        setCopySuccess(true);
        setTimeout(() => {
          setCopySuccess(false);
        }, 2000);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = asString;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand("copy");
        if (successful) {
          console.log("Address copied successfully via fallback method");
          setCopySuccess(true);
          setTimeout(() => {
            setCopySuccess(false);
          }, 2000);
        } else {
          console.error("Fallback copy failed");
        }

        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error("Copy error:", err);
    }
  };

  return (
    <span ref={addressRef} className="inline-flex items-center align-middle">
      {isFullAddress ? (
        <span className="break-all" style={{ userSelect: "all" }}>
          {typeof address === "string" ? address : address.toString()}
        </span>
      ) : (
        <span
          className="align-middle inline-block leading-normal"
          style={{ userSelect: "all" }}
        >
          {firstSubPart}
          <span
            onClick={handleToggle}
            className="px-0.5 text-blue-500 hover:underline cursor-pointer text-xl"
            style={{ userSelect: "none" }}
          >
            ...
          </span>
          {secondSubPart}
        </span>
      )}
      <span style={{ userSelect: "none" }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCopy();
          }}
          className="focus:outline-none cursor-pointer block mt-auto ml-2"
          title="Copy address"
          type="button"
        >
          {copySuccess ? (
            <CheckIcon className="size-5 text-green-400" />
          ) : (
            <Square2StackIcon className="size-5 text-white hover:opacity-80" />
          )}
        </button>
      </span>
    </span>
  );
};
