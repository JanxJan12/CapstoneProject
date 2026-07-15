import { toast } from "sonner";

/**
 * Cashier-wide notification facade. Keeping notification calls behind one
 * typed API prevents pages from depending directly on the toast vendor.
 */
export const Toast = {
  success: toast.success,
  warning: toast.warning,
  error: toast.error,
  info: toast.info,
  dismiss: toast.dismiss,
} as const;
