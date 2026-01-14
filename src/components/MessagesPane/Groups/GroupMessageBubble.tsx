import React from "react";
import { GroupMessage } from "../../../store/repository/group-message.repository";
import { Group } from "../../../store/repository/group.repository";
import { useWalletStore } from "../../../store/wallet.store";
import { useUiStore } from "../../../store/ui.store";
import { useGroupStore } from "../../../store/group.store";
import {
  FileContent,
  MessageBubble,
  MessageContent,
  ImageView,
} from "../Utilities";
import { extractFileData } from "../../../utils/parse-message";
import type { KasiaConversationEvent } from "../../../types/all";

interface GroupMessageBubbleProps {
  message: GroupMessage;
  group: Group;
  showTimestamp: boolean;
  groupPosition: "single" | "top" | "middle" | "bottom";
}

export const GroupMessageBubble: React.FC<GroupMessageBubbleProps> = ({
  message,
  group,
  showTimestamp,
  groupPosition,
}) => {
  const { address, selectedNetwork } = useWalletStore();
  const addressString = address?.toString() || "";
  const { openModal } = useUiStore();
  const { setSelectedGroupParticipant } = useGroupStore();

  const isFromMe = message.senderAddress === addressString;

  const senderAddress = message.senderAddress;
  const mockEvent = {
    content: message.content,
    __type: "message",
  } as unknown as KasiaConversationEvent;
  const fileData = extractFileData(mockEvent);
  const isImage = fileData?.mimeType?.startsWith("image/") ?? false;

  const handleAvatarClick = () => {
    setSelectedGroupParticipant({
      address: senderAddress,
      nickname: senderAddress.slice(-2).toUpperCase(),
      isAdmin: senderAddress === group.adminAddress,
    });
    openModal("group-participant-info");
  };

  return (
    <MessageBubble
      message={{
        senderAddress,
        content: message.content,
        timestamp:
          message.createdAt instanceof Date
            ? message.createdAt
            : new Date(Number(message.createdAt)),
        transactionId: message.transactionId,
      }}
      isOutgoing={isFromMe}
      showTimestamp={showTimestamp}
      groupPosition={groupPosition}
      network={selectedNetwork}
      onAvatarClick={handleAvatarClick}
      noBubble={isImage}
      useCustomColor={!isImage}
      timestampInBubble={!isImage}
      renderMetaRight={
        isFromMe ? <ImageView data={mockEvent} position="right" /> : null
      }
      renderMetaLeft={
        !isFromMe ? <ImageView data={mockEvent} position="left" /> : null
      }
      renderContent={() => {
        if (fileData) {
          return (
            <FileContent
              content={message.content}
              fileData={fileData}
              transactionId={message.transactionId}
            />
          );
        }

        return (
          <MessageContent
            content={message.content}
            isDecrypting={false}
            isOutgoing={isFromMe}
          />
        );
      }}
    />
  );
};
