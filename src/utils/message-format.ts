import React from "react";

// renders real newlines as <br /> and literal \\n as the text '\n'.
export function parseMessageForDisplay(stored: string): React.ReactNode {
  if (typeof stored !== "string") return stored;
  // Replace all \\n with a unique placeholder
  const PLACEHOLDER = "__LITERAL_NL__";
  const withPlaceholders = stored.replace(/\\\\n/g, PLACEHOLDER);
  // split by real newlines
  const lines = withPlaceholders.split("\n");
  return lines.map((line, idx, arr) =>
    React.createElement(
      React.Fragment,
      { key: idx },
      line.replace(new RegExp(PLACEHOLDER, "g"), "\\n"),
      idx < arr.length - 1 ? React.createElement("br") : null
    )
  );
}
