import { useState } from "react";
import { Ban } from "lucide-react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { MoreHorizontal } from "lucide-react";
import { useBlocklistStore } from "../../store/blocklist.store";
import { toast } from "../../utils/toast-helper";

interface BlockUnblockButtonProps {
  address: string;
  onBlock?: () => void;
  onUnblock?: () => void;
  className?: string;
}

export const BlockUnblockButton: React.FC<BlockUnblockButtonProps> = ({
  address,
  onBlock,
  onUnblock,
  className = "ml-auto pt-2",
}) => {
  const [isBlocking, setIsBlocking] = useState(false);
  const blocklistStore = useBlocklistStore();
  const isBlocked = blocklistStore.blockedAddresses.has(address);

  const handleBlock = async () => {
    try {
      setIsBlocking(true);
      if (isBlocked) {
        await blocklistStore.unblockAddress(address);
        toast.success("Unblocked");
        onUnblock?.();
      } else {
        if (onBlock) {
          onBlock();
        } else {
          // Default behavior: block and delete data
          await blocklistStore.blockAddressAndDeleteData(address);
          toast.success("Blocked");
        }
      }
    } catch (error) {
      console.error("Error blocking/unblocking:", error);
      toast.error("Failed to update block status");
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <div className={className}>
      <Popover className="relative">
        {({ close }) => (
          <>
            <PopoverButton className="flex cursor-pointer items-center justify-center rounded p-2 text-[var(--text-primary)] hover:bg-[var(--primary-bg)] hover:opacity-90 focus:outline-none data-[active]:scale-90 data-[active]:opacity-80">
              <MoreHorizontal className="size-5" />
            </PopoverButton>
            <Transition
              enter="transition ease-out duration-100"
              enterFrom="opacity-0 translate-x-1"
              enterTo="opacity-100 translate-x-0"
              leave="transition ease-in duration-75"
              leaveFrom="opacity-100 translate-x-0"
              leaveTo="opacity-0 translate-x-1"
            >
              <PopoverPanel
                anchor="right start"
                className="z-[60] ml-2 w-fit rounded bg-[var(--primary-bg)] shadow-2xl ring-1 shadow-(color:--button-primary)/30 ring-[var(--primary-border)]"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => {
                      handleBlock();
                      close();
                    }}
                    disabled={isBlocking}
                    className="focus:bg-secondary-bg active:bg-secondary-bg flex w-full cursor-pointer items-center justify-start gap-2 px-4 py-2 text-[var(--text-primary)] hover:bg-[var(--kas-primary)] active:scale-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4" />
                    {isBlocking
                      ? isBlocked
                        ? "Block"
                        : "Unblock"
                      : isBlocked
                        ? "Unblock"
                        : "Block"}
                  </button>
                </div>
              </PopoverPanel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  );
};
