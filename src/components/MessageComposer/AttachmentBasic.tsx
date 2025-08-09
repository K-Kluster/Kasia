import { Paperclip, Trash2 } from "lucide-react";
import {
  useComposerSlice,
  useComposerStore,
} from "../../store/message-composer.store";
import { MESSAGE_COMPOSER_MAX_HEIGHT } from "../../config/constants";

// this component is for rendering either a file or an image when its been attached
// also adds a trash button to delete
// further refactoring could ofc happen, but its good enough for now
export const AttachmentBasic = () => {
  // query the store for attachment
  const attachment = useComposerSlice((s) => s.attachment);
  const setAttachment = useComposerStore((s) => s.setAttachment);

  const removeAttachment = () => {
    setAttachment(null);
  };

  return (
    <>
      {attachment && (
        <div
          className={`bg-primary-bg border-secondary-border relative box-border flex-1 resize-none rounded-3xl border py-3 pr-20 pl-4 max-h-[${MESSAGE_COMPOSER_MAX_HEIGHT}px] overflow-hidden`}
        >
          <div className="flex items-center justify-between gap-2">
            {attachment.type === "image" ? (
              <img
                src={JSON.parse(attachment.data).content}
                alt={attachment.name}
                className="block max-h-[120px] max-w-[200px] flex-1 rounded-lg object-contain"
              />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Paperclip className="h-4 w-4" />
                {attachment.name} (
                {((JSON.parse(attachment.data).size || 0) / 1024).toFixed(2)}KB)
              </div>
            )}
            <button
              onClick={removeAttachment}
              className="flex-shrink-0 cursor-pointer rounded-full p-1 text-[var(--accent-red)] transition-colors duration-200 hover:text-[var(--accent-red)]/80"
              title="Remove attachment"
            >
              <Trash2 className="size-6" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
