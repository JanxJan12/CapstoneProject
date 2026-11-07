const UUID_LABEL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isInspectorAuditId = (value: string | null | undefined) =>
  Boolean(value && UUID_LABEL.test(value.trim()));

/** A legacy inspector ID is evidence of attribution, but is not a person's name. */
export function inspectorLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "Not recorded";
  return isInspectorAuditId(value)
    ? "Verified Manager · ID available in audit details"
    : value.trim();
}
