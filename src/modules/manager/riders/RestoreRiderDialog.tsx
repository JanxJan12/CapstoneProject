import { useRef, useState } from "react";
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
  onOutcomeUnknown: () => void;
}

export function RestoreRiderDialog({
  riderId,
  riderName,
  open,
  onOpenChange,
  onRestored,
  onOutcomeUnknown,
}: RestoreRiderDialogProps) {
  const [loading, setLoading] = useState(false);
  const mutationPending = useRef(false);

  const handleRestore = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!riderId || mutationPending.current) {
      return;
    }

    mutationPending.current = true;
    setLoading(true);

    try {
      const result = await setManagerRiderApprovalStatus(riderId, "approved");
      if (
        result.riderId !== riderId ||
        result.profileRole !== "rider" ||
        result.availabilityStatus !== "offline"
      ) {
        throw new Error("Unexpected restoration result");
      }

      onRestored();
      onOpenChange(false);
    } catch {
      onOutcomeUnknown();
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
          onOpenChange(nextOpen);
        }
      }}
    >
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <AlertDialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
            <UserCheck className="h-5 w-5" aria-hidden="true" />
          </div>

          <AlertDialogTitle className="break-words">
            Restore {riderName ?? "this rider"}?
          </AlertDialogTitle>

          <AlertDialogDescription className="leading-5">
            This rider will regain access to the Rider workspace. Their
            availability will remain Offline until they choose to accept
            deliveries.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} className="min-h-11">
            Keep suspended
          </AlertDialogCancel>

          <AlertDialogAction
            disabled={loading}
            onClick={handleRestore}
            className="min-h-11 bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}

            {loading ? "Restoring…" : "Restore rider"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
