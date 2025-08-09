import { FC } from "react";
import { HandshakeResponse } from "./HandshakeResponse";
import { Contact } from "../../../../store/repository/contact.repository";
import { Conversation } from "../../../../store/repository/conversation.repository";

type HandshakeContentProps = {
  conversation: Conversation | null;
  contact: Contact;
  isHandshake: boolean | null;
  handshakeId: string;
};

export const HandshakeContent: FC<HandshakeContentProps> = ({
  conversation,
  contact,
  isHandshake,
  handshakeId,
}) => {
  if (!isHandshake || !conversation) {
    return null;
  }

  if (conversation.status === "pending" && !conversation.initiatedByMe) {
    console.log("Rendering handshake response for conversation:", conversation);
    return (
      <HandshakeResponse
        conversation={conversation}
        contact={contact}
        handshakeId={handshakeId}
      />
    );
  }

  return conversation.status === "active"
    ? "Handshake completed"
    : conversation.initiatedByMe
      ? "Handshake sent"
      : "Handshake received";
};
