import { AlertCircle } from "lucide-react";

export function InputField({ label, type, placeholder, value, onChange, icon: Icon, error, right, height = 44 }: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ElementType;
  error?: string;
  right?: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-foreground">{label}</label>
      <div className={`relative flex items-center rounded-xl border shadow-[0_1px_2px_rgba(36,26,19,0.03)] transition-all ${error ? "border-destructive bg-red-50/60" : "border-border bg-white/90 hover:border-primary/25 focus-within:border-primary/55 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/10"}`} style={{ height }}>
        <Icon className={`absolute left-3 w-4 h-4 flex-shrink-0 ${error ? "text-destructive" : "text-muted-foreground"}`} />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full pl-9 pr-9 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />
        {right && <div className="absolute right-3">{right}</div>}
      </div>
      {error && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}
