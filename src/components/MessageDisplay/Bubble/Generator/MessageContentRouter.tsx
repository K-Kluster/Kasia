import { FC } from "react";
import { KasiaConversationEvent } from "../../../../types/all";
import { Conversation } from "src/store/repository/conversation.repository";

import { MessageContent } from "../Content/MessageContent";
import { HandshakeContent } from "../Content/HandshakeContent";
import { FileContent } from "../Content/FileContent";
import { PaymentContent } from "../Content/PaymentContent";
import { detectEventType } from "../Utils/MessageTypeDetector"; // renamed for clarity

type MessageContentRouterProps = {
  event: KasiaConversationEvent; // ← event, not Message
  isOutgoing: boolean;
  isDecrypting: boolean;
  decryptionAttempted: boolean;
  decryptedContent: string;
  conversation: Conversation | null;
};

export const MessageContentRouter: FC<MessageContentRouterProps> = ({
  event,
  isOutgoing,
  isDecrypting,
  decryptionAttempted,
  decryptedContent,
  conversation,
}) => {
  const { content, transactionId } = event;

  const messageToRender =
    (decryptionAttempted && decryptedContent) || content || "";

  const { isHandshake, isPayment } = detectEventType(event);

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

  // if (isFile) {
  //   return (
  //     <FileContent
  //       fileData={fileData || null}
  //       content={messageToRender}
  //       transactionId={transactionId}
  //     />
  //   );
  // }

  return (
    <MessageContent content={messageToRender} isDecrypting={isDecrypting} />
  );
};
