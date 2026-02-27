// strip markdown formatting and return plain text
export function stripMarkdown(markdown: string): string {
  return (
    markdown
      // remove code blocks
      .replace(/```[\s\S]*?```/g, "[code block]")
      .replace(/`[^`\n]+`/g, "[code]")
      // remove links and images
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links
      // remove headers
      .replace(/^#+\s*/gm, "")
      // remove bold/italic
      .replace(/\*\*\*([^*]+)\*\*\*/g, "$1") // bold italic
      .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
      .replace(/\*([^*]+)\*/g, "$1") // italic
      .replace(/__([^_]+)__/g, "$1") // underline bold
      .replace(/_([^_]+)_/g, "$1") // underline italic
      // remove strikethrough
      .replace(/~~([^~]+)~~/g, "$1")
      // remove blockquotes
      .replace(/^>\s*/gm, "")
      // remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // clean up extra whitespace
      .replace(/\n{2,}/g, " ")
      .trim()
  );
}
