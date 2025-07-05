const levelToUse = import.meta.env.VITE_LOG_LEVEL ?? "info";

const levels = ["info", "warn", "error", "silent"];
const indexToUse = levels.indexOf(levelToUse) ?? 0;

// Store the original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

// Overwrite console methods
console.log = (...args: unknown[]) => {
  if (indexToUse <= levels.indexOf("info")) originalConsole.log(...args);
};

console.warn = (...args: unknown[]) => {
  if (indexToUse <= levels.indexOf("warn")) originalConsole.warn(...args);
};

console.error = (...args: unknown[]) => {
  if (indexToUse <= levels.indexOf("error")) originalConsole.error(...args);
};
