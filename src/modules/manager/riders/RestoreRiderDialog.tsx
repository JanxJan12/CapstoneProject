import { useState } from "react";
import { Loader2, UserCheck } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";

import { setManagerRiderApprovalStatus } from "../api/managerPhase2Api";

interface RestoreRiderDialogProps {
  riderId: string | null;
  riderName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}

export function RestoreRiderDialog({
  riderId,
  riderName,
  open,
  onOpenChange,
  onRestored,
}: RestoreRiderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();

    if (!riderId || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await setManagerRiderApprovalStatus(
        riderId,
        "approved",
      );

      onRestored();
      onOpenChange(false);
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Unable to restore rider.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) {
          if (!nextOpen) {
            setError(null);
          }

          onOpenChange(nextOpen);
        }
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
            <UserCheck
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <AlertDialogTitle>
            Restore {riderName ?? "this rider"}?
          </AlertDialogTitle>

          <AlertDialogDescription className="leading-5">
            This rider will regain access to the Rider
            workspace. Their availability will remain Offline
            until they choose to accept deliveries.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs font-semibold leading-5 text-red-800">
              {error}
            </p>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            Keep suspended
          </AlertDialogCancel>

          <AlertDialogAction
            disabled={loading}
            onClick={handleRestore}
            className="bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}

            {loading
              ? "Restoring…"
              : "Restore rider"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}