"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import Masthead from "./Masthead";

// Client-side redirect only — a placeholder for the real Entra ID session
// check, which will live server-side in Phase 2.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authReady = useStore((s) => s.authReady);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const hydrateAuth = useStore((s) => s.hydrateAuth);
  const onLogin = pathname === "/login";

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated && !onLogin) router.replace("/login");
    if (isAuthenticated && onLogin) router.replace("/pipeline");
  }, [authReady, isAuthenticated, onLogin, router]);

  if (!authReady) return null;
  if (onLogin) return <>{children}</>;
  if (!isAuthenticated) return null;

  return (
    <>
      <Masthead />
      <div className="max-w-[1320px] w-full mx-auto px-[18px] pb-[60px] flex-1">{children}</div>
    </>
  );
}
