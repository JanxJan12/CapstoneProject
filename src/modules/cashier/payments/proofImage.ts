import { formatDateTime, formatMoney } from "../constants";
import type { Payment } from "../types";
import { EXPECTED_PAYMENT_RECEIVER } from "./paymentVerification";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 1400;

export function renderProofPng(payment: Payment) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.fillStyle = "#eff8ff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0877e6";
  context.fillRect(0, 0, canvas.width, 250);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.font = "700 58px Arial";
  context.fillText("GCash", 450, 145);
  context.fillStyle = "#059669";
  context.beginPath();
  context.arc(450, 390, 82, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "700 70px Arial";
  context.fillText("✓", 450, 415);
  context.fillStyle = "#52525b";
  context.font = "700 30px Arial";
  context.fillText("PAYMENT SENT", 450, 535);
  context.fillStyle = "#18181b";
  context.font = "700 66px Arial";
  context.fillText(formatMoney(payment.submittedAmount), 450, 630);

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(100, 720, 700, 430, 28);
  context.fill();
  context.fillStyle = "#52525b";
  context.textAlign = "left";
  context.font = "600 29px Arial";
  const rows = [
    ["From", payment.senderName ?? "GCash customer"],
    ["To", payment.receiverName ?? EXPECTED_PAYMENT_RECEIVER],
    ["Reference", payment.referenceNumber ?? "Not found"],
    ["Date", formatDateTime(payment.uploadedAt)],
  ];
  rows.forEach(([label, value], index) => {
    context.fillStyle = "#71717a";
    context.fillText(label, 145, 805 + index * 88);
    context.fillStyle = "#18181b";
    context.font = "700 29px Arial";
    context.fillText(value, 330, 805 + index * 88);
    context.font = "600 29px Arial";
  });
  context.fillStyle = "#a1a1aa";
  context.textAlign = "center";
  context.font = "500 24px Arial";
  context.fillText(payment.proofLabel ?? "Payment proof", 450, 1280);
  return canvas.toDataURL("image/png");
}
