import { useRef, useState } from "react";
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
  onOutcomeUnknown: () => void;
}

export function SuspendRiderDialog({
  riderId,
  riderName,
  open,
  onOpenChange,
  onSuspended,
  onOutcomeUnknown,
}: SuspendRiderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [blockedByDelivery, setBlockedByDelivery] = useState(false);
  const mutationPending = useRef(false);

  const handleSuspend = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!riderId || mutationPending.current || blockedByDelivery) {
      return;
    }

    mutationPending.current = true;
    setLoading(true);

    try {
      const result = await setManagerRiderApprovalStatus(riderId, "suspended");
      if (
        result.riderId !== riderId ||
        result.profileRole !== "customer" ||
        result.availabilityStatus !== "offline"
      ) {
        throw new Error("Unexpected suspension result");
      }

      onSuspended();
      onOpenChange(false);
    } catch (suspendError) {
      if (
        suspendError instanceof Error &&
        suspendError.message.includes(
          "The rider cannot be suspended while an active delivery assignment exists.",
        )
      ) {
        setBlockedByDelivery(true);
      } else {
        onOutcomeUnknown();
      }
    } finally {
      mutationPending.current = false;
      setLoading(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) {
          if (!nextOpen) setBlockedByDelivery(false);
          onOpenChange(nextOpen);
        }
      }}
    >
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <AlertDialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <UserX className="h-5 w-5" aria-hidden="true" />
          </div>

          <AlertDialogTitle className="break-words">
            Suspend {riderName ?? "this rider"}?
          </AlertDialogTitle>

          <AlertDialogDescription className="leading-5">
            This rider will immediately lose access to the Rider workspace and
            will be set to Offline. The account can be restored later by
            management.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs leading-5 text-amber-900">
            A rider with an active delivery cannot be suspended until that
            delivery is completed or otherwise resolved.
          </p>
        </div>

        {blockedByDelivery && (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            An active delivery assignment blocks suspension. Resolve the
            delivery, then refresh the rider directory before trying again.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} className="min-h-11">
            Keep rider active
          </AlertDialogCancel>

          <AlertDialogAction
            disabled={loading || blockedByDelivery}
            onClick={handleSuspend}
            className="min-h-11 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserX className="h-4 w-4" />
            )}

            {loading ? "Suspending…" : "Suspend rider"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
