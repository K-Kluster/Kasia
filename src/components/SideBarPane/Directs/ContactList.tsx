import { FC } from "react";
import { ContactCard } from "./ContactCard";
import { useMessagingStore } from "../../../store/messaging.store";
import { Contact } from "../../../store/repository/contact.repository";

interface ContactListProps {
  searchQuery: string;
  onContactClicked: (contact: Contact) => void;
  openedRecipient: string | null;
  contactsCollapsed: boolean;
  setMobileView: (v: "contacts" | "messages") => void;
  isMobile: boolean;
}

export const ContactList: FC<ContactListProps> = ({
  searchQuery,
  onContactClicked,
  openedRecipient,
  contactsCollapsed,
  setMobileView,
  isMobile,
}) => {
  const oneOnOneConversations = useMessagingStore(
    (state) => state.oneOnOneConversations
  );

  const contacts = oneOnOneConversations.map((oooc) => oooc.contact);
  // order contacts by last activity (most recent first)
  const orderedContacts = contacts.sort((a, b) => {
    const conversationA = oneOnOneConversations.find(
      (oooc) => oooc.contact.id === a.id
    );
    const conversationB = oneOnOneConversations.find(
      (oooc) => oooc.contact.id === b.id
    );

    const lastEventA = conversationA?.events?.at(-1);
    const lastEventB = conversationB?.events?.at(-1);

    // if both have events, sort by most recent
    if (lastEventA?.createdAt && lastEventB?.createdAt) {
      return lastEventB.createdAt.getTime() - lastEventA.createdAt.getTime();
    }

    // if only one has events, prioritize the one with events
    if (lastEventA?.createdAt && !lastEventB?.createdAt) return -1;
    if (!lastEventA?.createdAt && lastEventB?.createdAt) return 1;

    // if neither has events, sort alphabetically by name or address
    const nameA = a.name?.trim() || a.kaspaAddress;
    const nameB = b.name?.trim() || b.kaspaAddress;
    return nameA.localeCompare(nameB);
  });

  // get contacts to display - filter them by search if needed
  const contactsToDisplay = (() => {
    if (!searchQuery.trim()) return orderedContacts;
    const q = searchQuery.toLowerCase();
    const matches = new Map<string, Contact>();

    // first, add all contacts that match by name or address
    orderedContacts.forEach((contact) => {
      if (
        contact.name?.toLowerCase().includes(q) ||
        contact.kaspaAddress.toLowerCase().includes(q)
      ) {
        matches.set(contact.kaspaAddress, contact);
      }
    });

    // then, add contacts from messages that match content
    oneOnOneConversations.forEach((oneOnOneConversation) => {
      oneOnOneConversation.events.forEach((event) => {
        if (event.content.includes(q)) {
          // only add if not already present
          if (!matches.has(oneOnOneConversation.contact.kaspaAddress)) {
            matches.set(
              oneOnOneConversation.contact.kaspaAddress,
              oneOnOneConversation.contact
            );
          }
        }
      });
    });

    return [...matches.values()];
  })();

  if (!contactsCollapsed && contactsToDisplay.length === 0) {
    return (
      <div className="m-5 overflow-hidden rounded-[12px] bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
        {searchQuery ? "No search results" : "No Contacts Yet"}
      </div>
    );
  }

  return (
    <>
      {contactsToDisplay.map((contact, index) => (
        <ContactCard
          key={`contact-${contact.id}-${index}`}
          contact={contact}
          isSelected={contact.kaspaAddress === openedRecipient}
          collapsed={contactsCollapsed}
          onClick={() => {
            onContactClicked(contact);
            if (isMobile) setMobileView("messages");
          }}
        />
      ))}
    </>
  );
};
