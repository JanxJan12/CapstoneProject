import { supabase } from "@/lib/supabase";

export type RiderApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export interface RiderApplicationSummary {
  id: string;
  approvalStatus: RiderApplicationStatus;
  availabilityStatus:
    | "available"
    | "on_delivery"
    | "offline";
}

export interface SubmitRiderApplicationInput {
  contactNumber: string;
  driverLicenseNumber: string;
  plateNumber: string;
  motorBrand: string;
  motorModel: string;
  validId: File;
  orCrDocument: File;
  riderPhoto: File;
}

export interface SubmitRiderApplicationResult {
  riderId: string;
  approvalStatus: RiderApplicationStatus;
  availabilityStatus:
    | "available"
    | "on_delivery"
    | "offline";
  createdAt: string;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const DOCUMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
]);

function getFileExtension(file: File): string {
  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "application/pdf") {
    return "pdf";
  }

  return "jpg";
}

function validateFile(
  file: File,
  label: string,
  allowedTypes: Set<string>,
): void {
  if (!allowedTypes.has(file.type)) {
    throw new Error(
      `${label} must be a JPG, PNG${
        allowedTypes.has("application/pdf")
          ? ", or PDF"
          : ""
      } file.`,
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `${label} must be 5 MB or smaller.`,
    );
  }
}

async function uploadRiderDocument(
  userId: string,
  folder: "valid-id" | "or-cr" | "photo",
  file: File,
): Promise<string> {
  const extension = getFileExtension(file);

  const path = [
    userId,
    folder,
    `${crypto.randomUUID()}.${extension}`,
  ].join("/");

  const { error } = await supabase.storage
    .from("rider-documents")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(
      `Unable to upload ${folder === "valid-id"
        ? "the valid ID"
        : folder === "or-cr"
          ? "the OR/CR document"
          : "the rider photo"
      }: ${error.message}`,
    );
  }

  return path;
}

export async function getOwnRiderApplication(
  userId: string,
): Promise<RiderApplicationSummary | null> {
  const { data, error } = await supabase
    .from("riders")
    .select(
      `
        id,
        approval_status,
        availability_status
      `,
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to check rider application status: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  const approvalStatus =
    data.approval_status as RiderApplicationStatus;

  const availabilityStatus =
    data.availability_status as
      | "available"
      | "on_delivery"
      | "offline";

  return {
    id: data.id,
    approvalStatus,
    availabilityStatus,
  };
}

export async function submitRiderApplication(
  input: SubmitRiderApplicationInput,
): Promise<SubmitRiderApplicationResult> {
  const contactNumber = input.contactNumber.trim();
  const driverLicenseNumber =
    input.driverLicenseNumber.trim();
  const plateNumber = input.plateNumber.trim();
  const motorBrand = input.motorBrand.trim();
  const motorModel = input.motorModel.trim();

  if (!contactNumber) {
    throw new Error("Contact number is required.");
  }

  if (!driverLicenseNumber) {
    throw new Error(
      "Driver license number is required.",
    );
  }

  if (!plateNumber) {
    throw new Error("Plate number is required.");
  }

  if (!motorBrand) {
    throw new Error("Motorcycle brand is required.");
  }

  if (!motorModel) {
    throw new Error("Motorcycle model is required.");
  }

  validateFile(
    input.validId,
    "Valid ID",
    DOCUMENT_MIME_TYPES,
  );

  validateFile(
    input.orCrDocument,
    "OR/CR document",
    DOCUMENT_MIME_TYPES,
  );

  validateFile(
    input.riderPhoto,
    "Rider photo",
    PHOTO_MIME_TYPES,
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      "Your signed-in account could not be confirmed. Please sign in again.",
    );
  }

  const validIdPath =
    await uploadRiderDocument(
      user.id,
      "valid-id",
      input.validId,
    );

  const orCrDocumentPath =
    await uploadRiderDocument(
      user.id,
      "or-cr",
      input.orCrDocument,
    );

  const riderPhotoPath =
    await uploadRiderDocument(
      user.id,
      "photo",
      input.riderPhoto,
    );

  const { data, error } = await supabase.rpc(
    "submit_rider_application",
    {
      p_contact_number: contactNumber,
      p_driver_license_number:
        driverLicenseNumber,
      p_plate_number: plateNumber,
      p_motor_brand: motorBrand,
      p_motor_model: motorModel,
      p_valid_id_path: validIdPath,
      p_or_cr_document_path:
        orCrDocumentPath,
      p_rider_photo_path: riderPhotoPath,
    },
  );

  if (error) {
    throw new Error(
      `Unable to submit rider application: ${error.message}`,
    );
  }

  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(
      "The rider application was submitted, but the server returned an unexpected result.",
    );
  }

  const row = data[0] as {
    rider_id?: unknown;
    approval_status?: unknown;
    availability_status?: unknown;
    created_at?: unknown;
  };

  if (
    typeof row.rider_id !== "string" ||
    row.approval_status !== "pending" ||
    row.availability_status !== "offline" ||
    typeof row.created_at !== "string"
  ) {
    throw new Error(
      "The server returned an invalid rider application result.",
    );
  }

  return {
    riderId: row.rider_id,
    approvalStatus: row.approval_status,
    availabilityStatus:
      row.availability_status,
    createdAt: row.created_at,
  };
}