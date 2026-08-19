import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "../../../components/common/Button";

interface ProvisionedKdsTerminal {
  terminal_id: string;
  terminal_name: string;
  terminal_secret: string;
}

const SETTINGS_GROUPS = [
  {
    section: "Store Information",
    fields: [
      {
        label: "Store Name",
        value: "RRJ Food-House",
      },
      {
        label: "Contact",
        value: "09171234567",
      },
      {
        label: "Address",
        value: "123 Main St., Manila",
      },
    ],
  },
  {
    section: "Operating Hours",
    fields: [
      {
        label: "Opening",
        value: "07:00 AM",
      },
      {
        label: "Closing",
        value: "09:00 PM",
      },
    ],
  },
];

export function SettingsPage() {
  const [terminalName, setTerminalName] =
    useState("RRJ Kitchen KDS 1");

  const [provisionedTerminal, setProvisionedTerminal] =
    useState<ProvisionedKdsTerminal | null>(null);

  const [provisioning, setProvisioning] =
    useState(false);

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
      const { data, error } = await supabase.rpc(
        "provision_kds_terminal",
        {
          p_terminal_name: name,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      const terminal = (
        data as ProvisionedKdsTerminal[] | null
      )?.[0];

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
      await navigator.clipboard.writeText(
        provisionedTerminal.terminal_secret,
      );
    } catch {
      setKdsError(
        "Unable to copy automatically. Please copy the secret manually.",
      );
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-base font-bold text-foreground">
        Settings
      </h1>

      {SETTINGS_GROUPS.map((group) => (
        <div
          key={group.section}
          className="mb-4 rounded-xl border border-border bg-card p-5"
        >
          <p className="mb-3 text-xs font-bold text-foreground">
            {group.section}
          </p>

          <div className="flex flex-col gap-3">
            {group.fields.map((field) => (
              <div
                key={field.label}
                className="flex flex-col gap-1"
              >
                <label className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </label>

                <input
                  defaultValue={field.value}
                  className="rounded-lg border border-border bg-input-background px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Button variant="primary" size="sm">
              Save Changes
            </Button>
          </div>
        </div>
      ))}

      <div className="mb-4 rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <p className="text-xs font-bold text-foreground">
            Kitchen Display System
          </p>

          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            Provision a credential for an authorized RRJ kitchen
            terminal. Kitchen staff will use the terminal without
            individual staff accounts.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="kds-terminal-name"
            className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground"
          >
            Terminal Name
          </label>

          <input
            id="kds-terminal-name"
            value={terminalName}
            maxLength={80}
            disabled={provisioning}
            onChange={(event) =>
              setTerminalName(event.target.value)
            }
            className="rounded-lg border border-border bg-input-background px-3 py-2 text-xs focus:outline-none"
          />
        </div>

        {kdsError ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {kdsError}
          </div>
        ) : null}

        {provisionedTerminal ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold text-amber-900">
              Terminal provisioned
            </p>

            <p className="mt-1 text-[10px] leading-4 text-amber-800">
              Copy this secret now. The database stores only its
              hash, so this plaintext credential will not be
              available again.
            </p>

            <div className="mt-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-amber-800">
                Terminal
              </p>

              <p className="mt-1 text-xs font-semibold text-foreground">
                {provisionedTerminal.terminal_name}
              </p>
            </div>

            <div className="mt-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-amber-800">
                Device Secret
              </p>

              <div className="mt-1 break-all rounded-lg border border-amber-200 bg-white p-3 font-mono text-[10px] text-foreground">
                {provisionedTerminal.terminal_secret}
              </div>
            </div>

            <div className="mt-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopySecret}
              >
                Copy Device Secret
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <Button
            variant="primary"
            size="sm"
            disabled={provisioning}
            onClick={handleProvisionKds}
          >
            {provisioning
              ? "Provisioning..."
              : "Provision Kitchen Terminal"}
          </Button>
        </div>
      </div>
    </div>
  );
}