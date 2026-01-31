import { FC, useState, useEffect } from "react";
import { OneOnOneConversation } from "../../types/all";
import { AvatarHash } from "../icons/AvatarHash";
import { Tooltip } from "../Common/Tooltip";
import clsx from "clsx";
import { useMessagingStore } from "../../store/messaging.store";
import { Pencil, CheckCircle } from "lucide-react";
import { validateAlias } from "../../utils/alias-validator";
import { Button } from "../Common/Button";
import { WarningBlock } from "../Common/WarningBlock";
import { ALIAS_LENGTH } from "../../config/constants";
import { useSelfStash } from "../../hooks/useSelfStash";

type ContactInfoModalProps = {
  oooc: OneOnOneConversation;
  onClose: () => void;
};

export const ContactInfoModal: FC<ContactInfoModalProps> = ({ oooc }) => {
  const [editingAlias, setEditingAlias] = useState<"my" | "their" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [aliasWasEdited, setAliasWasEdited] = useState(false);

  // subscribe to live conversation data from messaging store
  const liveOooc = useMessagingStore((state) =>
    state.oneOnOneConversations.find(
      (o) => o.conversation.id === oooc.conversation.id
    )
  );

  // use live data if available, fallback to prop
  const currentOooc = liveOooc || oooc;

  const [myAliasValue, setMyAliasValue] = useState(
    currentOooc.conversation.myAlias
  );
  const [theirAliasValue, setTheirAliasValue] = useState(
    currentOooc.conversation.theirAlias ?? ""
  );

  const updateConversationAliases = useMessagingStore(
    (state) => state.updateConversationAliases
  );

  // use self stash hook for saving handshake with updated aliases
  const {
    isCreating: isCreatingSelfStash,
    isCompleted: selfStashCompleted,
    hasSufficientFunds,
    handleCreateSelfStash,
  } = useSelfStash({
    partnerAddress: currentOooc.contact.kaspaAddress,
    ourAlias: currentOooc.conversation.myAlias,
    theirAlias: currentOooc.conversation.theirAlias ?? "",
  });

  // sync local state when conversation updates from store
  useEffect(() => {
    setMyAliasValue(currentOooc.conversation.myAlias);
    setTheirAliasValue(currentOooc.conversation.theirAlias ?? "");
  }, [
    currentOooc.conversation.myAlias,
    currentOooc.conversation.theirAlias,
    currentOooc.conversation.id,
  ]);

  // auto-hide self stash section after successful save
  useEffect(() => {
    if (selfStashCompleted) {
      const timer = setTimeout(() => {
        setAliasWasEdited(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [selfStashCompleted]);

  const handleSaveAlias = async (type: "my" | "their") => {
    setError(null);
    setIsSaving(true);

    try {
      const aliasToSave = type === "my" ? myAliasValue : theirAliasValue;

      // validate alias format
      const validationError = validateAlias(aliasToSave);
      if (validationError) {
        setError(validationError);
        setIsSaving(false);
        return;
      }

      await updateConversationAliases(
        currentOooc.conversation.id,
        type === "my" ? myAliasValue : undefined,
        type === "their" ? theirAliasValue : undefined
      );

      setEditingAlias(null);
      setAliasWasEdited(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update alias");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = (type: "my" | "their") => {
    if (type === "my") {
      setMyAliasValue(currentOooc.conversation.myAlias);
    } else {
      setTheirAliasValue(currentOooc.conversation.theirAlias ?? "");
    }
    setError(null);
    setEditingAlias(null);
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <AvatarHash
              address={currentOooc.contact.kaspaAddress}
              size={40}
              className={clsx({
                "opacity-60": !!currentOooc.contact.name?.trim()?.[0],
              })}
              selected={true}
            />
            {currentOooc.contact.name?.trim()?.slice(0, 2)?.toUpperCase() && (
              <span
                className={clsx(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  "pointer-events-none select-none",
                  "flex h-10 w-10 items-center justify-center",
                  "rounded-full text-sm leading-none font-bold tracking-wide text-[var(--text-primary)]/80"
                )}
              >
                {currentOooc.contact.name.trim().slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="font-semibold break-all text-[var(--text-primary)]">
              {currentOooc.contact.name || "No nickname"}
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
              {currentOooc.contact.kaspaAddress}
            </div>
          </div>
          {currentOooc.contact.name && (
            <div>
              <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Nickname
              </div>
              <div className="text-sm break-all text-[var(--text-primary)]">
                {currentOooc.contact.name}
              </div>
            </div>
          )}
          {!editingAlias ? (
            <>
              <div>
                <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                  Messages
                </div>
                <div className="text-sm text-[var(--text-primary)]">
                  {currentOooc.events.length || 0} messages
                </div>
              </div>
              <div>
                <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                  Last Activity
                </div>
                <div className="text-sm text-[var(--text-primary)]">
                  {currentOooc.conversation.lastActivityAt.toLocaleString()}
                </div>
              </div>
            </>
          ) : (
            <WarningBlock className="!my-1" title="Warning">
              Only edit the alias if you're certain on the new values
            </WarningBlock>
          )}
          {/* My Alias Section */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              editingAlias === "their"
                ? "max-h-0 opacity-0"
                : editingAlias === "my"
                  ? "max-h-32 opacity-100"
                  : "max-h-20 opacity-100"
            }`}
          >
            <Tooltip trigger="MY ALIAS" position="top start">
              This is sent from you to the contact. They use this to identify
              messages from you.
            </Tooltip>
            {editingAlias === "my" ? (
              <div className="mt-2 space-y-3">
                <div className="px-1">
                  <input
                    type="text"
                    value={myAliasValue}
                    maxLength={ALIAS_LENGTH * 2}
                    onChange={(e) => setMyAliasValue(e.target.value)}
                    className="min-h-10 w-full rounded border border-[var(--secondary-border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-base text-[var(--text-primary)]"
                    placeholder="Enter alias"
                    disabled={isSaving}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCancelEdit("my")}
                    disabled={isSaving}
                    variant="secondary"
                    className="px-3 py-1 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleSaveAlias("my")}
                    disabled={isSaving}
                    className="px-3 py-1 text-xs"
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="font-mono text-sm break-all text-[var(--text-primary)]">
                  {currentOooc.conversation.myAlias}
                </div>
                <button
                  onClick={() => setEditingAlias("my")}
                  className="relative cursor-pointer rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                  disabled={isSaving}
                >
                  <Pencil className="size-3" />
                  <span className="absolute inset-0 p-3 pointer-fine:hidden" />
                </button>
              </div>
            )}
          </div>
          {/* Their Alias Section */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              editingAlias === "my"
                ? "max-h-0 opacity-0"
                : editingAlias === "their"
                  ? "max-h-32 opacity-100"
                  : "max-h-20 opacity-100"
            }`}
          >
            <Tooltip trigger="THEIR ALIAS" position="top start">
              Your contacts sent alias. Kasia uses this to 'scan' for messages
              for you.
            </Tooltip>

            {editingAlias === "their" ? (
              <div className="mt-2 space-y-3">
                <div className="px-1">
                  <input
                    type="text"
                    value={theirAliasValue}
                    maxLength={ALIAS_LENGTH * 2}
                    onChange={(e) => setTheirAliasValue(e.target.value)}
                    className="min-h-10 w-full rounded border border-[var(--secondary-border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-base text-[var(--text-primary)]"
                    placeholder="Enter their alias"
                    disabled={isSaving}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCancelEdit("their")}
                    disabled={isSaving}
                    variant="secondary"
                    className="px-3 py-1 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleSaveAlias("their")}
                    disabled={isSaving}
                    className="px-3 py-1 text-xs"
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="font-mono text-sm break-all text-[var(--text-primary)]">
                  {currentOooc.conversation.theirAlias ?? "N/A"}
                </div>

                <button
                  onClick={() => setEditingAlias("their")}
                  className="relative cursor-pointer rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                  disabled={isSaving}
                >
                  <Pencil className="size-3" />
                  <span className="absolute inset-0 p-3" />
                </button>
              </div>
            )}
          </div>
          {/* Error display */}
          {error && (
            <div className="mt-4 rounded border border-[var(--accent-red)] bg-[var(--accent-red)]/10 p-3 text-sm text-[var(--accent-red)]">
              {error}
            </div>
          )}
          {/* Self Stash Section - Shows after alias edits */}
          {aliasWasEdited && (
            <div className="mt-4 rounded-lg border border-[var(--button-primary)]/20 bg-[var(--button-primary)]/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-[var(--kas-secondary)]" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Aliases updated
                    </p>
                  </div>
                  <p className="mb-3 text-xs text-[var(--text-secondary)]">
                    Save this change to your handshake on-chain so it syncs
                    across devices.
                  </p>

                  {!selfStashCompleted ? (
                    <Button
                      onClick={handleCreateSelfStash}
                      disabled={isCreatingSelfStash || !hasSufficientFunds}
                      className="w-full"
                    >
                      {isCreatingSelfStash ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
                          Saving handshake...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle className="size-5" />
                          Save Handshake
                        </div>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--kas-primary)]/20 bg-[var(--kas-primary)]/10 p-2">
                      <CheckCircle className="h-4 w-4 text-[var(--kas-secondary)]" />
                      <span className="text-sm font-semibold text-[var(--kas-secondary)]">
                        Handshake saved successfully!
                      </span>
                    </div>
                  )}

                  {!hasSufficientFunds && !selfStashCompleted && (
                    <p className="mt-2 text-xs text-[var(--accent-red)]">
                      Insufficient funds. You need at least 0.2 KAS to save
                      handshake.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
