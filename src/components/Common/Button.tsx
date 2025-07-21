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
    "cursor-pointer w-full font-bold py-3 px-4 sm:px-6 rounded-3xl transition-colors duration-200 select-none";
  const variantClasses =
    variant === "primary"
      ? "bg-[var(--button-primary)] text-white hover:[var(--button-primary)]/80"
      : "bg-primary-bg/80 hover:bg-primary-bg/20 border border-primary-border";
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
