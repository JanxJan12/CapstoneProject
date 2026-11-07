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
  modifiers: string[];
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


  assignedAt: string;

  items: RiderDeliveryItem[];
}

export interface RiderProfile {
  approvalStatus: "pending" | "approved" | "rejected" | "suspended";
  contactNumber?: string;
  driverLicenseNumber?: string;
  plateNumber?: string;
  motorBrand?: string;
  motorModel?: string;
  availabilityStatus:
    | "available"
    | "on_delivery"
    | "offline";
}

export interface AdvanceRiderDeliveryResult {
  assignment_id: string;
  order_id: string;
  assignment_status:
    | "picked_up"
    | "out_for_delivery";
  order_status:
    | "picked_up"
    | "out_for_delivery";
}

export class RiderAdvanceRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiderAdvanceRejectedError";
  }
}

export interface CompleteRiderDeliveryResult {
  assignment_id: string;
  order_id: string;
  assignment_status: "delivered";
  order_status: "delivered";
  proof_of_delivery_path: string;
}

export class RiderCompletionRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiderCompletionRejectedError";
  }
}

export interface RiderCompletionSnapshot {
  assignmentId: string;
  orderId: string;
  assignmentStatus: RiderAssignmentStatus;
  orderStatus: string;
  proofPath: string | null;
}

export async function fetchRiderCompletionSnapshot(
  assignmentId: string,
): Promise<RiderCompletionSnapshot | null> {
  // Both reads are restricted to this rider's assignment and assigned order by RLS.
  const { data: assignment, error: assignmentError } = await supabase
    .from("delivery_assignments")
    .select("id, order_id, status, proof_of_delivery_path")
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignmentError) throw new Error("Could not check the delivery status. Try again.");
  if (!assignment) return null;
  if (assignment.id !== assignmentId) throw new Error("The delivery assignment could not be verified.");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, current_status")
    .eq("id", assignment.order_id)
    .maybeSingle();
  if (orderError || !order || order.id !== assignment.order_id) {
    throw new Error("Could not check the order status. Try again.");
  }
  return {
    assignmentId: assignment.id,
    orderId: assignment.order_id,
    assignmentStatus: assignment.status as RiderAssignmentStatus,
    orderStatus: order.current_status,
    proofPath: assignment.proof_of_delivery_path,
  };
}

export interface RiderDashboardStats {
  deliveriesToday: number;
  completedToday: number;
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
}

interface OrderItemRow {
  id: string;
  order_id: string;
  item_name: string | null;
  quantity: number;
  unit_price: number | string;
  special_instructions: string | null;
  modifiers: unknown;
}

function modifierNames(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.flatMap((entry) =>
    entry && typeof entry === "object" && "name" in entry &&
    typeof entry.name === "string" ? [entry.name] : [],
  );
}

export interface SetRiderAvailabilityResult {
  rider_id: string;
  availability_status:
    | "available"
    | "offline";
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

export class RiderOfferRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiderOfferRejectedError";
  }
}

export interface RiderAssignmentSnapshot {
  assignmentId: string;
  orderId: string;
  status: RiderAssignmentStatus;
}

export async function fetchRiderAssignmentSnapshot(
  assignmentId: string,
): Promise<RiderAssignmentSnapshot | null> {
  // RLS restricts this exact assignment read to the authenticated rider.
  const { data, error } = await supabase
    .from("delivery_assignments")
    .select("id, order_id, status")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw new Error("Could not check the delivery assignment. Try again.");
  if (!data) return null;
  const status = data.status as RiderAssignmentStatus;
  if (data.id !== assignmentId || ![
    "offered", "accepted", "rejected", "picked_up", "out_for_delivery", "delivered", "cancelled",
  ].includes(status)) {
    throw new Error("The delivery assignment could not be verified. Try again.");
  }
  return { assignmentId: data.id, orderId: data.order_id, status };
}

export interface RiderProfileStats {
  totalDeliveries: number;
  completedToday: number;
}

