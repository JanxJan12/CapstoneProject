export function normalizeCustomerGcashReference(input: string): {
  value: string;
  error: string | null;
} {
  const value = input.trim();
  if (!value) return { value, error: "Enter the GCash reference number." };
  if (value.length > 100) {
    return { value, error: "The GCash reference number must be 100 characters or fewer." };
  }
  return { value, error: null };
}
