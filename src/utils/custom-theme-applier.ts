export type CustomColorPalette = {
  primaryBg: string;
  secondaryBg: string;
  primaryBorder: string;
  secondaryBorder: string;
  textPrimary: string;
  textSecondary: string;
  accentRed: string;
  inputBg: string;
  textWarning: string;
  buttonPrimary: string;
};

// shared default colors constant
export const DEFAULT_COLORS: CustomColorPalette = {
  primaryBg: "#242424",
  secondaryBg: "#1b1c1a",
  primaryBorder: "#505459",
  secondaryBorder: "#3b3b3b",
  textPrimary: "#f1f5f9",
  textSecondary: "#9ca3af",
  accentRed: "#ef4444",
  inputBg: "#3b3b3b",
  textWarning: "#fbb81a",
  buttonPrimary: "#70c7ba",
};

export function applyCustomColors(colors: CustomColorPalette) {
  const root = document.documentElement;

  // apply each custom color as a css custom property
  Object.entries(colors).forEach(([key, value]) => {
    const cssVar = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    root.style.setProperty(`--${cssVar}`, value);
  });
}

export function resetCustomColors() {
  const root = document.documentElement;

  // remove all custom color properties
  const customProperties = [
    "primary-bg",
    "secondary-bg",
    "primary-border",
    "secondary-border",
    "text-primary",
    "text-secondary",
    "accent-red",
    "input-bg",
    "text-warning",
    "button-primary",
  ];

  customProperties.forEach((prop) => {
    root.style.removeProperty(`--${prop}`);
  });
}

export function getInitialCustomColors(): CustomColorPalette | null {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("kasia-custom-colors");
    if (saved) {
      try {
        const colors = JSON.parse(saved);

        // check if colors are different from defaults
        const isDifferentFromDefaults = Object.keys(colors).some(
          (key) =>
            colors[key as keyof typeof colors] !==
            DEFAULT_COLORS[key as keyof typeof DEFAULT_COLORS]
        );

        if (isDifferentFromDefaults) {
          return colors;
        } else {
          // clean up old default colors from localStorage
          localStorage.removeItem("kasia-custom-colors");
          return null;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}
