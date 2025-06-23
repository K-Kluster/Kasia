export const PASSWORD_MIN_LENGTH = 4;
export const disablePasswordRequirements =
  (import.meta.env.VITE_DISABLE_PASSWORD_REQUIREMENTS ?? "false") === "true";
