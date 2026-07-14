import { Button } from "../../../components/common/Button";

export function SettingsPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-base font-bold text-foreground mb-4">Settings</h1>
      {[
        { section: "Store Information", fields: [{ label: "Store Name", value: "RRJ Food-House" }, { label: "Contact", value: "09171234567" }, { label: "Address", value: "123 Main St., Manila" }] },
        { section: "Operating Hours", fields: [{ label: "Opening", value: "07:00 AM" }, { label: "Closing", value: "09:00 PM" }] }
      ].map((g) => (
        <div key={g.section} className="bg-card rounded-xl border border-border p-5 mb-4">
          <p className="text-xs font-bold text-foreground mb-3">{g.section}</p>
          <div className="flex flex-col gap-3">
            {g.fields.map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                <input defaultValue={f.value} className="px-3 py-2 text-xs bg-input-background border border-border rounded-lg focus:outline-none" />
              </div>
            ))}
          </div>
          <div className="mt-4"><Button variant="primary" size="sm">Save Changes</Button></div>
        </div>
      ))}
    </div>
  );
}
