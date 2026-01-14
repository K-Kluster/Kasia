import React, { useState, useMemo } from "react";
import { Group, GroupMember } from "../../store/repository/group.repository";
import { useWalletStore } from "../../store/wallet.store";
import { useGroupStore } from "../../store/group.store";
import { useMessagingStore } from "../../store/messaging.store";
import { toast } from "../../utils/toast-helper";
import { Button } from "../Common/Button";
import {
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { Avatar } from "../SideBarPane/Directs/Avatar";

interface GroupInfoModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
}

type ContactOption = {
  address: string;
  displayName: string;
  hasActiveConversation: boolean;
};

type PendingChange =
  | { type: "add"; address: string; displayName: string }
  | { type: "remove"; address: string };

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  group,
  onClose,
}) => {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRedistributing, setIsRedistributing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [distributionResult, setDistributionResult] = useState<{
    success: string[];
    failed: { address: string; error: string }[];
  } | null>(null);

  const { address } = useWalletStore();
  const { addMember, removeMember, leaveGroup, rotateRoot, redistributeRoot } =
    useGroupStore();
  const { oneOnOneConversations } = useMessagingStore();

  const isAdmin = group.adminAddress === address?.toString();
  const currentAddressStr = address?.toString() || "";

  // compute effective members (current + pending adds, with pending removes marked)
  const effectiveMembers = useMemo(() => {
    const currentMembers = [...group.members];
    const result: (GroupMember & {
      isPending?: boolean;
      isPendingRemove?: boolean;
    })[] = currentMembers.map((m) => ({ ...m }));

    for (const change of pendingChanges) {
      if (change.type === "remove") {
        const idx = result.findIndex((m) => m.address === change.address);
        if (idx !== -1) {
          result[idx].isPendingRemove = true;
        }
      } else if (change.type === "add") {
        if (!result.some((m) => m.address === change.address)) {
          result.push({
            address: change.address,
            signingPubKey: "",
            joinedAtEpoch: group.currentEpoch + 1,
            isPending: true,
          });
        }
      }
    }

    return result;
  }, [group.members, group.currentEpoch, pendingChanges]);

  // build list of available contacts (not already in group or pending)
  const availableContacts = useMemo((): ContactOption[] => {
    // get all addresses that are either current members or pending additions
    const excludedAddresses = new Set([
      ...effectiveMembers.map((m) => m.address),
      ...pendingChanges.filter((c) => c.type === "add").map((c) => c.address),
    ]);

    return oneOnOneConversations
      .filter((oooc) => {
        const status = oooc.conversation.status;
        const hasActive =
          status === "active" ||
          (status === "pending" && oooc.conversation.initiatedByMe);
        return hasActive && !excludedAddresses.has(oooc.contact.kaspaAddress);
      })
      .map((oooc) => ({
        address: oooc.contact.kaspaAddress,
        displayName: oooc.contact.name || oooc.contact.kaspaAddress,
        hasActiveConversation: oooc.conversation.status === "active",
      }));
  }, [oneOnOneConversations, effectiveMembers, pendingChanges]);

  // filter by search
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return availableContacts;
    const q = searchQuery.toLowerCase();
    return availableContacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [availableContacts, searchQuery]);

  const hasUnsavedChanges = pendingChanges.length > 0;

  const handleAddMemberToPending = (contact: ContactOption) => {
    // check if already pending remove, cancel it instead
    const existingRemove = pendingChanges.findIndex(
      (c) => c.type === "remove" && c.address === contact.address
    );
    if (existingRemove !== -1) {
      setPendingChanges((prev) => prev.filter((_, i) => i !== existingRemove));
    } else {
      setPendingChanges((prev) => [
        ...prev,
        {
          type: "add",
          address: contact.address,
          displayName: contact.displayName,
        },
      ]);
    }
    setShowDropdown(false);
    setSearchQuery("");
  };

  const handleRemoveMemberFromPending = (memberAddress: string) => {
    // check if it's a pending add, just remove it
    const existingAdd = pendingChanges.findIndex(
      (c) => c.type === "add" && c.address === memberAddress
    );
    if (existingAdd !== -1) {
      setPendingChanges((prev) => prev.filter((_, i) => i !== existingAdd));
    } else {
      // add pending remove
      setPendingChanges((prev) => [
        ...prev,
        { type: "remove", address: memberAddress },
      ]);
    }
  };

  const handleUndoChange = (address: string) => {
    setPendingChanges((prev) =>
      prev.filter(
        (c) =>
          !(c.type === "add" && c.address === address) &&
          !(c.type === "remove" && c.address === address)
      )
    );
  };

  const handleSaveChanges = async () => {
    if (pendingChanges.length === 0) return;

    setIsSaving(true);
    try {
      // process removes first, then adds
      const removes = pendingChanges.filter((c) => c.type === "remove");
      const adds = pendingChanges.filter((c) => c.type === "add");

      for (const change of removes) {
        await removeMember(group.id, change.address);
      }
      for (const change of adds) {
        if (change.type === "add") {
          await addMember(group.id, change.address);
        }
      }

      setPendingChanges([]);
      toast.success("Group updated successfully");
      onClose();
    } catch (error) {
      console.error("Failed to save group changes:", error);
      toast.error("Failed to update group");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setPendingChanges([]);
  };

  const handleLeaveGroup = async () => {
    if (
      !confirm(
        "Are you sure you want to leave this group? You won't be able to rejoin unless invited again."
      )
    ) {
      return;
    }

    try {
      await leaveGroup(group.id);
      onClose();
      toast.success("Left group successfully");
    } catch (error) {
      console.error("Failed to leave group:", error);
      toast.error("Failed to leave group");
    }
  };

  const handleRotateKeys = async () => {
    if (
      !confirm(
        "Are you sure you want to rotate the encryption keys? This will require redistributing keys to all members."
      )
    ) {
      return;
    }

    setIsRotating(true);
    try {
      await rotateRoot(group.id);
      toast.success("Keys rotated successfully");
    } catch (error) {
      console.error("Failed to rotate keys:", error);
      toast.error("Failed to rotate keys");
    } finally {
      setIsRotating(false);
    }
  };

  const handleRedistributeKeys = async () => {
    setIsRedistributing(true);
    setDistributionResult(null);
    try {
      const result = await redistributeRoot(group.id);
      setDistributionResult(result);
      if (result.failed.length === 0) {
        toast.success(`Keys redistributed to ${result.success.length} members`);
      } else {
        toast.error(
          `${result.failed.length} distributions failed. Check details below.`
        );
      }
    } catch (error) {
      console.error("Failed to redistribute keys:", error);
      toast.error("Failed to redistribute keys");
    } finally {
      setIsRedistributing(false);
    }
  };

  const isPendingAdd = (address: string) =>
    pendingChanges.some((c) => c.type === "add" && c.address === address);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-2 select-none">
        {/* header */}
        <div className="mb-1 flex items-center">
          <div className="mr-3">
            <Avatar
              address={group.adminAddress}
              size={48}
              displayName={group.name}
              isGroup={true}
              collapsed={false}
            />
          </div>
          <div>
            <h3 className="text-lg font-medium text-(--text-primary)">
              {group.name}
            </h3>
            <p className="text-sm text-(--text-seconday)">
              Created {group.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 select-none">
          {/* group ID */}
          <div className="bg-secondary-bg mb-4 rounded-lg p-3">
            <div className="mb-1 text-xs text-(--text-seconday)">Group ID</div>
            <div className="font-mono text-xs break-all text-(--text-primary)">
              {group.id}
            </div>
          </div>

          {/* group stats */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="bg-secondary-bg rounded-lg p-1 text-center">
              <div className="text-2xl font-bold text-(--text-primary)">
                {effectiveMembers.length}
              </div>
              <div className="text-sm text-(--text-seconday)">Members</div>
            </div>
            <div className="bg-secondary-bg rounded-lg p-1 text-center">
              <div className="text-2xl font-bold text-(--text-primary)">
                {group.currentEpoch}
              </div>
              <div className="text-sm text-(--text-seconday)">Epoch</div>
            </div>
          </div>

          {/* unsaved changes warning */}
          {hasUnsavedChanges && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-yellow-500/20 p-3 text-sm text-yellow-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                You have unsaved changes. Click "Save Changes" to apply them.
              </span>
            </div>
          )}

          {/* members list */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium text-(--text-primary)">
                Members
              </h4>
              {isAdmin && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="text-kas-secondary hover:text-kas-secondary/80 text-sm"
                >
                  {showAddMember ? "Hide" : <Plus className="size-6" />}
                </button>
              )}
            </div>

            {/* add member dropdown */}
            {showAddMember && isAdmin && (
              <div className="bg-secondary-bg relative mb-3 rounded-lg p-3">
                <div
                  onClick={() => setShowDropdown(!showDropdown)}
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
                        : "Search contacts..."
                    }
                    disabled={availableContacts.length === 0}
                    className="flex-1 bg-transparent text-sm text-(--text-primary) placeholder-(--text-secondary) focus:outline-none disabled:cursor-not-allowed"
                  />
                  <ChevronDown
                    className={`h-4 w-4 text-(--text-seconday) transition-transform ${showDropdown ? "rotate-180" : ""}`}
                  />
                </div>

                {showDropdown && filteredContacts.length > 0 && (
                  <div className="border-primary-border bg-secondary-bg absolute right-3 left-3 z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border shadow-lg">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.address}
                        onClick={() => handleAddMemberToPending(contact)}
                        className="cursor-pointer px-3 py-2 hover:bg-(--primary-bg)"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-(--text-primary)">
                              {contact.displayName !== contact.address
                                ? contact.displayName
                                : contact.address.slice(0, 12) +
                                  "..." +
                                  contact.address.slice(-6)}
                            </span>
                            {contact.displayName !== contact.address && (
                              <span className="text-xs text-(--text-seconday)">
                                {contact.address.slice(0, 12)}...
                                {contact.address.slice(-6)}
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

                {availableContacts.length === 0 && (
                  <p className="mt-2 text-xs text-(--text-seconday)">
                    All your contacts are already in this group
                  </p>
                )}
              </div>
            )}

            {/* member list */}
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {effectiveMembers.map((member) => {
                const isMe = member.address === currentAddressStr;
                const isGroupAdmin = member.address === group.adminAddress;
                const pendingRemove = member.isPendingRemove || false;
                const pendingAdd = isPendingAdd(member.address);

                return (
                  <div
                    key={member.address}
                    className={`flex items-center justify-between rounded p-0.5 ${
                      pendingRemove
                        ? "bg-(--accent-red)/10"
                        : pendingAdd
                          ? "bg-(--kas-secondary)/10"
                          : "bg-secondary-bg"
                    }`}
                  >
                    <div className="min-w-0 flex-1 p-0.5">
                      <div className="truncate text-sm text-(--text-primary)">
                        {member.address.slice(0, 20)}...
                        {member.address.slice(-10)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-(--text-seconday)">
                        <span>
                          {isGroupAdmin ? "Admin" : "Member"}
                          {isMe && " (You)"}
                        </span>
                        {pendingAdd && (
                          <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-green-600">
                            Adding
                          </span>
                        )}
                        {pendingRemove && (
                          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-(--accent-red)">
                            Removing
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && !isMe && !isGroupAdmin && (
                      <>
                        {pendingRemove || pendingAdd ? (
                          <button
                            onClick={() => handleUndoChange(member.address)}
                            className="me-3 text-sm text-blue-600 hover:text-blue-700"
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleRemoveMemberFromPending(member.address)
                            }
                            className="me-2 text-sm text-(--accent-red) hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* distribution result */}
          {distributionResult && (
            <div className="relative mb-4 rounded-lg border border-(--primary-border) p-1 px-2">
              <button
                onClick={() => setDistributionResult(null)}
                className="hover:bg-secondary-bg absolute top-2 right-2 rounded p-0.5"
              >
                <X className="size-4" />
              </button>
              <div className="mb-2 text-sm font-medium text-(--text-primary)">
                Distribution Result
              </div>
              {distributionResult.success.length > 0 && (
                <div className="mb-2 text-xs text-green-600">
                  ✓ Sent to {distributionResult.success.length} member(s)
                </div>
              )}
              {distributionResult.failed.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-(--accent-red)">
                    ✗ Failed for {distributionResult.failed.length} member(s):
                  </div>
                  {distributionResult.failed.map((f) => (
                    <div
                      key={f.address}
                      className="rounded bg-red-500/10 p-2 text-xs"
                    >
                      <div className="truncate text-(--text-primary)">
                        {f.address.slice(0, 20)}...{f.address.slice(-10)}
                      </div>
                      <div className="text-(--accent-red)">{f.error}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* actions */}
          <div className="flex flex-wrap justify-end gap-2">
            {hasUnsavedChanges && (
              <>
                <Button
                  onClick={handleDiscardChanges}
                  variant="secondary"
                  className="w-auto!"
                  disabled={isSaving}
                >
                  Discard
                </Button>
                <Button
                  onClick={handleSaveChanges}
                  variant="primary"
                  className="w-auto!"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}

            {!hasUnsavedChanges && (
              <>
                {isAdmin && (
                  <Button
                    onClick={handleRedistributeKeys}
                    variant="secondary"
                    className="w-auto!"
                    disabled={isRedistributing}
                  >
                    {isRedistributing ? (
                      <>
                        <RefreshCw className="mr-1 size-4 animate-spin" />
                      </>
                    ) : (
                      <div className="flex items-center">Resend Keys</div>
                    )}
                  </Button>
                )}

                {isAdmin && (
                  <Button
                    onClick={handleRotateKeys}
                    variant="secondary"
                    className="w-auto! bg-yellow-500/10! text-yellow-600 hover:bg-yellow-500/20!"
                    disabled={isRotating}
                  >
                    {isRotating ? (
                      <>
                        <RefreshCw className="mr-1 size-4 animate-spin" />
                      </>
                    ) : (
                      "Rotate Keys"
                    )}
                  </Button>
                )}

                {!isAdmin && (
                  <Button
                    onClick={handleLeaveGroup}
                    variant="secondary"
                    className="w-auto! bg-red-500/10! text-(--accent-red) hover:bg-red-500/20!"
                  >
                    Leave Group
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
