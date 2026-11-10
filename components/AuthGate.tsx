"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { signOut, startSession } from "@/lib/sync";
import Masthead from "./Masthead";

// Signed in with Microsoft, but no admin has given this person a role yet.
function WaitingForAccess() {
  const [email, setEmail] = useState("");
  useEffect(() => {
    api.me().then((me) => setEmail(me.email), () => {});
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-xl p-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--grid)", boxShadow: "var(--shadow-lg)" }}
      >
        <h1 className="text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
          Waiting for access
        </h1>
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--muted)" }}>
          {email ? <>You&apos;re signed in as <b style={{ color: "var(--ink)" }}>{email}</b>. </> : null}
          An admin needs to give you a role before you can use bdCRM for ModenX. Ask them to open Settings and assign
          you one, then check again.
        </p>
        <div className="mt-5 flex gap-2 justify-center">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[13px] font-medium text-white"
            style={{ background: "var(--accent)" }}
            onClick={() => window.location.reload()}
          >
            Check again
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[13px] border"
            style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// Asks the server who is signed in and loads their data. This only decides
// what to draw: the server checks the session and the role on every request,
// so hiding a screen here is a convenience, not the protection.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/login";
  const [status, setStatus] = useState<"loading" | "in" | "out" | "pending" | "error">("loading");

  useEffect(() => {
    if (onLogin) return;
    let cancelled = false;
    startSession()
      .then((result) => {
        if (cancelled) return;
        setStatus(result);
        if (result === "out") router.replace("/login");
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
  if (status === "pending") return <WaitingForAccess />;
  if (status !== "in") return null;

  return (
    <>
      <Masthead />
      <div className="max-w-[1320px] w-full mx-auto px-[18px] pb-[60px] flex-1">{children}</div>
    </>
  );
}
