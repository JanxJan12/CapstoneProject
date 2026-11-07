import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { gcashMerchantConfig } from "@/config/paymentConfig";
import { useAuth } from "@/app/providers/AuthProvider";
import { ArrowLeft, Upload, Check, Loader2, User, BadgeCheck, ChevronRight, MapPin } from "lucide-react";
import { CustNav } from "./customerNav";
import { customerLineKey, customerUnitPrice, customerMealChoiceName, customerDrinkChoiceNames } from "./customerCatalog";
import { formatCustomerCurrency } from "./customerRecordedCharges";
import { getPaymentProofExtension } from "./customerPaymentProof";
import { customerMoneyCents } from "./customerFinancialDisplay";
import { normalizeCustomerGcashReference } from "./customerPaymentInput";
import { currentCustomerQuote, customerQuoteDisplayStatus, customerQuoteStatusCopy, customerQuotedAmountRows, parseCustomerOrderQuote, type CustomerOrderQuote } from "./customerQuoteState";
import { customerErrorMessage } from "./customerBatch1";
import { CUSTOMER_RESUME_PAGE_STORAGE_KEY } from "./customerStorageKeys";
import { CUSTOMER_DELIVERY_RETRY_STORAGE_KEY, readCustomerDeliveryRetry, clearCustomerDeliveryRetry, markCustomerDeliveryRetryResponseUnknown, getOrCreateCustomerOrderRequestId, clearCustomerOrderRequestId, CustomerCheckoutFeedbackError, type StoredCustomerDeliveryRetry } from "./customerCheckoutRecovery";
import type { SubmittedCustomerPayment } from "./customerPaymentSubmission";
import type { CartItem } from "./customerTypes";
import type { CustomerPage } from "./customerPageTypes";

interface CheckoutCustomerProfile {
  first_name: string | null;
  last_name: string | null;
  contact_number: string | null;
}

interface PlacedCustomerOrder {
  order_id: string;
  order_number: string;
  subtotal: number;
  delivery_fee: number;
  grand_total: number;
  current_status: string;
}

interface PendingCustomerPaymentSubmission {
  order: PlacedCustomerOrder;
  requestId: string;
  proofImagePath?: string;
}

function parsePlacedCustomerOrder(value: unknown): PlacedCustomerOrder {
  if (!value || typeof value !== "object") {
    throw new Error(
      "The server returned invalid order information.",
    );
  }

  const row = value as Record<string, unknown>;
  const subtotal = Number(row.subtotal);
  const deliveryFee = Number(row.delivery_fee);
  const grandTotal = Number(row.grand_total);
  const hasNumericTotals = [
    row.subtotal,
    row.delivery_fee,
    row.grand_total,
  ].every(
    (amount) =>
      (typeof amount === "number" ||
        (typeof amount === "string" && amount.trim().length > 0)),
  );

  if (
    typeof row.order_id !== "string" ||
    row.order_id.trim().length === 0 ||
    typeof row.order_number !== "string" ||
    row.order_number.trim().length === 0 ||
    typeof row.current_status !== "string" ||
    row.current_status.trim().length === 0 ||
    !hasNumericTotals ||
    !Number.isFinite(subtotal) ||
    subtotal < 0 ||
    !Number.isFinite(deliveryFee) ||
    deliveryFee < 0 ||
    !Number.isFinite(grandTotal) ||
    grandTotal < 0
  ) {
    throw new Error(
      "The server returned incomplete order information.",
    );
  }

  return {
    order_id: row.order_id,
    order_number: row.order_number,
    subtotal,
    delivery_fee: deliveryFee,
    grand_total: grandTotal,
    current_status: row.current_status,
  };
}

