import { FC } from "react";
import { Paperclip } from "lucide-react";
import type { FileData } from "../../../../store/repository/message.repository";

type FileContentProps = {
  fileData: FileData | null;
  content: string | null;
  transactionId?: string;
};

export const FileContent: FC<FileContentProps> = ({ fileData }) => {
  if (!fileData || fileData.type !== "file") return null;

  const isImage = fileData.mimeType.startsWith("image/");
  const sizeKB = (fileData.size / 1024).toFixed(1);

  if (isImage) {
    return (
      <img
        src={fileData.content}
        alt={fileData.name}
        className="my-0.5 block max-w-full cursor-pointer rounded-lg"
      />
    );
  }

  return (
    <div className="mt-1 rounded-lg p-1">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <Paperclip className="h-4 w-4" />
        {fileData.name} ({sizeKB}KB)
      </div>
      <button
        className="cursor-pointer rounded border bg-[var(--button-primary)] px-3 py-1 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--button-primary)]/80"
        onClick={() => {
          const link = document.createElement("a");
          link.href = fileData.content;
          link.download = fileData.name;
          link.click();
        }}
      >
        Download
      </button>
    </div>
  );
};
