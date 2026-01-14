import { FC, useState, useEffect, useRef } from "react";

import { KasiaConversationEvent } from "../../../types/all";
import { useWalletStore } from "../../../store/wallet.store";
import { Conversation } from "../../../store/repository/conversation.repository";
import { Contact } from "../../../store/repository/contact.repository";
import { isImageType } from "../../../utils/parse-message";

import {
  MessageBubble,
  MessageContentRouter,
  MessageMeta,
  ImageView,
} from "../Utilities";

type DirectDisplayProps = {
  event: KasiaConversationEvent;
  isOutgoing: boolean;
  contact: Contact;
  conversation: Conversation;
  showTimestamp?: boolean;
  groupPosition?: "single" | "top" | "middle" | "bottom";
};

export const DirectDisplay: FC<DirectDisplayProps> = ({
  event,
  isOutgoing,
  contact,
  showTimestamp,
  groupPosition = "single",
  conversation,
}) => {
  const walletStore = useWalletStore();
  const mounted = useRef(true);
  const isImage = isImageType(event);

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

  return (
    <MessageBubble
      message={{
        senderAddress: isOutgoing
          ? (walletStore.address?.toString() ?? "")
          : contact.kaspaAddress,
        content: event.content ?? "",
        timestamp:
          event.createdAt instanceof Date
            ? event.createdAt
            : new Date(Number(event.createdAt)),
        transactionId: event.transactionId ?? undefined,
      }}
      isOutgoing={isOutgoing}
      showTimestamp={showTimestamp}
      groupPosition={groupPosition}
      network={walletStore.selectedNetwork}
      showAvatar={false}
      useCustomColor={false}
      noBubble={isImage}
      timestampInBubble={!isImage}
      renderMetaRight={
        isOutgoing ? <ImageView data={event} position="right" /> : null
      }
      renderMetaLeft={
        !isOutgoing ? <ImageView data={event} position="left" /> : null
      }
      renderContent={() => (
        <MessageContentRouter
          event={event}
          isOutgoing={isOutgoing}
          isDecrypting={isDecrypting}
          decryptionAttempted={decryptionAttempted}
          decryptedContent={decryptedContent}
          conversation={conversation}
          contact={contact}
        />
      )}
      renderFooter={({ showMeta }) =>
        showMeta ? (
          <MessageMeta fee={event.fee} isOutgoing={isOutgoing} />
        ) : null
      }
    />
  );
};
