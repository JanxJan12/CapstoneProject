import { formatMoney } from "../constants";
import type { Order, Payment } from "../types";

export const EXPECTED_PAYMENT_RECEIVER = "RRJ Food-House";

export type PaymentVerificationIssueCode =
  | "wrong_amount"
  | "reference_not_found"
  | "duplicate_payment"
  | "wrong_receiver";

export interface PaymentVerificationIssue {
  code: PaymentVerificationIssueCode;
  label: string;
  detail: string;
}

const normalize = (value?: string) =>
  value
    ?.trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "") ?? "";

export function getPaymentVerificationIssues(
  payment: Payment,
  order: Order,
  payments: Payment[],
): PaymentVerificationIssue[] {
  const issues: PaymentVerificationIssue[] = [];
  const difference = payment.submittedAmount - order.total;

  if (Math.abs(difference) >= 0.01) {
    issues.push({
      code: "wrong_amount",
      label: "Amount mismatch",
      detail:
        difference < 0
          ? `Proof is short by ${formatMoney(Math.abs(difference))}.`
          : `Proof exceeds the order total by ${formatMoney(difference)}.`,
    });
  }

  const reference = normalize(payment.referenceNumber);
  if (!reference) {
    issues.push({
      code: "reference_not_found",
      label: "Reference not found",
      detail: "The proof does not contain a usable transaction reference.",
    });
  } else {
    const duplicate = payments.find(
      (entry) =>
        entry.id !== payment.id &&
        entry.status !== "Rejected" &&
        normalize(entry.referenceNumber) === reference,
    );
    if (duplicate) {
      issues.push({
        code: "duplicate_payment",
        label: "Duplicate payment",
        detail: `Reference already appears on ${duplicate.orderId}.`,
      });
    }
  }

  if (
    payment.receiverName &&
    normalize(payment.receiverName) !== normalize(EXPECTED_PAYMENT_RECEIVER)
  ) {
    issues.push({
      code: "wrong_receiver",
      label: "Receiver mismatch",
      detail: `Proof receiver is ${payment.receiverName}, not ${EXPECTED_PAYMENT_RECEIVER}.`,
    });
  }

  return issues;
}
