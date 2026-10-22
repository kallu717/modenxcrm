"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startSession } from "@/lib/sync";
import Masthead from "./Masthead";

// Asks the server who is signed in and loads their data. This only decides
// what to draw: the server checks the session and the role on every request,
// so hiding a screen here is a convenience, not the protection.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/login";
  const [status, setStatus] = useState<"loading" | "in" | "out" | "error">("loading");

  useEffect(() => {
    if (onLogin) return;
    let cancelled = false;
    startSession()
      .then((ok) => {
        if (cancelled) return;
        setStatus(ok ? "in" : "out");
        if (!ok) router.replace("/login");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [onLogin, router]);

  if (onLogin) return <>{children}</>;
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            Couldn&apos;t reach the ModenX server.
          </p>
          <button
            type="button"
            className="mt-3 px-3 py-1.5 rounded-md text-[13px] border"
            style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (status !== "in") return null;

  return (
    <>
      <Masthead />
      <div className="max-w-[1320px] w-full mx-auto px-[18px] pb-[60px] flex-1">{children}</div>
    </>
  );
}
