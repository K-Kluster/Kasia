import { FC, useState, useEffect, useRef } from "react";
import clsx from "clsx";

import { KasiaConversationEvent } from "../../types/all";
import { useWalletStore } from "../../store/wallet.store";
import { Conversation } from "../../store/repository/conversation.repository";
import { Contact } from "../../store/repository/contact.repository";
import { isImageType } from "../../utils/parse-message";

import {
  ExplorerLink,
  generateBubbleClasses,
  MessageContentRouter,
  MessageTimestamp,
  MessageMeta,
  ImageView,
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
  contact,
  showTimestamp,
  groupPosition = "single",
  conversation,
}) => {
  const [showMeta, setShowMeta] = useState(false);
  const walletStore = useWalletStore();
  const mounted = useRef(true);
  const isImage = isImageType(event);

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

  // if image, don't use bubble
  const shouldUseBubble = !isImage;

  const renderMessageContent = () => (
    <MessageContentRouter
      event={event}
      isOutgoing={isOutgoing}
      isDecrypting={isDecrypting}
      decryptionAttempted={decryptionAttempted}
      decryptedContent={decryptedContent}
      conversation={conversation}
      contact={contact}
    />
  );

  const renderTimestamp = () => {
    if (!showMeta && !showTimestamp) return null;

    return (
      <MessageTimestamp
        timestamp={displayStamp}
        shouldUseBubble={shouldUseBubble}
      />
    );
  };

  const renderMeta = () => {
    if (!showMeta) return null;

    return <MessageMeta fee={event.fee} isOutgoing={isOutgoing} />;
  };

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
        <>
          <ImageView data={event} position="right" />
          <ExplorerLink
            transactionId={event.transactionId}
            network={walletStore.selectedNetwork}
            position="right"
          />
        </>
      )}

      <div
        onClick={() => setShowMeta((prev) => !prev)}
        className={clsx(
          "my-0.5 text-base leading-relaxed",
          shouldUseBubble && generateBubbleClasses(isOutgoing, groupPosition)
        )}
      >
        {renderMessageContent()}
        {renderTimestamp()}
        {renderMeta()}
      </div>

      {showMeta && event.transactionId && !isOutgoing && (
        <>
          <ExplorerLink
            transactionId={event.transactionId}
            network={walletStore.selectedNetwork}
            position="left"
          />
          <ImageView data={event} position="left" />
        </>
      )}
    </div>
  );
};
