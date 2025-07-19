import { FC, useMemo, useState, useEffect, useRef } from "react";
import { Contact } from "../types/all";
import { decodePayload } from "../utils/format";
import { useMessagingStore } from "../store/messaging.store";
import { AvatarHash } from "./icons/AvatarHash";
import clsx from "clsx";

export const ContactCard: FC<{
  contact: Contact;
  onClick?: (contact: Contact) => void;
  isSelected?: boolean;
  collapsed?: boolean; // tiny-avatar mode
}> = ({ contact, onClick, isSelected, collapsed = false }) => {
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

  useEffect(() => {
    if (
      !isSelected &&
      lastMessage?.transactionId &&
      prevMessageId.current !== undefined && // Only trigger if not first render
      prevMessageId.current !== lastMessage.transactionId
    ) {
      setNewMsgAlert(true);
      const timeout = setTimeout(() => setNewMsgAlert(false), 20000);
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
  const avatarLetter = contact.nickname?.trim()?.[0]?.toUpperCase();

  return (
    <div
      className={clsx(
        "group border-primary-border relative cursor-pointer border-b p-4 transition-all duration-200",
        {
          "bg-primary-bg": isSelected,
          "hover:bg-primary-bg/50": !isSelected,
          "border-kas-secondary": showNewMsgAlert,
        }
      )}
      onClick={() => onClick?.(contact)}
    >
      {/* Internal border overlay for alert */}
      {showNewMsgAlert && (
        <div
          className="border-kas-secondary pointer-events-none absolute inset-0 border-2 transition-all duration-300"
          style={{ zIndex: 1 }}
        />
      )}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="relative h-10 w-10">
            <AvatarHash
              address={contact.address}
              size={40}
              selected={isSelected}
              className={clsx({ "opacity-60": !!avatarLetter })}
            />
            {avatarLetter && (
              <span
                className={clsx(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+1px)]",
                  "pointer-events-none select-none",
                  "flex h-10 w-10 items-center justify-center",
                  "rounded-full text-sm leading-none font-bold tracking-wide text-gray-200"
                )}
              >
                {avatarLetter}
              </span>
            )}
            {isSelected && (
              <div className="ring-kas-secondary pointer-events-none absolute inset-0 animate-pulse rounded-full ring-2 blur-sm filter" />
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-base font-semibold">
            <span
              className={clsx(
                "block w-full cursor-pointer truncate break-all text-[var(--text-primary)] group-data-checked:text-[var(--color-kas-secondary)]",
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
      </div>
    </div>
  );
};