function CustomerQuotedBreakdown({ quote, variant }: {
  quote: CustomerOrderQuote;
  variant: "panel" | "summary";
}) {
  return (
    <dl className={`space-y-2 text-sm ${variant === "panel" ? "text-emerald-950" : "text-foreground"}`}>
      {customerQuotedAmountRows(quote).map((row) => (
        <div key={row.key} className={`flex items-start justify-between gap-3 ${row.key === "total"
          ? `border-t pt-2 ${variant === "panel" ? "border-emerald-300 text-lg" : "border-border text-base"}`
          : ""}`}>
          <dt className={`min-w-0 ${row.key === "total" ? "font-extrabold" : ""}`}>{row.label}</dt>
          <dd className={`shrink-0 text-right tabular-nums ${row.key === "total" ? "font-black" : "font-bold"}`}>
            {row.sign}{formatCustomerCurrency(row.amount)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── Checkout ─────────────────────────────────────────────────────
export function CheckoutPage({
  cart,
  cartValidationPending,
  cartValidationError,
  onNav,
  onTrackOrder,
  onOrderSubmitted,
}: {
  cart: CartItem[];
  cartValidationPending: boolean;
  cartValidationError: string | null;
  onNav: (page: CustomerPage) => void;
  onTrackOrder: (orderId: string) => void;
  onOrderSubmitted: (orderId: string) => void;
}) {
  const { session } = useAuth();

  const subtotal = cart.reduce(
    (sum, cartItem) =>
      sum + customerUnitPrice(cartItem) * cartItem.qty,
    0,
  );

  const [step, setStep] =
    useState<"login" | "details" | "upload">(
      "login",
    );

  const [googleLoading, setGoogleLoading] =
    useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const [fullName, setFullName] =
  useState("");

  const [contactNumber, setContactNumber] =
  useState("");

  const [deliveryAddress, setDeliveryAddress] =
  useState("");

  const [landmark, setLandmark] =
  useState("");

  const [profileLoading, setProfileLoading] =
  useState(false);

  const [deliveryError, setDeliveryError] =
  useState<string | null>(null);

  const [placingOrder, setPlacingOrder] =
  useState(false);
  const [requestingQuote, setRequestingQuote] = useState(false);
  const [orderQuote, setOrderQuote] = useState<CustomerOrderQuote | null>(null);
  const [failedQuoteFingerprint, setFailedQuoteFingerprint] = useState<string | null>(null);
  const [quoteClock, setQuoteClock] = useState(() => Date.now());
  const [existingOrderToReview, setExistingOrderToReview] = useState<string | null>(null);

const [placeOrderError, setPlaceOrderError] =
  useState<string | null>(null);

const [placedOrder, setPlacedOrder] =
  useState<PlacedCustomerOrder | null>(
    null,
  );

  const [
    pendingPaymentSubmission,
    setPendingPaymentSubmission,
  ] = useState<PendingCustomerPaymentSubmission | null>(
    null,
  );

  const [
    gcashReferenceNumber,
    setGcashReferenceNumber,
  ] = useState("");

  const [
    gcashReferenceError,
    setGcashReferenceError,
  ] = useState<string | null>(null);

  const [paymentProof, setPaymentProof] =
  useState<File | null>(null);

  const [paymentProofError, setPaymentProofError] =
  useState<string | null>(null);

  const paymentProofInputRef =
  useRef<HTMLInputElement | null>(null);

  const orderCreationInFlightRef = useRef(false);
  const checkoutCustomerIdRef = useRef<string | null>(null);
  const latestQuoteFingerprintRef = useRef("");

  const isCustomerSignedIn =
    session?.role === "customer";

  const currentQuoteFingerprint = JSON.stringify({
    customerId: checkoutCustomerIdRef.current,
    customerName: fullName.trim(), contactNumber: contactNumber.trim(),
    deliveryAddress: deliveryAddress.trim(), landmark: landmark.trim(),
    items: cart.map((item) => ({ id: item.id, qty: item.qty,
      modifier_ids: item.modifierIds,
      display_unit_price: customerUnitPrice(item),
      ...(item.mealOption ? { meal_option: item.mealOption } : {})
    })),
  });
  latestQuoteFingerprintRef.current = currentQuoteFingerprint;
  const currentOrderQuote = currentCustomerQuote(orderQuote, currentQuoteFingerprint,
    quoteClock, isCustomerSignedIn);

  useEffect(() => { setExistingOrderToReview(null); }, [currentQuoteFingerprint]);

  useEffect(() => {
    if (!orderQuote) return;
    const remaining = Date.parse(orderQuote.expires_at) - Date.now();
    const timer = window.setTimeout(() => setQuoteClock(Date.now()), Math.max(0, remaining + 1));
    return () => window.clearTimeout(timer);
  }, [orderQuote]);

  useEffect(() => {
    if (step !== "details" || !isCustomerSignedIn || profileLoading ||
        !fullName.trim() || !/^09\d{9}$/.test(contactNumber.trim()) ||
        !deliveryAddress.trim() || !gcashMerchantConfig.isConfigured ||
        cartValidationPending || cartValidationError || cart.length === 0 ||
        placingOrder || pendingPaymentSubmission?.order || existingOrderToReview ||
        currentOrderQuote || failedQuoteFingerprint === currentQuoteFingerprint) {
      setRequestingQuote(false);
      return;
    }

    let active = true;
    const fingerprint = currentQuoteFingerprint;
    setRequestingQuote(true);
    const timer = window.setTimeout(async () => {
      const rpcItems = cart.map((item) => ({
        id: item.id, qty: item.qty, modifier_ids: item.modifierIds,
        ...(item.mealOption ? { meal_option: item.mealOption } : {}),
      }));
      const requestFingerprint = JSON.stringify({
        customerName: fullName.trim(), contactNumber: contactNumber.trim(),
        deliveryAddress: deliveryAddress.trim(), landmark: landmark.trim(),
        items: [...rpcItems].sort((a, b) =>
          customerLineKey(a.id, a.modifier_ids, a.meal_option).localeCompare(customerLineKey(b.id, b.modifier_ids, b.meal_option))),
      });
      const requestId = getOrCreateCustomerOrderRequestId(requestFingerprint);
      try {
        const { data, error } = await supabase.rpc("quote_customer_order", {
          p_customer_name: fullName.trim(), p_contact_number: contactNumber.trim(),
          p_delivery_address: deliveryAddress.trim(), p_landmark: landmark.trim() || null,
          p_items: rpcItems, p_request_id: requestId,
        });
        if (error) throw error;
        const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
        const quote = parseCustomerOrderQuote(row, fingerprint, requestId);
        if (!active || latestQuoteFingerprintRef.current !== fingerprint) return;
        setQuoteClock(Date.now());
        setOrderQuote(quote);
        setFailedQuoteFingerprint(null);
      } catch (error) {
        if (!active || latestQuoteFingerprintRef.current !== fingerprint) return;
        console.error("Unable to calculate customer quote:", error);
        setFailedQuoteFingerprint(fingerprint);
      } finally {
        if (active && latestQuoteFingerprintRef.current === fingerprint) setRequestingQuote(false);
      }
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [step, isCustomerSignedIn, profileLoading, currentQuoteFingerprint, quoteClock,
    cartValidationPending, cartValidationError, placingOrder, pendingPaymentSubmission,
    existingOrderToReview, currentOrderQuote, failedQuoteFingerprint]);

useEffect(() => {
  if (!isCustomerSignedIn) {
    return;
  }

  let isMounted = true;

  async function loadCheckoutCustomer() {
    setProfileLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!isMounted) {
      return;
    }

    if (userError || !user) {
      console.error(
        "Unable to load checkout user:",
        userError?.message,
      );

      setProfileLoading(false);
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        `
          first_name,
          last_name,
          contact_number
        `,
      )
      .eq("id", user.id)
      .single<CheckoutCustomerProfile>();

    if (!isMounted) {
      return;
    }

    if (profileError) {
      console.error(
        "Unable to load checkout profile:",
        profileError.message,
      );
    }

    const profileName = [
      profile?.first_name,
      profile?.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const googleName =
      typeof user.user_metadata?.full_name ===
      "string"
        ? user.user_metadata.full_name
        : "";

    checkoutCustomerIdRef.current = user.id;
    const retryDraft = readCustomerDeliveryRetry(user.id);
    setFullName(
      retryDraft?.fullName || profileName ||
        googleName ||
        user.email?.split("@")[0] ||
        "",
    );

    setContactNumber(
      retryDraft?.contactNumber ?? profile?.contact_number ?? "",
    );
    if (retryDraft) {
      setDeliveryAddress(retryDraft.deliveryAddress);
      setLandmark(retryDraft.landmark);
      if (retryDraft.responseUnknown) {
        setDeliveryError("We could not confirm the server response. Your order may already exist. Check your connection, then retry here with the saved details to continue the same order.");
      }
    }

    setProfileLoading(false);
    setStep("details");
  }

  void loadCheckoutCustomer();

  return () => {
    isMounted = false;
  };
}, [isCustomerSignedIn]);

  const handleCheckoutGoogleLogin = async () => {
    if (googleLoading) {
      return;
    }

    setGoogleLoading(true);
    setGoogleError(null);

    /*
     * Remember that the customer was checking out.
     * The cart itself is already preserved separately.
     */
    sessionStorage.setItem(
      CUSTOMER_RESUME_PAGE_STORAGE_KEY,
      "checkout",
    );

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            `${window.location.origin}/customer`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

    if (error) {
      console.error(
        "Checkout Google sign-in failed:",
        error.message,
      );

      sessionStorage.removeItem(
        CUSTOMER_RESUME_PAGE_STORAGE_KEY,
      );

      setGoogleLoading(false);

      setGoogleError(customerErrorMessage(error, "auth"));
    }
  };

  const handleContinueToPayment = async () => {
  if (placingOrder || requestingQuote || orderCreationInFlightRef.current) {
    return;
  }

  const cleanName = fullName.trim();
  const cleanContact = contactNumber.trim();
  const cleanAddress = deliveryAddress.trim();

  if (!cleanName) {
    setDeliveryError(
      "Please enter your full name.",
    );
    return;
  }

  if (!cleanContact) {
    setDeliveryError(
      "Please enter your contact number.",
    );
    return;
  }

  if (!/^09\d{9}$/.test(cleanContact)) {
    setDeliveryError(
      "Enter an 11-digit Philippine mobile number starting with 09.",
    );
    return;
  }

  if (!cleanAddress) {
    setDeliveryError(
      "Please enter your delivery address.",
    );
    return;
  }

  if (!gcashMerchantConfig.isConfigured) {
    setDeliveryError(
      "GCash payment is temporarily unavailable. Please contact the store.",
    );
    return;
  }

  if (!isCustomerSignedIn) {
    setDeliveryError(
      "Please sign in before creating your order.",
    );
    return;
  }

  if (pendingPaymentSubmission?.order) {
    setDeliveryError(null);
    setStep("upload");
    return;
  }

  if (cartValidationPending || cartValidationError) {
    setDeliveryError(cartValidationError ?? "Checking your saved cart options. Please wait.");
    return;
  }

  if (cart.length === 0) {
    setDeliveryError("Your cart is empty.");
    return;
  }

  if (!currentOrderQuote || Date.parse(currentOrderQuote.expires_at) <= Date.now()) {
    setDeliveryError("Wait for the latest total, then confirm your order.");
    setQuoteClock(Date.now());
    return;
  }

  setDeliveryError(null);
  setExistingOrderToReview(null);
  setPlaceOrderError(null);
  setFailedQuoteFingerprint(null);
  setPlacingOrder(true);
  orderCreationInFlightRef.current = true;

  try {
const rpcItems = cart.map((item) => ({
  id: item.id,
  qty: item.qty,
  modifier_ids: item.modifierIds,
  ...(item.mealOption ? { meal_option: item.mealOption } : {}),
}));

const orderRequestId = currentOrderQuote.requestId;

if (checkoutCustomerIdRef.current) {
  try {
    sessionStorage.setItem(CUSTOMER_DELIVERY_RETRY_STORAGE_KEY, JSON.stringify({
      requestId: orderRequestId,
      customerId: checkoutCustomerIdRef.current,
      fullName: cleanName,
      contactNumber: cleanContact,
      deliveryAddress: cleanAddress,
      landmark: landmark.trim(),
      responseUnknown: false,
    } satisfies StoredCustomerDeliveryRetry));
  } catch {
    // The live form remains usable when browser storage is unavailable.
  }
}

const {
  data: orderData,
  error: orderError,
} = await supabase.rpc(
  "place_customer_order_confirmed",
  {
    p_customer_name: cleanName,
    p_contact_number: cleanContact,
    p_delivery_address: cleanAddress,
    p_landmark:
      landmark.trim() || null,
    p_items: rpcItems,
    p_request_id: currentOrderQuote.requestId,
    p_quote_token: currentOrderQuote.quote_token,
  },
);

if (orderError) {
  console.error("Customer order request failed:", orderError);
  if (/quote is stale|quote is invalid|quote.*expired/i.test(orderError.message)) {
    setOrderQuote(null);
    throw new CustomerCheckoutFeedbackError("The quoted price or choices changed. Review a fresh quote before confirming your order.");
  }
  throw new CustomerCheckoutFeedbackError(
    "We couldn't confirm your order. Review your details and cart, then retry here to check the same order request.",
    /failed to fetch|networkerror|network request failed/i.test(orderError.message),
  );
}

const orderResult =
  Array.isArray(orderData) &&
  orderData.length === 1
    ? orderData[0]
    : null;

if (!orderResult) {
  throw new CustomerCheckoutFeedbackError(
    "The order was submitted but no complete order information was returned.",
  );
}

const createdOrder =
  parsePlacedCustomerOrder(
    orderResult,
  );
if (customerMoneyCents(createdOrder.subtotal) !== customerMoneyCents(currentOrderQuote.subtotal) ||
    customerMoneyCents(createdOrder.delivery_fee) !== customerMoneyCents(currentOrderQuote.delivery_fee) ||
    customerMoneyCents(createdOrder.grand_total) !== customerMoneyCents(currentOrderQuote.grand_total)) {
  setExistingOrderToReview(createdOrder.order_id);
  setDeliveryError(`Order ${createdOrder.order_number} already exists with a different recorded amount. Review that order before continuing.`);
  return;
}

/*
 * The same idempotency request may be replayed after
 * the original order has already moved forward.
 *
 * Never create another order for that same request.
 */
if (
  createdOrder.current_status !==
  "waiting_payment_verification"
) {
  clearCustomerOrderRequestId(
    orderRequestId,
  );
  clearCustomerDeliveryRetry(orderRequestId);

  if (
    createdOrder.current_status === "cancelled" ||
    createdOrder.current_status === "rejected"
  ) {
    throw new CustomerCheckoutFeedbackError(
      `Order ${createdOrder.order_number} already exists but can no longer continue. You may create a new order.`,
    );
  }

  /*
   * The original order already progressed.
   * Treat it as the successful order instead of creating
   * another checkout attempt.
   */
  onOrderSubmitted(
    createdOrder.order_id,
  );
  onTrackOrder(createdOrder.order_id);

  return;
}

setPendingPaymentSubmission({
  order: createdOrder,
  requestId: orderRequestId,
});

setStep("upload");

  } catch (error) {
    console.error("Unable to create customer order:", error);

    const responseUnknown = error instanceof CustomerCheckoutFeedbackError
      ? error.responseUnknown
      : error instanceof Error && /failed to fetch|networkerror|network request failed/i.test(error.message);
    if (responseUnknown) markCustomerDeliveryRetryResponseUnknown();

    setDeliveryError(
      responseUnknown
        ? "We could not confirm the server response. Your order may already exist. Check your connection, then retry here with the saved details to continue the same order."
        : error instanceof CustomerCheckoutFeedbackError
        ? error.message
        : "We couldn't confirm your order. Check your connection, then retry here to check the same order request.",
    );
  } finally {
    orderCreationInFlightRef.current = false;
    setPlacingOrder(false);
  }
};

const handlePaymentProofChange = (
  event: React.ChangeEvent<HTMLInputElement>,
) => {
  if (pendingPaymentSubmission?.proofImagePath) {
    event.target.value = "";
    return;
  }

  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
  ];

  if (!allowedTypes.includes(file.type)) {
    setPaymentProof(null);

    setPaymentProofError(
      "Please select a JPG or PNG image.",
    );

    event.target.value = "";
    return;
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    setPaymentProof(null);

    setPaymentProofError(
      "The payment screenshot must be 5 MB or smaller.",
    );

    event.target.value = "";
    return;
  }

  setPaymentProof(file);
  setPaymentProofError(null);
  setPlaceOrderError(null);
};

const handleRemovePaymentProof = () => {
  if (pendingPaymentSubmission?.proofImagePath) {
    return;
  }

  setPaymentProof(null);
  setPaymentProofError(null);
  setPlaceOrderError(null);

  if (paymentProofInputRef.current) {
    paymentProofInputRef.current.value = "";
  }
};

const handlePlaceOrder = async () => {
  if (placingOrder || placedOrder) {
    return;
  }

  setPlaceOrderError(null);

  const existingSubmission = pendingPaymentSubmission;

  if (!existingSubmission?.order) {
    setPlaceOrderError(
      "Create your order before submitting a GCash payment.",
    );
    return;
  }

  if (!isCustomerSignedIn) {
    setPlaceOrderError(
      `Order ${existingSubmission.order.order_number} exists, but your signed-in customer account could not be confirmed. Please sign in and retry this payment submission.`,
    );
    return;
  }

  const { value: normalizedReference, error: referenceError } =
    normalizeCustomerGcashReference(gcashReferenceNumber);

  if (referenceError) {
    setGcashReferenceError(referenceError);
    return;
  }

  setGcashReferenceError(null);

  if (
    !paymentProof &&
    !pendingPaymentSubmission?.proofImagePath
  ) {
    setPaymentProofError(
      "Please select your GCash payment screenshot.",
    );
    return;
  }

  setPaymentProofError(null);

  setPlacingOrder(true);

  try {
    let submission = existingSubmission;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new CustomerCheckoutFeedbackError(
        `Order ${submission.order.order_number} was created, but your signed-in customer account could not be confirmed. Please sign in and retry this payment submission.`,
      );
    }

    let proofImagePath =
      submission.proofImagePath;

    if (!proofImagePath) {
      if (!paymentProof) {
        throw new CustomerCheckoutFeedbackError(
          `Order ${submission.order.order_number} was created. Select your payment screenshot, then retry the payment submission.`,
        );
      }

      const proofExtension =
        getPaymentProofExtension(paymentProof);

      proofImagePath = [
        user.id,
        submission.order.order_id,
        `${crypto.randomUUID()}.${proofExtension}`,
      ].join("/");

      const { error: uploadError } =
        await supabase.storage
          .from("payment-proofs")
          .upload(
            proofImagePath,
            paymentProof,
            {
              cacheControl: "3600",
              contentType: paymentProof.type,
              upsert: false,
            },
          );

      if (uploadError) {
        console.error("Customer payment proof upload failed:", uploadError);
        throw new CustomerCheckoutFeedbackError(
          `Order ${submission.order.order_number} was created, but its payment screenshot could not be uploaded. Check your connection, then retry with the same order.`,
        );
      }

      submission = {
        ...submission,
        proofImagePath,
      };

      setPendingPaymentSubmission(submission);
    }

    const {
      data: paymentData,
      error: paymentError,
    } = await supabase.rpc(
      "submit_customer_payment",
      {
        p_order_id:
          submission.order.order_id,
        p_gcash_reference_number:
          normalizedReference,
        p_proof_image_path:
          proofImagePath,
      },
    );

    if (paymentError) {
      console.error("Customer payment submission failed:", paymentError);
      throw new CustomerCheckoutFeedbackError(
        `Order ${submission.order.order_number} and its screenshot were saved, but we couldn't confirm the payment submission. Retry to check the same order.`,
      );
    }

    const paymentResult =
      Array.isArray(paymentData) &&
      paymentData.length > 0
        ? paymentData[0] as SubmittedCustomerPayment
        : null;

    if (
      !paymentResult ||
      !paymentResult.payment_id ||
      paymentResult.order_id !==
        submission.order.order_id ||
      paymentResult.payment_method !== "gcash" ||
      paymentResult.status !== "pending" ||
      paymentResult.gcash_reference_number.trim().toLowerCase() !==
        normalizedReference.toLowerCase() ||
      paymentResult.proof_image_path !==
        proofImagePath ||
      !paymentResult.created_at ||
      Number(paymentResult.amount) !==
        submission.order.grand_total
    ) {
      throw new CustomerCheckoutFeedbackError(
        `Order ${submission.order.order_number} was created, but the server returned an invalid payment confirmation. Retry to confirm the same order payment.`,
      );
    }

  clearCustomerOrderRequestId(
    submission.requestId,
  );
  clearCustomerDeliveryRetry(submission.requestId);

  setPlacedOrder(
    submission.order,
  );

  setPendingPaymentSubmission(
    null,
  );

  onOrderSubmitted(
    submission.order.order_id,
  );
  } catch (error) {
    console.error(
      "Unable to complete customer payment submission:",
      error,
    );

    setPlaceOrderError(
      error instanceof CustomerCheckoutFeedbackError
        ? error.message
        : `Order ${existingSubmission.order.order_number} was created, but we couldn't confirm its payment submission. Check your connection and retry with the same order.`,
    );
  } finally {
    setPlacingOrder(false);
  }
};

const confirmedCheckoutOrder =
  placedOrder ?? pendingPaymentSubmission?.order ?? null;
const confirmedSubtotalCents = customerMoneyCents(confirmedCheckoutOrder?.subtotal);
const confirmedFeeCents = customerMoneyCents(confirmedCheckoutOrder?.delivery_fee);
const confirmedCheckoutBreakdown = confirmedSubtotalCents !== null && confirmedFeeCents !== null &&
  confirmedSubtotalCents + confirmedFeeCents === customerMoneyCents(confirmedCheckoutOrder?.grand_total);
const quoteDisplayStatus = customerQuoteDisplayStatus({
  confirmed: Boolean(confirmedCheckoutOrder), requesting: requestingQuote,
  currentQuote: currentOrderQuote, previousQuote: orderQuote,
  quoteFailed: failedQuoteFingerprint === currentQuoteFingerprint,
  now: quoteClock,
});
const quoteStatusCopy = customerQuoteStatusCopy[quoteDisplayStatus];

return (
  <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="checkout" />
      <div className="customer-storefront customer-checkout-screen flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
          <button onClick={() => onNav("cart")} className="mb-4 flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to cart</button>
          <div className="mb-5 sm:mb-7">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Delivery and payment</h1>
            {gcashMerchantConfig.isDemo ? <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground">Enter fictional delivery details and submit a synthetic payment claim. Do not send money.</p> : null}
          </div>

          {/* Steps */}
          <div role="group" aria-label="Checkout progress" className="customer-checkout-progress mb-5 grid grid-cols-3 sm:mb-7">
            {[{ key: "login", label: "Sign In" }, { key: "details", label: "Delivery" }, { key: "upload", label: "Payment" }].map((s, i) => (
              <div key={s.key} aria-current={step === s.key ? "step" : undefined} className={`flex min-h-12 min-w-0 items-center justify-center gap-1 px-1 text-xs font-semibold min-[360px]:gap-2 min-[360px]:px-2 sm:text-sm ${step === s.key ? "text-primary" : i < ["login","details","upload"].indexOf(step) ? "text-emerald-700" : "text-muted-foreground"}`}>
                <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-black ${step === s.key ? "bg-white/15 text-white" : i < ["login","details","upload"].indexOf(step) ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{i < ["login","details","upload"].indexOf(step) ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                <span className="min-w-0 break-words text-center leading-tight">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="customer-checkout-layout grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)] lg:items-start">
            <div className="customer-checkout-flow min-w-0">
              {step === "login" && (
                <section className="rounded-2xl border border-border bg-card p-5  sm:p-6">
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-primary"><User className="h-5 w-5" /></span>
                  <h2 className="text-xl font-extrabold text-foreground">Sign in to continue</h2>
                  {profileLoading && isCustomerSignedIn ? (
                    <div role="status" className="flex min-h-24 items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 text-sm font-bold text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading your saved details…
                    </div>
                  ) : (
                    <button type="button" onClick={handleCheckoutGoogleLogin} disabled={googleLoading} className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-bold shadow-sm hover:bg-muted/60 disabled:cursor-wait disabled:opacity-70">
                      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      {googleLoading ? "Connecting to Google…" : "Continue with Google"}
                    </button>
                  )}
                  {googleError ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{googleError}</p> : null}
                </section>
              )}
              {step === "details" && (
                <section className="rounded-2xl border border-border bg-card p-5  sm:p-6">
                  <div className="mb-5 flex items-start gap-3 border-b border-border pb-4">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-amber-50 text-primary"><MapPin className="h-5 w-5" /></span>
                    <div><h2 className="text-xl font-extrabold text-foreground">Delivery details</h2></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Full Name */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="checkout-full-name"
                        className="text-sm font-bold text-foreground"
                      >
                        Full name <span className="text-primary" aria-hidden="true">*</span>
                      </label>

                      <input
                        id="checkout-full-name"
                        type="text"
                        value={fullName}
                        onChange={(event) => { setFullName(event.target.value); setDeliveryError(null); }}
                        aria-required="true"
                        aria-invalid={deliveryError === "Please enter your full name."}
                        aria-describedby={deliveryError === "Please enter your full name." ? "checkout-delivery-error" : undefined}
                        placeholder={
                          profileLoading
                            ? "Loading customer name..."
                            : "Enter your full name"
                        }
                        disabled={profileLoading}
                        autoComplete="name"
                        className="min-h-12 rounded-xl border border-border bg-input-background px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 disabled:cursor-wait disabled:opacity-60"
                      />
                    </div>

                    {/* Contact Number */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="checkout-contact-number"
                        className="text-sm font-bold text-foreground"
                      >
                        Contact number <span className="text-primary" aria-hidden="true">*</span>
                      </label>

                      <input
                        id="checkout-contact-number"
                        type="tel"
                        value={contactNumber}
                        onChange={(event) => { setContactNumber(event.target.value); setDeliveryError(null); }}
                        aria-required="true"
                        aria-invalid={deliveryError === "Please enter your contact number." || deliveryError?.startsWith("Enter an 11-digit")}
                        aria-describedby={deliveryError === "Please enter your contact number." || deliveryError?.startsWith("Enter an 11-digit") ? "checkout-delivery-error" : undefined}
                        placeholder={
                          profileLoading
                            ? "Loading contact number..."
                            : "09XXXXXXXXX"
                        }
                        disabled={profileLoading}
                        autoComplete="tel"
                        inputMode="tel"
                        className="min-h-12 rounded-xl border border-border bg-input-background px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 disabled:cursor-wait disabled:opacity-60"
                      />
                    </div>

                    {/* Delivery Address */}
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label
                        htmlFor="checkout-delivery-address"
                        className="text-sm font-bold text-foreground"
                      >
                        Delivery address <span className="text-primary" aria-hidden="true">*</span>
                      </label>

                      <input
                        id="checkout-delivery-address"
                        type="text"
                        value={deliveryAddress}
                        onChange={(event) => { setDeliveryAddress(event.target.value); setDeliveryError(null); }}
                        aria-required="true"
                        aria-invalid={deliveryError === "Please enter your delivery address."}
                        aria-describedby={deliveryError === "Please enter your delivery address." ? "checkout-delivery-error" : undefined}
                        placeholder="House no., street, barangay, city"
                        autoComplete="street-address"
                        className="min-h-12 rounded-xl border border-border bg-input-background px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
                      />
                    </div>

                    {/* Landmark */}
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label
                        htmlFor="checkout-landmark"
                        className="text-sm font-bold text-foreground"
                      >
                        Landmark
                        <span className="ml-1 font-normal text-muted-foreground">
                          (Optional)
                        </span>
                      </label>

                      <input
                        id="checkout-landmark"
                        type="text"
                        value={landmark}
                        onChange={(event) =>
                          setLandmark(event.target.value)
                        }
                        placeholder="e.g. Near Jollibee, blue gate"
                        className="min-h-12 rounded-xl border border-border bg-input-background px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
                      />
                    </div>
                  </div>
                  {deliveryError && (
  <div id="checkout-delivery-error" role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
    <p className="text-sm font-semibold leading-5 text-red-700">
      {deliveryError}
    </p>
  </div>
)}

{!pendingPaymentSubmission?.order && (cartValidationPending || cartValidationError) ? (
  <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
    {cartValidationError ?? "Checking your saved cart options…"}
    {cartValidationError ? (
      <button type="button" onClick={() => onNav("cart")} className="ml-2 underline">
        Review cart
      </button>
    ) : null}
  </div>
) : null}

{existingOrderToReview ? (
  <button type="button" onClick={() => onTrackOrder(existingOrderToReview)}
    className="mt-3 min-h-11 rounded-xl border border-amber-300 px-4 text-sm font-bold text-amber-950 underline">
    View existing order
  </button>
) : null}

                </section>  
              )}
              {step === "upload" && placedOrder && (
                <section
                  aria-labelledby="order-confirmation-heading"
                  className="overflow-hidden rounded-2xl border border-emerald-200 bg-card "
                >
                  <div className="bg-emerald-50 p-5 sm:p-6">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Check className="h-6 w-6" />
                    </span>
                    <h2
                      id="order-confirmation-heading"
                      className="mt-4 text-2xl font-extrabold text-emerald-900"
                    >
                      {gcashMerchantConfig.isDemo ? "Demo payment claim submitted" : "Payment submitted"}
                    </h2>
                    <p className="mt-1.5 max-w-xl text-sm leading-6 text-emerald-800">
                      {gcashMerchantConfig.isDemo ? "Your synthetic proof is waiting for the Cashier’s internal decision. No real money moved." : "Your GCash payment is waiting for cashier verification. You can track this same order for updates."}
                    </p>
                  </div>
                  <div className="p-5 sm:p-6">
                    <dl className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border bg-background px-4 py-3">
                        <dt className="text-xs font-semibold text-muted-foreground">
                          Order number
                        </dt>
                        <dd className="mt-1 break-words font-mono text-base font-black text-foreground">
                          {placedOrder.order_number}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-border bg-background px-4 py-3">
                        <dt className="text-xs font-semibold text-muted-foreground">
                          Service type
                        </dt>
                        <dd className="mt-1 text-base font-extrabold text-foreground">
                          Delivery
                        </dd>
                      </div>
                      <div className="rounded-xl border border-border bg-background px-4 py-3">
                        <dt className="text-xs font-semibold text-muted-foreground">
                          Confirmed total
                        </dt>
                        <dd className="mt-1 text-base font-black text-primary">
                          {formatCustomerCurrency(placedOrder.grand_total)}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => onNav("history")}
                        className="min-h-12 rounded-xl border border-border bg-white px-5 text-sm font-bold text-foreground hover:bg-muted"
                      >
                        View all orders
                      </button>
                      <button
                        type="button"
                        onClick={() => onTrackOrder(placedOrder.order_id)}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:bg-amber-800"
                      >
                        Track this order <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </section>
              )}
              {step === "upload" &&
                !placedOrder &&
                pendingPaymentSubmission?.order &&
                gcashMerchantConfig.isConfigured && (
                <section className="rounded-2xl border border-border bg-card p-5  sm:p-6">
                  <div className="mb-5 flex items-start gap-3 border-b border-border pb-4">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><BadgeCheck className="h-5 w-5" /></span>
                    <div>
                      <h2 className="text-xl font-extrabold text-foreground">{gcashMerchantConfig.isDemo ? "Simulate GCash proof — no payment" : "Pay securely with GCash"}</h2>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{gcashMerchantConfig.isDemo ? "Your sample order is created. Use a fictional DEMO reference and synthetic image; do not send money." : "Your order is created. Pay the confirmed amount, then submit the receipt details below."}</p>
                    </div>
                  </div>

                  <div className="customer-checkout-payment-facts mb-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs font-semibold text-amber-800">Order number</p>
                      <p className="mt-1 font-mono text-lg font-black text-amber-950">{pendingPaymentSubmission.order.order_number}</p>
                    </div>
                    <div className="customer-checkout-payment-amount rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:text-right">
                      <p className="text-xs font-semibold text-emerald-800">Server-confirmed payment amount</p>
                      <p className="mt-1 text-2xl font-black tracking-tight text-emerald-800">{formatCustomerCurrency(pendingPaymentSubmission.order.grand_total)}</p>
                    </div>
                  </div>

                  <div className="customer-checkout-merchant mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <p className="mb-3 text-sm font-extrabold text-emerald-900">{gcashMerchantConfig.isDemo ? "DEMO ONLY — DO NOT PAY" : "Send payment to this merchant"}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="text-xs font-semibold text-emerald-700">Merchant name</p><p className="mt-1 text-base font-extrabold text-foreground">{gcashMerchantConfig.name}</p></div>
                      <div><p className="text-xs font-semibold text-emerald-700">Merchant number</p><p className="mt-1 font-mono text-base font-extrabold text-foreground">{gcashMerchantConfig.number}</p></div>
                    </div>
                    <ol className="mt-4 grid gap-2 border-t border-emerald-200/80 pt-4 text-sm leading-5 text-emerald-900 sm:grid-cols-3">
                      {gcashMerchantConfig.isDemo ? (
                        <>
                          <li className="flex gap-2"><span className="font-black">1.</span><span>Do not send money.</span></li>
                          <li className="flex gap-2"><span className="font-black">2.</span><span>Enter a fictional DEMO reference.</span></li>
                          <li className="flex gap-2"><span className="font-black">3.</span><span>Upload a synthetic image.</span></li>
                        </>
                      ) : (
                        <>
                          <li className="flex gap-2"><span className="font-black">1.</span><span>Send the exact confirmed amount.</span></li>
                          <li className="flex gap-2"><span className="font-black">2.</span><span>Copy the GCash reference number.</span></li>
                          <li className="flex gap-2"><span className="font-black">3.</span><span>Upload a clear receipt screenshot.</span></li>
                        </>
                      )}
                    </ol>
                  </div>

                  <div className="mb-5 flex flex-col gap-1.5">
                    <label
                      htmlFor="checkout-gcash-reference"
                      className="text-sm font-bold text-foreground"
                    >
                      {gcashMerchantConfig.isDemo ? "Fictional DEMO reference" : "GCash reference number"} <span className="text-primary" aria-hidden="true">*</span>
                    </label>

                    <input
                      id="checkout-gcash-reference"
                      type="text"
                      value={gcashReferenceNumber}
                      inputMode="text"
                      autoCapitalize="off"
                      spellCheck={false}
                      aria-required="true"
                      aria-invalid={Boolean(gcashReferenceError)}
                      aria-describedby={gcashReferenceError ? "checkout-reference-error" : "checkout-reference-help"}
                      onChange={(event) => {
                        setGcashReferenceNumber(
                          event.target.value,
                        );
                        setGcashReferenceError(null);
                        setPlaceOrderError(null);
                      }}
                      placeholder={gcashMerchantConfig.isDemo ? "DEMO-<fictional reference>" : "Enter the reference from your GCash receipt"}
                      autoComplete="off"
                      disabled={placingOrder}
                      className="min-h-12 rounded-xl border border-border bg-input-background px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 disabled:cursor-wait disabled:opacity-60"
                    />

                    <p id="checkout-reference-help" className="text-sm text-muted-foreground">Enter the reference shown on your GCash receipt (up to 100 characters).</p>

                    {gcashReferenceError && (
                      <p id="checkout-reference-error" role="alert" className="text-sm font-semibold text-red-700">
                        {gcashReferenceError}
                      </p>
                    )}
                  </div>

                  <div className="mb-5">
                    <div className="mb-2">
                      <p className="text-sm font-bold text-foreground">{gcashMerchantConfig.isDemo ? "Synthetic proof image" : "Payment proof"} <span className="text-primary" aria-hidden="true">*</span></p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{gcashMerchantConfig.isDemo ? "Upload only an invented sample image; no payment was made." : "Upload the screenshot from this GCash payment."}</p>
                    </div>
                    <input
                      ref={paymentProofInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handlePaymentProofChange}
                      disabled={
                        placingOrder ||
                        Boolean(
                          pendingPaymentSubmission?.proofImagePath,
                        )
                      }
                      className="hidden"
                    />

                    {!paymentProof ? (
                      <button
                        type="button"
                        onClick={() =>
                          paymentProofInputRef.current?.click()
                        }
                        disabled={placingOrder}
                        className="flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-background/60 p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.02] disabled:cursor-wait disabled:opacity-60 sm:p-7"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground/50 sm:h-10 sm:w-10" />

                        <div className="text-center">
                          <p className="text-base font-extrabold text-foreground">
                            {gcashMerchantConfig.isDemo ? "Choose synthetic demo image" : "Choose payment screenshot"}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            PNG or JPG, maximum 5 MB
                          </p>
                        </div>
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                            <Check className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-emerald-800">
                              {pendingPaymentSubmission?.proofImagePath
                                ? "Payment screenshot uploaded"
                                : "Payment screenshot selected"}
                            </p>

                            <p className="mt-1 truncate text-sm font-semibold text-foreground">
                              {paymentProof.name}
                            </p>

                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {(paymentProof.size / 1024 / 1024).toFixed(
                                2,
                              )}{" "}
                              MB
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              paymentProofInputRef.current?.click()
                            }
                            disabled={
                              placingOrder ||
                              Boolean(
                                pendingPaymentSubmission?.proofImagePath,
                              )
                            }
                            className="min-h-11 flex-1 rounded-xl border border-border bg-white px-3 text-sm font-bold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Change
                          </button>

                          <button
                            type="button"
                            onClick={handleRemovePaymentProof}
                            disabled={
                              placingOrder ||
                              Boolean(
                                pendingPaymentSubmission?.proofImagePath,
                              )
                            }
                            className="min-h-11 flex-1 rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {paymentProofError && (
                      <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-sm font-semibold leading-5 text-red-700">
                          {paymentProofError}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-bold text-amber-900">Your order is protected during retries</p>
                    <p className="mt-1 text-sm leading-5 text-amber-800">If submission fails, retrying continues with order {pendingPaymentSubmission.order.order_number}; it does not create another order.</p>
                  </div>

                  {placeOrderError && (
  <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
    <p className="text-sm font-bold text-red-800">Payment submission needs attention</p>
    <p className="mt-1 text-sm font-medium leading-5 text-red-700">
      {placeOrderError}
    </p>
  </div>
)}

  <button
    type="button"
    onClick={() => {
      void handlePlaceOrder();
    }}
    disabled={placingOrder}
    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-amber-800 disabled:cursor-wait disabled:opacity-60"
  >
    {placingOrder ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        {pendingPaymentSubmission
          ? "Submitting Payment…"
          : "Creating Order…"}
      </>
    ) : (
      placeOrderError
        ? "Retry Payment Submission"
        : gcashMerchantConfig.isDemo ? "Submit demo payment claim" : "Submit GCash Payment"
    )}
  </button>
                </section>
              )}
              {step === "upload" &&
                !placedOrder &&
                (!pendingPaymentSubmission?.order ||
                  !gcashMerchantConfig.isConfigured) && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-5 sm:p-6">
                    <p className="text-sm font-bold text-red-800">
                      {!gcashMerchantConfig.isConfigured
                        ? "GCash payment is temporarily unavailable. Please contact the store."
                        : "No created order is available for this payment. Return to delivery details and create your order first."}
                    </p>
                  </div>
                )}
            </div>
            {/* Order summary sidebar */}
            <aside className={`customer-checkout-receipt min-w-0 ${step === "details" ? "order-first lg:order-last" : ""}`}>
              <div className="customer-checkout-summary rounded-xl border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-extrabold text-foreground">Order summary</h2>
                  <span role="status" aria-live="polite" aria-label={`Price status: ${quoteStatusCopy.label}`}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${quoteDisplayStatus === "confirmed" || quoteDisplayStatus === "quoted"
                      ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                    {quoteStatusCopy.label}
                  </span>
                </div>
                <div className="space-y-3 text-sm">
                  {cart.map((c) => (
                    <div key={c.lineKey} className="flex justify-between gap-3">
                      <span className="min-w-0 text-muted-foreground"><span className="font-bold text-foreground">{c.qty}×</span> {c.name}{c.mealOption ? <span className="block text-xs">{customerMealChoiceName(c.mealOption)}</span> : null}{c.modifiers.length > 0 ? <span className="block text-xs">{customerDrinkChoiceNames(c.modifiers)}</span> : null}</span>
                      {!confirmedCheckoutOrder && !currentOrderQuote ? (
                        <span className="flex-shrink-0 font-bold text-foreground">{formatCustomerCurrency(customerUnitPrice(c) * c.qty)}</span>
                      ) : null}
                    </div>
                  ))}
                  {confirmedCheckoutOrder ? (
                    <>
                      {confirmedCheckoutBreakdown ? <>
                        <div className="flex justify-between gap-3 border-t border-border pt-3"><span className="text-muted-foreground">Server-confirmed subtotal</span><span className="font-bold text-foreground">{formatCustomerCurrency(confirmedCheckoutOrder.subtotal)}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Server-confirmed delivery fee</span><span className="font-bold text-foreground">{formatCustomerCurrency(confirmedCheckoutOrder.delivery_fee)}</span></div>
                      </> : <p className="border-t border-border pt-3 text-sm text-muted-foreground">Charge breakdown unavailable from this order response.</p>}
                      <div className="flex items-end justify-between gap-3 border-t border-border pt-4"><span className="font-extrabold text-foreground">Server-confirmed total</span><span className="text-2xl font-black tracking-tight text-primary">{formatCustomerCurrency(confirmedCheckoutOrder.grand_total)}</span></div>
                    </>
                  ) : currentOrderQuote ? (
                    <div className="border-t border-border pt-3">
                      <CustomerQuotedBreakdown quote={currentOrderQuote} variant="summary" />
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between gap-3 border-t border-border pt-3"><span className="text-muted-foreground">Items subtotal (estimate)</span><span className="font-bold text-foreground">{formatCustomerCurrency(subtotal)}</span></div>
                      <div className="flex flex-wrap justify-between gap-3"><span className="text-muted-foreground">Delivery fee</span><span className="font-bold text-foreground">Shown before confirmation</span></div>
                      <div className="flex items-end justify-between gap-3 border-t border-border pt-4"><span className="font-extrabold text-foreground">Final total</span><span className="font-black text-primary">Pending server confirmation</span></div>
                    </>
                  )}
                </div>
                {quoteStatusCopy.note && (quoteDisplayStatus === "expired" || quoteDisplayStatus === "changed" || quoteDisplayStatus === "failed") ? (
                  <p className="mt-4 rounded-xl bg-muted/70 px-3 py-2.5 text-sm leading-5 text-muted-foreground">{quoteStatusCopy.note}</p>
                ) : null}
              </div>
              {step === "details" ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (quoteDisplayStatus === "failed") {
                        setFailedQuoteFingerprint(null);
                      } else {
                        void handleContinueToPayment();
                      }
                    }}
                    disabled={placingOrder || requestingQuote || Boolean(existingOrderToReview) ||
                      (!pendingPaymentSubmission?.order && (cartValidationPending || Boolean(cartValidationError) ||
                        (!currentOrderQuote && quoteDisplayStatus !== "failed")))}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-amber-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {(placingOrder || requestingQuote) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {placingOrder ? "Creating Order…"
                      : pendingPaymentSubmission?.order ? "Continue to Payment"
                      : requestingQuote ? "Calculating total…"
                      : currentOrderQuote ? `Confirm order — ${formatCustomerCurrency(currentOrderQuote.grand_total)}`
                      : quoteDisplayStatus === "failed" ? "Retry price calculation"
                      : quoteDisplayStatus === "expired" || quoteDisplayStatus === "changed" ? "Recalculating total…"
                      : "Enter delivery details"}
                  </button>
                  {!pendingPaymentSubmission?.order ? (
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">
                      Confirming creates your order. GCash payment is submitted in the next step.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

