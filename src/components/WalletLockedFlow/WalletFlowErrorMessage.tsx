type WalletFlowErrorMessageProps = {
  message: string;
  className?: string;
};

export const WalletFlowErrorMessage = ({
  message,
  className = "",
}: WalletFlowErrorMessageProps) => {
  return (
    <div
      className={`mb-4 rounded-md border border-[var(--accent-red)]/20 bg-[var(--accent-red)]/10 p-3 text-sm text-[var(--accent-red)] ${className}`}
    >
      {message}
    </div>
  );
};
