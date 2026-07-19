import {
  ACTIVE_ORDER_STATUSES,
  CASHIER_STAGE_DELAY_THRESHOLDS,
} from "../constants";
import type {
  CashierActionQueueItem,
  CashierQueueNextAction,
  CashierQueuePriority,
  CashierQueueStage,
  CashierShiftSummary,
  CashierState,
  Order,
  Payment,
} from "../types";
import { calculateShiftTotals } from "./shiftService";

const minutesBetween = (startedAt: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));

const latestStageTimestamp = (order: Order) =>
  [...order.timeline].reverse().find((event) => event.status === order.status)
    ?.timestamp ??
  order.updatedAt ??
  order.createdAt;

const pendingPaymentFor = (state: CashierState, order: Order) =>
  state.payments.find(
    (payment) => payment.orderId === order.id && payment.status === "Pending",
  );

interface StageDetails {
  stage: CashierQueueStage;
  label: string;
  nextAction: CashierQueueNextAction;
  startedAt: string;
  delayThreshold?: number;
  payment?: Payment;
}

function getStageDetails(state: CashierState, order: Order): StageDetails {
  const stageStartedAt = latestStageTimestamp(order);
  const pendingPayment = pendingPaymentFor(state, order);

  if (pendingPayment) {
    return {
      stage: "payment_pending",
      label: "Payment pending",
      nextAction: "verify_payment",
      startedAt: pendingPayment.uploadedAt,
      delayThreshold: CASHIER_STAGE_DELAY_THRESHOLDS.paymentPending,
      payment: pendingPayment,
    };
  }

  if (order.status === "Awaiting Payment") {
    return {
      stage: "payment_resubmission",
      label:
        order.paymentStatus === "Rejected"
          ? "Payment resubmission needed"
          : "Awaiting payment",
      nextAction: "view_details",
      startedAt: stageStartedAt,
    };
  }

  if (order.status === "Confirmed") {
    return {
      stage: "kitchen_queue",
      label: "In kitchen queue",
      nextAction: "view_details",
      startedAt: stageStartedAt,
    };
  }

  if (order.status === "Preparing") {
    return {
      stage: "preparing",
      label: "Preparing",
      nextAction: "view_details",
      startedAt: stageStartedAt,
      delayThreshold: CASHIER_STAGE_DELAY_THRESHOLDS.preparing,
    };
  }

  if (order.status === "Ready") {
    return {
      stage: "ready_for_handoff",
      label: "Ready for handoff",
      nextAction: "release_order",
      startedAt: stageStartedAt,
      delayThreshold: CASHIER_STAGE_DELAY_THRESHOLDS.readyForHandoff,
    };
  }

  if (order.status === "Waiting for Rider" && !order.assignedRider) {
    return {
      stage: "rider_assignment",
      label: "Waiting for rider",
      nextAction: "view_details",
      startedAt: stageStartedAt,
      delayThreshold: CASHIER_STAGE_DELAY_THRESHOLDS.riderAssignment,
    };
  }

  if (
    order.status === "Waiting for Rider" ||
    order.status === "Rider Accepted"
  ) {
    return {
      stage: "rider_assigned",
      label: order.assignedRider ? "Rider assigned" : "Rider accepted",
      nextAction: "view_details",
      startedAt: stageStartedAt,
    };
  }

  if (order.status === "Picked Up") {
    return {
      stage: "picked_up",
      label: "Picked up",
      nextAction: "view_details",
      startedAt: stageStartedAt,
    };
  }

  return {
    stage: "out_for_delivery",
    label: "Out for delivery",
    nextAction: "view_details",
    startedAt: stageStartedAt,
  };
}

const getPriority = (
  nextAction: CashierQueueNextAction,
  isDelayed: boolean,
): CashierQueuePriority => {
  if (isDelayed) return 1;
  if (nextAction !== "view_details") return 2;
  return 3;
};

/**
 * Normalized dashboard read model. This is the client-side equivalent of a
 * future get_cashier_action_queue(shift_id) RPC and is the dashboard's only
 * order/payment aggregation boundary.
 */
export function getCashierActionQueue(
  state: CashierState,
  shiftId?: string,
  now = Date.now(),
): CashierActionQueueItem[] {
  const shift = shiftId
    ? state.shifts.find((entry) => entry.id === shiftId)
    : undefined;

  return state.orders
    .filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
    .filter(
      (order) =>
        !shift ||
        !order.shiftId ||
        order.shiftId === shift.id ||
        order.type === "Delivery",
    )
    .map((order) => {
      const details = getStageDetails(state, order);
      const waitingMinutes = minutesBetween(details.startedAt, now);
      const isDelayed =
        details.delayThreshold !== undefined &&
        waitingMinutes > details.delayThreshold;

      return {
        orderId: order.id,
        customerName: order.customerName || "Walk-in Customer",
        orderType: order.type,
        totalAmount: order.total,
        currentStage: details.label,
        stage: details.stage,
        nextAction: details.nextAction,
        waitingMinutes,
        isDelayed,
        priority: getPriority(details.nextAction, isDelayed),
        orderStatus: order.status,
        stageStartedAt: details.startedAt,
        paymentId: details.payment?.id,
      } satisfies CashierActionQueueItem;
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        b.waitingMinutes - a.waitingMinutes ||
        a.orderId.localeCompare(b.orderId),
    );
}

/**
 * Compact shift read model. This is the client-side equivalent of a future
 * get_cashier_shift_summary(shift_id) RPC.
 */
export function getCashierShiftSummary(
  state: CashierState,
  shiftId?: string,
): CashierShiftSummary {
  const shift = shiftId
    ? state.shifts.find((entry) => entry.id === shiftId)
    : state.shifts.find((entry) => entry.status === "Open");
  const totals = shift ? calculateShiftTotals(state, shift.id) : undefined;

  return {
    shiftId: shift?.id,
    isActive: shift?.status === "Open",
    cashierName: shift?.cashierName ?? state.cashier.name,
    terminal: shift?.terminal ?? state.cashier.terminal,
    startedAt: shift?.startedAt,
    expectedDrawer: totals?.expectedCash ?? 0,
    pendingPaymentCount: state.payments.filter(
      (payment) => payment.status === "Pending",
    ).length,
  };
}
