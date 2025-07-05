import { FC, useMemo, useState, useEffect, useRef } from "react";
import { Square2StackIcon } from "@heroicons/react/24/outline";
import { toast } from "../utils/toast";
import { useIsMobile } from "../utils/useIsMobile";

interface KaspaAddressProps {
  address: string | { toString: () => string };
}

export const KaspaAddress: FC<KaspaAddressProps> = ({ address }) => {
  const [isFullAddress, setIsFullAddress] = useState(false);
  const addressRef = useRef<HTMLSpanElement>(null);
  const isMobile = useIsMobile();

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

  const handleCopy = () => {
    const asString = typeof address === "string" ? address : address.toString();
    navigator.clipboard.writeText(asString).then(() => {});
    toast.info("Address copied");
  };
  return (
    <span
      ref={addressRef}
      className="flex items-center justify-center align-middle"
    >
      {isFullAddress ? (
        <span className="">
          {typeof address === "string" ? address : address.toString()}
        </span>
      ) : (
        <span className="inline-block align-middle leading-normal">
          {firstSubPart}
          <span
            onClick={handleToggle}
            className="cursor-pointer px-0.5 text-xl text-blue-500 hover:underline max-sm:pointer-events-none max-sm:cursor-default sm:cursor-pointer"
            inert={isMobile ? true : undefined}
          >
            ...
          </span>
          {secondSubPart}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="mt-auto ml-2 block cursor-pointer focus:outline-none"
      >
        <Square2StackIcon className="size-5 text-white hover:opacity-80" />
      </button>
    </span>
  );
};
