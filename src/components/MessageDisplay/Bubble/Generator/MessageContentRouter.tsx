import { FC } from "react";
import { KasiaConversationEvent } from "../../../../types/all";
import { Conversation } from "../../../../store/repository/conversation.repository";

import { MessageContent } from "../Content/MessageContent";
import { HandshakeContent } from "../Content/HandshakeContent";
import { FileContent } from "../Content/FileContent";
import { PaymentContent } from "../Content/PaymentContent";

import type { FileData } from "../../../../store/repository/message.repository";
import { Contact } from "src/store/repository/contact.repository";

type MessageContentRouterProps = {
  event: KasiaConversationEvent;
  isOutgoing: boolean;
  isDecrypting: boolean;
  decryptionAttempted: boolean;
  decryptedContent: string;
  conversation: Conversation | null;
  contact: Contact;
};

function extractFileData(e: KasiaConversationEvent): FileData | null {
  // check if it's a message with fileData property
  if (
    e.__type === "message" &&
    "fileData" in e &&
    e.fileData?.type === "file"
  ) {
    return e.fileData as FileData;
  }

  if (e.content) {
    try {
      const parsed = JSON.parse(e.content);
      if (parsed?.type === "file") {
        return {
          ...parsed,
          size: parsed.size || 0,
        } as FileData;
      }
    } catch {
      // not JSON, ignore
    }
  }
  return null;
}

export const MessageContentRouter: FC<MessageContentRouterProps> = ({
  event,
  isOutgoing,
  isDecrypting,
  decryptionAttempted,
  decryptedContent,
  conversation,
  contact,
}) => {
  const { content, transactionId, __type } = event;

  const messageToRender =
    (decryptionAttempted ? decryptedContent : content) ?? "";

  switch (__type) {
    case "handshake":
      return conversation ? (
        <HandshakeContent
          conversation={conversation}
          isHandshake
          contact={contact}
          handshakeId={String(event.id)}
        />
      ) : (
        <MessageContent content={messageToRender} isDecrypting={isDecrypting} />
      );

    case "payment":
      return (
        <PaymentContent
          content={messageToRender}
          isOutgoing={isOutgoing}
          isDecrypting={isDecrypting}
        />
      );

    case "message":
    default: {
      const file = extractFileData(event);
      return file ? (
        <FileContent
          content={messageToRender}
          transactionId={transactionId}
          fileData={file}
        />
      ) : (
        <MessageContent content={messageToRender} isDecrypting={isDecrypting} />
      );
    }
  }
};
