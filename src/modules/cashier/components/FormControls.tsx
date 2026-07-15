import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../../app/components/ui/utils";

export const fieldClass =
  "cashier-field min-h-11 w-full rounded-[11px] border border-border bg-white/90 px-3 text-sm text-foreground shadow-[0_1px_2px_rgba(36,26,19,0.03)] outline-none transition-all placeholder:text-muted-foreground/55 hover:border-primary/25 focus:border-primary/55 focus:bg-white focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-red-100 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-600"
    >
      <AlertCircle className="h-3 w-3" aria-hidden="true" />
      {children}
    </p>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-bold text-foreground"
    >
      {children}
    </label>
  );
}

export const CashierInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function CashierInput({ className, ...props }, ref) {
  return <input ref={ref} {...props} className={cn(fieldClass, className)} />;
});

export const CashierSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function CashierSelect({ className, ...props }, ref) {
  return <select ref={ref} {...props} className={cn(fieldClass, className)} />;
});

export const CashierTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function CashierTextarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={cn(fieldClass, "min-h-20 py-3", className)}
    />
  );
});
