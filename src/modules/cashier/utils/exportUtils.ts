const manilaCalendar = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const manilaDate = (value: string | Date): string => {
  const parts = manilaCalendar.formatToParts(
    typeof value === "string" ? new Date(value) : value,
  );
  const part = (type: "year" | "month" | "day") =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const currentLocalDate = () => manilaDate(new Date());

export const toCsvCell = (value: string | number) => {
  const raw = String(value);
  // Quoting alone does not stop Excel/Sheets from evaluating imported formulas.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) || /^[\t\r\n]/u.test(raw)
    ? `'${raw}`
    : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function serializeCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
) {
  if (rows.some((row) => row.length !== headers.length)) {
    throw new Error("CSV row length does not match its headers.");
  }
  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\r\n")}\r\n`;
}

export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
) {
  const contents = serializeCsv(headers, rows);
  const url = URL.createObjectURL(
    new Blob([contents], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Immediate revocation can cancel a download before the browser reads it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
