const verbose = import.meta.env.VITE_ALLOW_VERBOSE_LOGGING === "true";

// Store the original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

// Overwrite console methods
console.log = (...args: unknown[]) => {
  if (verbose) {
    originalConsole.log(...args);
  }
};

console.warn = (...args: unknown[]) => {
  if (verbose) {
    originalConsole.warn(...args);
  }
};

console.error = (...args: unknown[]) => {
  if (verbose) {
    originalConsole.error(...args);
  }
};
