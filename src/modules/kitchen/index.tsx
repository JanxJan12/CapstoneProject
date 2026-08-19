import { useEffect, useState } from "react";
import {
  ChefHat,
  KeyRound,
  LogOut,
  Monitor,
} from "lucide-react";

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
  const [terminal, setTerminal] =
    useState<VerifiedKdsTerminal | null>(null);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [terminalId, setTerminalId] =
    useState("");

  const [terminalSecret, setTerminalSecret] =
    useState("");

  const [activating, setActivating] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    const restoreTerminal = async () => {
      const savedCredential = loadKdsSession();

      if (!savedCredential) {
        setCheckingSession(false);
        return;
      }

      try {
        const verified =
          await verifyKdsTerminal(savedCredential);

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
      const verified =
        await verifyKdsTerminal(credential);

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
      <div className="mb-4 flex justify-end">
        <CashierButton
          variant="secondary"
          size="sm"
          onClick={handleDeactivate}
        >
          <LogOut
            className="h-4 w-4"
            aria-hidden="true"
          />
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
    <div className="flex min-h-screen items-center justify-center bg-[#f8f4ef] p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-lg">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Monitor
            className="h-6 w-6"
            aria-hidden="true"
          />
        </div>

        <h1 className="font-['Fraunces'] text-2xl font-bold text-foreground">
          Activate Kitchen Terminal
        </h1>

        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Enter the terminal ID and private device secret
          provided by an RRJ manager.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="kds-terminal-id"
              className="text-[10px] font-black uppercase tracking-wider text-muted-foreground"
            >
              Terminal ID
            </label>

            <input
              id="kds-terminal-id"
              value={terminalId}
              disabled={activating}
              autoComplete="off"
              onChange={(event) =>
                onTerminalIdChange(event.target.value)
              }
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2.5 font-mono text-xs outline-none focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="kds-terminal-secret"
              className="text-[10px] font-black uppercase tracking-wider text-muted-foreground"
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
                onChange={(event) =>
                  onTerminalSecretChange(
                    event.target.value,
                  )
                }
                placeholder="kds_••••••••••••••••••••"
                className="w-full rounded-lg border border-border bg-input-background py-2.5 pl-10 pr-3 font-mono text-xs outline-none focus:border-primary"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          <CashierButton
            className="w-full justify-center"
            loading={activating}
            disabled={
              activating ||
              !terminalId.trim() ||
              !terminalSecret.trim()
            }
            onClick={onActivate}
          >
            <ChefHat
              className="h-4 w-4"
              aria-hidden="true"
            />
            Activate Kitchen Terminal
          </CashierButton>
        </div>

        <p className="mt-5 text-[10px] leading-4 text-muted-foreground">
          Kitchen staff do not need individual accounts.
          This credential identifies the authorized kitchen
          terminal itself.
        </p>
      </div>
    </div>
  );
}

function KitchenTerminalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f4ef]">
      <div className="text-center">
        <ChefHat className="mx-auto h-7 w-7 animate-pulse text-primary" />

        <p className="mt-3 text-xs font-bold text-foreground">
          Checking kitchen terminal…
        </p>
      </div>
    </div>
  );
}