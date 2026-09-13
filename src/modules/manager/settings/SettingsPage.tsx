import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { KeyRound, MonitorCog, ShieldAlert } from "lucide-react";
import { Button } from "../../../components/common/Button";

interface ProvisionedKdsTerminal {
  terminal_id: string;
  terminal_name: string;
  terminal_secret: string;
}

export function SettingsPage() {
  const [terminalName, setTerminalName] = useState("RRJ Kitchen KDS 1");

  const [provisionedTerminal, setProvisionedTerminal] =
    useState<ProvisionedKdsTerminal | null>(null);

  const [provisioning, setProvisioning] = useState(false);

  const [kdsError, setKdsError] = useState("");

  const handleProvisionKds = async () => {
    const name = terminalName.trim();

    if (!name) {
      setKdsError("Terminal name is required.");
      return;
    }

    setProvisioning(true);
    setKdsError("");
    setProvisionedTerminal(null);

    try {
      const { data, error } = await supabase.rpc("provision_kds_terminal", {
        p_terminal_name: name,
      });

      if (error) {
        throw new Error(error.message);
      }

      const terminal = (data as ProvisionedKdsTerminal[] | null)?.[0];

      if (!terminal) {
        throw new Error(
          "The terminal was created, but no credential was returned.",
        );
      }

      setProvisionedTerminal(terminal);
    } catch (caught) {
      setKdsError(
        caught instanceof Error
          ? caught.message
          : "Unable to provision the KDS terminal.",
      );
    } finally {
      setProvisioning(false);
    }
  };

  const handleCopySecret = async () => {
    if (!provisionedTerminal) return;

    try {
      await navigator.clipboard.writeText(provisionedTerminal.terminal_secret);
    } catch {
      setKdsError(
        "Unable to copy automatically. Please copy the secret manually.",
      );
    }
  };

  return (
    <div className="manager-terminal-page max-w-3xl">
      <header className="manager-page-header mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
          <MonitorCog className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">
            Terminal Management
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Provision and manage authorized kitchen display terminals.
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_8px_22px_rgba(67,42,23,0.035)]">
        <div className="mb-3 flex items-start gap-3 border-b border-border pb-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">
              Provision a kitchen terminal
            </p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
              Kitchen staff use this device credential instead of individual
              staff accounts.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="kds-terminal-name"
              className="text-xs font-semibold text-foreground"
            >
              Terminal Name
            </label>

            <input
              id="kds-terminal-name"
              value={terminalName}
              maxLength={80}
              disabled={provisioning}
              onChange={(event) => setTerminalName(event.target.value)}
              className="min-h-10 rounded-lg border border-border bg-input-background px-3 text-sm focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={provisioning}
            onClick={handleProvisionKds}
          >
            {provisioning ? "Provisioning..." : "Provision Kitchen Terminal"}
          </Button>
        </div>

        {kdsError ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {kdsError}
          </div>
        ) : null}

        {provisionedTerminal ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
              <div>
                <p className="text-xs font-bold text-amber-900">
                  Terminal provisioned — copy the secret now
                </p>
                <p className="mt-0.5 text-[10px] leading-4 text-amber-800">
                  The database stores only its hash. This plaintext credential
                  will not be available again.
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <div className="rounded-lg border border-amber-200/80 bg-white/65 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-amber-800">
                  Terminal
                </p>
                <p className="mt-1 text-xs font-semibold text-foreground">
                  {provisionedTerminal.terminal_name}
                </p>
              </div>

              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-amber-800">
                  Device Secret
                </p>
                <div className="mt-1 break-all rounded-lg border border-amber-200 bg-white p-2.5 font-mono text-[10px] text-foreground">
                  {provisionedTerminal.terminal_secret}
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button variant="primary" size="sm" onClick={handleCopySecret}>
                Copy Device Secret
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
