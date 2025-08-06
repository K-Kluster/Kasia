import { FC, useState } from "react";
import { RefreshCcw } from "lucide-react";
import clsx from "clsx";

type FetchApiMessagesProps = {
  address: string;
};

/**
 * Now unused - what should we do with this?
 */
export const FetchApiMessages: FC<FetchApiMessagesProps> = ({ address }) => {
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <button
        onClick={() => undefined}
        disabled={loading}
        className={clsx(
          "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2",
          { "cursor-not-allowed": loading }
        )}
        title={"Fetch latest messages from blockDAG"}
      >
        <RefreshCcw
          className={clsx(
            "h-6 w-6",
            loading
              ? "animate-spin text-gray-500"
              : "text-[var(--button-primary)] hover:scale-110"
          )}
        />
      </button>
    </div>
  );
};
