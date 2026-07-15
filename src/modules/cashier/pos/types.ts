import type { OrderItem } from "../types";

export interface POSCartLine extends Omit<OrderItem, "id"> {
  lineId: string;
}
