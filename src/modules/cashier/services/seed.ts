import {
  CASHIER_ID,
  CASHIER_NAME,
  CASHIER_STATE_VERSION,
  CASHIER_TERMINAL,
  DEFAULT_DELAY_THRESHOLD_MINUTES,
} from "../constants";

import type { CashierState } from "../types";

export function createInitialCashierState(): CashierState {
  return {
    version: CASHIER_STATE_VERSION,

    cashier: {
      id: CASHIER_ID,
      name: CASHIER_NAME,
      terminal: CASHIER_TERMINAL,
    },

    delayedThresholdMinutes:
      DEFAULT_DELAY_THRESHOLD_MINUTES,

    /*
     * Temporary local menu catalog.
     *
     * Operational order/payment/delivery data must not be
     * seeded here. The menu can later move to PostgreSQL
     * when the Menu Management module becomes database-backed.
     */
    menuItems: [
      {
        id: "MENU-01",
        code: "B1",
        name: "Crispy Beef Tadyang",
        aliases: [
          "Tadyang",
          "Beef ribs",
          "Crispy beef",
        ],
        category: "Viands",
        description:
          "Crispy beef ribs with garlic and spices",
        price: 185,
        available: true,
        preparationMinutes: 18,
        inventoryRemaining: 14,
      },
      {
        id: "MENU-02",
        code: "A1",
        name: "Adobong Manok",
        aliases: [
          "Adobo",
          "Chicken adobo",
          "Manok",
        ],
        category: "Viands",
        description:
          "Classic chicken adobo",
        price: 120,
        available: true,
        preparationMinutes: 14,
        inventoryRemaining: 22,
      },
      {
        id: "MENU-03",
        code: "S1",
        name: "Sinigang na Baka",
        aliases: [
          "Sinigang",
          "Beef soup",
          "Baka soup",
        ],
        category: "Soups",
        description:
          "Tamarind beef soup with vegetables",
        price: 155,
        available: true,
        preparationMinutes: 16,
        inventoryRemaining: 8,
      },
      {
        id: "MENU-04",
        code: "B2",
        name: "Chicken Bicol Express",
        aliases: [
          "Bicol express",
          "Spicy chicken",
        ],
        category: "Viands",
        description:
          "Spicy chicken in coconut milk",
        price: 130,
        available: false,
        preparationMinutes: 15,
        inventoryRemaining: 0,
      },
      {
        id: "MENU-05",
        code: "K1",
        name: "Kare-Kare",
        aliases: [
          "Kare kare",
          "Peanut stew",
        ],
        category: "Viands",
        description:
          "Peanut stew with vegetables",
        price: 175,
        available: true,
        preparationMinutes: 20,
        inventoryRemaining: 5,
      },
      {
        id: "MENU-06",
        code: "V1",
        name: "Pinakbet",
        aliases: [
          "Pakbet",
          "Mixed vegetables",
        ],
        category: "Vegetables",
        description:
          "Mixed vegetables in shrimp paste",
        price: 110,
        available: true,
        preparationMinutes: 12,
        inventoryRemaining: 9,
      },
      {
        id: "MENU-07",
        code: "R2",
        name: "Fried Rice",
        aliases: [
          "Sinangag",
          "Garlic rice",
        ],
        category: "Rice",
        description:
          "Garlic fried rice",
        price: 45,
        available: true,
        preparationMinutes: 8,
        inventoryRemaining: 18,
      },
      {
        id: "MENU-08",
        code: "R1",
        name: "White Rice",
        aliases: [
          "Plain rice",
          "Steamed rice",
          "Kanin",
        ],
        category: "Rice",
        description:
          "Steamed white rice",
        price: 35,
        available: true,
        preparationMinutes: 4,
        inventoryRemaining: 6,
      },
      {
        id: "MENU-09",
        code: "D1",
        name: "Softdrinks",
        aliases: [
          "Soda",
          "Coke",
          "Royal",
          "Sprite",
        ],
        category: "Beverages",
        description:
          "Coke, Royal, or Sprite",
        price: 30,
        available: true,
        preparationMinutes: 2,
        inventoryRemaining: 24,
      },
      {
        id: "MENU-10",
        code: "D2",
        name: "Buko Juice",
        aliases: [
          "Coconut juice",
          "Buko",
        ],
        category: "Beverages",
        description:
          "Fresh coconut juice",
        price: 35,
        available: true,
        preparationMinutes: 3,
        inventoryRemaining: 4,
      },
    ],

    /*
     * No fake operational data.
     *
     * Real online orders are loaded from PostgreSQL.
     * These arrays begin empty instead of creating ORD-20xx,
     * PAY-91xx, demo riders, fake shifts, etc.
     */
    orders: [],
    payments: [],
    transactions: [],
    shifts: [],
    riders: [],
    notifications: [],
    activities: [],
    heldOrders: [],
  };
}