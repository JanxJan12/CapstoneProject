import { type ButtonHTMLAttributes, type ElementType, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../../app/components/ui/utils";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface CashierButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  size?: ButtonSize;
  loadingLabel?: string;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-primary to-orange-600 text-primary-foreground shadow-[0_6px_16px_rgba(184,79,10,0.18)] hover:-translate-y-0.5 hover:shadow-[0_9px_20px_rgba(184,79,10,0.24)]",
  secondary:
    "border border-border bg-white text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-amber-50/40 hover:shadow-md",
  danger:
    "border border-red-600 bg-gradient-to-r from-red-600 to-red-500 text-white shadow-sm hover:-translate-y-0.5 hover:from-red-700 hover:to-red-600 hover:shadow-md",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-[10px] px-3 text-[11px]",
  md: "min-h-11 rounded-[11px] px-4 text-xs",
  lg: "min-h-12 rounded-xl px-5 text-sm",
};

export const CashierButton = forwardRef<HTMLButtonElement, CashierButtonProps>(
  function CashierButton(
    {
      variant = "primary",
      loading = false,
      loadingLabel = "Please wait…",
      size = "md",
      className,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-busy={loading || undefined}
        className={cn(
          "cashier-action inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-black transition-all duration-200 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
          SIZE_STYLES[size],
          VARIANT_STYLES[variant],
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            <span>{loadingLabel}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

export interface CashierIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ElementType;
}

export const CashierIconButton = forwardRef<
  HTMLButtonElement,
  CashierIconButtonProps
>(function CashierIconButton(
  { label, icon: Icon, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "cashier-action inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-white text-muted-foreground shadow-sm transition-all hover:border-primary/25 hover:bg-amber-50/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
});
