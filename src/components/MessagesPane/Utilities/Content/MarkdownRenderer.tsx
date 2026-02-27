import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
// NOTE: In its current vanilla form, our use of react-markdown is safe from XSS attack
// If adding more plugins or raw HTML support, add rehype-sanitize or find a way to sanitize properly

interface MarkdownRendererProps {
  content: string;
  enableMdLinks?: boolean;
  enableMdImages?: boolean;
}

const isSafeHref = (href?: string) => {
  if (!href) return false;
  const normalized = href.trim().toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("www.")
  );
};

const normalizeHref = (href?: string) => {
  if (!href) return undefined;
  const trimmed = href.trim();
  return trimmed.toLowerCase().startsWith("www.")
    ? `https://${trimmed}`
    : trimmed;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  enableMdLinks = false,
  enableMdImages = false,
}) => (
  <div className="prose-sm [&_a]:text-blue-400 [&_a]:underline [&_a]:hover:text-blue-300 [&_blockquote]:border-l-2 [&_blockquote]:border-current [&_blockquote]:pl-2 [&_blockquote]:opacity-80 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_h4]:font-bold [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:rounded [&_pre]:bg-black/10 [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-4">
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      components={{
        a: ({
          href,
          children,
          ...props
        }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
          enableMdLinks ? (
            isSafeHref(href) ? (
              <a
                href={normalizeHref(href)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (
                    !confirm(
                      `You are navigating away from Kasia to ${normalizeHref(href)}. Continue?`
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
                {...props}
              >
                {children}
              </a>
            ) : (
              <span {...props}>
                Kasia Safety Guard - Not Standard Link | Link Text: {children} |
                Link: {href}
              </span>
            )
          ) : (
            <span {...props}>
              Kasia Safety Guard - Links Not Enabled | Link Text: {children} |
              Link: {href}
            </span>
          ),
        img: ({
          src,
          alt,
          ...props
        }: React.ImgHTMLAttributes<HTMLImageElement>) =>
          enableMdImages ? (
            <img src={src} alt={alt} {...props} />
          ) : (
            <span className="text-gray-500 italic" {...props}>
              [KASIA PERMISSION - Image Links Not Enabled: {src}]
            </span>
          ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
