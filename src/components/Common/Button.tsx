import clsx from "clsx";
import { ButtonHTMLAttributes, FC } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export const Button: FC<ButtonProps> = ({
  variant = "primary",
  disabled,
  className,
  children,
  ...props
}) => {
  const base =
    "cursor-pointer w-full text-gray-100 font-bold py-3 px-4 sm:px-6 rounded-lg transition-colors duration-200";
  const variantClasses =
    variant === "primary"
      ? "bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/70 active:bg-[var(--accent-blue)]/20 disabled:bg-[var(--accent-blue)]/50"
      : "bg-[var(--primary-bg)] hover:bg-[var(--primary-bg)]/70 active:bg-[var(--primary-bg)]/20 disabled:bg-[var(--primary-bg)]/50";
  return (
    <button
      {...props}
      disabled={disabled}
      className={clsx(base, variantClasses, className, {
        "cursor-not-allowed opacity-50": disabled,
      })}
    >
      {children}
    </button>
  );
};
