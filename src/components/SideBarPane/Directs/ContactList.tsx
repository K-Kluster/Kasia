import { FC } from "react";
import { ContactCard } from "./ContactCard";
import { GroupCardInline } from "./GroupCard";
import { useMessagingStore } from "../../../store/messaging.store";
import { useGroupStore, GroupWithMessages } from "../../../store/group.store";
import { Contact } from "../../../store/repository/contact.repository";

// unified conversation item type
type ConversationItem =
  | { type: "contact"; contact: Contact; lastActivity: Date | null }
  | { type: "group"; group: GroupWithMessages; lastActivity: Date | null };

interface ContactListProps {
  searchQuery: string;
  onContactClicked: (contact: Contact) => void;
  onGroupClicked: (groupId: string) => void;
  openedRecipient: string | null;
  contactsCollapsed: boolean;
  setMobileView: (v: "contacts" | "messages") => void;
  isMobile: boolean;
}

export const ContactList: FC<ContactListProps> = ({
  searchQuery,
  onContactClicked,
  onGroupClicked,
  openedRecipient,
  contactsCollapsed,
  setMobileView,
  isMobile,
}) => {
  const messageStore = useMessagingStore();
  const groupStore = useGroupStore();

  // build unified list of contacts and groups
  const conversationItems: ConversationItem[] = [];

  // add contacts
  messageStore.oneOnOneConversations.forEach((oooc) => {
    const lastEvent = oooc.events?.at(-1);
    conversationItems.push({
      type: "contact",
      contact: oooc.contact,
      lastActivity: lastEvent?.createdAt || null,
    });
  });

  // add groups
  groupStore.getAllGroupsWithMessages().forEach((gwm) => {
    conversationItems.push({
      type: "group",
      group: gwm,
      lastActivity: gwm.lastMessage?.createdAt || gwm.group.lastActivityAt,
    });
  });

  // sort by last activity (most recent first)
  const sortedItems = conversationItems.sort((a, b) => {
    if (a.lastActivity && b.lastActivity) {
      return b.lastActivity.getTime() - a.lastActivity.getTime();
    }
    if (a.lastActivity && !b.lastActivity) return -1;
    if (!a.lastActivity && b.lastActivity) return 1;

    // fallback: sort by name
    const nameA =
      a.type === "contact"
        ? a.contact.name?.trim() || a.contact.kaspaAddress
        : a.group.group.name;
    const nameB =
      b.type === "contact"
        ? b.contact.name?.trim() || b.contact.kaspaAddress
        : b.group.group.name;
    return nameA.localeCompare(nameB);
  });

  // filter by search
  const itemsToDisplay = (() => {
    if (!searchQuery.trim()) return sortedItems;
    const q = searchQuery.toLowerCase();

    return sortedItems.filter((item) => {
      if (item.type === "contact") {
        return (
          item.contact.name?.toLowerCase().includes(q) ||
          item.contact.kaspaAddress.toLowerCase().includes(q)
        );
      } else {
        return item.group.group.name.toLowerCase().includes(q);
      }
    });
  })();

  const selectedGroupId = groupStore.selectedGroupId;

  if (!contactsCollapsed && itemsToDisplay.length === 0) {
    return (
      <div className="m-5 overflow-hidden rounded-[12px] bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
        {searchQuery ? "No search results" : "No Conversations Yet"}
      </div>
    );
  }

  return (
    <>
      {itemsToDisplay.map((item, index) => {
        if (item.type === "contact") {
          return (
            <ContactCard
              key={`contact-${item.contact.id}-${index}`}
              contact={item.contact}
              isSelected={
                item.contact.kaspaAddress === openedRecipient &&
                !selectedGroupId
              }
              collapsed={contactsCollapsed}
              onClick={() => {
                // clear group selection when clicking a contact
                groupStore.setSelectedGroup(null);
                onContactClicked(item.contact);
                if (isMobile) setMobileView("messages");
              }}
            />
          );
        } else {
          // group card using existing ContactCard styling
          return (
            <GroupCardInline
              key={`group-${item.group.group.id}-${index}`}
              groupWithMessages={item.group}
              isSelected={selectedGroupId === item.group.group.id}
              collapsed={contactsCollapsed}
              onClick={() => {
                // clear contact selection when clicking a group
                messageStore.setOpenedRecipient(null);
                onGroupClicked(item.group.group.id);
                if (isMobile) setMobileView("messages");
              }}
            />
          );
        }
      })}
    </>
  );
};
