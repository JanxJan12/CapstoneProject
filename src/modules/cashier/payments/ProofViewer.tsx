import { useState } from "react";
import {
  Maximize2,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import { formatDateTime, formatMoney } from "../constants";
import type { Payment } from "../types";

export function ProofViewer({ payment }: { payment: Payment }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const reset = () => {
    setZoom(1);
    setRotation(0);
  };
  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[70] flex flex-col bg-[#17110e] p-4"
          : "rounded-2xl border border-[#4b382b] bg-gradient-to-br from-[#30251f] to-[#17120f] p-3 shadow-inner"
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-white">
        <div>
          <p className="text-xs font-black">Proof of payment</p>
          <p className="text-[10px] text-white/55">{payment.proofLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <Tool
            label="Zoom out"
            icon={ZoomOut}
            onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}
          />
          <Tool
            label="Zoom in"
            icon={ZoomIn}
            onClick={() => setZoom((value) => Math.min(2.2, value + 0.2))}
          />
          <Tool
            label="Rotate"
            icon={RotateCw}
            onClick={() => setRotation((value) => value + 90)}
          />
          <Tool label="Reset view" icon={RotateCcw} onClick={reset} />
          <Tool
            label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            icon={fullscreen ? X : Maximize2}
            onClick={() => setFullscreen((value) => !value)}
          />
        </div>
      </div>
      <div
        className={`flex items-center justify-center overflow-auto rounded-xl bg-black/30 ring-1 ring-white/5 ${fullscreen ? "flex-1" : "h-[330px]"}`}
      >
        <div
          className="w-[238px] shrink-0 overflow-hidden rounded-[28px] border-[7px] border-zinc-800 bg-[#eff8ff] shadow-2xl transition-transform duration-200"
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          aria-label={`GCash proof showing ${formatMoney(payment.submittedAmount)} with reference ${payment.referenceNumber}`}
        >
          <div className="bg-[#0877e6] px-4 pb-5 pt-3 text-white">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/60" />
            <p className="text-center text-xs font-black tracking-wide">
              GCash
            </p>
          </div>
          <div className="p-5 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-600">
              ✓
            </span>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Payment sent
            </p>
            <p className="mt-1 text-2xl font-black text-zinc-900">
              {formatMoney(payment.submittedAmount)}
            </p>
            <p className="mt-4 rounded-lg bg-white p-3 text-left text-[9px] leading-5 text-zinc-600 shadow-sm">
              To: <strong>RRJ Food-House</strong>
              <br />
              Reference: <strong>{payment.referenceNumber}</strong>
              <br />
              Date: <strong>{formatDateTime(payment.uploadedAt)}</strong>
            </p>
            <p className="mt-5 text-[8px] text-zinc-400">
              This prototype proof is for cashier verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tool({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-white text-zinc-700 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
