export const currentLocalDate = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const toCsvCell = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
) {
  const contents = [headers, ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([contents], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
