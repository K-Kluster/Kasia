import { FC } from "react";
import { Check, X } from "lucide-react";

export const EditNicknamePopover: FC<{
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ value, placeholder, onChange, onSave, onCancel }) => (
  <div
    className="flex flex-col gap-2 bg-[var(--secondary-bg)] px-4 py-2"
    style={{ minHeight: "72px" }}
  >
    <EditNicknameInput
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      onSave={onSave}
      onCancel={onCancel}
    />
    <EditNicknameActions onSave={onSave} onCancel={onCancel} />
  </div>
);

const EditNicknameInput: FC<{
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ value, placeholder, onChange, onSave, onCancel }) => (
  <input
    type="text"
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }}
    className="w-full rounded border border-[var(--primary-border)] bg-[var(--secondary-bg)] px-2 py-1 text-sm text-[var(--text-primary)]"
    autoFocus
  />
);

const EditNicknameActions: FC<{
  onSave: () => void;
  onCancel: () => void;
}> = ({ onSave, onCancel }) => (
  <div className="flex flex-col gap-2">
    <button
      onClick={onSave}
      className="bg-kas-primary hover:bg-kas-primary/80 flex h-10 w-full cursor-pointer items-center justify-center rounded font-bold text-white transition-colors"
      title="Save"
    >
      <Check className="h-5 w-5" />
    </button>
    <button
      onClick={onCancel}
      className="flex h-10 w-full cursor-pointer items-center justify-center rounded border border-[var(--primary-border)] bg-[var(--primary-bg)] font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--primary-bg)]/80"
      title="Cancel"
    >
      <X className="h-5 w-5" />
    </button>
  </div>
);
