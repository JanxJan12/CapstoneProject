import { supabase } from "@/lib/supabase";

export type RiderAssignmentStatus =
  | "offered"
  | "accepted"
  | "rejected"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface RiderDeliveryItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  specialInstructions?: string;
}

export interface RiderDeliveryRequest {
  assignmentId: string;
  orderId: string;
  orderNumber: string;

  assignmentStatus: RiderAssignmentStatus;

  customerName: string;
  contactNumber: string;

  deliveryAddress: string;
  landmark?: string;

  subtotal: number;
  deliveryFee: number;
  total: number;

  notes?: string;

  assignedAt: string;

  items: RiderDeliveryItem[];
}

interface AssignmentRow {
  id: string;
  order_id: string;
  status: RiderAssignmentStatus;
  assigned_at: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_contact_number: string | null;
  delivery_address: string | null;
  landmark: string | null;
  subtotal: number | string;
  delivery_fee: number | string;
  grand_total: number | string;
  notes: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  item_name: string | null;
  quantity: number;
  unit_price: number | string;
  special_instructions: string | null;
}

export interface RiderActiveDelivery
  extends RiderDeliveryRequest {
  assignmentStatus:
    | "accepted"
    | "picked_up"
    | "out_for_delivery";
}

export interface AcceptRiderOfferResult {
  assignment_id: string;
  order_id: string;
  order_number: string;
  assignment_status: "accepted";
  order_status: "rider_accepted";
}

