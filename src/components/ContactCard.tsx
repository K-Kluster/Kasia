import { FC, useMemo } from "react";
import { Contact } from "../type/all";
import { decodePayload } from "../utils/all-in-one";

export const ContactCard: FC<{
  contact: Contact;
  onClick?: (contact: Contact) => void;
  isSelected?: boolean;
}> = ({ contact, onClick, isSelected }) => {
  const preview = useMemo(() => {
    if (!contact?.lastMessage) return "";
    return contact.lastMessage.payload
      ? decodePayload(contact.lastMessage.payload)
      : contact.lastMessage.content || "";
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
          const handshakeMatch = contact.lastMessage.payload.match(/ciph_msg:1:handshake:(.+)/);
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
    if (addr.startsWith('kaspa:') || addr.startsWith('kaspatest:')) {
      return `${addr.substring(0, 12)}...${addr.substring(addr.length - 8)}`;
    }
    
    return addr;
  }, [contact?.address, contact?.lastMessage?.payload]);

  // Don't render if we don't have a valid contact
  if (!contact?.address) {
    return null;
  }

  return (
    <div
      className={`contact-item ${isSelected ? "active" : ""}`}
      onClick={() => onClick?.(contact)}
    >
      <div className="contact-name">{shortAddress}</div>
      <div className="contact-preview">{preview}</div>
      <div className="contact-time">{timestamp}</div>
    </div>
  );
};
