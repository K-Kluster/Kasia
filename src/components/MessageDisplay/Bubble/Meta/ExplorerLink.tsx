import { FC } from "react";
import { Tickets } from "lucide-react";
import { getExplorerUrl } from "../../../../utils/explorer-url";

type ExplorerLinkProps = {
  transactionId: string;
  network: string;
  position: "left" | "right";
};

export const ExplorerLink: FC<ExplorerLinkProps> = ({
  transactionId,
  network,
  position,
}) => {
  const containerClass = position === "left" ? "ml-2" : "mr-2";

  return (
    <div className={`${containerClass} flex items-center`}>
      <a
        href={getExplorerUrl(transactionId, network)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs opacity-80 transition-opacity hover:opacity-100"
      >
        <Tickets className="size-5" />
      </a>
    </div>
  );
};
