export function customerSnapshotModifierNames(modifiers: unknown): string {
  return Array.isArray(modifiers) ? modifiers.filter((option) =>
    option && typeof option.name === "string").map((option) => option.name).join(", ") : "";
}
