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
          "fixed left-1/2 top-1/2",
          "flex max-h-[calc(100dvh-2rem)]",
          "w-[calc(100vw-2rem)]",
          "-translate-x-1/2 -translate-y-1/2",
          "flex-col gap-0 overflow-hidden",
          "rounded-[20px] border-border/80",
          "bg-[#fffdf9]",
          "p-0",
          "shadow-[0_24px_70px_rgba(36,26,19,0.22)]",

          "[&_[data-slot=dialog-title]]:text-lg",
          "[&_[data-slot=dialog-title]]:font-black",
          "[&_[data-slot=dialog-title]]:tracking-tight",

          "[&_[data-slot=dialog-description]]:text-xs",
          "[&_[data-slot=dialog-description]]:font-medium",
          "[&_[data-slot=dialog-description]]:leading-5",

          "[&_[data-slot=dialog-close]]:rounded-lg",
          "[&_[data-slot=dialog-close]]:p-1.5",
        ].join(" "),
        className,
      )}
      {...props}
    />
  );
}