import { useState } from "react";
import { Pencil, Info, Copy, Check, UserCog, Ban } from "lucide-react";
import clsx from "clsx";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { EditNicknamePopover } from "./EditNicknamePopover";
import { copyToClipboard } from "../utils/clipboard";
import { OneOnOneConversation } from "../types/all";
import { ModalType } from "../store/ui.store";
import { useBlocklistStore } from "../store/blocklist.store";
import { useUiStore } from "../store/ui.store";
import { useMessagingStore } from "../store/messaging.store";
import { toast } from "../utils/toast-helper";

interface ContactMenuProps {
  oneOnOneConversation: OneOnOneConversation | null;
  openedRecipient: string | null;
  messageStore: {
    setContactNickname: (address: string, nickname: string) => void;
  };
  openModal: (modalId: ModalType) => void;
  setOneOnOneConversation: (conversation: OneOnOneConversation | null) => void;
}

export const ContactMenu: React.FC<ContactMenuProps> = ({
  oneOnOneConversation,
  openedRecipient,
  messageStore,
  openModal,
  setOneOnOneConversation,
}) => {
  const [isCopying, setIsCopying] = useState(false);
  const [isEditingInPopover, setIsEditingInPopover] = useState(false);
  const [popoverEditValue, setPopoverEditValue] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const blocklistStore = useBlocklistStore();
  const uiStore = useUiStore();
  const messagingStore = useMessagingStore();

  const address =
    oneOnOneConversation?.contact.kaspaAddress ?? openedRecipient ?? "";
  const isBlocked = blocklistStore.blockedAddresses.has(address);

  const handleBlock = () => {
    // set up confirmation modal
    uiStore.setConfirmationConfig({
      title: "Block Contact",
      message: "This will block and delete ALL messages with this contact",
      confirmText: "Block",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          setIsBlocking(true);
          await blocklistStore.blockAddressAndDeleteData(address);

          // close modal and navigate away
          messagingStore.setOpenedRecipient(null);

          toast.success("Contact blocked and all conversations deleted");
        } catch (error) {
          console.error("Error blocking contact:", error);
          toast.error("Failed to block contact");
        } finally {
          setIsBlocking(false);
        }
      },
    });

    // open it
    uiStore.openModal("confirm");
  };

  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          <PopoverButton className="translate-y-[1.5px] transform cursor-pointer rounded p-2 text-[var(--button-primary)] hover:bg-[var(--primary-bg)] hover:opacity-90 focus:outline-none data-[active]:scale-90 data-[active]:opacity-80">
            <UserCog className="size-6 sm:size-5" />
          </PopoverButton>
          <PopoverPanel
            anchor="bottom start"
            className="absolute right-0 z-10 mt-2 w-48 rounded bg-[var(--primary-bg)] shadow-2xl ring-1 shadow-(color:--button-primary)/30 ring-[var(--primary-border)]"
          >
            <div className="flex flex-col">
              <button
                onClick={() => {
                  setOneOnOneConversation(oneOnOneConversation ?? null);
                  openModal("contact-info-modal");
                  close();
                }}
                className="focus:bg-secondary-bg active:bg-secondary-bg flex w-full cursor-pointer items-center justify-start gap-2 px-4 py-2 text-[var(--text-primary)] hover:bg-[var(--kas-primary)] active:scale-90 active:opacity-80"
              >
                <Info className="h-4 w-4" /> Contact Info
              </button>
              <button
                onClick={() => {
                  copyToClipboard(
                    oneOnOneConversation?.contact.kaspaAddress ??
                      openedRecipient ??
                      "",
                    "Address Copied"
                  );
                  setIsCopying(true);
                  setTimeout(() => setIsCopying(false), 1000);
                }}
                className={clsx(
                  "flex w-full cursor-pointer items-center justify-start gap-2 px-4 py-2 transition duration-300 active:scale-90 active:opacity-80",
                  {
                    "bg-kas-secondary text-white": isCopying,
                    "focus:bg-secondary-bg active:bg-secondary-bg text-[var(--text-primary)] hover:bg-[var(--kas-primary)]":
                      !isCopying,
                  }
                )}
                title="Copy Address"
              >
                {isCopying ? (
                  <Check className="h-4 w-4 text-white" />
                ) : (
                  <Copy className="h-4 w-4 text-[var(--text-primary)]" />
                )}
                Copy Address
              </button>
              <button
                onClick={() => {
                  setIsEditingInPopover(true);
                  setPopoverEditValue(oneOnOneConversation?.contact.name || "");
                }}
                className={clsx(
                  "focus:bg-secondary-bg active:bg-secondary-bg flex w-full cursor-pointer items-center justify-start gap-2 px-4 py-2 text-[var(--text-primary)] hover:bg-[var(--kas-primary)] active:scale-90 active:opacity-80",
                  { hidden: isEditingInPopover }
                )}
              >
                <Pencil className="h-4 w-4" /> Edit Nickname
              </button>
              {isEditingInPopover && (
                <EditNicknamePopover
                  value={popoverEditValue}
                  placeholder={
                    oneOnOneConversation?.contact.name ||
                    oneOnOneConversation?.contact.kaspaAddress ||
                    ""
                  }
                  onChange={setPopoverEditValue}
                  onSave={() => {
                    if (oneOnOneConversation) {
                      messageStore.setContactNickname(
                        oneOnOneConversation.contact.kaspaAddress,
                        popoverEditValue
                      );
                    }
                    setIsEditingInPopover(false);
                    close();
                  }}
                  onCancel={() => setIsEditingInPopover(false)}
                />
              )}
              {!isBlocked && (
                <button
                  onClick={() => {
                    handleBlock();
                    close();
                  }}
                  disabled={isBlocking}
                  className="focus:bg-secondary-bg active:bg-secondary-bg flex w-full cursor-pointer items-center justify-start gap-2 px-4 py-2 text-[var(--text-primary)] hover:bg-[var(--kas-primary)] active:scale-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" />
                  {isBlocking ? "Blocking..." : "Block"}
                </button>
              )}
            </div>
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
};
