import React, { useState, useMemo } from "react";
import { useGroupStore } from "../../store/group.store";
import { useMessagingStore } from "../../store/messaging.store";
import { toast } from "../../utils/toast-helper";
import { Button } from "../Common/Button";
import { WarningBlock } from "../Common/WarningBlock";
import { ChevronDown, X } from "lucide-react";

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: () => void;
}

// contact option type for dropdown
type ContactOption = {
  address: string;
  displayName: string;
  hasActiveConversation: boolean;
};

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<ContactOption[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { createGroup } = useGroupStore();
  const { oneOnOneConversations } = useMessagingStore();

  // build list of available contacts from 1:1 conversations
  const availableContacts = useMemo((): ContactOption[] => {
    return oneOnOneConversations
      .filter((oooc) => {
        // only include contacts with active or pending-initiated conversations
        const status = oooc.conversation.status;
        return (
          status === "active" ||
          (status === "pending" && oooc.conversation.initiatedByMe)
        );
      })
      .map((oooc) => ({
        address: oooc.contact.kaspaAddress,
        displayName: oooc.contact.name || oooc.contact.kaspaAddress,
        hasActiveConversation: oooc.conversation.status === "active",
      }))
      .filter(
        // exclude already selected members
        (contact) => !selectedMembers.some((m) => m.address === contact.address)
      );
  }, [oneOnOneConversations, selectedMembers]);

  // filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return availableContacts;
    const q = searchQuery.toLowerCase();
    return availableContacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [availableContacts, searchQuery]);

  const handleSelectContact = (contact: ContactOption) => {
    setSelectedMembers([...selectedMembers, contact]);
    setShowDropdown(false);
    setSearchQuery("");
  };

  const handleRemoveMember = (address: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.address !== address));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error("Please add at least one member");
      return;
    }

    // check all members have active conversations
    const pendingMembers = selectedMembers.filter(
      (m) => !m.hasActiveConversation
    );
    if (pendingMembers.length > 0) {
      toast.error(
        `Some members don't have completed handshakes: ${pendingMembers.map((m) => m.displayName).join(", ")}`
      );
      return;
    }

    setIsCreating(true);
    try {
      await createGroup(
        groupName.trim(),
        selectedMembers.map((m) => m.address)
      );

      // reset form
      setGroupName("");
      setSelectedMembers([]);

      if (onGroupCreated) {
        onGroupCreated();
      } else {
        onClose();
      }
      toast.success("Group created successfully!");
    } catch (error) {
      console.error("Failed to create group:", error);
      toast.error("Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  const reset = () => {
    setGroupName("");
    setSelectedMembers([]);
    setIsCreating(false);
    setShowDropdown(false);
    setSearchQuery("");
  };

  if (!isOpen) return null;

  const content = (
    <div className="w-full">
      {/* header */}
      <h3 className="mb-5 text-base font-semibold text-[var(--text-primary)]">
        Create New Group
      </h3>

      {/* group name */}
      <div className="mb-5">
        <label className="mb-[5px] block text-[14px] font-bold text-[var(--text-primary)]">
          Group Name
        </label>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Enter group name"
          disabled={isCreating}
          className="border-primary-border bg-primary-bg w-full rounded-lg border px-3 py-2 text-base text-[var(--text-primary)] placeholder-gray-400 focus:border-[var(--button-primary)]/80 focus:ring-2 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {/* members */}
      <div className="mb-5">
        <label className="mb-[5px] block text-[14px] font-bold text-[var(--text-primary)]">
          Members (select from your contacts)
        </label>

        {/* selected members chips */}
        {selectedMembers.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedMembers.map((member) => (
              <div
                key={member.address}
                className="flex items-center gap-1 rounded-full bg-[var(--kas-primary)]/20 px-3 py-1 text-sm text-[var(--text-primary)]"
              >
                <span className="max-w-[150px] truncate">
                  {member.displayName.length > 13
                    ? `${member.displayName.slice(0, 10)}...${member.displayName.slice(-3)}`
                    : member.displayName}
                </span>
                <button
                  onClick={() => handleRemoveMember(member.address)}
                  disabled={isCreating}
                  className="ml-1 rounded-full p-0.5 hover:bg-white/10 disabled:opacity-50"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* contact selector dropdown */}
        <div className="relative">
          <div
            onClick={() => !isCreating && setShowDropdown(!showDropdown)}
            className="border-primary-border bg-primary-bg flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={
                availableContacts.length === 0
                  ? "No contacts available"
                  : "Search or select a contact..."
              }
              disabled={isCreating || availableContacts.length === 0}
              className="flex-1 bg-transparent text-base text-[var(--text-primary)] placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed"
            />
            <ChevronDown
              className={`h-4 w-4 text-[var(--text-secondary)] transition-transform ${showDropdown ? "rotate-180" : ""}`}
            />
          </div>

          {/* dropdown list */}
          {showDropdown && filteredContacts.length > 0 && (
            <div className="border-primary-border bg-secondary-bg absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-lg">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.address}
                  onClick={() => handleSelectContact(contact)}
                  className="cursor-pointer px-3 py-2 hover:bg-[var(--primary-bg)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {contact.displayName !== contact.address
                          ? contact.displayName
                          : contact.address.slice(0, 16) +
                            "..." +
                            contact.address.slice(-8)}
                      </span>
                      {contact.displayName !== contact.address && (
                        <span className="text-xs text-[var(--text-secondary)]">
                          {contact.address.slice(0, 16)}...
                          {contact.address.slice(-8)}
                        </span>
                      )}
                    </div>
                    {!contact.hasActiveConversation && (
                      <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showDropdown && filteredContacts.length === 0 && searchQuery && (
            <div className="border-primary-border bg-secondary-bg absolute z-10 mt-1 w-full rounded-lg border p-3 text-center text-sm text-[var(--text-secondary)] shadow-lg">
              No contacts found matching "{searchQuery}"
            </div>
          )}
        </div>

        {availableContacts.length === 0 &&
          selectedMembers.length === 0 &&
          oneOnOneConversations.length > 0 && (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              All your contacts are already added
            </p>
          )}

        {oneOnOneConversations.length === 0 && (
          <p className="mt-2 text-xs text-yellow-600">
            You need to start 1:1 conversations with contacts before adding them
            to a group
          </p>
        )}
      </div>

      {/* info */}
      <WarningBlock title="Important" className="mb-6">
        Group encryption keys (including updates) are sent directly to members
        via private messages. Members must maintain active conversations with
        you (the group admin) to receive these keys, both when joining the group
        and for any future key updates.
      </WarningBlock>

      {/* actions */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={() => {
            reset();
            onClose();
          }}
          disabled={isCreating}
          variant="secondary"
          className="!w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleCreateGroup}
          disabled={
            !groupName.trim() || selectedMembers.length === 0 || isCreating
          }
          variant="primary"
          className="!w-auto"
        >
          {isCreating ? "Creating..." : "Create Group"}
        </Button>
      </div>
    </div>
  );

  return content;
};
