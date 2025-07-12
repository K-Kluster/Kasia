import { FC, useState } from "react";
import { Copy, Check } from "lucide-react";
import { clsx } from "clsx";
import { copyToClipboard } from "../../utils/copy-to-clipboard";

type StringCopyProps = {
  text?: string | null;
  alertText?: string;
  titleText?: string;
  iconClass?: string;
  className?: string;
};

export const StringCopy: FC<StringCopyProps> = ({
  text,
  alertText = "Text copied",
  titleText = "Copy text",
  className,
  iconClass = "size-5",
}) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!text) return null;

  const handleCopy = () => {
    copyToClipboard(text, alertText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={clsx(
        "flex cursor-pointer items-center rounded-lg transition-all duration-300 focus:outline-none",
        className,
        {
          "bg-kas-secondary": isCopied,
          "focus:ring-kas-secondary hover:bg-gray-200/20 focus:ring-2":
            !isCopied,
        }
      )}
      title={titleText}
    >
      {isCopied ? (
        <Check
          className={clsx(
            "align-middle transition-colors duration-300",
            iconClass,
            "text-white"
          )}
        />
      ) : (
        <Copy
          className={clsx(
            "align-middle transition-colors duration-300",
            iconClass,
            "hover:text-kas-secondary text-text-primary"
          )}
        />
      )}
    </button>
  );
};
