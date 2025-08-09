import { FC } from "react";
import { Message as MessageType } from "../../../../types/all";
import { MessageContent } from "../Content/MessageContent";
import { HandshakeContent } from "../Content/HandshakeContent";
import { FileContent } from "../Content/FileContent";
import { PaymentContent } from "../Content/PaymentContent";
import { detectMessageType } from "../Utils/MessageTypeDetector";
import { Conversation } from "src/types/messaging.types";

type MessageContentRouterProps = {
  message: MessageType;
  isOutgoing: boolean;
  isDecrypting: boolean;
  decryptionAttempted: boolean;
  decryptedContent: string;
  conversation: Conversation | null;
};

export const MessageContentRouter: FC<MessageContentRouterProps> = ({
  message,
  isOutgoing,
  isDecrypting,
  decryptionAttempted,
  decryptedContent,
  conversation,
}) => {
  const { content, fileData, transactionId } = message;

  const messageToRender = (decryptionAttempted && decryptedContent) || content;

  // detect message type
  const { isHandshake, isPayment, isFile } = detectMessageType(message);

  // generate the appropriate content component
  if (isHandshake && conversation) {
    return (
      <HandshakeContent conversation={conversation} isHandshake={isHandshake} />
    );
  }

  if (isPayment) {
    return (
      <PaymentContent
        content={messageToRender}
        isOutgoing={isOutgoing}
        isDecrypting={isDecrypting}
      />
    );
  }

  if (isFile) {
    return (
      <FileContent
        fileData={fileData || null}
        content={messageToRender}
        transactionId={transactionId}
      />
    );
  }

  // default to message content
  return (
    <MessageContent
      content={messageToRender || ""}
      isDecrypting={isDecrypting}
    />
  );
};
