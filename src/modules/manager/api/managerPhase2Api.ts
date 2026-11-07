import { supabase } from "@/lib/supabase";

export type ManagerRiderApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export type ManagerRiderAvailabilityStatus =
  | "available"
  | "on_delivery"
  | "offline";

export interface ManagerMenuItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryName: string;
  price: number;
  isActive: boolean;
  manuallyAvailable: boolean;
  effectivelyAvailable: boolean;
  updatedAt: string;
}

export interface ManagerCustomer {
  id: string;
  name: string;
  contactNumber: string | null;
  isActive: boolean;
  orderCount: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface ManagerRider {
  id: string;
  name: string;
  contactNumber: string | null;
  driverLicenseNumber: string | null;
  plateNumber: string | null;
  motorBrand: string | null;
  motorModel: string | null;
  approvalStatus: ManagerRiderApprovalStatus;
  availabilityStatus: ManagerRiderAvailabilityStatus;
  isActive: boolean;
  deliveriesToday: number;
  totalDeliveries: number;
  lastAssignedAt: string | null;
}

export interface ManagerRiderApplication {
  id: string;
  name: string;
  contactNumber: string | null;

  validIdPath: string | null;
  validIdUrl: string | null;

  orCrDocumentPath: string | null;
  orCrDocumentUrl: string | null;

  riderPhotoPath: string | null;
  riderPhotoUrl: string | null;

  driverLicenseNumber: string | null;
  plateNumber: string | null;
  motorBrand: string | null;
  motorModel: string | null;

  approvalStatus: ManagerRiderApprovalStatus;
  availabilityStatus: ManagerRiderAvailabilityStatus;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerRiderApprovalResult {
  riderId: string;
  approvalStatus: ManagerRiderApprovalStatus;
  availabilityStatus: ManagerRiderAvailabilityStatus;
  profileRole:
    | "customer"
    | "cashier"
    | "manager"
    | "rider";
  updatedAt: string;
}

const RIDER_DOCUMENT_SIGNED_URL_EXPIRY_SECONDS = 300;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RIDER_APPROVAL_STATUSES = new Set<ManagerRiderApprovalStatus>([
  "pending",
  "approved",
  "rejected",
  "suspended",
]);

const RIDER_AVAILABILITY_STATUSES =
  new Set<ManagerRiderAvailabilityStatus>([
    "available",
    "on_delivery",
    "offline",
  ]);

function requireRecord(
  value: unknown,
  recordName: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`The server returned an invalid ${recordName}.`);
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return value.trim();
}

function optionalString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return value.trim() || null;
}

function requireUuid(value: unknown, fieldName: string): string {
  const uuid = requireString(value, fieldName);

  if (!UUID_PATTERN.test(uuid)) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return uuid;
}

function requireNumber(value: unknown, fieldName: string): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return number;
}

function requireNonNegativeNumber(value: unknown, fieldName: string): number {
  const number = requireNumber(value, fieldName);

  if (number < 0) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return number;
}

function requireNonNegativeInteger(value: unknown, fieldName: string): number {
  const number = requireNonNegativeNumber(value, fieldName);

  if (!Number.isSafeInteger(number)) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return number;
}

function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return value;
}

function requireTimestamp(value: unknown, fieldName: string): string {
  const timestamp = requireString(value, fieldName);

  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return timestamp;
}

function optionalTimestamp(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return requireTimestamp(value, fieldName);
}

function requireEnum<T extends string>(
  value: unknown,
  allowedValues: Set<T>,
  fieldName: string,
): T {
  if (typeof value !== "string" || !allowedValues.has(value as T)) {
    throw new Error(`The server returned an unsupported ${fieldName}.`);
  }

  return value as T;
}

function requireList(value: unknown, listName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`The server returned an invalid ${listName}.`);
  }

  return value;
}

function mapMenuItem(value: unknown): ManagerMenuItem {
  const row = requireRecord(value, "manager menu item");

  return {
    id: requireUuid(row.id, "menu item ID"),
    code: requireString(row.code, "menu item code"),
    name: requireString(row.name, "menu item name"),
    description: optionalString(row.description, "menu item description"),
    categoryName: requireString(row.category_name, "menu category name"),
    price: requireNonNegativeNumber(row.price, "menu item price"),
    isActive: requireBoolean(row.is_active, "menu item active state"),
    manuallyAvailable: requireBoolean(
      row.is_available,
      "menu item manual availability",
    ),
    effectivelyAvailable: requireBoolean(
      row.effective_available,
      "menu item effective availability",
    ),
    updatedAt: requireTimestamp(row.updated_at, "menu item update date"),
  };
}

