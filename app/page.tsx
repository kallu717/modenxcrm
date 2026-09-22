export default function Home() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
        ModenX Pipeline
      </h1>
      <p className="font-mono text-sm" style={{ color: "var(--muted)" }}>
        Design tokens check — sans body text, mono here.
      </p>
      <div className="flex gap-2">
        <span
          className="px-2 py-1 rounded text-xs font-mono"
          style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
        >
          accent
        </span>
        <span
          className="px-2 py-1 rounded text-xs font-mono"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          warn
        </span>
        <span
          className="px-2 py-1 rounded text-xs font-mono"
          style={{ background: "var(--crit-soft)", color: "var(--crit)" }}
        >
          crit
        </span>
        <span
          className="px-2 py-1 rounded text-xs font-mono"
          style={{ background: "var(--good-soft)", color: "var(--good)" }}
        >
          good
        </span>
      </div>
    </div>
  );
}
