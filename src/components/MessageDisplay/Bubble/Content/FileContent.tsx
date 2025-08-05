import { FC } from "react";
import { Paperclip } from "lucide-react";

type FileData = {
  type: string;
  name: string;
  size: number;
  mimeType: string;
  content: string;
};

type FileContentProps = {
  fileData: FileData | null;
  content: string | null;
  transactionId?: string;
};

export const FileContent: FC<FileContentProps> = ({ fileData }) => {
  // Handle file/image messages from fileData
  if (fileData && fileData.type === "file") {
    if (fileData.mimeType.startsWith("image/")) {
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
          <Paperclip className="h-4 w-4 cursor-pointer" /> {fileData.name} (
          {(fileData.size / 1024).toFixed(2)}
          KB)
        </div>
        <button
          className="mt-1 cursor-pointer rounded border bg-[var(--button-primary)] px-3 py-1 text-sm text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--button-primary)]/80"
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
  }

  return null;
};
