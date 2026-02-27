import { FC } from "react";
import { AvatarHash } from "../icons/AvatarHash";
import { CopyableValueWithQR } from "./CopyableValueWithQR";
import clsx from "clsx";
import { useBlocklistStore } from "../../store/blocklist.store";
import { useUiStore } from "../../store/ui.store";
import { BlockUnblockButton } from "../Common/BlockUnblockButton";
import { toast } from "../../utils/toast-helper";

type BroadcastParticipantInfoModalProps = {
  address: string;
  nickname?: string;
};

export const BroadcastParticipantInfoModal: FC<
  BroadcastParticipantInfoModalProps
> = ({ address, nickname }) => {
  const blocklistStore = useBlocklistStore();
  const uiStore = useUiStore();
  const isBlocked = blocklistStore.blockedAddresses.has(address);

  const handleBlockWithConfirmation = () => {
    // set up confirmation modal
    uiStore.setConfirmationConfig({
      title: "Block Participant",
      message: `This will block ${nickname || "this participant"} and delete any existing direct messages with them.`,
      confirmText: "Block",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          await blocklistStore.blockAddressAndDeleteData(address);
          toast.success("Participant blocked");
        } catch (error) {
          console.error("Error blocking participant:", error);
          toast.error("Failed to block participant");
        }
      },
    });

    // open confirmation modal
    uiStore.openModal("confirm");
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="space-y-2">
        {/* Avatar and basic info */}
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12">
            <AvatarHash
              address={address}
              size={48}
              className={clsx({
                "opacity-80": !!nickname?.trim()?.[0],
              })}
              selected={true}
              isGroup={true}
            />
            {nickname && (
              <span
                className={clsx(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  "pointer-events-none select-none",
                  "flex h-12 w-12 items-center justify-center",
                  "rounded-full text-base leading-none font-bold tracking-wide text-[var(--text-primary)]"
                )}
              >
                {nickname.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="font-semibold break-all text-[var(--text-primary)]">
                {nickname || "No nickname"}
              </div>
              {/* actions menu */}
              <BlockUnblockButton
                address={address}
                onBlock={handleBlockWithConfirmation}
                className="flex-shrink-0"
              />
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              Broadcast Participant
            </div>
          </div>
        </div>

        {/* Address section */}
        <CopyableValueWithQR value={address} />

        {/* block status */}
        {isBlocked && (
          <div className="rounded-lg border border-red-500/30 bg-[var(--accent-red)]/10 p-3">
            <div className="text-xs font-medium text-[var(--accent-red)]">
              This participant is blocked
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
