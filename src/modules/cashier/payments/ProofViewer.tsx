import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Focus,
  Maximize2,
  Move,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateTime, formatMoney } from "../constants";
import type { Payment } from "../types";
import { CashierIconButton } from "../components";
import { EXPECTED_PAYMENT_RECEIVER } from "./paymentVerification";
import { renderProofPng } from "./proofImage";

const PROOF_WIDTH = 238;
const PROOF_HEIGHT = 398;
const SIGNED_PROOF_EXPIRY_SECONDS = 300;

interface PrivateProofState {
  path: string;
  signedUrl?: string;
  error?: string;
}

export function ProofViewer({ payment }: { payment: Payment }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [privateProof, setPrivateProof] =
    useState<PrivateProofState>();
  const viewerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<
    | { pointerId: number; x: number; y: number; panX: number; panY: number }
    | undefined
  >(undefined);

  const reset = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitToScreen = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const sideways = Math.abs(Math.round(rotation / 90)) % 2 === 1;
    const proofWidth = sideways ? PROOF_HEIGHT : PROOF_WIDTH;
    const proofHeight = sideways ? PROOF_WIDTH : PROOF_HEIGHT;
    const fittedZoom = Math.min(
      2.5,
      Math.max(
        0.5,
        Math.min(
          (viewer.clientWidth - 32) / proofWidth,
          (viewer.clientHeight - 32) / proofHeight,
        ),
      ),
    );
    setZoom(Number(fittedZoom.toFixed(2)));
    setPan({ x: 0, y: 0 });
  }, [rotation]);

  useEffect(() => {
    reset();
  }, [payment.id, reset]);

  useEffect(() => {
    const proofImagePath = payment.proofImagePath;
    let cancelled = false;

    setPrivateProof(undefined);

    if (!proofImagePath) {
      return;
    }

    const loadPrivateProof = async () => {
      try {
        const { data, error } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(
            proofImagePath,
            SIGNED_PROOF_EXPIRY_SECONDS,
          );

        if (cancelled) return;

        if (error || !data?.signedUrl) {
          setPrivateProof({
            path: proofImagePath,
            error:
              error?.message ||
              "The payment proof could not be loaded.",
          });
          return;
        }

        setPrivateProof({
          path: proofImagePath,
          signedUrl: data.signedUrl,
        });
      } catch (error) {
        if (cancelled) return;

        setPrivateProof({
          path: proofImagePath,
          error:
            error instanceof Error
              ? error.message
              : "The payment proof could not be loaded.",
        });
      }
    };

    void loadPrivateProof();

    return () => {
      cancelled = true;
    };
  }, [payment.id, payment.proofImagePath]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [fullscreen]);

  const proofImagePath = payment.proofImagePath;
  const currentPrivateProof =
    proofImagePath && privateProof?.path === proofImagePath
      ? privateProof
      : undefined;
  const signedProofUrl = currentPrivateProof?.signedUrl;
  const proofError = currentPrivateProof?.error;
  const displayedProofUrl = proofImagePath
    ? signedProofUrl
    : payment.proofUrl;
  const privateProofLoading = Boolean(
    proofImagePath && !currentPrivateProof,
  );
  const canExportProof = !proofImagePath || Boolean(signedProofUrl);

  const proofUrl = () => {
    if (proofImagePath) {
      return signedProofUrl;
    }

    return payment.proofUrl ?? renderProofPng(payment);
  };

  const downloadProof = () => {
    const url = proofUrl();

    if (!url) return;

    const link = document.createElement("a");
    link.href = url;
    link.download =
      proofImagePath?.split("/").pop() ||
      `${payment.orderId}-${payment.id}-payment-proof.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  const openOriginal = () => {
    const url = proofUrl();

    if (!url) return;

    if (proofImagePath || payment.proofUrl) {
      const opened = window.open(url, "_blank");
      if (opened) opened.opener = null;
      return;
    }
    const opened = window.open("", "_blank");
    if (!opened) return;
    opened.opener = null;
    opened.document.title = `${payment.orderId} payment proof`;
    opened.document.body.style.cssText =
      "margin:0;min-height:100vh;display:grid;place-items:center;background:#17110e;padding:24px;box-sizing:border-box";
    const image = opened.document.createElement("img");
    image.src = url;
    image.alt = `${payment.orderId} original payment proof`;
    image.style.cssText =
      "max-width:100%;max-height:calc(100vh - 48px);object-fit:contain";
    opened.document.body.appendChild(image);
  };

  return (
    <div
      role={fullscreen ? "dialog" : undefined}
      aria-modal={fullscreen || undefined}
      aria-label={fullscreen ? "Fullscreen payment proof" : undefined}
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
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Tool
            label="Zoom out"
            icon={ZoomOut}
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.2))}
          />
          <Tool
            label="Zoom in"
            icon={ZoomIn}
            onClick={() => setZoom((value) => Math.min(3, value + 0.2))}
          />
          <Tool
            label="Rotate left"
            icon={RotateCcw}
            onClick={() => setRotation((value) => value - 90)}
          />
          <Tool
            label="Rotate right"
            icon={RotateCw}
            onClick={() => setRotation((value) => value + 90)}
          />
          <Tool label="Fit to screen" icon={Focus} onClick={fitToScreen} />
          <Tool label="Reset view" icon={Move} onClick={reset} />
          <Tool
            label="Download proof"
            icon={Download}
            onClick={downloadProof}
            disabled={!canExportProof}
          />
          <Tool
            label="Open original"
            icon={ExternalLink}
            onClick={openOriginal}
            disabled={!canExportProof}
          />
          <Tool
            label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            icon={fullscreen ? X : Maximize2}
            onClick={() => setFullscreen((value) => !value)}
          />
        </div>
      </div>
      <div
        ref={viewerRef}
        className={`relative flex select-none items-center justify-center overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/5 ${fullscreen ? "flex-1" : "h-[330px]"} ${pointer.current ? "cursor-grabbing" : "cursor-grab"}`}
        onWheel={(event) => {
          event.preventDefault();
          setZoom((value) =>
            Math.min(3, Math.max(0.5, value + (event.deltaY < 0 ? 0.1 : -0.1))),
          );
        }}
        onPointerDown={(event) => {
          pointer.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (pointer.current?.pointerId !== event.pointerId) return;
          setPan({
            x: pointer.current.panX + event.clientX - pointer.current.x,
            y: pointer.current.panY + event.clientY - pointer.current.y,
          });
        }}
        onPointerUp={(event) => {
          if (pointer.current?.pointerId === event.pointerId)
            pointer.current = undefined;
        }}
        onPointerCancel={() => {
          pointer.current = undefined;
        }}
        style={{ touchAction: "none" }}
        aria-label="Payment proof canvas. Drag to pan and use the toolbar to inspect the proof."
      >
        <div
          className="w-[238px] shrink-0 overflow-hidden rounded-[28px] border-[7px] border-zinc-800 bg-[#eff8ff] shadow-2xl transition-transform duration-150"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          }}
          aria-label={
            proofImagePath
              ? `Uploaded GCash payment proof for ${payment.orderId}`
              : `GCash proof showing ${formatMoney(payment.submittedAmount)} with reference ${payment.referenceNumber ?? "not found"}`
          }
        >
          {displayedProofUrl ? (
            <img
              src={displayedProofUrl}
              alt={`${payment.orderId} payment proof`}
              className="block h-[398px] w-[238px] object-contain"
              onError={() => {
                if (!proofImagePath) return;

                setPrivateProof({
                  path: proofImagePath,
                  error: "The signed payment proof could not be displayed.",
                });
              }}
            />
          ) : proofImagePath ? (
            <div
              className="flex h-[398px] w-[238px] items-center justify-center p-6 text-center text-xs font-bold text-zinc-600"
              role={proofError ? "alert" : "status"}
            >
              {proofError ||
                (privateProofLoading
                  ? "Loading private payment proof…"
                  : "The payment proof is unavailable.")}
            </div>
          ) : (
            <>
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
                  From:{" "}
                  <strong>{payment.senderName ?? "GCash customer"}</strong>
                  <br />
                  To:{" "}
                  <strong>
                    {payment.receiverName ?? EXPECTED_PAYMENT_RECEIVER}
                  </strong>
                  <br />
                  Reference:{" "}
                  <strong>{payment.referenceNumber ?? "Not found"}</strong>
                  <br />
                  Date: <strong>{formatDateTime(payment.uploadedAt)}</strong>
                </p>
              </div>
            </>
          )}
        </div>
        <span className="pointer-events-none absolute bottom-3 rounded-full bg-black/55 px-3 py-1 text-[9px] font-bold text-white/75">
          Drag to pan · {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}

function Tool({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <CashierIconButton
      label={label}
      icon={Icon}
      onClick={onClick}
      disabled={disabled}
      className="border-white/10 bg-white text-zinc-700 hover:bg-zinc-100"
    />
  );
}