function mapCustomer(value: unknown): ManagerCustomer {
  const row = requireRecord(value, "manager customer");

  return {
    id: requireUuid(row.id, "customer ID"),
    name: requireString(row.customer_name, "customer name"),
    contactNumber: optionalString(row.contact_number, "customer contact number"),
    isActive: requireBoolean(row.is_active, "customer active state"),
    orderCount: requireNonNegativeInteger(row.order_count, "customer order count"),
    lastOrderAt: optionalTimestamp(row.last_order_at, "customer last order date"),
    createdAt: requireTimestamp(row.created_at, "customer creation date"),
  };
}

function mapRider(value: unknown): ManagerRider {
  const row = requireRecord(value, "manager rider");

  return {
    id: requireUuid(row.id, "rider ID"),
    name: requireString(row.rider_name, "rider name"),
    contactNumber: optionalString(row.contact_number, "rider contact number"),
    driverLicenseNumber: optionalString(
      row.driver_license_number,
      "rider driver license number",
    ),
    plateNumber: optionalString(row.plate_number, "rider plate number"),
    motorBrand: optionalString(row.motor_brand, "rider motor brand"),
    motorModel: optionalString(row.motor_model, "rider motor model"),
    approvalStatus: requireEnum(
      row.approval_status,
      RIDER_APPROVAL_STATUSES,
      "rider approval status",
    ),
    availabilityStatus: requireEnum(
      row.availability_status,
      RIDER_AVAILABILITY_STATUSES,
      "rider availability status",
    ),
    isActive: requireBoolean(row.is_active, "rider active state"),
    deliveriesToday: requireNonNegativeInteger(
      row.deliveries_today,
      "rider deliveries today",
    ),
    totalDeliveries: requireNonNegativeInteger(
      row.total_deliveries,
      "rider total deliveries",
    ),
    lastAssignedAt: optionalTimestamp(
      row.last_assigned_at,
      "rider last assignment date",
    ),
  };
}

function mapRiderApplication(
  value: unknown,
): Omit<
  ManagerRiderApplication,
  | "validIdUrl"
  | "orCrDocumentUrl"
  | "riderPhotoUrl"
> {
  const row = requireRecord(
    value,
    "manager rider application",
  );

  return {
    id: requireUuid(
      row.id,
      "rider application ID",
    ),

    name: requireString(
      row.rider_name,
      "rider name",
    ),

    contactNumber: optionalString(
      row.contact_number,
      "rider contact number",
    ),

    validIdPath: optionalString(
      row.valid_id_path,
      "valid ID path",
    ),

    orCrDocumentPath: optionalString(
      row.or_cr_document_path,
      "OR/CR document path",
    ),

    riderPhotoPath: optionalString(
      row.rider_photo_path,
      "rider photo path",
    ),

    driverLicenseNumber: optionalString(
      row.driver_license_number,
      "driver license number",
    ),

    plateNumber: optionalString(
      row.plate_number,
      "plate number",
    ),

    motorBrand: optionalString(
      row.motor_brand,
      "motor brand",
    ),

    motorModel: optionalString(
      row.motor_model,
      "motor model",
    ),

    approvalStatus: requireEnum(
      row.approval_status,
      RIDER_APPROVAL_STATUSES,
      "rider approval status",
    ),

    availabilityStatus: requireEnum(
      row.availability_status,
      RIDER_AVAILABILITY_STATUSES,
      "rider availability status",
    ),

    isActive: requireBoolean(
      row.is_active,
      "rider active state",
    ),

    createdAt: requireTimestamp(
      row.created_at,
      "rider application creation date",
    ),

    updatedAt: requireTimestamp(
      row.updated_at,
      "rider application update date",
    ),
  };
}

async function createRiderDocumentSignedUrl(
  path: string | null,
  riderId: string,
  documentKind: "valid-id" | "or-cr" | "photo",
): Promise<string | null> {
  if (!path) {
    return null;
  }

  const parts = path.split("/");
  if (
    parts.length !== 3 ||
    parts[0] !== riderId ||
    parts[1] !== documentKind ||
    !parts[2]
  ) {
    throw new Error("Rider document path does not match this application.");
  }

  const { data, error } = await supabase.storage
    .from("rider-documents")
    .createSignedUrl(
      path,
      RIDER_DOCUMENT_SIGNED_URL_EXPIRY_SECONDS,
    );

  if (error || !data?.signedUrl) {
    throw new Error("Rider document could not be opened.");
  }

  return data.signedUrl;
}

export async function getManagerMenuItems(): Promise<ManagerMenuItem[]> {
  const { data, error } = await supabase.rpc("get_manager_menu_items");

  if (error) {
    throw new Error(`Unable to load manager menu: ${error.message}`);
  }

  return requireList(data, "manager menu list").map(mapMenuItem);
}

