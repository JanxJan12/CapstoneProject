import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { POS_MAX_CASH_DIGITS } from "../constants";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"];

export function NumericKeypad({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [entry, setEntry] = useState(value > 0 ? String(value) : "");

  useEffect(() => {
    setEntry(value > 0 ? String(value) : "");
  }, [value]);

  const update = (next: string) => {
    const normalized = next
      .replace(/^0+(?=\d)/, "")
      .slice(0, POS_MAX_CASH_DIGITS);
    setEntry(normalized);
    onChange(Number(normalized || 0));
  };

  return (
    <div className="pos-numeric-keypad mt-2" aria-label="Cash numeric keypad">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground">
          Numeric keypad
        </span>
        <button
          type="button"
          onClick={() => update("")}
          className="min-h-8 rounded-md px-2 text-[9px] font-black"
        >
          Clear
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => update(`${entry}${key}`)}
            className="min-h-11 rounded-lg border text-sm font-black"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          aria-label="Delete last cash digit"
          onClick={() => update(entry.slice(0, -1))}
          className="flex min-h-11 items-center justify-center rounded-lg border"
        >
          <Delete className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
