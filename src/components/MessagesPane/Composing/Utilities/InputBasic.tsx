import { useEffect, useState, forwardRef } from "react";
import clsx from "clsx";
import { useIsMobile } from "../../../../hooks/useIsMobile";
import {
  MESSAGE_COMPOSER_MIN_HEIGHT,
  MESSAGE_COMPOSER_MAX_HEIGHT,
} from "../../../../config/constants";
import { MAX_CHAT_INPUT_CHAR } from "../../../../config/constants";
import { useFeatureFlagsStore } from "../../../../store/featureflag.store";
import { MARKDOWN_PREFIX } from "../../../../config/constants";

interface InputBasicProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onSend?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  onDragOver?: boolean;
}

// this is our "basic" input
// it does have added complexity for managing its height, max height and over / pasting etc
// but its simple incomparison to a potential rich text editor
export const InputBasic = forwardRef<HTMLTextAreaElement, InputBasicProps>(
  (
    {
      value,
      onChange,
      placeholder,
      disabled,
      onSend,
      onKeyDown,
      onPaste,
      className,
      onDragOver,
    },
    ref
  ) => {
    const [textareaHeight, setTextareaHeight] = useState(
      MESSAGE_COMPOSER_MIN_HEIGHT
    );
    const [showScroll, setShowScroll] = useState(false);
    const isMobile = useIsMobile();

    const markdownEnabled = useFeatureFlagsStore(
      (state) => state.flags.markdown
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let newValue = e.target.value;

      // add markdown prefix if markdown is enabled and there's real content
      if (markdownEnabled) {
        newValue = newValue.trim().length > 0 ? MARKDOWN_PREFIX + newValue : "";
      }

      onChange(newValue);

      // auto-resize logic - measure with minimal height
      const originalHeight = e.target.style.height;
      e.target.style.height = "1px";
      const scrollHeight = e.target.scrollHeight;
      e.target.style.height = originalHeight;

      // add padding compensation
      const contentHeight = scrollHeight + 0;
      const newHeight = Math.max(
        MESSAGE_COMPOSER_MIN_HEIGHT,
        Math.min(contentHeight, MESSAGE_COMPOSER_MAX_HEIGHT)
      );

      setTextareaHeight(newHeight);
      // set scroll when content needs more than 144px
      setShowScroll(contentHeight > MESSAGE_COMPOSER_MAX_HEIGHT);
    };

    // reset height when content becomes empty
    useEffect(() => {
      if (!value) {
        setTextareaHeight(MESSAGE_COMPOSER_MIN_HEIGHT);
        setShowScroll(false);

        // auto-focus when input becomes empty (after send)
        if (ref && typeof ref !== "function" && ref.current) {
          ref.current.focus();
        }
      }
    }, [value, ref]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !isMobile) {
        e.preventDefault();
        onSend?.();
      }
      onKeyDown?.(e);
    };

    return (
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={MAX_CHAT_INPUT_CHAR + 1}
        className={clsx(
          className ||
            "peer bg-primary-bg box-border flex-1 resize-none rounded-3xl py-3 pr-20 pl-4 text-base text-[var(--text-primary)] sm:text-sm",
          showScroll ? "overflow-y-auto" : "overflow-y-hidden",
          onDragOver ? "border-kas-secondary border" : "outline-none"
        )}
        style={{ height: `${textareaHeight}px` }}
      />
    );
  }
);
