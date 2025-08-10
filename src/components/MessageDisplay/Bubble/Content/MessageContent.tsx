import { FC } from "react";
import { parseMessageForDisplay } from "../../../../utils/message-format";

type MessageContentProps = {
  content: string;
  isDecrypting: boolean;
};

export const MessageContent: FC<MessageContentProps> = ({
  content,
  isDecrypting,
}) => {
  if (isDecrypting) {
    return (
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 italic">
        Decrypting message...
      </div>
    );
  }

  // render plain text with newlines as <br /> and \\n as literal text
  if (typeof content === "string") {
    return parseMessageForDisplay(content);
  }

  return content;
};
