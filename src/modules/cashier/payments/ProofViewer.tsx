import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Payment } from "../types";

const SIGNED_PROOF_EXPIRY_SECONDS = 300;

interface PrivateProofState {
  path: string;
  signedUrl?: string;
  error?: string;
}

export function ProofViewer({ payment }: { payment: Payment }) {
  const [privateProof, setPrivateProof] = useState<PrivateProofState>();
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const [failedUrl, setFailedUrl] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const proofImagePath = payment.proofImagePath;
    let cancelled = false;

    setPrivateProof(undefined);
    if (!proofImagePath) return;

    const loadPrivateProof = async () => {
      try {
        const { data, error } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(proofImagePath, SIGNED_PROOF_EXPIRY_SECONDS);

        if (cancelled) return;
        setPrivateProof({
          path: proofImagePath,
          signedUrl: data?.signedUrl,
          error: error?.message || (!data?.signedUrl ? "The payment proof could not be loaded." : undefined),
        });
      } catch (error) {
        if (cancelled) return;
        setPrivateProof({
          path: proofImagePath,
          error: error instanceof Error ? error.message : "The payment proof could not be loaded.",
        });
      }
    };

    void loadPrivateProof();
    return () => {
      cancelled = true;
    };
  }, [payment.id, payment.proofImagePath]);

  useEffect(() => {
    setPreviewOpen(false);
  }, [payment.id]);

  const proofImagePath = payment.proofImagePath;
  const currentPrivateProof =
    proofImagePath && privateProof?.path === proofImagePath ? privateProof : undefined;
  const proofUrl = proofImagePath ? currentPrivateProof?.signedUrl : payment.proofUrl;
  const proofError = currentPrivateProof?.error ||
    (proofUrl && failedUrl === proofUrl ? "The payment proof could not be displayed." : undefined);
  const loading = Boolean(proofImagePath && !currentPrivateProof) ||
    Boolean(proofUrl && loadedUrl !== proofUrl && !proofError);
  const canEnlarge = Boolean(proofUrl && loadedUrl === proofUrl && !proofError);

  return (
    <section className="min-w-0 rounded-xl bg-[#17120f] p-2.5" aria-label="Payment proof">
      <p className="mb-2 text-sm font-black text-white">Payment proof</p>
      <button
        ref={previewButtonRef}
        type="button"
        disabled={!canEnlarge}
        onClick={() => setPreviewOpen(true)}
        aria-label={`Enlarge payment proof for ${payment.orderId}`}
        className="flex h-[300px] w-full min-w-0 items-center justify-center overflow-hidden rounded-lg bg-black/30 p-2 text-center text-sm font-bold text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-default sm:h-[390px]"
      >
        {proofUrl && !proofError ? (
          <img
            src={proofUrl}
            alt={`${payment.orderId} uploaded payment proof`}
            className="max-h-full max-w-full object-contain"
            onLoad={() => setLoadedUrl(proofUrl)}
            onError={() => setFailedUrl(proofUrl)}
          />
        ) : null}
        {loading || proofError || !proofUrl ? (
          <span role={proofError ? "alert" : "status"} className="px-4">
            {proofError || (loading ? "Loading payment proof…" : "No payment proof uploaded.")}
          </span>
        ) : null}
      </button>
      {canEnlarge ? <p className="mt-2 text-center text-sm font-semibold text-white/85">Tap or click the image to enlarge</p> : null}

      <Dialog open={previewOpen && canEnlarge} onOpenChange={setPreviewOpen}>
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col border-white/20 bg-[#17120f] p-4 text-white sm:max-w-5xl [&_[data-slot=dialog-close]]:text-white"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previewButtonRef.current?.focus();
          }}
        >
          <DialogTitle className="pr-10 text-sm">Payment proof for {payment.orderId}</DialogTitle>
          <DialogDescription className="sr-only">Enlarged original payment proof. Press Escape or use Close to return.</DialogDescription>
          {proofUrl ? (
            <img
              src={proofUrl}
              alt={`${payment.orderId} enlarged uploaded payment proof`}
              className="mx-auto max-h-[calc(100dvh-8rem)] max-w-full object-contain"
              onError={() => {
                setFailedUrl(proofUrl);
                setPreviewOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
