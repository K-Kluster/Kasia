import React from "react";
const LITERAL_NL = "__LITERAL_NL__";
const ESCAPED_NL_RE = /\\\\n/g;
const LEADING_WS_RE = /^(\s+)/;

export function parseMessageForDisplay(stored: string): React.ReactNode {
  if (typeof stored !== "string") return stored;
  return stored
    .replace(ESCAPED_NL_RE, LITERAL_NL)
    .split("\n")
    .flatMap((line, i, arr) => [
      line
        .replace(LEADING_WS_RE, (m) => "\u00A0".repeat(m.length))
        .replace(new RegExp(LITERAL_NL, "g"), "\\n"),
      i < arr.length - 1 && React.createElement("br", { key: i }),
    ]);
}
