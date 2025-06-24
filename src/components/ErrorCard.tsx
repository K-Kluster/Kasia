import { FC } from "react";

export const ErrorCard: FC<{
  error?: string | null;
  onDismiss?: () => void;
}> = ({ error, onDismiss }) => {
  return error ? (
    <div
      className="error"
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
