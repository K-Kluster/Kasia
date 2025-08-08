import { FC, useState, useEffect, useRef } from "react";
import clsx from "clsx";

import { KasiaConversationEvent } from "../../types/all";
import { useWalletStore } from "../../store/wallet.store";
import { Conversation } from "../../store/repository/conversation.repository";
import { Contact } from "../../store/repository/contact.repository";

import {
  ExplorerLink,
  generateBubbleClasses,
  MessageContentRouter,
  MessageTimestamp,
  MessageMeta,
} from "./Bubble";

type MessageDisplayProps = {
  event: KasiaConversationEvent;
  isOutgoing: boolean;
  contact: Contact;
  conversation: Conversation;
  showTimestamp?: boolean;
  groupPosition?: "single" | "top" | "middle" | "bottom";
};

export const MessageDisplay: FC<MessageDisplayProps> = ({
  event,
  isOutgoing,
  showTimestamp,
  groupPosition = "single",
  conversation,
}) => {
  const [showMeta, setShowMeta] = useState(false);
  const walletStore = useWalletStore();
  const mounted = useRef(true);

  const createdAtMs =
    event.createdAt instanceof Date
      ? event.createdAt.getTime()
      : Number(event.createdAt);

  const isRecent = Date.now() - createdAtMs < 12 * 60 * 60 * 1000;
  const displayStamp =
    showMeta || !isRecent
      ? new Date(createdAtMs).toLocaleString()
      : new Date(createdAtMs).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

  // we already get decrypted content in event.content; satisfy Router booleans
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionAttempted, setDecryptionAttempted] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<string>("");

  useEffect(() => {
    if (!mounted.current) return;
    setIsDecrypting(false);
    setDecryptionAttempted(true);
    setDecryptedContent(event.content ?? "");
    return () => {
      mounted.current = false;
    };
  }, [event.content]);

  // const shouldUseBubble = !(
  //   event.fileData?.type === "file" &&
  //   event.fileData.mimeType?.startsWith?.("image/")
  // );

  const renderMessageContent = () => (
    <MessageContentRouter
      event={event}
      isOutgoing={isOutgoing}
      isDecrypting={isDecrypting}
      decryptionAttempted={decryptionAttempted}
      decryptedContent={decryptedContent}
      conversation={conversation}
    />
  );

  return (
    <div
      className={clsx(
        "flex w-full",
        isOutgoing
          ? "justify-end pr-0.5 sm:pr-2"
          : "justify-start pl-0.5 sm:pl-2"
      )}
    >
      {showMeta && event.transactionId && isOutgoing && (
        <ExplorerLink
          transactionId={event.transactionId}
          network={walletStore.selectedNetwork}
          position="right"
        />
      )}

      {(() => {
        const timeStampBlock = (showMeta || showTimestamp) && (
          <MessageTimestamp timestamp={displayStamp} shouldUseBubble={true} />
        );

        const metaBlock = showMeta && (
          <MessageMeta fee={event.fee} isOutgoing={isOutgoing} />
        );

        return true ? (
          <div
            onClick={() => setShowMeta((prev) => !prev)}
            className={generateBubbleClasses(isOutgoing, groupPosition)}
          >
            <div className="my-0.5 text-base leading-relaxed">
              {renderMessageContent()}
            </div>
            {timeStampBlock}
            {metaBlock}
          </div>
        ) : (
          <div onClick={() => setShowMeta((prev) => !prev)}>
            {renderMessageContent()}
            {timeStampBlock}
            {metaBlock}
          </div>
        );
      })()}

      {showMeta && event.transactionId && !isOutgoing && (
        <ExplorerLink
          transactionId={event.transactionId}
          network={walletStore.selectedNetwork}
          position="left"
        />
      )}
    </div>
  );
};
