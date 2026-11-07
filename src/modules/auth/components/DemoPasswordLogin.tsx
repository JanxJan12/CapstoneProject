import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export function DemoPasswordLogin({ mode = "defense" }: { mode?: "defense" | "stage2" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setError(mode === "stage2" ? "Stage 2 sign-in failed. Check the private account card." : "Demo sign-in failed. Check the local account card.");
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto mb-4 flex w-full max-w-[25rem] flex-col gap-2 rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm">
      <p className="font-bold text-amber-950">{mode === "stage2" ? "Local Stage 2 test sign-in" : "Local defense demo sign-in"}</p>
      <p className="text-xs text-amber-900">{mode === "stage2" ? "Use the private Stage 2 account card. This sign-in is available only in the isolated test build." : "Use the private role account card. This sign-in is available only in the isolated demo build."}</p>
      <label htmlFor="demo-email">{mode === "stage2" ? "Test email" : "Demo email"}</label>
      <input id="demo-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-10 rounded border px-3" />
      <label htmlFor="demo-password">{mode === "stage2" ? "Test password" : "Demo password"}</label>
      <input id="demo-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-10 rounded border px-3" />
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-10 rounded bg-amber-900 px-4 font-bold text-white disabled:opacity-50">{busy ? "Signing in…" : mode === "stage2" ? "Sign in to test" : "Sign in to demo"}</button>
    </form>
  );
}
