import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../app/components/ui/alert-dialog";
import { cn } from "../../../app/components/ui/utils";

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Go back",
  danger = false,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="cashier-confirm-dialog max-w-md rounded-[20px] border-border/80 bg-[#fffdf9] p-5 shadow-[0_24px_70px_rgba(36,26,19,0.22)] sm:p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-black tracking-tight text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs font-medium leading-5">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cashier-action min-h-11 rounded-[11px] border border-border bg-white px-4 text-xs font-black text-foreground shadow-sm transition-all hover:border-primary/25 hover:bg-amber-50/40 focus-visible:ring-primary">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              "cashier-action min-h-11 rounded-[11px] px-4 text-xs font-black text-white shadow-sm transition-all focus-visible:ring-primary",
              danger
                ? "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600"
                : "bg-gradient-to-r from-primary to-orange-600 hover:shadow-md",
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
