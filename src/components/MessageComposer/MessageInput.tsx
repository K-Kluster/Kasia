import { forwardRef } from "react";
import { InputBasic } from "./InputBasic";
import { AttachmentBasic } from "./AttachmentBasic";
import { useComposerSlice } from "../../store/message-composer.store";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend?: () => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onDragOver: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const MessageInput = forwardRef<HTMLTextAreaElement, MessageInputProps>(
  ({ ...props }, ref) => {
    const attachment = useComposerSlice((s) => s.attachment);

    // if there's an attachment, show its preview, otherwise show input with ref
    return (
      <>
        {attachment ? <AttachmentBasic /> : <InputBasic {...props} ref={ref} />}
      </>
    );
  }
);
