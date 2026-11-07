import { quantityStep } from "./inventoryMutationUi";

export function InventoryQuantityInput({
  id,
  label,
  value,
  unit,
  quantityScale,
  onChange,
  disabled,
  error,
}: {
  id: string;
  label: string;
  value: string;
  unit: string | undefined;
  quantityScale: number;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label} {unit ? `(${unit})` : ""}
      </label>
      <input
        id={id}
        type="number"
        min={quantityStep(quantityScale)}
        step={quantityStep(quantityScale)}
        inputMode={quantityScale === 0 ? "numeric" : "decimal"}
        placeholder="0"
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helpId}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {error ? (
        <p id={errorId} className="text-[10px] font-semibold text-red-600">
          {error}
        </p>
      ) : (
        <p id={helpId} className="text-[10px] text-muted-foreground">
          {quantityScale === 0
            ? "Enter whole units only."
            : `Use up to ${quantityScale} decimal places.`}
        </p>
      )}
    </div>
  );
}
