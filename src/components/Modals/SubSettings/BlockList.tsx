import React, { useState } from "react";
import { useBlocklistStore } from "../../../store/blocklist.store";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";
import { toast } from "../../../utils/toast-helper";
import { BLOCKED_PLACEHOLDER } from "../../../components/MessagesPane/Broadcasts/BroadcastMessagesList";

export const BlockList: React.FC = () => {
  const blocklistStore = useBlocklistStore();
  const [isBroadcastExpanded, setIsBroadcastExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* broadcast display mode toggle - collapsible */}
      <div className="border-primary-border bg-primary-bg mb-2 rounded-2xl border p-4">
        {/* Collapsible Header */}
        <button
          onClick={() => setIsBroadcastExpanded(!isBroadcastExpanded)}
          className="hover:bg-secondary-bg -my-2 flex w-full cursor-pointer items-center justify-between rounded-lg p-2 transition-colors"
        >
          <h4 className="text-text-primary text-base font-semibold">
            Broadcast Display Mode
          </h4>
          {isBroadcastExpanded ? (
            <ChevronUp className="text-text-secondary h-5 w-5" />
          ) : (
            <ChevronDown className="text-text-secondary h-5 w-5" />
          )}
        </button>

        {/* Collapsible Content */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isBroadcastExpanded
              ? "mt-4 max-h-96 opacity-100"
              : "max-h-0 opacity-0"
          }`}
        >
          <div className="mb-3 text-xs">
            Choose how to display messages from blocked participants in
            broadcasts
          </div>
          <div className="space-y-2">
            <button
              onClick={() =>
                blocklistStore.setBroadcastBlockedDisplayMode("placeholder")
              }
              className={clsx(
                "flex w-full cursor-pointer items-center gap-2 rounded-lg border p-3 transition-all active:rounded-4xl",
                blocklistStore.broadcastBlockedDisplayMode === "placeholder"
                  ? "bg-kas-secondary/10 border-kas-secondary"
                  : "bg-primary-bg border-primary-border hover:bg-primary-bg/50"
              )}
            >
              <div className="text-left">
                <div className="text-sm font-semibold">Show Placeholder</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Display "{BLOCKED_PLACEHOLDER}"
                </div>
              </div>
            </button>
            <button
              onClick={() =>
                blocklistStore.setBroadcastBlockedDisplayMode("hide")
              }
              className={clsx(
                "flex w-full cursor-pointer items-center gap-2 rounded-lg border p-3 transition-all active:rounded-4xl",
                blocklistStore.broadcastBlockedDisplayMode === "hide"
                  ? "bg-kas-secondary/10 border-kas-secondary"
                  : "bg-primary-bg border-primary-border hover:bg-primary-bg/50"
              )}
            >
              <div className="text-left">
                <div className="text-sm font-semibold">Hide Completely</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Don't show messages from blocked participants
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* blocked addresses list */}
      <div className="border-primary-border bg-primary-bg rounded-2xl border p-4">
        <div className="mb-3">
          <h4 className="text-base font-semibold">
            Blocked Addresses ({blocklistStore.blockedAddressList.length})
          </h4>
        </div>

        {blocklistStore.blockedAddressList.length === 0 ? (
          <div className="py-3 text-center text-sm text-[var(--text-secondary)]">
            No blocked addresses
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {blocklistStore.blockedAddressList.map((blocked) => (
              <div
                key={blocked.id}
                className="border-primary-border flex items-center justify-between rounded-lg border bg-[var(--secondary-bg)]/70 p-3"
              >
                <div className="flex-1 overflow-hidden">
                  <div className="cursor-text text-xs break-all text-[var(--text-primary)] select-text">
                    {blocked.kaspaAddress}
                  </div>
                  {blocked.reason && (
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      {blocked.reason}
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    try {
                      await blocklistStore.unblockAddress(blocked.kaspaAddress);
                      toast.success("Address unblocked");
                    } catch (error) {
                      console.error("Error unblocking address:", error);
                      toast.error("Failed to unblock address");
                    }
                  }}
                  className="ml-2 cursor-pointer p-1 transition-colors hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
