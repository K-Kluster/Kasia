import { FC } from "react";
import { GroupWithMessages } from "../../../store/group.store";
import { Avatar } from "./Avatar";
import clsx from "clsx";
import { getMessagePreview } from "../../../utils/message-preview";

export const GroupCardInline: FC<{
  groupWithMessages: GroupWithMessages;
  isSelected: boolean;
  collapsed: boolean;
  onClick: () => void;
}> = ({ groupWithMessages, isSelected, collapsed, onClick }) => {
  const { group, lastMessage } = groupWithMessages;

  const preview = lastMessage
    ? lastMessage.isFromMe
      ? `You: ${getMessagePreview(lastMessage.content)}`
      : getMessagePreview(lastMessage.content)
    : "No messages yet";

  const timestamp = lastMessage
    ? lastMessage.createdAt.toLocaleString()
    : group.lastActivityAt.toLocaleString();

  const displayName = group.name;
  const avatarLetter = group.name.slice(0, 2).toUpperCase();

  if (collapsed) {
    return (
      <div
        className="relative flex cursor-pointer justify-center py-2"
        title={displayName}
        onClick={onClick}
      >
        <Avatar
          address={group.adminAddress}
          size={32}
          displayName={displayName}
          isSelected={isSelected}
          isGroup={true}
          collapsed={true}
        />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "group border-primary-border relative cursor-pointer border-b p-4 transition-all duration-200",
        {
          "bg-primary-bg": isSelected,
          "hover:bg-primary-bg/50": !isSelected,
        }
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* group avatar */}
        <Avatar
          address={group.adminAddress}
          size={40}
          displayName={displayName}
          isSelected={isSelected}
          isGroup={true}
          collapsed={false}
        />

        {/* group info */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline gap-2 text-base font-semibold">
            <span className="truncate text-(--text-primary)">
              {displayName}
            </span>
            <span className="text-xs text-(--kas-secondary)">
              ({group.members.length})
            </span>
          </div>
          <div className="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-(--text-secondary)">
            {preview}
          </div>
          <div className="mt-1 text-xs text-(--text-secondary)">
            {timestamp}
          </div>
        </div>
      </div>
    </div>
  );
};
