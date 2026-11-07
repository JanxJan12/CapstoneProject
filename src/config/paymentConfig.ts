const isDefenseDemo = import.meta.env.VITE_DEMO_MODE === "true";

const gcashMerchantNumber = isDefenseDemo
  ? "NO REAL ACCOUNT"
  : import.meta.env.VITE_GCASH_MERCHANT_NUMBER?.trim() ?? "";

const gcashMerchantName = isDefenseDemo
  ? "DEFENSE DEMO — DO NOT PAY"
  : import.meta.env.VITE_GCASH_MERCHANT_NAME?.trim() ?? "";

export const gcashMerchantConfig = {
  isDemo: isDefenseDemo,
  number: gcashMerchantNumber,
  name: gcashMerchantName,
  isConfigured:
    isDefenseDemo ||
    (/^09\d{9}$/.test(gcashMerchantNumber) &&
      gcashMerchantName.length > 0),
} as const;
