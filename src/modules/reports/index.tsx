import { AppShell } from "../../components/layout/AppShell";
import { DesktopFrame } from "../../components/layout/DesktopFrame";
import { FrameRow } from "../../components/layout/FrameRow";
import { PageHeader } from "../../components/layout/PageHeader";
import { SectionDivider } from "../../components/navigation/SectionDivider";
import { MANAGER_GROUPS } from "../../constants";
import { ReportsPage } from "../manager/reports/ReportsPage";

const W = 920;
const H = 580;

const reportTypes = [
  { label: "Sales Report", tag: "reports / sales", desc: "Revenue, order count, average order value, and top-selling items." },
  { label: "Inventory Report", tag: "reports / inventory", desc: "Stock levels, reorder alerts, and consumption trends." },
  { label: "Order Report", tag: "reports / orders", desc: "Order volume, status breakdown, and delivery performance." },
  { label: "Waste & Spoilage Report", tag: "reports / waste", desc: "Recorded waste and spoilage transactions with item and quantity." },
  { label: "Purchase Order Report", tag: "reports / purchase-orders", desc: "PO history, supplier totals, and receiving log." },
];

export function ReportsBlueprintPage() {
  return (
    <div>
      <PageHeader num="07" title="Reports" subtitle="Operational reporting views for the Manager — filterable, searchable, and exportable." count="5" />
      {reportTypes.map((r) => (
        <div key={r.tag}>
          <SectionDivider label={r.label} desc={r.desc} />
          <FrameRow>
            <DesktopFrame title={r.label} tag={r.tag} w={W} h={H}>
              <AppShell groups={MANAGER_GROUPS} active="reports" onSelect={() => {}} user={{ name: "Maria Reyes", role: "Manager" }}>
                <ReportsPage />
              </AppShell>
            </DesktopFrame>
          </FrameRow>
        </div>
      ))}
    </div>
  );
}
