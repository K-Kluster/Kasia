import { FC } from "react";
import { Contact } from "../../types/all";
import { AvatarHash } from "../icons/AvatarHash";
import clsx from "clsx";

type ContactInfoModalProps = {
  contact: Contact;
  onClose: () => void;
};

export const ContactInfoModal: FC<ContactInfoModalProps> = ({ contact }) => (
  <div onClick={(e) => e.stopPropagation()}>
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10">
          <AvatarHash
            address={contact.address}
            size={40}
            className={clsx({
              "opacity-60": !!contact.nickname?.trim()?.[0],
            })}
            selected={true}
          />
          {contact.nickname?.trim()?.[0]?.toUpperCase() && (
            <span
              className={clsx(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+1px)]",
                "pointer-events-none select-none",
                "flex h-10 w-10 items-center justify-center",
                "rounded-full text-sm leading-none font-bold tracking-wide text-[var(--text-secondary)]"
              )}
            >
              {contact.nickname.trim()[0].toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <div className="font-semibold break-all text-[var(--text-primary)]">
            {contact.nickname || "No nickname"}
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
            {contact.address}
          </div>
        </div>
        {contact.nickname && (
          <div>
            <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
              Nickname
            </div>
            <div className="text-sm break-all text-[var(--text-primary)]">
              {contact.nickname}
            </div>
          </div>
        )}
        <div>
          <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
            Messages
          </div>
          <div className="text-sm text-[var(--text-primary)]">
            {contact.messages?.length || 0} messages
          </div>
        </div>
        {contact.lastMessage && (
          <div>
            <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
              Last Message
            </div>
            <div className="text-sm text-[var(--text-primary)]">
              {new Date(contact.lastMessage.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
