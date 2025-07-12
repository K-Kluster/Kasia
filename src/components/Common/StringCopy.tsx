import { FC, useState, ReactNode } from "react";
import { toast } from "../../utils/toast";
import { Copy } from "lucide-react";
import { clsx } from "clsx";

type StringCopyProps = {
  text?: string | null;
  alertText?: string;
  titleText?: string;
  iconClass?: string;
  className?: string;
  children?: ReactNode;
};

export const StringCopy: FC<StringCopyProps> = ({
  text,
  alertText = "Text copied",
  titleText = "Copy text",
  className,
  iconClass = "size-5",
  children,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!text) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast.info(alertText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 750);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={clsx(
        "flex cursor-pointer items-center gap-2 transition-all duration-500 focus:outline-none",
        className,
        {
          "bg-kas-secondary": isCopied,
          "focus:ring-kas-secondary hover:bg-gray-200/20 focus:ring-2":
            !isCopied,
        }
      )}
      title={titleText}
    >
      <Copy
        className={clsx(
          "align-middle transition-colors duration-500",
          iconClass,
          {
            "text-white": isCopied,
            "hover:text-kas-secondary text-gray-400": !isCopied,
          }
        )}
      />
      {children && <span>{children}</span>}
    </button>
  );
};
