import { useState } from "react";
import { Loader2, UserX } from "lucide-react";

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

interface SuspendRiderDialogProps {
  riderId: string | null;
  riderName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuspended: () => void;
}

export function SuspendRiderDialog({
  riderId,
  riderName,
  open,
  onOpenChange,
  onSuspended,
}: SuspendRiderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuspend = async (
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
        "suspended",
      );

      onSuspended();
      onOpenChange(false);
    } catch (suspendError) {
      setError(
        suspendError instanceof Error
          ? suspendError.message
          : "Unable to suspend rider.",
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
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <UserX
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <AlertDialogTitle>
            Suspend {riderName ?? "this rider"}?
          </AlertDialogTitle>

          <AlertDialogDescription className="leading-5">
            This rider will immediately lose access to the
            Rider workspace and will be set to Offline. The
            account can be restored later by management.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs leading-5 text-amber-900">
            A rider with an active delivery cannot be
            suspended until that delivery is completed or
            otherwise resolved.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs font-semibold leading-5 text-red-800">
              {error}
            </p>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            Keep rider active
          </AlertDialogCancel>

          <AlertDialogAction
            disabled={loading}
            onClick={handleSuspend}
            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserX className="h-4 w-4" />
            )}

            {loading
              ? "Suspending…"
              : "Suspend rider"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}