export async function setManagerMenuItemAvailability(
  menuItemId: string,
  isAvailable: boolean,
): Promise<ManagerMenuItem> {
  const normalizedId = requireUuid(menuItemId, "menu item ID");
  const { data, error } = await supabase.rpc(
    "set_manager_menu_item_availability",
    {
      p_menu_item_id: normalizedId,
      p_is_available: isAvailable,
    },
  );

  if (error) {
    throw new Error(`Unable to update menu availability: ${error.message}`);
  }

  const result = requireList(data, "menu availability result")[0];

  if (!result) {
    throw new Error(
      "Menu availability was updated, but the server returned no result.",
    );
  }

  const item = mapMenuItem(result);

  if (item.id !== normalizedId || item.manuallyAvailable !== isAvailable) {
    throw new Error("The server returned an unexpected menu availability result.");
  }

  return item;
}

export async function getManagerCustomers(): Promise<ManagerCustomer[]> {
  const { data, error } = await supabase.rpc("get_manager_customers");

  if (error) {
    throw new Error(`Unable to load manager customers: ${error.message}`);
  }

  return requireList(data, "manager customer list").map(mapCustomer);
}

export async function getManagerRiders(): Promise<ManagerRider[]> {
  const { data, error } = await supabase.rpc("get_manager_riders");

  if (error) {
    throw new Error(`Unable to load manager riders: ${error.message}`);
  }

  return requireList(data, "manager rider list").map(mapRider);
}


export async function getManagerRiderApplication(
  riderId: string,
): Promise<ManagerRiderApplication> {
  const normalizedId = requireUuid(
    riderId,
    "rider ID",
  );

  const { data, error } = await supabase.rpc(
    "get_manager_rider_application",
    {
      p_rider_id: normalizedId,
    },
  );

  if (error) {
    throw new Error(
      `Unable to load rider application: ${error.message}`,
    );
  }

  const row = requireList(
    data,
    "manager rider application result",
  )[0];

  if (!row) {
    throw new Error(
      "The rider application was not found.",
    );
  }

  const application =
    mapRiderApplication(row);

  const [validId, orCrDocument, riderPhoto] = await Promise.allSettled([
    createRiderDocumentSignedUrl(
      application.validIdPath,
      application.id,
      "valid-id",
    ),
    createRiderDocumentSignedUrl(
      application.orCrDocumentPath,
      application.id,
      "or-cr",
    ),
    createRiderDocumentSignedUrl(
      application.riderPhotoPath,
      application.id,
      "photo",
    ),
  ]);

  return {
    ...application,
    validIdUrl: validId.status === "fulfilled" ? validId.value : null,
    orCrDocumentUrl:
      orCrDocument.status === "fulfilled" ? orCrDocument.value : null,
    riderPhotoUrl: riderPhoto.status === "fulfilled" ? riderPhoto.value : null,
  };
}

export async function setManagerRiderApprovalStatus(
  riderId: string,
  status: "approved" | "suspended",
): Promise<ManagerRiderApprovalResult> {
  const normalizedId = requireUuid(
    riderId,
    "rider ID",
  );

  const { data, error } = await supabase.rpc(
    "set_manager_rider_approval_status",
    {
      p_rider_id: normalizedId,
      p_status: status,
    },
  );

  if (error) {
    throw new Error(
      `Unable to update rider approval: ${error.message}`,
    );
  }

  const row = requireList(
    data,
    "rider approval result",
  )[0];

  if (!row) {
    throw new Error(
      "The rider approval was updated, but the server returned no result.",
    );
  }

  const result = requireRecord(
    row,
    "rider approval result",
  );

  const approvalStatus = requireEnum(
    result.approval_status,
    RIDER_APPROVAL_STATUSES,
    "rider approval status",
  );

  const availabilityStatus = requireEnum(
    result.availability_status,
    RIDER_AVAILABILITY_STATUSES,
    "rider availability status",
  );

  const profileRole = requireString(
    result.profile_role,
    "profile role",
  );

  if (
    profileRole !== "customer" &&
    profileRole !== "cashier" &&
    profileRole !== "manager" &&
    profileRole !== "rider"
  ) {
    throw new Error(
      "The server returned an unsupported profile role.",
    );
  }

  if (approvalStatus !== status) {
    throw new Error(
      "The server returned an unexpected rider approval status.",
    );
  }

  return {
    riderId: requireUuid(
      result.rider_id,
      "rider ID",
    ),

    approvalStatus,
    availabilityStatus,

    profileRole,

    updatedAt: requireTimestamp(
      result.updated_at,
      "rider approval update date",
    ),
  };
}
