"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error")) {
      setError("Sign-in didn’t complete. Please try again.");
    }
  }, []);

  const signInWithGoogle = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // On success the browser redirects to Google; no further action here.
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Countdown Timer Platform</h1>
        <p className="mt-1 text-sm text-neutral-400">Sign in to run your timed programs.</p>
      </header>
      <Card>
        <div className="flex flex-col gap-4">
          <Button variant="primary" onClick={signInWithGoogle} disabled={busy}>
            {busy ? "Redirecting…" : "Continue with Google"}
          </Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <p className="text-center text-xs text-neutral-500">
            We only use your Google account for sign-in. No password to remember.
          </p>
        </div>
      </Card>
    </main>
  );
}
