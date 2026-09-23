"use client";

import { useStore } from "@/lib/store";

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function LoginPage() {
  const login = useStore((s) => s.login);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-xl p-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--grid)", boxShadow: "var(--shadow-lg)" }}
      >
        <div
          className="w-11 h-11 rounded-[10px] mx-auto flex items-center justify-center text-white font-semibold text-lg"
          style={{ background: "var(--accent)" }}
        >
          M
        </div>
        <h1 className="mt-4 text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
          ModenX <span style={{ color: "var(--muted)" }}>Pipeline</span>
        </h1>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>
          Sign in with your ModenX work account to continue.
        </p>

        {/* Placeholder: Phase 2 hands this off to Entra ID via Auth.js. */}
        <button
          type="button"
          onClick={login}
          className="mt-6 w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-md text-[13.5px] font-medium border"
          style={{ borderColor: "var(--rule)", background: "var(--surface)", color: "var(--ink)" }}
        >
          <MicrosoftLogo />
          Sign in with Microsoft
        </button>

        <p className="mt-5 text-[11px]" style={{ color: "var(--muted)" }}>
          Single sign-on only. Contact your administrator if you can&apos;t access your account.
        </p>
      </div>
    </div>
  );
}
