import { customerRecordedBreakdown, type CustomerRecordedAmounts } from "./customerFinancialDisplay";

const CUSTOMER_CURRENCY_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCustomerCurrency(value: number | string): string {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? CUSTOMER_CURRENCY_FORMATTER.format(amount)
    : "₱—";
}

export function CustomerRecordedCharges({ order }: { order: CustomerRecordedAmounts }) {
  const breakdown = customerRecordedBreakdown(order);
  return (
    <section aria-label="Recorded charges" className="rounded-xl border border-border bg-background p-4">
      <h3 className="mb-2 text-sm font-extrabold text-foreground">Recorded charges</h3>
      {breakdown.lines ? (
        <dl className="space-y-2 text-sm">
          {breakdown.lines.map((line) => (
            <div key={line.label} className="flex items-start justify-between gap-3">
              <dt className="min-w-0 text-muted-foreground">{line.label}</dt>
              <dd className="flex-none font-bold tabular-nums text-foreground">{line.subtract ? "−" : ""}{formatCustomerCurrency(line.cents / 100)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">Charge breakdown unavailable for this order. The recorded total remains shown above.</p>
      )}
    </section>
  );
}
