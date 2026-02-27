import { FC } from "react";
import { OneOnOneConversation } from "../../types/all";
import { AvatarHash } from "../icons/AvatarHash";
import clsx from "clsx";
import { useBlocklistStore } from "../../store/blocklist.store";

type ContactInfoModalProps = {
  oooc: OneOnOneConversation;
  onClose: () => void;
};

export const ContactInfoModal: FC<ContactInfoModalProps> = ({
  oooc,
  onClose,
}) => {
  const blocklistStore = useBlocklistStore();

  const isBlocked = blocklistStore.blockedAddresses.has(
    oooc.contact.kaspaAddress
  );

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <AvatarHash
              address={oooc.contact.kaspaAddress}
              size={40}
              className={clsx({
                "opacity-60": !!oooc.contact.name?.trim()?.[0],
              })}
              selected={true}
            />
            {oooc.contact.name?.trim()?.slice(0, 2)?.toUpperCase() && (
              <span
                className={clsx(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  "pointer-events-none select-none",
                  "flex h-10 w-10 items-center justify-center",
                  "rounded-full text-sm leading-none font-bold tracking-wide text-[var(--text-primary)]/80"
                )}
              >
                {oooc.contact.name.trim().slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="font-semibold break-all text-[var(--text-primary)]">
                {oooc.contact.name || "No nickname"}
              </div>
            </div>
            <div className="text-sm text-[var(--text-secondary)]">Contact</div>
          </div>
        </div>
        {/* Indented content below avatar/nickname/contact */}
        <div className="space-y-2 pl-2">
          {" "}
          {/* pl-14 aligns with avatar+gap */}
          <div>
            <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
              Address
            </div>
            <div className="text-sm break-all text-[var(--text-primary)]">
              {oooc.contact.kaspaAddress}
            </div>
          </div>
          {oooc.contact.name && (
            <div>
              <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Nickname
              </div>
              <div className="text-sm break-all text-[var(--text-primary)]">
                {oooc.contact.name}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
              Messages
            </div>
            <div className="text-sm text-[var(--text-primary)]">
              {oooc.events.length || 0} messages
            </div>
          </div>
          <div>
            <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
              Last Activity
            </div>
            <div className="text-sm text-[var(--text-primary)]">
              {oooc.conversation.lastActivityAt.toLocaleString()}
            </div>
          </div>
          {/* block status */}
          {isBlocked && (
            <div className="rounded-lg border border-red-500/30 bg-[var(--accent-red)]/10 p-3">
              <div className="text-xs font-medium text-[var(--accent-red)]">
                This contact is blocked
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
