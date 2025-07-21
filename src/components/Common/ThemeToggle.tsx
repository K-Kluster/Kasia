import { FC } from "react";
import { Sun, Moon, Monitor, Palette } from "lucide-react";
import { useUiStore } from "../../store/ui.store";

export const ThemeToggle: FC = () => {
  const { theme, setTheme, getEffectiveTheme, customColors } = useUiStore();
  const effectiveTheme = getEffectiveTheme();

  const getButtonStyles = (
    buttonTheme: "light" | "dark" | "system" | "custom"
  ) => {
    const isActive = theme === buttonTheme;
    const baseStyles =
      "cursor-pointer p-1.5 rounded-2xl transition-all duration-200";

    if (isActive) {
      return `${baseStyles} shadow-sm`;
    } else {
      return `${baseStyles} hover:bg-opacity-50`;
    }
  };

  const getButtonColors = (
    buttonTheme: "light" | "dark" | "system" | "custom"
  ) => {
    const isActive = theme === buttonTheme;

    if (isActive) {
      return {
        backgroundColor:
          effectiveTheme === "dark" ? "var(--primary-bg)" : "#ffffff",
        color: "var(--text-primary)",
      };
    } else {
      return {
        color: "var(--text-secondary)",
      };
    }
  };

  return (
    <div
      className="border-primary-border flex w-fit items-center space-x-1 rounded-3xl border p-1"
      style={{
        backgroundColor:
          effectiveTheme === "dark" ? "var(--secondary-bg)" : "#f8fafc",
      }}
    >
      <button
        onClick={() => setTheme("light")}
        className={getButtonStyles("light")}
        style={getButtonColors("light")}
        aria-label="Light mode"
      >
        <Sun
          className="h-4 w-4"
          style={{
            color: theme === "light" ? "#f59e0b" : "var(--text-secondary)",
          }}
        />
      </button>

      <button
        onClick={() => setTheme("dark")}
        className={getButtonStyles("dark")}
        style={getButtonColors("dark")}
        aria-label="Dark mode"
      >
        <Moon
          className="h-4 w-4"
          style={{
            color:
              theme === "dark"
                ? "var(--button-primary)"
                : "var(--text-secondary)",
          }}
        />
      </button>

      <button
        onClick={() => setTheme("system")}
        className={getButtonStyles("system")}
        style={getButtonColors("system")}
        aria-label="System theme"
      >
        <Monitor
          className="h-4 w-4"
          style={{
            color:
              theme === "system"
                ? effectiveTheme === "dark"
                  ? "var(--button-primary)"
                  : "#64748b"
                : "var(--text-secondary)",
          }}
        />
      </button>

      {customColors && (
        <button
          onClick={() => setTheme("custom")}
          className={getButtonStyles("custom")}
          style={getButtonColors("custom")}
          aria-label="Custom theme"
        >
          <Palette
            className="h-4 w-4"
            style={{
              color:
                theme === "custom"
                  ? "var(--button-primary)"
                  : "var(--text-secondary)",
            }}
          />
        </button>
      )}
    </div>
  );
};
