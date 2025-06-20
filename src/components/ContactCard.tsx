import { FC, useMemo, useState } from "react";
import { Contact } from "../types/all";
import { decodePayload } from "../utils/all-in-one";
import { useMessagingStore } from "../store/messaging.store";

export const ContactCard: FC<{
  contact: Contact;
  onClick?: (contact: Contact) => void;
  isSelected?: boolean;
}> = ({ contact, onClick, isSelected }) => {
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState(contact.nickname || "");
  const messagingStore = useMessagingStore();

  const preview = useMemo(() => {
    if (!contact?.lastMessage) return "";

    const message = contact.lastMessage;

    // Handle different message types
    if (message.content) {
      // If it's a handshake message
      if (
        message.content.includes("Handshake completed") ||
        message.content.includes("handshake")
      ) {
        return "Handshake completed";
      }

      // If it's a file message
      if (message.content.startsWith("[File:")) {
        return message.content;
      }

      // For regular messages, try to decode if it's encrypted
      if (message.content.startsWith("ciph_msg:")) {
        const decoded = decodePayload(message.content);
        return decoded || "Encrypted message";
      }

      // Plain text content
      return message.content;
    }

    // Fallback to payload if no content
    if (message.payload) {
      if (message.payload.includes("handshake")) {
        return "Handshake message";
      }

      const decoded = decodePayload(message.payload);
      return decoded || "Encrypted message";
    }

    return "No message content";
  }, [contact?.lastMessage]);

  const timestamp = useMemo(() => {
    if (!contact?.lastMessage?.timestamp) return "";
    return new Date(contact.lastMessage.timestamp).toLocaleString();
  }, [contact?.lastMessage?.timestamp]);

  const shortAddress = useMemo(() => {
    if (!contact?.address) return "Unknown";
    const addr = contact.address;

    // If address is "Unknown", try to extract a better name from the message content
    if (addr === "Unknown") {
      // Try to extract alias from handshake messages
      if (contact.lastMessage?.payload?.includes("handshake")) {
        try {
          const handshakeMatch = contact.lastMessage.payload.match(
            /ciph_msg:1:handshake:(.+)/
          );
          if (handshakeMatch) {
            const handshakeData = JSON.parse(handshakeMatch[1]);
            if (handshakeData.alias) {
              return `Alias: ${handshakeData.alias}`;
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      return "Unknown Contact";
    }

    // For valid Kaspa addresses, show truncated version
    if (addr.startsWith("kaspa:") || addr.startsWith("kaspatest:")) {
      return `${addr.substring(0, 12)}...${addr.substring(addr.length - 8)}`;
    }

    return addr;
  }, [contact?.address, contact?.lastMessage?.payload]);

  const displayName = useMemo(() => {
    // If nickname exists, show ONLY the nickname
    if (contact.nickname?.trim()) {
      return contact.nickname;
    }
    // Otherwise show the address/alias (unchanged)
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

  // Don't render if we don't have a valid contact
  if (!contact?.address) {
    return null;
  }

  return (
    <div
      className={`contact-item ${isSelected ? "active" : ""}`}
      onClick={() => !isEditingNickname && onClick?.(contact)}
    >
      <div className="contact-name">
        {isEditingNickname ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              width: "100%",
            }}
          >
            <input
              type="text"
              value={tempNickname}
              onChange={(e) => setTempNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNicknameSave();
                if (e.key === "Escape") handleNicknameCancel();
              }}
              autoFocus
              placeholder="Enter nickname..."
              style={{
                flex: 1,
                padding: "2px 6px",
                border: "1px solid #ccc",
                borderRadius: "3px",
                fontSize: "12px",
              }}
            />
            <button
              onClick={handleNicknameSave}
              style={{
                padding: "2px 6px",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
                background: "#4CAF50",
                color: "white",
              }}
            >
              ✓
            </button>
            <button
              onClick={handleNicknameCancel}
              style={{
                padding: "2px 6px",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
                background: "#f44336",
                color: "white",
              }}
            >
              ✗
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
            }}
          >
            <span
              style={{
                flex: 1,
                cursor: contact.nickname?.trim() ? "help" : "default",
              }}
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
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                opacity: 0.6,
                fontSize: "12px",
                padding: "2px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
            >
              ✏️
            </button>
          </div>
        )}
      </div>
      <div className="contact-preview">{preview}</div>
      <div className="contact-time">{timestamp}</div>
    </div>
  );
};
