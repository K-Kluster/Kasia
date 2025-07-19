// src/components/DateSeparator.tsx
import { FC, memo } from "react";
import { getDateSeparatorString } from "../utils/message-date-format";

interface DateSeparatorProps {
  timestamp: string | number;
  isFirst?: boolean;
}

export const DateSeparator: FC<DateSeparatorProps> = memo(
  ({ timestamp, isFirst }) => (
    <div className="my-4 text-center text-xs text-[var(--text-secondary)]">
      {getDateSeparatorString(timestamp, isFirst)}
    </div>
  )
);
