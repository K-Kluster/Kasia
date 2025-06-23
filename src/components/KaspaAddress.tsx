import React, { FC, useMemo, useState, useEffect, useRef, Ref } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { ClipboardIcon } from "@heroicons/react/24/outline";

interface KaspaAddressProps {
  address: string | { toString: () => string };
}

export const KaspaAddress: FC<KaspaAddressProps> = ({ address }) => {
  const [isFullAddress, setIsFullAddress] = useState(false);
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

  const handleCopy = () => {
    console.log("1");
    const asString = typeof address === "string" ? address : address.toString();
    navigator.clipboard.writeText(asString).then(() => {
      console.log("2");
      setTimeout(() => {
        close();
      }, 2000);
    });
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
        <span className="align-middle inline-block leading-normal">
          {firstSubPart}
          <span
            onClick={handleToggle}
            className="px-0.5 text-blue-500 hover:underline cursor-pointer text-xl"
          >
            ...
          </span>
          {secondSubPart}
        </span>
      )}
      <Popover className="relative ml-2">
        <PopoverButton
          onClick={handleCopy}
          className="focus:outline-none cursor-pointer block mt-auto"
        >
          <ClipboardIcon className="size-5 text-white hover:opacity-80" />
        </PopoverButton>

        <PopoverPanel
          transition
          className="mt-2 absolute rounded shadow-lg bg-bg-primary border-bg-secondary border transition duration-200 ease-out data-closed:scale-95 data-closed:opacity-0"
        >
          <p className="text-sm p-2 text-white">Copied!</p>
        </PopoverPanel>
      </Popover>
    </span>
  );
};
