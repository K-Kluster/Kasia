import { FC, useMemo, useState, useEffect, useRef } from "react";
import { Square2StackIcon } from "@heroicons/react/24/outline";
import { toast } from "../utils/toast";
import { useIsMobile } from "../utils/useIsMobile";
import { useMessagingStore } from "../store/messaging.store";

interface KaspaAddressProps {
  address: string | { toString: () => string };
}

export const KaspaAddress: FC<KaspaAddressProps> = ({ address }) => {
  const NICKNAME_SHORT_LENGTH = 20;
  const [isFullAddress, setIsFullAddress] = useState(false);
  const addressRef = useRef<HTMLSpanElement>(null);

  const addressStr = typeof address === "string" ? address : address.toString();
  const contact = useMessagingStore((s) =>
    s.contacts.find((c) => c.address === addressStr)
  );
  const nickname =
    contact && typeof contact.nickname === "string" && contact.nickname.trim()
      ? contact.nickname.trim()
      : "";

  const displayString = nickname || addressStr;
  const isNickname = !!nickname;

  const [firstSubPart, secondSubPart] = useMemo(() => {
    const indexOfColon = addressStr.indexOf(":");
    if (indexOfColon === -1) {
      return [addressStr, ""];
    }
    const prefix = addressStr.slice(0, indexOfColon);
    return [
      `${prefix}:${addressStr.slice(indexOfColon + 1, indexOfColon + 6)}`,
      addressStr.slice(-5),
    ];
  }, [addressStr]);

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
    navigator.clipboard.writeText(addressStr).then(() => {});
    toast.info("Address copied");
  };

  const isMobile = useIsMobile();

  const isLongNickname =
    isNickname && displayString.length > NICKNAME_SHORT_LENGTH;

  return (
    <span
      ref={addressRef}
      className="flex items-center justify-center align-middle"
    >
      {isFullAddress || (nickname && !isLongNickname) ? (
        <span className="">{displayString}</span>
      ) : isLongNickname ? (
        <span>
          {displayString.slice(0, NICKNAME_SHORT_LENGTH - 3)}
          <span
            onClick={isMobile ? undefined : handleToggle}
            className={
              isMobile
                ? "px-0.5 text-xl text-blue-500 max-sm:pointer-events-none max-sm:cursor-default sm:cursor-pointer"
                : "cursor-pointer px-0.5 text-xl text-blue-500 hover:underline sm:cursor-pointer"
            }
            inert={isMobile ? true : undefined}
          >
            ...
          </span>
        </span>
      ) : (
        <span>
          {firstSubPart}
          {secondSubPart ? (
            <>
              <span
                onClick={isMobile ? undefined : handleToggle}
                className={
                  isMobile
                    ? "px-0.5 text-xl text-blue-500 max-sm:pointer-events-none max-sm:cursor-default sm:cursor-pointer"
                    : "cursor-pointer px-0.5 text-xl text-blue-500 hover:underline sm:cursor-pointer"
                }
                inert={isMobile ? true : undefined}
              >
                ...
              </span>
              {secondSubPart}
            </>
          ) : null}
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
