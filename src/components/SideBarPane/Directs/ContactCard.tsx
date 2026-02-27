import { FC, useMemo, useState, useEffect, useRef } from "react";
import { decodePayload } from "../../../utils/format";
import { useMessagingStore } from "../../../store/messaging.store";
import { AvatarHash } from "../../icons/AvatarHash";
import { PROTOCOL } from "../../../config/protocol";
import { MARKDOWN_PREFIX } from "../../../config/constants";
import clsx from "clsx";
import { Contact } from "../../../store/repository/contact.repository";
import { getFileTypeFromContent } from "../../../utils/parse-message";
import { stripMarkdown } from "../../../utils/markdown";

function getMessagePreview(content: string) {
  // check if it's a file or image message
  const fileType = getFileTypeFromContent(content);

  if (fileType) {
    try {
      const parsed = JSON.parse(content);
      return parsed.name || (fileType === "image" ? "Image" : "File");
    } catch {
      return fileType === "image" ? "Image" : "File";
    }
  }

  let messageContent: string;
  if (content.startsWith(PROTOCOL.prefix.string)) {
    const decoded = decodePayload(content);
    if (!decoded) return "Encrypted message";
    messageContent = decoded;
  } else {
    messageContent = content;
  }

  const isMarkdown = messageContent.startsWith(MARKDOWN_PREFIX);
  if (isMarkdown) {
    const processedContent = messageContent.slice(MARKDOWN_PREFIX.length);
    // strip off the markdown flags, so we can just render the content 'plain' in the preview
    const plainTextContent = stripMarkdown(processedContent);
    return (
      plainTextContent.slice(0, 40) +
      (plainTextContent.length > 40 ? "..." : "")
    );
  }

  return (
    messageContent.slice(0, 40) + (messageContent.length > 40 ? "..." : "")
  );
}

export const ContactCard: FC<{
  contact: Contact;
  onClick?: (contact: Contact) => void;
  isSelected?: boolean;
  collapsed?: boolean; // tiny-avatar mode
}> = ({ contact, onClick, isSelected, collapsed = false }) => {
  const [showNewMsgAlert, setNewMsgAlert] = useState(false);
  const prevMessageId = useRef<string | undefined>(undefined);

  const oneOnOneConversation = useMessagingStore((s) =>
    s.oneOnOneConversations.find((oooc) => oooc.contact.id === contact.id)
  );

  // Use the store selector to get the latest message for this contact
  const lastEvent = oneOnOneConversation?.events?.at(-1);

  // get last message preview
  const preview = useMemo(() => {
    if (!lastEvent) return "";

    const { content, __type } = lastEvent;

    switch (__type) {
      case "message":
        return getMessagePreview(content);
      case PROTOCOL.headers.PAYMENT.type:
        return "Payment received";
      case PROTOCOL.headers.HANDSHAKE.type:
        if (
          oneOnOneConversation?.conversation.theirAlias &&
          oneOnOneConversation.conversation.status === "active"
        ) {
          return "Handshake completed";
        }

        if (lastEvent.fromMe) {
          return "Handshake sent";
        }

        return "Handshake received";
      default:
        return "";
    }
  }, [
    lastEvent,
    oneOnOneConversation?.conversation.theirAlias,
    oneOnOneConversation?.conversation.status,
  ]);

  const timestamp = useMemo(() => {
    if (!lastEvent?.createdAt) return "";
    return lastEvent.createdAt.toLocaleString();
  }, [lastEvent?.createdAt]);

  const shortAddress = useMemo(() => {
    if (!contact?.kaspaAddress) return "Unknown";
    const addr = contact.kaspaAddress;
    if (addr === "Unknown") {
      if (lastEvent?.__type === PROTOCOL.headers.HANDSHAKE.type) {
        try {
          // use protocol constants instead of hardcoded regex
          const handshakePrefix = `${PROTOCOL.prefix.string}${PROTOCOL.headers.HANDSHAKE.string}`;
          const handshakeMatch = lastEvent.content.match(
            new RegExp(`${handshakePrefix}(.+)`)
          );
          if (handshakeMatch) {
            const handshakeData = JSON.parse(handshakeMatch[1]);
            if (handshakeData.alias) {
              return `Alias: ${handshakeData.alias}`;
            }
          }
        } catch (e) {
          // ignore parsing errors for handshake alias extraction
          void e;
        }
      }
      return "Unknown Contact";
    }
    if (addr.startsWith("kaspa:") || addr.startsWith("kaspatest:")) {
      return `${addr.substring(0, 12)}...${addr.substring(addr.length - 8)}`;
    }
    return addr;
  }, [contact.kaspaAddress, lastEvent]);

  const displayName = useMemo(() => {
    if (contact.name) {
      return contact.name?.trim();
    }
    return shortAddress;
  }, [contact?.name, shortAddress]);

  useEffect(() => {
    if (
      !isSelected &&
      lastEvent?.transactionId &&
      prevMessageId.current !== undefined && // Only trigger if not first render
      prevMessageId.current !== lastEvent.transactionId
    ) {
      setNewMsgAlert(true);
      const timeout = setTimeout(() => setNewMsgAlert(false), 20000);
      prevMessageId.current = lastEvent.transactionId;
      return () => clearTimeout(timeout);
    }
    prevMessageId.current = lastEvent?.transactionId;
  }, [lastEvent?.transactionId, isSelected]);

  useEffect(() => {
    if (isSelected && showNewMsgAlert) {
      setNewMsgAlert(false);
    }
  }, [isSelected, showNewMsgAlert]);

  if (!contact?.kaspaAddress) {
    return null;
  }

  if (collapsed) {
    const avatarLetter = contact.name?.trim()?.slice(0, 2)?.toUpperCase();
    return (
      <div
        className="relative flex cursor-pointer justify-center py-2"
        title={displayName}
        onClick={() => onClick?.(contact)}
      >
        <div className="relative h-8 w-8">
          {/* hash */}
          <AvatarHash
            address={contact.kaspaAddress}
            size={32}
            selected={isSelected}
            className={clsx(
              { "opacity-80": !!avatarLetter },
              showNewMsgAlert && "animate-spin opacity-90"
            )}
          />
          {/* letter */}
          {avatarLetter && (
            <span
              className={clsx(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                "pointer-events-none select-none",
                "flex h-8 w-8 items-center justify-center",
                "rounded-full text-sm leading-none font-bold tracking-wide text-[var(--text-primary)]/80"
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
  const avatarLetter = contact.name?.trim()?.slice(0, 2)?.toUpperCase();

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
              address={contact.kaspaAddress}
              size={40}
              selected={isSelected}
              className={clsx({ "opacity-80": !!avatarLetter })}
            />
            {avatarLetter && (
              <span
                className={clsx(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  "pointer-events-none select-none",
                  "flex h-10 w-10 items-center justify-center",
                  "rounded-full text-sm leading-none font-bold tracking-wide text-[var(--text-primary)]/80"
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
                  "cursor-help": contact.name?.trim(),
                  "cursor-default": !contact.name?.trim(),
                }
              )}
              title={
                contact.name?.trim() ? `Address: ${shortAddress}` : undefined
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
