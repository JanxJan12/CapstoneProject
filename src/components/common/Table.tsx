export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="rrj-data-table overflow-x-auto rounded-2xl border border-border bg-card shadow-[0_12px_32px_rgba(67,42,23,0.045)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-[#f8f3ec]">
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[9px] font-extrabold uppercase tracking-[0.13em] text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/80 bg-card">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}
