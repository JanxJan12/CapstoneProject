import { z } from "zod";
import type { OrderType } from "../types";

export const rejectionSchema = z
  .object({
    reason: z.string().trim().min(1, "Select a rejection reason."),
    notes: z
      .string()
      .trim()
      .max(300, "Notes must be 300 characters or fewer.")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.reason === "Other" && !value.notes) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Explain the rejection reason when Other is selected.",
      });
    }
  });

export const cancellationSchema = z.object({
  reason: z.string().trim().min(3, "Enter a cancellation reason.").max(200),
});

export const orderOperationalEditSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, "Customer name is required.")
    .max(80, "Customer name must be 80 characters or fewer."),
  contactNumber: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .max(20, "Phone number must be 20 characters or fewer."),
  deliveryAddress: z
    .string()
    .trim()
    .max(200, "Delivery address must be 200 characters or fewer.")
    .optional(),
});

export function createOrderOperationalEditSchema(
  orderType: OrderType,
) {
  return orderOperationalEditSchema.superRefine((value, ctx) => {
    if (orderType === "Delivery" && !value.deliveryAddress?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Delivery address is required.",
      });
    }
  });
}

export const voidSchema = z.object({
  reason: z.string().trim().min(3, "Enter a void reason.").max(200),
});

export const startShiftSchema = z.object({
  openingCash: z
    .string()
    .trim()
    .min(1, "Enter the physical opening cash amount.")
    .regex(/^-?\d+(?:\.\d{1,2})?$/, "Enter a number with at most two decimal places.")
    .transform(Number)
    .pipe(z.number().finite().min(0, "Opening cash cannot be negative.")
      .max(100000, "Opening cash cannot exceed ₱100,000.")),
  terminal: z.string().trim().min(2, "Terminal is required."),
});

export const endShiftSchema = z.object({
  actualCash: z.number({ error: "Enter the physical cash count." })
    .finite("Enter a valid cash amount.")
    .min(0, "Actual cash cannot be negative.")
    .refine((value) => Math.abs(value - Math.round(value * 100) / 100) < 1e-9,
      "Enter cash to two decimal places at most."),
});

export const posSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .max(80, "Customer name must be 80 characters or fewer.")
      .optional(),
    contactNumber: z
      .string()
      .trim()
      .max(30, "Contact number must be 30 characters or fewer.")
      .optional(),
    deliveryAddress: z
      .string()
      .trim()
      .max(200, "Delivery address must be 200 characters or fewer.")
      .optional(),
    orderType: z.enum(["Dine-in", "Take-out", "Delivery"]),
    paymentMethod: z.literal("Cash"),
    amountTendered: z.number().optional(),
    gcashReference: z.string().optional(),
    gcashConfirmed: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.orderType === "Delivery") {
      if (!value.customerName?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["customerName"],
          message: "Customer name is required for delivery.",
        });
      }
      if (!value.contactNumber?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["contactNumber"],
          message: "Contact number is required for delivery.",
        });
      }
      if (!value.deliveryAddress?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["deliveryAddress"],
          message: "Delivery address is required.",
        });
      }
    }
  });

export type RejectionForm = z.infer<typeof rejectionSchema>;
export type CancellationForm = z.infer<typeof cancellationSchema>;
export type OrderOperationalEditForm = z.infer<
  typeof orderOperationalEditSchema
>;
export type VoidForm = z.infer<typeof voidSchema>;
export type StartShiftForm = z.input<typeof startShiftSchema>;
export type EndShiftForm = z.infer<typeof endShiftSchema>;
export type POSForm = z.infer<typeof posSchema>;
