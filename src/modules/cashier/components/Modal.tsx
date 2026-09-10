import type { ComponentProps } from "react";
import { DialogContent as BaseDialogContent } from "@/components/ui/dialog";
import { cn } from "@/components/ui/utils";

export function CashierDialogContent({
  className,
  ...props
}: ComponentProps<typeof BaseDialogContent>) {
  return (
    <BaseDialogContent
      className={cn(
        [
          "cashier-modal",
          "fixed left-1/2 top-1/2",
          "flex max-h-[calc(100dvh-2rem)]",
          "w-[calc(100vw-2rem)]",
          "-translate-x-1/2 -translate-y-1/2",
          "flex-col gap-4 overflow-y-auto overscroll-contain",
          "rounded-2xl border-border/80",
          "bg-[#fffdf9]",
          "p-5 sm:p-6",
          "shadow-[0_24px_70px_rgba(36,26,19,0.22)]",

          "[&_[data-slot=dialog-header]]:gap-1.5",

          "[&_[data-slot=dialog-title]]:text-lg",
          "[&_[data-slot=dialog-title]]:font-black",
          "[&_[data-slot=dialog-title]]:leading-tight",
          "[&_[data-slot=dialog-title]]:tracking-tight",

          "[&_[data-slot=dialog-description]]:text-xs",
          "[&_[data-slot=dialog-description]]:font-medium",
          "[&_[data-slot=dialog-description]]:leading-5",

          "[&_[data-slot=dialog-footer]]:gap-2",

          "[&_[data-slot=dialog-close]]:right-3.5",
          "[&_[data-slot=dialog-close]]:top-3.5",
          "[&_[data-slot=dialog-close]]:rounded-[10px]",
          "[&_[data-slot=dialog-close]]:p-2",
          "[&_[data-slot=dialog-close]]:opacity-60",
          "[&_[data-slot=dialog-close]]:hover:opacity-100",
        ].join(" "),
        className,
      )}
      {...props}
    />
  );
}
