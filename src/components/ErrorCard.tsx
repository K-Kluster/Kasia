import { FC } from "react";

export const ErrorCard: FC<{
  error?: string | null;
  onDismiss?: () => void;
}> = ({ error, onDismiss }) => {
  return error ? (
    <div
      className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>{error}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            marginLeft: "10px",
            cursor: "pointer",
            background: "transparent",
            border: "none",
            color: "inherit",
            fontSize: "16px",
            padding: "2px 6px",
          }}
          title="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  ) : null;
};
