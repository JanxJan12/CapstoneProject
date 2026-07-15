import { z } from "zod";

export const rejectionSchema = z.object({
  reason: z.string().min(1, "Select a rejection reason."),
  notes: z
    .string()
    .max(300, "Notes must be 300 characters or fewer.")
    .optional(),
});

export const cancellationSchema = z.object({
  reason: z.string().trim().min(3, "Enter a cancellation reason.").max(200),
});

export const voidSchema = z.object({
  reason: z.string().trim().min(3, "Enter a void reason.").max(200),
});

export const startShiftSchema = z.object({
  openingCash: z
    .number()
    .min(0, "Opening cash cannot be negative.")
    .max(100000),
  terminal: z.string().trim().min(2, "Terminal is required."),
});

export const endShiftSchema = z.object({
  actualCash: z.number().min(0, "Actual cash cannot be negative."),
  notes: z
    .string()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional(),
});

export const posSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .max(80, "Customer name must be 80 characters or fewer.")
      .optional(),
    orderType: z.enum(["Dine-in", "Take-out"]),
    tableNumber: z.string().optional(),
    paymentMethod: z.enum(["Cash", "GCash"]),
    amountTendered: z.number().optional(),
    gcashReference: z.string().optional(),
    discountType: z.enum(["None", "Senior Citizen", "PWD"]),
    discountReference: z.string().optional(),
    orderInstructions: z
      .string()
      .max(300, "Order instructions must be 300 characters or fewer.")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.orderType === "Dine-in" && !value.tableNumber?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["tableNumber"],
        message: "Select a table for dine-in orders.",
      });
    }
    if (value.paymentMethod === "GCash" && !value.gcashReference?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["gcashReference"],
        message: "GCash reference number is required.",
      });
    }
    if (value.discountType !== "None" && !value.discountReference?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["discountReference"],
        message: "ID or reference is required for this discount.",
      });
    }
  });

export type RejectionForm = z.infer<typeof rejectionSchema>;
export type CancellationForm = z.infer<typeof cancellationSchema>;
export type VoidForm = z.infer<typeof voidSchema>;
export type StartShiftForm = z.infer<typeof startShiftSchema>;
export type EndShiftForm = z.infer<typeof endShiftSchema>;
export type POSForm = z.infer<typeof posSchema>;