export interface RejectRiderOfferResult {
  assignment_id: string;
  order_id: string;
  order_number: string;
  assignment_status: "rejected";
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
        grand_total
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
        special_instructions,
        modifiers
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
      modifiers: modifierNames(item.modifiers),
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
      p_assignment_id:
        normalizedId,
    },
  );

  if (error) {
    const message = /must be available/i.test(error.message)
      ? "Set your availability to Available before accepting."
      : /already have an active delivery/i.test(error.message)
        ? "Finish your active delivery before accepting another."
        : /no longer available|no longer waiting|not found/i.test(error.message)
          ? "This offer is no longer available. Check your offers."
          : "The offer could not be accepted. Check its current status.";
    if (/^[A-Z0-9]{5}$/i.test(error.code ?? "")) {
      throw new RiderOfferRejectedError(message);
    }
    throw new Error("The acceptance response is uncertain. Check the delivery assignment.");
  }

  const result = (
    data as AcceptRiderOfferResult[] | null
  )?.[0];

  if (!result) {
    throw new Error(
      "The acceptance response is uncertain. Check the delivery assignment.",
    );
  }

  if (result.assignment_id !== normalizedId || result.assignment_status !== "accepted" ||
    result.order_status !== "rider_accepted") {
    throw new Error("The acceptance response did not match this offer. Check the delivery assignment.");
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
        grand_total
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
        special_instructions,
        modifiers
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
      modifiers: modifierNames(item.modifiers),
    })),
  };
}

export async function fetchRiderProfile():
  Promise<RiderProfile> {

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(
      `Unable to identify rider: ${userError.message}`,
    );
  }

  const userId =
    userData.user?.id;

  if (!userId) {
    throw new Error(
      "No authenticated rider was found.",
    );
  }

  const [
    {
      data: profileData,
      error: profileError,
    },
    {
      data: riderData,
      error: riderError,
    },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(`
        contact_number
      `)
      .eq("id", userId)
      .single(),

    supabase
      .from("riders")
      .select(`
        driver_license_number,
        plate_number,
        motor_brand,
        motor_model,
        availability_status,
        approval_status
      `)
      .eq("id", userId)
      .single(),
  ]);

  if (profileError) {
    throw new Error(
      `Unable to load rider account: ${profileError.message}`,
    );
  }

  if (riderError) {
    throw new Error(
      `Unable to load rider profile: ${riderError.message}`,
    );
  }

  return {
    approvalStatus: riderData.approval_status,
    contactNumber:
      profileData.contact_number?.trim() ||
      undefined,

    driverLicenseNumber:
      riderData.driver_license_number?.trim() ||
      undefined,

    plateNumber:
      riderData.plate_number?.trim() ||
      undefined,

    motorBrand:
      riderData.motor_brand?.trim() ||
      undefined,

    motorModel:
      riderData.motor_model?.trim() ||
      undefined,

    availabilityStatus:
      riderData.availability_status,
  };
}

export async function advanceRiderDelivery(
  assignmentId: string,
  expectedAssignmentStatus:
    | "accepted"
    | "picked_up",
): Promise<AdvanceRiderDeliveryResult> {
  const normalizedId =
    assignmentId.trim();

  if (!normalizedId) {
    throw new Error(
      "This delivery does not have a valid assignment ID.",
    );
  }

  const { data, error } =
    await supabase.rpc(
      "advance_rider_delivery",
      {
        p_assignment_id:
          normalizedId,
        p_expected_assignment_status:
          expectedAssignmentStatus,
      },
    );

  if (error) {
    if (error.code === "P0001") {
      throw new RiderAdvanceRejectedError(`Unable to update delivery status: ${error.message}`);
    }
    throw new Error("The delivery transition response is uncertain. Check its status.");
  }

  const result = (
    data as
      | AdvanceRiderDeliveryResult[]
      | null
  )?.[0];

  if (!result) {
    throw new Error(
      "The delivery transition response is uncertain. Check its status.",
    );
  }

  const expectedNextStatus = expectedAssignmentStatus === "accepted"
    ? "picked_up" : "out_for_delivery";
  if (result.assignment_id !== normalizedId ||
    result.assignment_status !== expectedNextStatus ||
    result.order_status !== expectedNextStatus) {
    throw new Error("The delivery transition response did not match this assignment. Check its status.");
  }

  return result;
}

