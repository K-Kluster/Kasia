import { FC, useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { parseMessageForDisplay } from "../../../../utils/message-format";
import { MARKDOWN_PREFIX } from "../../../../config/constants";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { useFeatureFlagsStore } from "../../../../store/featureflag.store";

type MessageContentProps = {
  content: string;
  isDecrypting: boolean;
  isBroadcast?: boolean;
  isOutgoing?: boolean;
};

export const MessageContent: FC<MessageContentProps> = ({
  content,
  isDecrypting,
  isBroadcast = false,
  isOutgoing = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldCollapse, setShouldCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const imageLinksEnabled = useFeatureFlagsStore(
    (state) => state.flags.broadcast_image_links
  );

  const clickableLinksEnabled = useFeatureFlagsStore(
    (state) => state.flags.broadcast_links
  );

  // check if content should be collapsed based on line count, length or some combo
  useEffect(() => {
    if (typeof content === "string" && !isDecrypting) {
      const lineCount = content.split("\n").length;
      const contentLength = content.length;
      // collapse if more than 8 lines OR if content is very long
      setShouldCollapse(
        (lineCount > 6 && contentLength > 100) ||
          lineCount > 10 ||
          contentLength > 300
      );
    }
  }, [content, isDecrypting]);

  if (isDecrypting) {
    return (
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 italic">
        Decrypting message...
      </div>
    );
  }

  // render content (markdown or plain text)
  if (typeof content === "string") {
    // check if content starts with markdown flag and process content
    const isMarkdown = content.startsWith(MARKDOWN_PREFIX);
    const displayContent = isMarkdown
      ? content.slice(MARKDOWN_PREFIX.length)
      : content;

    // preserve multiple consecutive newlines by replacing them with non-breaking spaces
    const formattedContent = displayContent.replace(/\n{2,}/g, "\n\u00A0\n");

    const renderedContent = isMarkdown ? (
      <MarkdownRenderer
        content={formattedContent}
        enableMdLinks={clickableLinksEnabled || !isBroadcast}
        enableMdImages={imageLinksEnabled || !isBroadcast}
      />
    ) : (
      parseMessageForDisplay(displayContent)
    );

    return (
      <div>
        <div
          ref={contentRef}
          className={clsx(
            "overflow-hidden transition-all duration-300 ease-in-out",
            {
              "max-h-32": shouldCollapse && !isExpanded,
            }
          )}
          style={{
            maxHeight: shouldCollapse && !isExpanded ? "10rem" : "none",
            maskImage:
              shouldCollapse && !isExpanded
                ? "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 80%, rgba(0,0,0,0.3) 90%, rgba(0,0,0,0) 100%)"
                : "none",
          }}
        >
          {renderedContent}
        </div>

        {shouldCollapse && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={clsx(
              "text-text-secondary w-full cursor-pointer px-2 pb-2 text-xs font-semibold underline opacity-70 transition-opacity hover:opacity-100",
              {
                "text-right": !isOutgoing,
                "text-left": isOutgoing,
              }
            )}
          >
            {isExpanded ? "collapse" : "see more..."}
          </button>
        )}
      </div>
    );
  }

  return content;
};
