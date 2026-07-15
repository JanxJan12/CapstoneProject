import type { ReactNode } from "react";
import { Dialog } from "../../../app/components/ui/dialog";
import { cn } from "../../../app/components/ui/utils";
import { CashierDialogContent } from "./Modal";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  size?: "md" | "lg";
  className?: string;
}

const SIZE_STYLES: Record<NonNullable<DrawerProps["size"]>, string> = {
  md: "max-w-xl sm:max-w-xl",
  lg: "max-w-2xl sm:max-w-2xl",
};

export function Drawer({
  open,
  onOpenChange,
  children,
  size = "md",
  className,
}: DrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CashierDialogContent
        className={cn(
          "cashier-drawer left-auto right-0 top-0 h-dvh max-h-dvh w-full translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-[#f8f4ef] p-0 shadow-[-18px_0_50px_rgba(36,26,19,0.16)]",
          SIZE_STYLES[size],
          className,
        )}
      >
        {children}
      </CashierDialogContent>
    </Dialog>
  );
}
