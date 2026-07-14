import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export function Button({ children, onClick, variant = "primary", size = "md", loading, disabled, className = "" }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const b = "inline-flex items-center justify-center gap-2 rounded-xl font-extrabold transition-all duration-200 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  const v: Record<ButtonVariant, string> = {
    primary: "bg-gradient-to-r from-primary to-orange-600 text-primary-foreground shadow-[0_7px_18px_rgba(184,79,10,0.18)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(184,79,10,0.24)]",
    secondary: "border border-border bg-white/90 text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-amber-50/40 hover:shadow-md",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    danger: "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-sm hover:-translate-y-0.5 hover:from-red-700 hover:to-red-600 hover:shadow-md",
  };
  const sz: Record<ButtonSize, string> = {
    sm: "min-h-9 px-3 py-1.5 text-[11px]",
    md: "min-h-11 px-4 py-2.5 text-xs",
    lg: "min-h-12 px-5 py-3 text-sm",
  };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={`${b} ${v[variant]} ${sz[size]} ${className}`}>
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}