export async function fetchRiderOffers():
  Promise<RiderDeliveryRequest[]> {
  /*
   * RLS guarantees that the logged-in rider can only
   * receive their own delivery_assignments rows.
   */
  const {
    data: assignmentData,
    error: assignmentError,
  } = await supabase
    .from("delivery_assignments")
    .select(`
      id,
      order_id,
      status,
      assigned_at
    `)
    .eq("status", "offered")
    .order("assigned_at", {
      ascending: true,
    });

  if (assignmentError) {
    throw new Error(
      `Unable to load rider offers: ${assignmentError.message}`,
    );
  }

  const assignments =
    (assignmentData ?? []) as AssignmentRow[];

  if (!assignments.length) {
    return [];
  }

  const orderIds = assignments.map(
    (assignment) => assignment.order_id,
  );

  /*
   * These queries are also protected by the Rider RLS
   * policies we just created.
   */
  const [
    {
      data: orderData,
      error: orderError,
    },
    {
      data: itemData,
      error: itemError,
    },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_name,
        customer_contact_number,
        delivery_address,
        landmark,
        subtotal,
        delivery_fee,
        grand_total,
        notes
      `)
      .in("id", orderIds),

    supabase
      .from("order_items")
      .select(`
        id,
        order_id,
        item_name,
        quantity,
        unit_price,
        special_instructions
      `)
      .in("order_id", orderIds)
      .order("created_at", {
        ascending: true,
      }),
  ]);

  if (orderError) {
    throw new Error(
      `Unable to load assigned orders: ${orderError.message}`,
    );
  }

  if (itemError) {
    throw new Error(
      `Unable to load assigned order items: ${itemError.message}`,
    );
  }

  const orders =
    (orderData ?? []) as OrderRow[];

  const items =
    (itemData ?? []) as OrderItemRow[];

  const orderById = new Map(
    orders.map((order) => [
      order.id,
      order,
    ]),
  );

  const itemsByOrder = new Map<
    string,
    RiderDeliveryItem[]
  >();

  for (const item of items) {
    const current =
      itemsByOrder.get(item.order_id) ?? [];

    current.push({
      id: item.id,
      name:
        item.item_name?.trim() ||
        "Menu Item",
      quantity: item.quantity,
      unitPrice: toNumber(
        item.unit_price,
      ),
      specialInstructions:
        item.special_instructions?.trim() ||
        undefined,
    });

    itemsByOrder.set(
      item.order_id,
      current,
    );
  }

  return assignments.flatMap(
    (assignment) => {
      const order =
        orderById.get(
          assignment.order_id,
        );

      if (!order) {
        return [];
      }

      return [
        {
          assignmentId:
            assignment.id,

          orderId:
            order.id,

          orderNumber:
            order.order_number,

          assignmentStatus:
            assignment.status,

          customerName:
            order.customer_name?.trim() ||
            "Customer",

          contactNumber:
            order.customer_contact_number?.trim() ||
            "—",

          deliveryAddress:
            order.delivery_address?.trim() ||
            "Delivery address unavailable",

          landmark:
            order.landmark?.trim() ||
            undefined,

          subtotal:
            toNumber(order.subtotal),

          deliveryFee:
            toNumber(
              order.delivery_fee,
            ),

          total:
            toNumber(
              order.grand_total,
            ),

          notes:
            order.notes?.trim() ||
            undefined,

          assignedAt:
            assignment.assigned_at,

          items:
            itemsByOrder.get(
              order.id,
            ) ?? [],
        },
      ];
    },
  );
}

export async function acceptRiderOffer(
  assignmentId: string,
): Promise<AcceptRiderOfferResult> {
  const normalizedId = assignmentId.trim();

  if (!normalizedId) {
    throw new Error(
      "This delivery offer does not have a valid assignment ID.",
    );
  }

  const { data, error } = await supabase.rpc(
    "accept_rider_offer",
    {
      p_assignment_id: normalizedId,
    },
  );

  if (error) {
    throw new Error(
      `Unable to accept delivery: ${error.message}`,
    );
  }

  const result = (
    data as AcceptRiderOfferResult[] | null
  )?.[0];

  if (!result) {
    throw new Error(
      "The delivery was accepted, but no updated assignment was returned.",
    );
  }

  return result;
}

export async function fetchActiveRiderDelivery():
  Promise<RiderActiveDelivery | null> {

  const {
    data: assignmentData,
    error: assignmentError,
  } = await supabase
    .from("delivery_assignments")
    .select(`
      id,
      order_id,
      status,
      assigned_at
    `)
    .in("status", [
      "accepted",
      "picked_up",
      "out_for_delivery",
    ])
    .order("assigned_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(
      `Unable to load active delivery: ${assignmentError.message}`,
    );
  }

  if (!assignmentData) {
    return null;
  }

  const assignment =
    assignmentData as AssignmentRow;

  const [
    {
      data: orderData,
      error: orderError,
    },
    {
      data: itemData,
      error: itemError,
    },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_name,
        customer_contact_number,
        delivery_address,
        landmark,
        subtotal,
        delivery_fee,
        grand_total,
        notes
      `)
      .eq("id", assignment.order_id)
      .single(),

    supabase
      .from("order_items")
      .select(`
        id,
        order_id,
        item_name,
        quantity,
        unit_price,
        special_instructions
      `)
      .eq("order_id", assignment.order_id)
      .order("created_at", {
        ascending: true,
      }),
  ]);

  if (orderError) {
    throw new Error(
      `Unable to load active order: ${orderError.message}`,
    );
  }

  if (itemError) {
    throw new Error(
      `Unable to load active order items: ${itemError.message}`,
    );
  }

  const order =
    orderData as OrderRow;

  const items =
    (itemData ?? []) as OrderItemRow[];

  return {
    assignmentId: assignment.id,
    orderId: order.id,
    orderNumber: order.order_number,
    assignmentStatus:
      assignment.status as
        | "accepted"
        | "picked_up"
        | "out_for_delivery",

    customerName:
      order.customer_name?.trim() ||
      "Customer",

    contactNumber:
      order.customer_contact_number?.trim() ||
      "—",

    deliveryAddress:
      order.delivery_address?.trim() ||
      "Delivery address unavailable",

    landmark:
      order.landmark?.trim() ||
      undefined,

    subtotal: toNumber(order.subtotal),

    deliveryFee:
      toNumber(order.delivery_fee),

    total:
      toNumber(order.grand_total),

    notes:
      order.notes?.trim() ||
      undefined,

    assignedAt:
      assignment.assigned_at,

    items: items.map((item) => ({
      id: item.id,
      name:
        item.item_name?.trim() ||
        "Menu Item",

      quantity:
        item.quantity,

      unitPrice:
        toNumber(item.unit_price),

      specialInstructions:
        item.special_instructions?.trim() ||
        undefined,
    })),
  };
}

function toNumber(
  value: number | string,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}