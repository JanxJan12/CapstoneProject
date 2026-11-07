import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function ReceivingAccordion({
  id, title, hint, open, onToggle, children, className = "", ariaLabel, staticContent = false,
}: {
  id: string;
  title: string;
  hint?: string;
  open?: boolean;
  onToggle?: () => void;
  staticContent?: boolean;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const contentId = `${id}-content`;
  return (
    <section id={id} tabIndex={-1} aria-label={ariaLabel} className={`manager-receiving-accordion min-w-0 scroll-mt-24 rounded-2xl border border-border bg-card shadow-sm ${className}`}>
      {staticContent ? <h2 className="px-4 py-3 text-sm font-bold text-foreground">
        {title}{hint ? <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span> : null}
      </h2> : <h2>
        <button type="button" aria-expanded={open} aria-controls={contentId} onClick={onToggle}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="min-w-0">{title}{hint ? <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span> : null}</span>
          <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-primary transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>}
      <div id={contentId} hidden={!staticContent && !open} className="manager-receiving-accordion-body border-t border-border px-4 pb-4 pt-3">
        {children}
      </div>
    </section>
  );
}
