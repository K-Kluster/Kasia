import { FC } from "react";

export const ErrorCard: FC<{ error?: string | null }> = ({ error }) => {
  return error ? <div className="error">{error}</div> : null;
};
