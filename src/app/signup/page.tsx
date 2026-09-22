"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Google-only auth: there is no separate signup. */
export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-neutral-500">Redirecting…</p>
    </main>
  );
}
