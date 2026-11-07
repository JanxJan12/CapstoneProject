import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const stage2Test = import.meta.env.VITE_STAGE2_TEST_MODE === "true";

if (stage2Test && (
  import.meta.env.VITE_DEMO_MODE === "true" ||
  supabaseUrl !== "http://127.0.0.1:49321"
)) {
  throw new Error("Stage 2 testing requires its dedicated loopback Supabase stack.");
}

if (
  import.meta.env.VITE_DEMO_MODE === "true" &&
  !/^http:\/\/127\.0\.0\.1:(61321|62321|63321)$/.test(supabaseUrl ?? "")
) {
  throw new Error("Defense demo mode requires the isolated loopback Supabase stack.");
}

if (!supabaseUrl) {
  throw new Error(
    "VITE_SUPABASE_URL is missing from .env.local.",
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    stage2Test
      ? "Stage 2 testing requires a local publishable or anon key."
      : "VITE_SUPABASE_PUBLISHABLE_KEY is missing from .env.local.",
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
);
