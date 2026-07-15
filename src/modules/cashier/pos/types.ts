import type { OrderItem, OrderType } from "../types";

export interface POSCartLine extends Omit<OrderItem, "id"> {
  lineId: string;
}

export type WalkInOrderType = Extract<OrderType, "Dine-in" | "Take-out">;

export type POSWorkflowState =
  | "selectingItems"
  | "customizingItem"
  | "reviewingCart"
  | "checkout"
  | "processing"
  | "receipt";
