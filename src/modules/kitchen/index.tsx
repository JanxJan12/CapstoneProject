import { ChefHat } from "lucide-react";
import { AppShell }      from "../../components/layout/AppShell";
import type { NavGroup } from "../../types";
import { KitchenQueue }  from "./queue/KitchenQueue";

const NAV_GROUPS: NavGroup<"queue">[] = [
  {
    label: "Kitchen",
    items: [{ id: "queue", label: "Kitchen Queue", icon: ChefHat }],
  },
];

export function KitchenApp() {
  return (
    <AppShell
      groups={NAV_GROUPS}
      active="queue"
      onSelect={() => {}}
      user={{ name: "Ana Cruz", role: "Kitchen Staff" }}
    >
      <KitchenQueue />
    </AppShell>
  );
}
