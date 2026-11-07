import { createRoot } from "react-dom/client";
import {
  StockOverviewCard,
  StockOverviewFilters,
} from "../../src/modules/manager/inventory/InventoryPage";
import { InventoryBatchList } from "../../src/modules/manager/inventory/InventoryBatchList";
import { StockMovementList } from "../../src/modules/manager/inventory/StockMovementList";
import type {
  ManagerInventoryStock,
  ManagerStockMovement,
} from "../../src/modules/manager/inventory/inventoryApi";
import "../../src/styles/index.css";

const base: ManagerInventoryStock = {
  id: "00000000-0000-0000-0000-000000000001",
  itemName: "Marinated Chicken - Paa with a deliberately long inventory name",
  category: "Ready-to-Cook",
  unit: "pcs",
  physicalQuantity: 15,
  usableQuantity: 10,
  expiredQuantity: 5,
  reorderLevel: 5,
  isActive: true,
  batchConsumptionEnabled: true,
  expiryRequired: true,
  rotationPolicy: "fefo",
  nearestUseBy: "2026-10-06",
  updatedAt: "2026-10-05T00:00:00Z",
};
const stocks = [
  base,
  {
    ...base,
    id: "2",
    itemName: "Marinated Chicken - Pecho",
    physicalQuantity: 5,
    usableQuantity: 0,
    expiredQuantity: 5,
    nearestUseBy: null,
  },
  {
    ...base,
    id: "3",
    itemName: "Fried Chicken - Quarter Leg",
    physicalQuantity: 0,
    usableQuantity: 0,
    expiredQuantity: 0,
    nearestUseBy: null,
  },
];
const movements: ManagerStockMovement[] = [
  {
    id: "1",
    inventoryItemId: base.id,
    itemName: base.itemName,
    unit: "pcs",
    transactionType: "receiving",
    quantityChange: 20,
    quantityBefore: 0,
    quantityAfter: 20,
    reason: null,
    referenceLabel: "RR-1",
    batches: [{ batchCode: "A", quantity: 20 }],
    performedByName: "Manager",
    createdAt: "2026-10-05T00:00:00Z",
  },
  {
    id: "2",
    inventoryItemId: base.id,
    itemName: base.itemName,
    unit: "pcs",
    transactionType: "issuance",
    quantityChange: -15,
    quantityBefore: 20,
    quantityAfter: 5,
    reason: null,
    referenceLabel: "SALE-1",
    batches: [
      { batchCode: "A", quantity: 12 },
      { batchCode: "B", quantity: 3 },
    ],
    performedByName: "System",
    createdAt: "2026-10-05T01:00:00Z",
  },
];

const mobile = new URLSearchParams(window.location.search).has("mobile");
createRoot(document.getElementById("root")!).render(
  <main
    className="mx-auto max-w-7xl space-y-5 p-3 sm:p-5"
    style={mobile ? { width: 390, marginLeft: 0, marginRight: 0 } : undefined}
  >
    <h1 className="text-xl font-bold">Manager inventory fixture</h1>
    <p id="fixture-dimensions" className="text-xs" />
    <StockOverviewFilters
      search=""
      onSearch={() => undefined}
      category=""
      onCategory={() => undefined}
      categories={["Ready-to-Cook"]}
      filter="all"
      onFilter={() => undefined}
    />
    <section
      aria-label="Stock cards"
      className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3"
    >
      {stocks.map((stock) => (
        <StockOverviewCard
          key={stock.id}
          stock={stock}
          onOpen={() => undefined}
        />
      ))}
    </section>
    <InventoryBatchList
      detail={{
        stock: base,
        batches: [
          {
            id: "a",
            batchCode: "A",
            quantityOnHand: 12,
            receivedAt: "2026-10-01T00:00:00Z",
            useByDate: "2026-10-04",
            status: "expired",
          },
          {
            id: "b",
            batchCode: "B",
            quantityOnHand: 8,
            receivedAt: "2026-10-03T00:00:00Z",
            useByDate: "2026-10-10",
            status: "current",
          },
        ],
      }}
    />
    <StockMovementList rows={movements} />
  </main>,
);

requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    document.body.dataset.viewportWidth = String(window.innerWidth);
    document.body.dataset.documentWidth = String(
      document.documentElement.scrollWidth,
    );
    const main = document.querySelector("main")!;
    document.getElementById("fixture-dimensions")!.textContent =
      `Viewport ${window.innerWidth}; panel ${main.clientWidth}; content ${main.scrollWidth}`;
  }),
);
