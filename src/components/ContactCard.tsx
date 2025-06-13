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
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 8)}`;
  }, [contact?.address]);

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
