import { FC } from "react";
import { AvatarHash } from "../icons/AvatarHash";
import { CopyableValueWithQR } from "./CopyableValueWithQR";
import { Crown } from "lucide-react";
import clsx from "clsx";

type GroupParticipantInfoProps = {
  address: string;
  nickname?: string;
  isAdmin?: boolean;
  onClose: () => void;
};

export const GroupParticipantInfo: FC<GroupParticipantInfoProps> = ({
  address,
  nickname,
  isAdmin = false,
}) => {
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
                  "rounded-full text-base leading-none font-bold tracking-wide text-(--text-primary)"
                )}
              >
                {nickname.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 font-semibold break-all text-(--text-primary)">
              <span>{nickname || "No nickname"}</span>
              {isAdmin && <Crown className="size-4 text-amber-500" />}
            </div>
            <div className="text-sm text-(--text-secondary)">
              {isAdmin ? "Group Admin" : "Group Member"}
            </div>
          </div>
        </div>

        {/* Address section */}
        <CopyableValueWithQR value={address} />
      </div>
    </div>
  );
};
