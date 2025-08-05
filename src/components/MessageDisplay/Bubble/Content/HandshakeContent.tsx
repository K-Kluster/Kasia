import { FC } from "react";
import { HandshakeResponse } from "../../../HandshakeResponse";
import { Conversation } from "../../../../types/messaging.types";

type HandshakeContentProps = {
  conversation: Conversation | null;
  isHandshake: boolean;
};

export const HandshakeContent: FC<HandshakeContentProps> = ({
  conversation,
  isHandshake,
}) => {
  if (!isHandshake || !conversation) {
    return null;
  }

  // Only show handshake response UI if:
  // 1. The conversation is pending
  // 2. We didn't initiate it
  // 3. It hasn't been responded to yet
  if (conversation.status === "pending" && !conversation.initiatedByMe) {
    console.log("Rendering handshake response for conversation:", conversation);
    return <HandshakeResponse conversation={conversation} />;
  }

  // For other handshake messages, just show the status text
  return conversation.status === "active"
    ? "Handshake completed"
    : conversation.initiatedByMe
      ? "Handshake sent"
      : "Handshake received";
};
