// ContactSection.tsx
import { FC } from "react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { ContactCard } from "./ContactCard";
import { Contact } from "../types/all"; // Assuming you have a type definition for `Contact`

interface ContactSectionProps {
  contacts: Contact[]; // Use the correct Contact type from your types
  onNewChatClicked: () => void;
  onContactClicked: (contact: Contact) => void;
  openedRecipient: string | null;
  walletAddress: string | undefined;
}

export const ContactSection: FC<ContactSectionProps> = ({
  contacts,
  onNewChatClicked,
  onContactClicked,
  openedRecipient,
  walletAddress,
}) => {
  return (
    <div className="w-[200px] md:w-[280px] bg-[var(--primary-bg)] border-r border-[var(--border-color)] flex flex-col">
      <div className="px-4 py-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--secondary-bg)] h-[60px]">
        <div className="font-bold">Conversations</div>
        <button
          onClick={onNewChatClicked}
          className="cursor-pointer text-[#49EACB] transition-transform duration-150 ease-in-out hover:scale-110"
        >
          <PlusIcon className="size-8" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {contacts
          .filter(
            (contact) => contact.address && contact.address !== walletAddress
          )
          .map((contact) => (
            <ContactCard
              key={contact.address}
              contact={contact}
              isSelected={contact.address === openedRecipient}
              onClick={() => onContactClicked(contact)}
            />
          ))}
      </div>
    </div>
  );
};