export async function uploadRiderDeliveryProof(
  assignmentId: string,
  file: File,
): Promise<string> {
  const normalizedAssignmentId =
    assignmentId.trim();

  if (!normalizedAssignmentId) {
    throw new Error(
      "This delivery does not have a valid assignment ID.",
    );
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      "Proof of delivery must be a JPEG, PNG, or WebP image.",
    );
  }

  if (file.size > 5 * 1024 * 1024) {
  throw new Error(
    "Proof of delivery must be 5 MB or smaller.",
  );
}

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(
      `Unable to identify rider: ${userError.message}`,
    );
  }

  const riderId =
    userData.user?.id;

  if (!riderId) {
    throw new Error(
      "No authenticated rider was found.",
    );
  }

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const proofPath =
    `${riderId}/${normalizedAssignmentId}/proof-${Date.now()}.${extension}`;

  const {
    data,
    error,
  } = await supabase.storage
    .from("delivery-proofs")
    .upload(
      proofPath,
      file,
      {
        contentType: file.type,
        upsert: false,
      },
    );

  if (error) {
    throw new Error(
      `Unable to upload proof of delivery: ${error.message}`,
    );
  }

  if (!data.path) {
    throw new Error(
      "Proof of delivery was uploaded, but no storage path was returned.",
    );
  }

  return data.path;
}

export interface RiderDeliveryHistoryItem {
  assignmentId: string;
  orderId: string;
  orderNumber: string;
  deliveryAddress: string;
  total: number;
  deliveredAt: string;
}

export async function completeRiderDelivery(
  assignmentId: string,
  proofPath: string,
): Promise<CompleteRiderDeliveryResult> {
  const normalizedAssignmentId =
    assignmentId.trim();

  const normalizedProofPath =
    proofPath.trim();

  if (!normalizedAssignmentId) {
    throw new Error(
      "This delivery does not have a valid assignment ID.",
    );
  }

  if (!normalizedProofPath) {
    throw new Error(
      "Proof of delivery is required.",
    );
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    "complete_rider_delivery",
    {
      p_assignment_id:
        normalizedAssignmentId,

      p_proof_path:
        normalizedProofPath,
    },
  );

  if (error) {
    if (error.code === "P0001") {
      throw new RiderCompletionRejectedError(`Unable to complete delivery: ${error.message}`);
    }
    throw new Error("The completion response is uncertain. Check the delivery status.");
  }

  const result = (
    data as
      | CompleteRiderDeliveryResult[]
      | null
  )?.[0];

  if (!result) {
    throw new Error(
      "The completion response is uncertain. Check the delivery status.",
    );
  }

  if (result.assignment_id !== normalizedAssignmentId ||
    result.assignment_status !== "delivered" ||
    result.order_status !== "delivered" ||
    result.proof_of_delivery_path !== normalizedProofPath) {
    throw new Error("The completion response did not match this delivery. Check its status.");
  }

  return result;
}

export async function fetchRiderDashboardStats():
  Promise<RiderDashboardStats> {

const now = new Date();

const dateParts =
  new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).formatToParts(now);

const year = Number(
  dateParts.find(
    (part) => part.type === "year",
  )?.value,
);

const month = Number(
  dateParts.find(
    (part) => part.type === "month",
  )?.value,
);

const day = Number(
  dateParts.find(
    (part) => part.type === "day",
  )?.value,
);

/*
 * Midnight in Manila is 16:00 UTC
 * on the previous calendar day.
 *
 * Philippines is UTC+8 and does not
 * observe daylight-saving time.
 */
const startTimestamp =
  Date.UTC(
    year,
    month - 1,
    day,
    -8,
    0,
    0,
    0,
  );

const startUtc =
  new Date(
    startTimestamp,
  ).toISOString();

const endUtc =
  new Date(
    startTimestamp +
      24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    {
      count: deliveriesToday,
      error: deliveriesError,
    },
    {
      count: completedToday,
      error: completedError,
    },
  ] = await Promise.all([
    supabase
      .from("delivery_assignments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .in("status", [
        "accepted",
        "picked_up",
        "out_for_delivery",
        "delivered",
      ])
      .gte(
        "assigned_at",
        startUtc,
      )
      .lt(
        "assigned_at",
        endUtc,
      ),

    supabase
      .from("delivery_assignments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "status",
        "delivered",
      )
      .gte(
        "delivered_at",
        startUtc,
      )
      .lt(
        "delivered_at",
        endUtc,
      ),
  ]);

  if (deliveriesError) {
    throw new Error(
      `Unable to load today's deliveries: ${deliveriesError.message}`,
    );
  }

  if (completedError) {
    throw new Error(
      `Unable to load completed deliveries: ${completedError.message}`,
    );
  }

  return {
    deliveriesToday:
      deliveriesToday ?? 0,

    completedToday:
      completedToday ?? 0,
  };
}

