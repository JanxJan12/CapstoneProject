import type { ComponentProps } from "react";
import { DialogContent as BaseDialogContent } from "../../../app/components/ui/dialog";
import { cn } from "../../../app/components/ui/utils";

export function CashierDialogContent({
  className,
  ...props
}: ComponentProps<typeof BaseDialogContent>) {
  return (
    <BaseDialogContent
      className={cn(
        "cashier-modal max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-[20px] border-border/80 bg-[#fffdf9] p-5 shadow-[0_24px_70px_rgba(36,26,19,0.22)] sm:p-6 [&_[data-slot=dialog-title]]:text-lg [&_[data-slot=dialog-title]]:font-black [&_[data-slot=dialog-title]]:tracking-tight [&_[data-slot=dialog-description]]:text-xs [&_[data-slot=dialog-description]]:font-medium [&_[data-slot=dialog-description]]:leading-5 [&_[data-slot=dialog-close]]:rounded-lg [&_[data-slot=dialog-close]]:p-1.5",
        className,
      )}
      {...props}
    />
  );
}
