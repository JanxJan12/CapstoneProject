import type { OrderItem, OrderType } from "../types";

export interface POSCartLine extends Omit<OrderItem, "id"> {
  lineId: string;
}

export type WalkInOrderType = Extract<OrderType, "Dine-in" | "Take-out">;

export enum POSTransactionState {
  IDLE = "idle",
  ORDERING = "ordering",
  ORDER_REVIEW = "order-review",
  PAYMENT = "payment",
  RECEIPT = "receipt",
}
