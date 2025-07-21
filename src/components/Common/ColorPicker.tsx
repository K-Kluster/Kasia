import { FC } from "react";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
}

export const ColorPicker: FC<ColorPickerProps> = ({
  color,
  onChange,
  label,
}) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <label className="text-center text-xs font-medium text-[var(--text-primary)]">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded-lg"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 rounded border border-[var(--primary-border)] bg-[var(--input-bg)] px-1 py-1 text-xs text-[var(--text-primary)]"
          placeholder="#000000"
        />
      </div>
    </div>
  );
};
