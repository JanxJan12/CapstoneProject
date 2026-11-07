export function getPaymentProofExtension(file: File): string {
  const originalExtension = file.name
    .split(".")
    .pop()
    ?.toLowerCase();

  if (file.type === "image/png") {
    return "png";
  }

  return originalExtension === "jpeg"
    ? "jpeg"
    : "jpg";
}
