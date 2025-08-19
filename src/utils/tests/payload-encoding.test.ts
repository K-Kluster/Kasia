import { it, describe, expect } from "vitest";
import { tryParseBase64AsHexToHex } from "../payload-encoding";

describe("tryParseBase64AsHexToHex", () => {
  it("should decode base64 input", () => {
    const hexInput =
      "583731357435574670537a6742515a6341727375706c5a6d64324768682f35307a6d786a41737347705839454e782b5148664d394454784b506d53506666496458624e715741544753754f7365776c57626167486b42593d";
    const expectedOutput =
      "5fbd79b79585a52ce005065c02bb2ea656667761a187fe74ce6c6302cb06a57f44371f901df33d0d3c4a3e648f7df21d5db36a5804c64ae3ac7b09566da8079016";
    expect(tryParseBase64AsHexToHex(hexInput)).toBe(expectedOutput);
  });

  it("should not alter non-base 64 content", () => {
    const hexInput =
      "574c626b376876536b784136706550556a6e674755344c65686576392f4d5241433339557453345a726c4b77667a6d624f4f75636";
    expect(tryParseBase64AsHexToHex(hexInput)).toBe(hexInput);
  });

  it("should not alter non-base 64 content", () => {
    const hexInput =
      "583731357435574670537a6742515a6341727375706c5a6d64324768682f35307a6d786a41737347705839454e782b505486584d394454784b506d53506666496458624e715741544753754f7365776c57626167486b42593d";
    expect(tryParseBase64AsHexToHex(hexInput)).toBe(hexInput);
  });
});
