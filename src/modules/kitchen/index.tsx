import { useEffect, useState } from "react";
import { ChefHat, KeyRound, LogOut, Monitor } from "lucide-react";

import { AppShell } from "../../components/layout/AppShell";
import type { NavGroup } from "../../types";

import { CashierButton } from "../cashier/components";

import { KitchenQueue } from "./queue/KitchenQueue";

import {
  clearKdsSession,
  loadKdsSession,
  saveKdsSession,
  verifyKdsTerminal,
  type KdsTerminalCredential,
  type VerifiedKdsTerminal,
} from "./services/kdsTerminalService";

const NAV_GROUPS: NavGroup<"queue">[] = [
  {
    label: "Kitchen",
    items: [
      {
        id: "queue",
        label: "Kitchen Queue",
        icon: ChefHat,
      },
    ],
  },
];

export function KitchenApp() {
  const [terminal, setTerminal] = useState<VerifiedKdsTerminal | null>(null);

  const [checkingSession, setCheckingSession] = useState(true);

  const [terminalId, setTerminalId] = useState("");

  const [terminalSecret, setTerminalSecret] = useState("");

  const [activating, setActivating] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const restoreTerminal = async () => {
      const savedCredential = loadKdsSession();

      if (!savedCredential) {
        setCheckingSession(false);
        return;
      }

      try {
        const verified = await verifyKdsTerminal(savedCredential);

        if (cancelled) return;

        setTerminal(verified);
      } catch {
        clearKdsSession();

        if (cancelled) return;

        setTerminal(null);
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    };

    void restoreTerminal();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleActivate = async () => {
    const credential: KdsTerminalCredential = {
      terminalId: terminalId.trim(),
      terminalSecret: terminalSecret.trim(),
    };

    setActivating(true);
    setError("");

    try {
      const verified = await verifyKdsTerminal(credential);

      saveKdsSession(credential);

      setTerminal(verified);

      /*
       * Remove the secret from component state after it has
       * been stored in sessionStorage.
       */
      setTerminalSecret("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to activate the kitchen terminal.",
      );
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = () => {
    clearKdsSession();

    setTerminal(null);
    setTerminalId("");
    setTerminalSecret("");
    setError("");
  };

  if (checkingSession) {
    return <KitchenTerminalLoading />;
  }

  if (!terminal) {
    return (
      <KitchenTerminalActivation
        terminalId={terminalId}
        terminalSecret={terminalSecret}
        activating={activating}
        error={error}
        onTerminalIdChange={setTerminalId}
        onTerminalSecretChange={setTerminalSecret}
        onActivate={handleActivate}
      />
    );
  }

  return (
    <AppShell
      groups={NAV_GROUPS}
      active="queue"
      onSelect={() => {}}
      user={{
        name: terminal.terminalName,
        role: "Kitchen Display System",
      }}
    >
      <div className="kitchen-terminal-bar mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Monitor
            className="h-6 w-6 shrink-0 text-slate-700"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kitchen terminal · activated
            </p>
            <p className="mt-0.5 break-words text-base font-bold text-foreground">
              {terminal.terminalName}
            </p>
          </div>
        </div>
        <CashierButton
          variant="secondary"
          size="sm"
          className="kitchen-secondary-action"
          onClick={handleDeactivate}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Deactivate terminal
        </CashierButton>
      </div>

      <KitchenQueue />
    </AppShell>
  );
}

function KitchenTerminalActivation({
  terminalId,
  terminalSecret,
  activating,
  error,
  onTerminalIdChange,
  onTerminalSecretChange,
  onActivate,
}: {
  terminalId: string;
  terminalSecret: string;
  activating: boolean;
  error: string;
  onTerminalIdChange: (value: string) => void;
  onTerminalSecretChange: (value: string) => void;
  onActivate: () => void;
}) {
  return (
    <div className="kitchen-terminal-entry flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-5 sm:p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Monitor className="h-6 w-6" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Activate Kitchen Terminal
        </h1>

        <p className="mt-2 text-base leading-6 text-muted-foreground">
          Enter the terminal ID and private device secret provided by an RRJ
          manager.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="kds-terminal-id"
              className="text-sm font-semibold text-foreground"
            >
              Terminal ID
            </label>

            <input
              id="kds-terminal-id"
              value={terminalId}
              disabled={activating}
              autoComplete="off"
              onChange={(event) => onTerminalIdChange(event.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="mt-1.5 min-h-12 w-full rounded-lg border border-border bg-input-background px-3 py-2.5 font-mono text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label
              htmlFor="kds-terminal-secret"
              className="text-sm font-semibold text-foreground"
            >
              Device Secret
            </label>

            <div className="relative mt-1.5">
              <KeyRound
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />

              <input
                id="kds-terminal-secret"
                type="password"
                value={terminalSecret}
                disabled={activating}
                autoComplete="off"
                onChange={(event) => onTerminalSecretChange(event.target.value)}
                placeholder="kds_••••••••••••••••••••"
                className="min-h-12 w-full rounded-lg border border-border bg-input-background py-2.5 pl-10 pr-3 font-mono text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="break-words rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          ) : null}

          <CashierButton
            className="kitchen-next-action min-h-12 w-full justify-center text-base"
            loadingLabel="Activating terminal…"
            loading={activating}
            disabled={
              activating || !terminalId.trim() || !terminalSecret.trim()
            }
            onClick={onActivate}
          >
            <ChefHat className="h-4 w-4" aria-hidden="true" />
            Activate Kitchen Terminal
          </CashierButton>
        </div>

        <p className="mt-5 text-sm leading-5 text-muted-foreground">
          Kitchen staff do not need individual accounts. This credential
          identifies the authorized kitchen terminal itself.
        </p>
      </div>
    </div>
  );
}

function KitchenTerminalLoading() {
  return (
    <div className="kitchen-terminal-entry flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div
        role="status"
        className="w-full max-w-md rounded-xl border border-border bg-white p-6 text-center"
      >
        <ChefHat className="mx-auto h-7 w-7 animate-pulse text-primary" />

        <p className="mt-3 text-base font-bold text-foreground">
          Checking kitchen terminal…
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifying this device before opening the queue.
        </p>
      </div>
    </div>
  );
}
