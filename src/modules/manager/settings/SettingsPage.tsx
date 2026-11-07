import { useEffect, useRef, useState } from "react";
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
  const [nameError, setNameError] = useState("");
  const [kdsError, setKdsError] = useState("");
  const [outcomeUncertain, setOutcomeUncertain] = useState(false);
  const [copiedField, setCopiedField] = useState<"id" | "secret" | null>(null);
  const [copyError, setCopyError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const submitting = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const hadCredentials = useRef(false);

  useEffect(() => {
    if (provisionedTerminal) {
      hadCredentials.current = true;
      resultHeading.current?.focus();
    } else if (hadCredentials.current) {
      hadCredentials.current = false;
      nameInput.current?.focus();
    }
  }, [provisionedTerminal]);

  const handleProvisionKds = async () => {
    if (submitting.current || provisionedTerminal || outcomeUncertain) return;

    const name = terminalName.trim();

    if (!name) {
      setNameError("Enter a terminal name before provisioning.");
      nameInput.current?.focus();
      return;
    }

    submitting.current = true;
    setProvisioning(true);
    setNameError("");
    setKdsError("");

    try {
      const { data, error } = await supabase.rpc("provision_kds_terminal", {
        p_terminal_name: name,
      });

      if (error) {
        throw new Error(error.message);
      }

      const terminal = Array.isArray(data)
        ? (data[0] as Partial<ProvisionedKdsTerminal> | undefined)
        : undefined;
      if (
        !terminal ||
        typeof terminal.terminal_id !== "string" ||
        !terminal.terminal_id ||
        typeof terminal.terminal_name !== "string" ||
        !terminal.terminal_name ||
        typeof terminal.terminal_secret !== "string" ||
        !terminal.terminal_secret
      ) {
        throw new Error("Provisioning response was incomplete.");
      }

      setProvisionedTerminal({
        terminal_id: terminal.terminal_id,
        terminal_name: terminal.terminal_name,
        terminal_secret: terminal.terminal_secret,
      });
      setAcknowledged(false);
      setCopiedField(null);
      setCopyError("");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message.toLowerCase() : "";
      if (
        message.includes("authentication is required") ||
        message.includes("only an active manager")
      ) {
        setKdsError(
          "Active Manager access is required to provision a kitchen terminal.",
        );
      } else if (message.includes("terminal name is required")) {
        setNameError("Enter a terminal name before provisioning.");
        nameInput.current?.focus();
      } else if (message.includes("terminal name must be 80")) {
        setNameError("Use a terminal name of 80 characters or fewer.");
        nameInput.current?.focus();
      } else {
        setOutcomeUncertain(true);
        setKdsError(
          "Provisioning could not be confirmed. Check whether this terminal was created before starting another request. The one-time secret cannot be recovered from this page.",
        );
      }
    } finally {
      submitting.current = false;
      setProvisioning(false);
    }
  };

  const handleCopy = async (field: "id" | "secret") => {
    if (!provisionedTerminal) return;

    const value =
      field === "id"
        ? provisionedTerminal.terminal_id
        : provisionedTerminal.terminal_secret;
    setCopiedField(null);
    setCopyError("");
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    } catch {
      setCopyError(
        `Unable to copy the ${field === "id" ? "terminal ID" : "device secret"} automatically. Select the value above and copy it manually.`,
      );
    }
  };

  const closeCredentials = () => {
    if (!acknowledged || !provisionedTerminal) return;
    setProvisionedTerminal(null);
    setTerminalName("");
    setCopiedField(null);
    setCopyError("");
    setAcknowledged(false);
  };

  return (
    <div className="manager-terminal-page min-w-0 max-w-3xl">
      <header className="manager-page-header mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
          <MonitorCog className="h-4 w-4" />
        </div>
        <div>
          <p className="manager-page-context">Business Management / Settings</p>
          <h1 className="text-base font-bold text-foreground">
            Terminal Management
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Provision and manage authorized kitchen display terminals.
          </p>
        </div>
      </header>

      <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_8px_22px_rgba(67,42,23,0.035)]">
        <div className="mb-3 flex items-start gap-3 border-b border-border pb-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
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
          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor="kds-terminal-name"
              className="text-xs font-semibold text-foreground"
            >
              Terminal name{" "}
              <span aria-hidden="true" className="text-red-600">
                *
              </span>
            </label>

            <input
              ref={nameInput}
              id="kds-terminal-name"
              value={terminalName}
              maxLength={80}
              required
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "kds-name-error" : "kds-name-help"}
              disabled={
                provisioning || Boolean(provisionedTerminal) || outcomeUncertain
              }
              onChange={(event) => {
                setTerminalName(event.target.value);
                setNameError("");
              }}
              className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-input-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
            {nameError ? (
              <p
                id="kds-name-error"
                className="text-xs font-semibold text-red-700"
              >
                {nameError}
              </p>
            ) : (
              <p id="kds-name-help" className="text-xs text-muted-foreground">
                Required. Up to 80 characters; the name identifies this kitchen
                device.
              </p>
            )}
          </div>

          <Button
            variant="primary"
            size="sm"
            className="min-h-11 w-full sm:w-auto"
            disabled={
              provisioning || Boolean(provisionedTerminal) || outcomeUncertain
            }
            loading={provisioning}
            onClick={handleProvisionKds}
          >
            {provisioning ? "Provisioning…" : "Provision Kitchen Terminal"}
          </Button>
        </div>

        {provisioning ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Provisioning the kitchen terminal. Keep this page open for the
            one-time credential.
          </p>
        ) : null}

        {kdsError ? (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
          >
            <p className="font-semibold">
              {outcomeUncertain
                ? "Provisioning outcome unknown"
                : "Unable to provision terminal"}
            </p>
            <p className="mt-1">{kdsError}</p>
          </div>
        ) : null}

        {provisionedTerminal ? (
          <section
            aria-label="New kitchen terminal credentials"
            className="mt-4 min-w-0 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
              <div className="min-w-0">
                <div role="status">
                  <h2
                    ref={resultHeading}
                    tabIndex={-1}
                    className="text-sm font-bold text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Kitchen terminal provisioned
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-amber-900">
                  Save the terminal ID and device secret securely before leaving
                  this page. The database stores only the secret hash; this
                  plaintext secret is shown only in this response.
                </p>
              </div>
            </div>

            <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-amber-200/80 bg-white/65 px-3 py-2.5 sm:col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Terminal name
                </dt>
                <dd className="mt-1 break-words text-sm font-semibold text-foreground">
                  {provisionedTerminal.terminal_name}
                </dd>
              </div>

              <div className="min-w-0 rounded-lg border border-amber-200 bg-white px-3 py-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Terminal ID · identifier
                </dt>
                <dd className="mt-1 select-text break-all font-mono text-xs text-foreground">
                  {provisionedTerminal.terminal_id}
                </dd>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2 min-h-11 w-full"
                  onClick={() => void handleCopy("id")}
                >
                  Copy Terminal ID
                </Button>
              </div>

              <div className="min-w-0 rounded-lg border border-amber-200 bg-white px-3 py-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Device secret · credential
                </dt>
                <dd className="mt-1 select-text break-all font-mono text-xs text-foreground">
                  {provisionedTerminal.terminal_secret}
                </dd>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-2 min-h-11 w-full"
                  onClick={() => void handleCopy("secret")}
                >
                  Copy Device Secret
                </Button>
              </div>
            </dl>

            {copiedField ? (
              <p
                role="status"
                className="mt-3 text-xs font-semibold text-green-800"
              >
                {copiedField === "id" ? "Terminal ID" : "Device secret"} copied.
                Paste it only into a secure destination.
              </p>
            ) : null}
            {copyError ? (
              <p
                role="alert"
                className="mt-3 text-xs font-semibold text-red-800"
              >
                {copyError}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-amber-900">
              Your clipboard may retain a copied value after you leave this
              page.
            </p>

            <div className="mt-4 border-t border-amber-200 pt-3">
              <label className="flex items-start gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary focus-visible:ring-2 focus-visible:ring-primary"
                />
                <span>
                  I have saved the terminal ID and device secret securely.
                  Closing this view removes the displayed secret.
                </span>
              </label>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 min-h-11 w-full sm:w-auto"
                disabled={!acknowledged}
                onClick={closeCredentials}
              >
                Close Credentials
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
