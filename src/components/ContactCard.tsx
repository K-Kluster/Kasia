import { FC, useMemo, useState, useEffect, useRef } from "react";
import { Contact } from "../types/all";
import { decodePayload } from "../utils/format";
import { useMessagingStore } from "../store/messaging.store";
import { AvatarHash } from "./icons/AvatarHash";
import {
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";

export const ContactCard: FC<{
  contact: Contact;
  onClick?: (contact: Contact) => void;
  isSelected?: boolean;
  collapsed?: boolean; // tiny-avatar mode
}> = ({ contact, onClick, isSelected, collapsed = false }) => {
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState(contact.nickname || "");
  const messagingStore = useMessagingStore();
  const [showNewMsgAlert, setNewMsgAlert] = useState(false);
  const prevMessageId = useRef<string | undefined>(undefined);

  // Use the store selector to get the latest message for this contact
  const lastMessage = useMessagingStore((s) =>
    s.getLastMessageForContact(contact.address)
  );

  // get last message preview
  const preview = useMemo(() => {
    if (!lastMessage) return "";

    const { content, payload } = lastMessage;

    // Handle different message types
    if (content) {
      // If it's a handshake message
      if (
        content.includes("Handshake completed") ||
        content.includes("handshake")
      ) {
        return "Handshake completed";
      }

      // If it's a file message
      if (content.startsWith("[File:")) {
        // only consider the file name, not the whole content
        return content;
      }

      // For regular messages, try to decode if it's encrypted
      if (content.startsWith("ciph_msg:")) {
        const decoded = decodePayload(content);
        return decoded
          ? decoded.slice(0, 40) + (content.length > 40 ? "..." : "")
          : "Encrypted message";
      }

      // Check if it's a payment message
      try {
        const parsed = JSON.parse(content);
        if (parsed.type === "payment") {
          return parsed.message?.trim() || "Payment";
        }
      } catch (e) {
        // Not a payment message, continue with normal handling
        void e;
      }

      // Plain text content, take the first 40 characters
      return content.slice(0, 40) + (content.length > 40 ? "..." : "");
    }

    // Fallback to payload if no content
    if (payload) {
      if (payload.includes("handshake")) {
        return "Handshake message";
      }

      const decoded = decodePayload(payload);
      return decoded || "Encrypted message";
    }

    return "No message content";
  }, [lastMessage]);

  const timestamp = useMemo(() => {
    if (!lastMessage?.timestamp) return "";
    return new Date(lastMessage.timestamp).toLocaleString();
  }, [lastMessage?.timestamp]);

  const shortAddress = useMemo(() => {
    if (!contact?.address) return "Unknown";
    const addr = contact.address;
    if (addr === "Unknown") {
      if (lastMessage?.payload?.includes("handshake")) {
        try {
          const handshakeMatch = lastMessage.payload.match(
            /ciph_msg:1:handshake:(.+)/
          );
          if (handshakeMatch) {
            const handshakeData = JSON.parse(handshakeMatch[1]);
            if (handshakeData.alias) {
              return `Alias: ${handshakeData.alias}`;
            }
          }
        } catch (e) {
          // Ignore parsing errors for handshake alias extraction
          void e;
        }
      }
      return "Unknown Contact";
    }
    if (addr.startsWith("kaspa:") || addr.startsWith("kaspatest:")) {
      return `${addr.substring(0, 12)}...${addr.substring(addr.length - 8)}`;
    }
    return addr;
  }, [contact?.address, lastMessage?.payload]);

  const displayName = useMemo(() => {
    if (contact.nickname?.trim()) {
      return contact.nickname;
    }
    return shortAddress;
  }, [contact?.nickname, shortAddress]);

  const handleNicknameSave = () => {
    messagingStore.setContactNickname(contact.address, tempNickname);
    setIsEditingNickname(false);
  };

  const handleNicknameCancel = () => {
    setTempNickname(contact.nickname || "");
    setIsEditingNickname(false);
  };

  useEffect(() => {
    if (
      !isSelected &&
      lastMessage?.transactionId &&
      prevMessageId.current !== undefined && // Only trigger if not first render
      prevMessageId.current !== lastMessage.transactionId
    ) {
      setNewMsgAlert(true);
      const timeout = setTimeout(() => setNewMsgAlert(false), 5000);
      prevMessageId.current = lastMessage.transactionId;
      return () => clearTimeout(timeout);
    }
    prevMessageId.current = lastMessage?.transactionId;
  }, [lastMessage?.transactionId, isSelected]);

  useEffect(() => {
    if (isSelected && showNewMsgAlert) {
      setNewMsgAlert(false);
    }
  }, [isSelected, showNewMsgAlert]);

  if (!contact?.address) {
    return null;
  }

  if (collapsed) {
    const avatarLetter = contact.nickname?.trim()?.[0]?.toUpperCase();
    return (
      <div
        className="relative flex cursor-pointer justify-center py-2"
        title={displayName}
        onClick={() => onClick?.(contact)}
      >
        <div className="relative h-8 w-8">
          {/* hash */}
          <AvatarHash
            address={contact.address}
            size={32}
            selected={isSelected}
            className={clsx(
              { "opacity-60": !!avatarLetter },
              showNewMsgAlert && "animate-spin opacity-90"
            )}
          />
          {/* letter */}
          {avatarLetter && (
            <span
              className={clsx(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+1px)]",
                "pointer-events-none select-none",
                "flex h-8 w-8 items-center justify-center",
                "rounded-full text-base leading-none font-bold tracking-wide text-gray-200"
              )}
            >
              {avatarLetter}
            </span>
          )}
          {/* ring hugging the avatar, only when selected */}
          {isSelected && (
            <div className="ring-kas-secondary pointer-events-none absolute inset-0 rounded-full ring-2" />
          )}
        </div>
      </div>
    );
  }

  // Expanded (full view)
  return (
    <div
      className={clsx(
        "group bg-bg-secondary relative mb-2 cursor-pointer overflow-hidden rounded-lg border p-4 transition-all duration-200 hover:bg-slate-900/20",
        {
          "border-[var(--color-kas-primary)] bg-[var(--color-kas-primary)]/5":
            isSelected,
          "border-[var(--border-color)]": !isSelected && !showNewMsgAlert,
          "border-kas-secondary": showNewMsgAlert,
        }
      )}
      onClick={() => !isEditingNickname && onClick?.(contact)}
    >
      {/* Internal border overlay for alert */}
      {showNewMsgAlert && (
        <div
          className="border-kas-secondary pointer-events-none absolute inset-0 rounded-lg border-2 transition-all duration-300"
          style={{ zIndex: 1 }}
        />
      )}
      <div className="mb-2 text-base font-semibold">
        {isEditingNickname ? (
          <div className="flex w-full flex-col md:flex-row md:items-center md:gap-2">
            <input
              type="text"
              value={tempNickname}
              onChange={(e) => setTempNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNicknameSave();
                if (e.key === "Escape") handleNicknameCancel();
              }}
              autoFocus
              placeholder={contact?.address}
              className="h-5 flex-1 rounded-sm text-xs leading-none"
            />
            <div className="mt-2 flex w-full justify-between gap-2 md:mt-0 md:w-auto md:justify-start">
              <button
                onClick={handleNicknameSave}
                className="flex w-full cursor-pointer items-center justify-center rounded-sm bg-green-500 p-0.5 hover:bg-gray-600 md:w-fit"
              >
                <CheckCircleIcon className="h-5 w-5 fill-current text-gray-300" />
              </button>
              <button
                onClick={handleNicknameCancel}
                className="flex w-full cursor-pointer items-center justify-center rounded-sm bg-red-500 p-0.5 text-white hover:bg-gray-600 md:w-fit"
              >
                <XCircleIcon className="h-5 w-5 fill-current text-gray-300" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-1">
            <span
              className={clsx(
                "max-w-full cursor-pointer truncate break-all text-[var(--text-primary)] group-data-checked:text-[var(--color-kas-secondary)]",
                {
                  "cursor-help": contact.nickname?.trim(),
                  "cursor-default": !contact.nickname?.trim(),
                }
              )}
              title={
                contact.nickname?.trim()
                  ? `Address: ${shortAddress}`
                  : undefined
              }
            >
              {displayName}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingNickname(true);
              }}
              title="Edit nickname"
              className="cursor-pointer border-0 bg-transparent text-xs opacity-60 hover:opacity-100"
            >
              <PencilIcon className="h-5 w-5 md:h-4 md:w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[var(--text-secondary)]">
        <span
          className={clsx(
            "relative transition-colors duration-300",
            showNewMsgAlert && "text-kas-secondary animate-pulse"
          )}
        >
          {preview}
        </span>
      </div>
      <div className="mt-1 text-xs text-[var(--text-secondary)]">
        {timestamp}
      </div>
    </div>
  );
};
