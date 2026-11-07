import type { RequestSnapshot } from "./inventoryRequestApi";
import { formatRequestQuantity } from "./requestQuantity";

export interface RequestDocumentLine {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  overrideReason?: string;
}

export interface RequestDocumentData {
  identifier: string;
  reference?: string;
  revision: number;
  status: string;
  issuedAt?: string;
  issuedBy?: string;
  priority: string;
  neededAt: string;
  destination?: string;
  lines: RequestDocumentLine[];
  draft: boolean;
}

const manila = (date: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

/** Only the saved revision snapshot supplies business fields for an issued export. */
export function issuedRequestDocument(snapshot: RequestSnapshot): RequestDocumentData {
  return {
    identifier: snapshot.number,
    reference: snapshot.number,
    revision: snapshot.revision,
    status: `Issued revision ${snapshot.revision}`,
    issuedAt: manila(snapshot.issued_at),
    issuedBy: snapshot.issued_by_name || snapshot.issued_by,
    priority: snapshot.priority,
    neededAt: manila(snapshot.needed_at),
    destination: snapshot.destination,
    lines: snapshot.lines.map((line) => ({
      id: line.inventory_item_id,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
    })),
    draft: false,
  };
}

export function requestDocumentText(data: RequestDocumentData): string {
  return [
    "RRJ’S FOOD-HOUSE",
    data.draft ? "DRAFT PRODUCTION REQUEST — NOT ISSUED" : `FORMAL PRODUCTION REQUEST — ISSUED REVISION ${data.revision}`,
    data.reference ? `${data.reference}  ·  Rev ${data.revision}` : `Draft revision ${data.revision} · reference assigned on issue`,
    data.issuedAt ? `Issued: ${data.issuedAt}` : "",
    data.issuedBy ? `Issuer: ${data.issuedBy}` : "",
    ...(data.destination ? [`Destination: ${data.destination}`] : []),
    `Priority: ${data.priority.toUpperCase()}`,
    `Needed: ${data.neededAt}`,
    "",
    ...data.lines.flatMap((line, index) => [
      `${index + 1}. ${line.name} — ${formatRequestQuantity(line.quantity)} ${line.unit}`,
      `   Item ID: ${line.id}`,
      ...(line.overrideReason?.trim() ? [`   Quantity override: ${line.overrideReason.trim()}`] : []),
    ]),
    "",
    "REQUEST ONLY — NOT RECEIVING PROOF",
    "Physical delivery requires separate inspection and Manager posting.",
  ].join("\n");
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const field = (label: string, value?: string) =>
  value?.trim()
    ? `<div class="field"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    : "";

export function requestPdfTitle(data: RequestDocumentData): string {
  const identifier =
    (data.reference || data.identifier)
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "request";
  return `${data.draft ? "DRAFT-" : ""}${identifier}-rev${data.revision}`;
}

/** Self-contained print document; the browser's Save as PDF uses its title as the suggested filename. */
export function requestPrintHtml(data: RequestDocumentData): string {
  const rows = data.lines
    .map(
      (line, index) => `<tr>
        <td class="index">${index + 1}</td>
        <td><strong class="item-name">${escapeHtml(line.name)}</strong>
          <span class="item-id">Item ID: ${escapeHtml(line.id)}</span>
          ${line.overrideReason?.trim() ? `<span class="item-note">Quantity override: ${escapeHtml(line.overrideReason.trim())}</span>` : ""}
        </td>
        <td class="quantity">${escapeHtml(formatRequestQuantity(line.quantity))}</td>
        <td class="unit">${escapeHtml(line.unit)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(requestPdfTitle(data))}</title>
    <style>
      @page { size: A4; margin: 17mm 15mm 20mm; }
      * { box-sizing: border-box; }
      html { color: #111; font: 11pt/1.4 Arial, sans-serif; }
      body { margin: 0; }
      header { border-bottom: 2px solid #111; padding-bottom: 10mm; margin-bottom: 8mm; }
      .brand { margin: 0 0 4mm; font-size: 10pt; font-weight: 800; letter-spacing: .13em; }
      h1 { margin: 0; font-size: 21pt; line-height: 1.15; }
      .reference { margin: 3mm 0 0; font-size: 12pt; font-weight: 700; overflow-wrap: anywhere; }
      .status { display: inline-block; margin-top: 4mm; border: 1px solid #333; padding: 1mm 3mm; font-size: 9pt; font-weight: 700; }
      .draft-warning { margin: 0 0 6mm; border: 1px solid #555; padding: 3mm; font-size: 9pt; font-weight: 700; }
      dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5mm 9mm; margin: 0 0 8mm; }
      .field { min-width: 0; border-bottom: 1px solid #aaa; padding-bottom: 2mm; break-inside: avoid; }
      dt { color: #444; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
      dd { margin: 1mm 0 0; font-size: 10pt; font-weight: 600; overflow-wrap: anywhere; }
      h2 { margin: 0 0 3mm; font-size: 12pt; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      col.index { width: 8%; } col.item { width: 56%; } col.quantity { width: 18%; } col.unit { width: 18%; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th, td { border-bottom: 1px solid #bbb; padding: 2mm; vertical-align: top; }
      th { border-top: 1px solid #333; border-bottom: 1px solid #333; font-size: 8pt; text-align: left; text-transform: uppercase; }
      .quantity { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .unit { overflow-wrap: anywhere; }
      .item-name, .item-id, .item-note { display: block; overflow-wrap: anywhere; }
      .item-id, .item-note { margin-top: 1mm; color: #444; font-size: 8pt; }
      .summary { margin: 5mm 0 0; font-size: 9pt; font-weight: 700; }
      footer { margin-top: 10mm; border-top: 1px solid #333; padding-top: 3mm; color: #333; font-size: 8pt; break-inside: avoid; }
      @media screen { body { max-width: 210mm; margin: 20px auto; padding: 17mm 15mm; box-shadow: 0 0 0 1px #ccc; } }
    </style></head><body>
    <header><p class="brand">RRJ’S FOOD-HOUSE</p><h1>${data.draft ? "Inventory Request" : "Formal Production Request"}</h1>
      ${data.reference ? `<p class="reference">${escapeHtml(data.reference)} · Revision ${data.revision}</p>` : `<p class="reference">Draft revision ${data.revision} · reference assigned on issue</p>`}
      <span class="status">${escapeHtml(data.draft ? data.status : `Issued revision ${data.revision}`)}</span>
    </header>
    ${data.draft ? `<p class="draft-warning">DRAFT PREVIEW — Not issued or sent. No stock has been received.</p>` : ""}
    <dl>${field("Issued / created", data.issuedAt)}${field("Issued by", data.issuedBy)}${field("Priority", data.priority)}${field("Needed", data.neededAt)}${data.destination ? field("Destination", data.destination) : ""}</dl>
    <section><h2>Requested items</h2><table><colgroup><col class="index"><col class="item"><col class="quantity"><col class="unit"></colgroup>
      <thead><tr><th scope="col">#</th><th scope="col">Item / ID</th><th scope="col" class="quantity">Quantity</th><th scope="col">Unit</th></tr></thead>
      <tbody>${rows}</tbody></table><p class="summary">${data.lines.length} item line${data.lines.length === 1 ? "" : "s"} · Quantities remain per item and unit.</p></section>
    <footer>Request document only. Export does not issue, send, receive, post, or change stock. Physical deliveries require separate Receiving review and authorized posting.</footer>
    </body></html>`;
}

