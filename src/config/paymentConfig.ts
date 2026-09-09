const gcashMerchantNumber =
  import.meta.env.VITE_GCASH_MERCHANT_NUMBER?.trim() ?? "";

const gcashMerchantName =
  import.meta.env.VITE_GCASH_MERCHANT_NAME?.trim() ?? "";

export const gcashMerchantConfig = {
  number: gcashMerchantNumber,
  name: gcashMerchantName,
  isConfigured:
    /^09\d{9}$/.test(gcashMerchantNumber) &&
    gcashMerchantName.length > 0,
} as const;
