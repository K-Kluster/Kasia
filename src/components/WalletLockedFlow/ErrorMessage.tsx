type ErrorMessageProps = {
  message: string;
  className?: string;
};

export const ErrorMessage = ({
  message,
  className = "",
}: ErrorMessageProps) => {
  return (
    <div
      className={`mb-4 rounded-md border border-[var(--accent-red)]/20 bg-[var(--accent-red)]/10 p-3 text-sm text-[var(--accent-red)] ${className}`}
    >
      {message}
    </div>
  );
};
