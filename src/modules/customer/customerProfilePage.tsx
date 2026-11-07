import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { CustomerPage } from "./customerPageTypes";
import { BadgeCheck, Check, ChevronRight, ClipboardList, Loader2, User } from "lucide-react";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { customerErrorMessage } from "./customerBatch1";
interface CustomerProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  contact_number: string | null;
  avatar_url: string | null;
}

interface CustomerAccountData {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
}

// ── Profile ───────────────────────────────────────────────────────
export function ProfilePage({
  nav,
  onNav,
}: {
  nav: ReactNode;
  onNav: (page: CustomerPage) => void;
}) {
  const [account, setAccount] =
    useState<CustomerAccountData | null>(null);

  const [phoneInput, setPhoneInput] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [saveMessage, setSaveMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentAccount() {
      setLoading(true);
      setErrorMessage(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (userError || !user) {
        setErrorMessage(customerErrorMessage(userError, "auth"));

        setLoading(false);
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          `
            id,
            first_name,
            last_name,
            contact_number,
            avatar_url
          `,
        )
        .eq("id", user.id)
        .single<CustomerProfileData>();

      if (!isMounted) {
        return;
      }

      if (profileError || !profile) {
        setErrorMessage(customerErrorMessage(profileError, "profile"));

        setLoading(false);
        return;
      }

      const profileName = [
        profile.first_name,
        profile.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const googleName =
        typeof user.user_metadata?.full_name ===
        "string"
          ? user.user_metadata.full_name
          : "";

      const displayName =
        profileName ||
        googleName ||
        user.email?.split("@")[0] ||
        "Customer";

      const googleAvatar =
        typeof user.user_metadata?.avatar_url ===
        "string"
          ? user.user_metadata.avatar_url
          : typeof user.user_metadata?.picture ===
              "string"
            ? user.user_metadata.picture
            : null;

      const savedPhone =
        profile.contact_number ?? "";

      setAccount({
        fullName: displayName,
        email: user.email ?? "",
        phone: savedPhone,
        avatarUrl:
          profile.avatar_url ?? googleAvatar,
      });

      setPhoneInput(savedPhone);
      setLoading(false);
    }

    void loadCurrentAccount();

    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  const handleSavePhone = async () => {
    if (saving) {
      return;
    }

    const cleanPhone =
      phoneInput.trim();

    setSaveError(null);
    setSaveMessage(null);

    if (!cleanPhone) {
      setSaveError(
        "Please enter your contact number.",
      );
      return;
    }

    if (!/^09\d{9}$/.test(cleanPhone)) {
      setSaveError(
        "Enter an 11-digit Philippine mobile number starting with 09.",
      );
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaveError(customerErrorMessage(userError, "auth"));

      setSaving(false);
      return;
    }

    const { error: updateError } =
      await supabase
        .from("profiles")
        .update({
          contact_number: cleanPhone,
        })
        .eq("id", user.id);

    if (updateError) {
      console.error(
        "Unable to update contact number:",
        updateError.message,
      );

      setSaveError(customerErrorMessage(updateError, "profile-save"));

      setSaving(false);
      return;
    }

    setAccount((currentAccount) => {
      if (!currentAccount) {
        return currentAccount;
      }

      return {
        ...currentAccount,
        phone: cleanPhone,
      };
    });

    setPhoneInput(cleanPhone);

    setSaveMessage(
      "Contact number saved successfully.",
    );

    setSaving(false);
  };

  const phoneChanged =
    account !== null &&
    phoneInput.trim() !== account.phone;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {nav}

      <div className="customer-storefront customer-profile-screen flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-5 sm:mb-7">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Profile
            </h1>

          </div>

          <button
            type="button"
            onClick={() => onNav("history")}
            className="customer-profile-orders mb-6 flex min-h-16 w-full items-center gap-3 border-b border-border px-1 text-left text-foreground"
          >
            <ClipboardList aria-hidden="true" className="h-5 w-5 text-primary" />
            <span className="flex-1 font-semibold">Orders</span>
            <ChevronRight aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </button>

          {loading && (
            <div role="status" className="flex min-h-40 items-center justify-center rounded-2xl border border-border bg-card px-5 py-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-primary"><Loader2 className="h-5 w-5 animate-spin" /></span>
                <div>
                  <p className="text-base font-bold text-foreground">Loading your profile…</p>
                </div>
              </div>
            </div>
          )}

          {!loading && errorMessage && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-base font-bold text-red-700">Unable to load profile</p>
              <p className="mt-1 max-w-xl text-sm leading-5 text-red-600">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="mt-4 min-h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && account && (
            <div className="customer-profile-content grid gap-6">
              <aside className="customer-profile-account overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-muted text-foreground sm:h-18 sm:w-18">
                      {account.avatarUrl ? (
                        <ImageWithFallback
                          src={account.avatarUrl}
                          alt={`${account.fullName} profile`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-8 w-8" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-xl font-semibold leading-tight text-foreground sm:text-2xl">{account.fullName}</p>
                      <p className="mt-1 break-all text-sm leading-5 text-muted-foreground">{account.email || "Email unavailable"}</p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-foreground">
                    <BadgeCheck className="h-4 w-4" /> Signed in
                  </div>
                </div>

                <dl className="grid gap-4 border-t border-border p-5 text-sm sm:grid-cols-2 sm:gap-6 sm:p-6">
                  <div>
                    <dt className="text-sm font-semibold text-muted-foreground">Email</dt>
                    <dd className="mt-1 break-all font-bold text-foreground">{account.email || "Not available"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-muted-foreground">Current contact</dt>
                    <dd className="mt-1 font-bold text-foreground">{account.phone || "Not provided"}</dd>
                  </div>
                </dl>
              </aside>

              <section className="customer-profile-contact rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="mb-5 border-b border-border pb-4">
                  <h2 className="text-xl font-bold text-foreground">Contact information</h2>
                </div>

                <div className="flex max-w-xl flex-col gap-1.5">
                  <label htmlFor="profile-phone" className="text-sm font-bold text-foreground">Contact number</label>
                  <div>
                    <input
                      id="profile-phone"
                      type="tel"
                      value={phoneInput}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 11);

                        setPhoneInput(digits);
                        setSaveError(null);
                        setSaveMessage(null);
                      }}
                      placeholder="09XXXXXXXXX"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={11}
                      className="min-h-12 w-full rounded-lg border border-border bg-input-background px-3.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                    />
                  </div>
                  <p className="text-xs leading-4 text-muted-foreground">Use an 11-digit Philippine mobile number starting with 09.</p>
                </div>

                {saveError && (
                  <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-bold text-red-800">Unable to save contact number</p>
                    <p className="mt-1 text-sm font-medium leading-5 text-red-700">{saveError}</p>
                  </div>
                )}

                {saveMessage && (
                  <div role="status" className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-emerald-700" />
                    <p className="text-sm font-bold leading-5 text-emerald-700">{saveMessage}</p>
                  </div>
                )}

                <div className="mt-5 flex justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      void handleSavePhone();
                    }}
                    disabled={saving || !phoneChanged}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save contact number"
                    )}
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

