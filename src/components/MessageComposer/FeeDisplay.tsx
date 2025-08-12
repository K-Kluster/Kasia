import clsx from "clsx";
import { formatKasAmount } from "../../utils/format";
import { PriorityFeeSelector } from "../PriorityFeeSelector";
import { PriorityFeeConfig } from "../../types/all";
import { Attachment } from "../../store/message-composer.store";
import { FeeState } from "../../types/all";

// fee levels for color coding
// need to extract this and make it setable from the settings
const FEE_LEVELS = [
  { limit: 0.00002, classes: "text-green-400 border-green-400" },
  { limit: 0.00005, classes: "text-blue-400  border-blue-400" },
  { limit: 0.0005, classes: "text-yellow-400 border-yellow-400" },
  { limit: 0.001, classes: "text-orange-400 border-orange-400" },
  { limit: Infinity, classes: "text-red-400 border-red-400" },
];

function getFeeClasses(fee: number) {
  return FEE_LEVELS.find(({ limit }) => fee <= limit)!.classes;
}

interface FeeDisplayProps {
  recipient?: string;
  draft?: string;
  attachment: Attachment | null;
  feeState: FeeState;
  priority: PriorityFeeConfig;
  onPriorityChange: (priority: PriorityFeeConfig) => void;
}

// this displayes the fee above the message box and colors it!
export const FeeDisplay = ({
  recipient,
  draft,
  attachment,
  feeState,
  priority,
  onPriorityChange,
}: FeeDisplayProps) => {
  // only show fee display when we have a recipient and either draft or attachment
  if (!recipient || (!draft && !attachment)) {
    return null;
  }

  return (
    <div className="absolute -top-7.5 right-4 flex items-center gap-2">
      <div
        className={clsx(
          "inline-block rounded-md border bg-white/10 px-3 py-1 text-right text-xs text-gray-400 transition-opacity duration-300 ease-out",
          feeState.value && getFeeClasses(feeState.value)
        )}
      >
        {feeState.status === "loading"
          ? feeState.value != null
            ? `Updating fee… ${formatKasAmount(feeState.value)} KAS`
            : "Estimating fee…"
          : feeState.value != null
            ? `Estimated fee: ${formatKasAmount(feeState.value)} KAS`
            : "Calculating fee…"}
      </div>

      <PriorityFeeSelector
        currentFee={priority}
        onFeeChange={onPriorityChange}
        className="mr-0 sm:mr-2"
      />
    </div>
  );
};