export async function fetchRiderProfileStats():
  Promise<RiderProfileStats> {

  const todayStats =
    await fetchRiderDashboardStats();

  const {
    count: totalDeliveries,
    error,
  } = await supabase
    .from("delivery_assignments")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("status", "delivered");

  if (error) {
    throw new Error(
      `Unable to load total deliveries: ${error.message}`,
    );
  }

  return {
    totalDeliveries:
      totalDeliveries ?? 0,

    completedToday:
      todayStats.completedToday,
  };
}

export async function fetchRiderDeliveryHistory():
  Promise<RiderDeliveryHistoryItem[]> {

  const {
    data: assignmentData,
    error: assignmentError,
  } = await supabase
    .from("delivery_assignments")
    .select(`
      id,
      order_id,
      delivered_at
    `)
    .eq("status", "delivered")
    .not("delivered_at", "is", null)
    .order("delivered_at", {
      ascending: false,
    });

  if (assignmentError) {
    throw new Error(
      `Unable to load delivery history: ${assignmentError.message}`,
    );
  }

  const assignments =
    assignmentData ?? [];

  if (!assignments.length) {
    return [];
  }

  const orderIds =
    assignments.map(
      (assignment) =>
        assignment.order_id,
    );

  const {
    data: orderData,
    error: orderError,
  } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      delivery_address,
      grand_total
    `)
    .in("id", orderIds);

  if (orderError) {
    throw new Error(
      `Unable to load completed orders: ${orderError.message}`,
    );
  }

  const orders =
    orderData ?? [];

  const orderById =
    new Map(
      orders.map((order) => [
        order.id,
        order,
      ]),
    );

  return assignments.flatMap(
    (assignment) => {
      const order =
        orderById.get(
          assignment.order_id,
        );

      if (
        !order ||
        !assignment.delivered_at
      ) {
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

          deliveryAddress:
            order.delivery_address?.trim() || 
            "Delivery address unavailable",

          total:
            toNumber(
              order.grand_total,
            ),

          deliveredAt:
            assignment.delivered_at,
        },
      ];
    },
  );
}

export async function rejectRiderOffer(
  assignmentId: string,
  reason?: string,
): Promise<RejectRiderOfferResult> {
  const normalizedId =
    assignmentId.trim();

  if (!normalizedId) {
    throw new Error(
      "This delivery offer does not have a valid assignment ID.",
    );
  }

  const normalizedReason =
    reason?.trim() || null;

  const { data, error } =
    await supabase.rpc(
      "reject_rider_offer",
      {
        p_assignment_id:
          normalizedId,

        p_reason:
          normalizedReason,
      },
    );

  if (error) {
    throw new Error(
      `Unable to reject delivery: ${error.message}`,
    );
  }

  const result = (
    data as
      | RejectRiderOfferResult[]
      | null
  )?.[0];

  if (!result) {
    throw new Error(
      "The delivery was rejected, but no updated assignment was returned.",
    );
  }

  return result;
}

export async function setRiderAvailability(
  status: "available" | "offline",
): Promise<SetRiderAvailabilityResult> {
  const { data, error } =
    await supabase.rpc(
      "set_rider_availability",
      {
        p_status: status,
      },
    );

  if (error) {
    throw new Error(
      `Unable to update availability: ${error.message}`,
    );
  }

  const result = (
    data as
      | SetRiderAvailabilityResult[]
      | null
  )?.[0];

  if (!result) {
    throw new Error(
      "Availability was updated, but no result was returned.",
    );
  }

  return result;
}

export async function subscribeToRiderAssignmentChanges(
  onChange: () => void,
): Promise<() => void> {
  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(
      `Unable to start Rider realtime updates: ${userError.message}`,
    );
  }

  const riderId =
    userData.user?.id;

  if (!riderId) {
    throw new Error(
      "No authenticated rider was found.",
    );
  }

  const channel =
    supabase
      .channel(
        `rider-assignments-${riderId}-${Date.now()}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_assignments",
          filter: `rider_id=eq.${riderId}`,
        },
        () => {
          onChange();
        },
      )
      .subscribe();

  return () => {
    void supabase.removeChannel(
      channel,
    );
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

