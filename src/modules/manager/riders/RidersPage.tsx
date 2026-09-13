import { useCallback, useEffect, useState } from "react";
import { Bike, CheckCircle, RefreshCw, Truck } from "lucide-react";

import { Badge, StatusBadge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { StatCard } from "../../../components/common/StatCard";
import { Table, Td } from "../../../components/common/Table";
import {
  getManagerRiders,
  type ManagerRider,
  type ManagerRiderApprovalStatus,
} from "../api/managerPhase2Api";

const APPROVAL_BADGES: Record<
  ManagerRiderApprovalStatus,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  approved: { label: "Approved", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  rejected: { label: "Rejected", variant: "danger" },
  suspended: { label: "Suspended", variant: "danger" },
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load manager riders.";
}

const activityDateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

export function RidersPage() {
  const [riders, setRiders] = useState<ManagerRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRiders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setRiders(await getManagerRiders());
    } catch (loadError) {
      setRiders([]);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRiders();
  }, [loadRiders]);

  const availableCount = riders.filter(
    (rider) =>
      rider.isActive &&
      rider.approvalStatus === "approved" &&
      rider.availabilityStatus === "available",
  ).length;
  const onDeliveryCount = riders.filter(
    (rider) =>
      rider.isActive &&
      rider.approvalStatus === "approved" &&
      rider.availabilityStatus === "on_delivery",
  ).length;

  return (
    <div className="manager-riders">
      <header className="manager-page-header mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground">Riders</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Read-only rider approvals, availability, and completed deliveries
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadRiders()}
          loading={loading}
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </header>

      <div className="manager-rider-metrics mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Riders"
          value={String(riders.length)}
          icon={Bike}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Available"
          value={String(availableCount)}
          icon={CheckCircle}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          label="On Delivery"
          value={String(onDeliveryCount)}
          icon={Truck}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <Table
        headers={[
          "Rider",
          "Current Status",
          "Delivery Activity",
          "Vehicle & Credentials",
        ]}
      >
        {loading ? (
          <tr>
            <td
              colSpan={4}
              className="px-4 py-8 text-center text-xs text-muted-foreground"
            >
              Loading riders…
            </td>
          </tr>
        ) : riders.length === 0 ? (
          <tr>
            <td
              colSpan={4}
              className="px-4 py-8 text-center text-xs text-muted-foreground"
            >
              No rider profiles were returned by PostgreSQL.
            </td>
          </tr>
        ) : (
          riders.map((rider) => {
            const approvalBadge = APPROVAL_BADGES[rider.approvalStatus];
            const motor = [rider.motorBrand, rider.motorModel]
              .filter(Boolean)
              .join(" ");
            const hasVehicleDetails = Boolean(
              rider.plateNumber || motor || rider.driverLicenseNumber,
            );

            return (
              <tr key={rider.id} className="hover:bg-muted/30">
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-[10px] font-bold text-primary">
                        {rider.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{rider.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {rider.contactNumber ?? "Contact not recorded"}
                      </p>
                      {!rider.isActive ? (
                        <p className="mt-0.5 text-[9px] font-bold uppercase text-red-600">
                          Inactive account
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-col items-start gap-1.5">
                    <StatusBadge status={rider.availabilityStatus} />
                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                      <span>Approval</span>
                      <Badge variant={approvalBadge.variant}>
                        {approvalBadge.label}
                      </Badge>
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className="flex items-baseline gap-4">
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {rider.deliveriesToday.toLocaleString("en-PH")}
                      </p>
                      <p className="text-[9px] text-muted-foreground">Today</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {rider.totalDeliveries.toLocaleString("en-PH")}
                      </p>
                      <p className="text-[9px] text-muted-foreground">Total</p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[9px] text-muted-foreground">
                    {rider.lastAssignedAt
                      ? `Last assigned ${activityDateTimeFormatter.format(
                          new Date(rider.lastAssignedAt),
                        )}`
                      : "No assignment recorded"}
                  </p>
                </Td>
                <Td className="text-[10px]">
                  {hasVehicleDetails ? (
                    <div className="space-y-0.5 text-muted-foreground">
                      {rider.plateNumber ? (
                        <p>
                          <span className="font-semibold text-foreground">
                            Plate
                          </span>{" "}
                          {rider.plateNumber}
                        </p>
                      ) : null}
                      {motor ? <p>{motor}</p> : null}
                      {rider.driverLicenseNumber ? (
                        <p className="font-mono">
                          License {rider.driverLicenseNumber}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-muted-foreground/70">
                      No vehicle or license details recorded
                    </p>
                  )}
                </Td>
              </tr>
            );
          })
        )}
      </Table>
    </div>
  );
}
