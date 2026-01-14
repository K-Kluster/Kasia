import { FC } from "react";
import { AvatarHash } from "../../icons/AvatarHash";
import clsx from "clsx";

interface AvatarProps {
  address: string;
  size: number;
  displayName?: string;
  isSelected?: boolean;
  isGroup?: boolean;
  collapsed?: boolean;
  className?: string;
}

export const Avatar: FC<AvatarProps> = ({
  address,
  size,
  displayName,
  isSelected = false,
  isGroup = false,
  collapsed = false,
  className,
}) => {
  const effectiveDisplayName = displayName || address.slice(-2).toUpperCase();
  const avatarLetter = effectiveDisplayName.slice(0, 2).toUpperCase();

  if (collapsed) {
    const avatarSize = size === 32 ? 32 : 36; // Support 32 or 36 for collapsed avatars
    const containerSize = avatarSize === 32 ? "h-8 w-8" : "h-9 w-9";
    const letterSize =
      avatarSize === 32 ? "h-8 w-8 text-xs" : "h-9 w-9 text-xs";

    return (
      <div className={`relative ${containerSize}`}>
        <AvatarHash
          address={address}
          size={avatarSize}
          selected={isSelected}
          isGroup={isGroup}
          className={clsx({ "opacity-80": !!avatarLetter }, className)}
        />
        {/* letter */}
        {avatarLetter && (
          <span
            className={clsx(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              "pointer-events-none select-none",
              `flex ${letterSize} items-center justify-center`,
              "rounded-full leading-none font-bold tracking-wide text-(--text-primary)/80"
            )}
          >
            {avatarLetter}
          </span>
        )}
        {/* ring hugging the avatar, only when selected */}
        {isSelected && (
          <div className="ring-kas-secondary pointer-events-none absolute inset-0 rounded-full ring-2" />
        )}
      </div>
    );
  }

  const containerSize =
    size === 40 ? "h-10 w-10" : size === 48 ? "h-12 w-12" : "h-10 w-10";
  const letterSize =
    size === 40
      ? "h-10 w-10 text-sm"
      : size === 48
        ? "h-12 w-12 text-base"
        : "h-10 w-10 text-sm";

  return (
    <div className="relative shrink-0">
      <div className={`relative ${containerSize}`}>
        <AvatarHash
          address={address}
          size={size}
          selected={isSelected}
          isGroup={isGroup}
          className={clsx({ "opacity-80": !!avatarLetter }, className)}
        />
        {avatarLetter && (
          <span
            className={clsx(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              "pointer-events-none select-none",
              `flex ${letterSize} items-center justify-center`,
              "rounded-full leading-none font-bold tracking-wide text-(--text-primary)/80"
            )}
          >
            {avatarLetter}
          </span>
        )}
        {isSelected && (
          <div className="ring-kas-secondary pointer-events-none absolute inset-0 animate-pulse rounded-full ring-2 blur-sm filter" />
        )}
      </div>
    </div>
  );
};
