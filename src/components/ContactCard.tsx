import { FC, useMemo } from "react";
import { Contact } from "../type/all";
import { decodePayload } from "../utils/all-in-one";

export const ContactCard: FC<{
  contact: Contact;
  onClick?: (contact: Contact) => void;
  isSelected?: boolean;
}> = ({ contact, onClick, isSelected }) => {
  const preview = useMemo(() => {
    return contact.lastMessage.payload
      ? decodePayload(contact.lastMessage.payload)
      : contact.lastMessage.content;
  }, [contact.lastMessage.payload, contact.lastMessage.content]);

  const timestamp = useMemo(() => {
    return contact.lastMessage.timestamp
      ? new Date(contact.lastMessage.timestamp).toLocaleString()
      : "";
  }, [contact.lastMessage.timestamp]);

  const shortAddress = useMemo(() => {
    return `${contact.address.substring(0, 8)}...${contact.address.substring(
      contact.address.length - 8
    )}`;
  }, [contact.address]);

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
