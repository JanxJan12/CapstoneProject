export function PageHeader({ num, title, subtitle, count }: { num: string; title: string; subtitle: string; count: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 mb-8 flex items-start justify-between">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="text-lg font-bold text-primary">{num}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-2xl font-bold text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">screens</p>
      </div>
    </div>
  );
}
