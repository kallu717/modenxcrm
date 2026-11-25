"use client";

import Link from "next/link";
import { FN_TIER, bandForScore } from "@/lib/scoring";

const card = "rounded-lg border p-4";
const cardStyle = { borderColor: "var(--grid)", background: "var(--surface)" };

function Pill({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "muted" }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11.5px]"
      style={{ background: "var(--surface-2)", color: tone === "muted" ? "var(--muted)" : "var(--ink)" }}
    >
      {children}
    </span>
  );
}

function Plus() {
  return (
    <span className="text-[18px] shrink-0 hidden sm:inline" style={{ color: "var(--muted)" }}>
      +
    </span>
  );
}

function IngredientCard({ title, lines }: { title: string; lines: { label: string; points: string }[] }) {
  return (
    <div className={card + " flex-1 min-w-[190px]"} style={cardStyle}>
      <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--ink)" }}>
        {title}
      </p>
      <dl className="space-y-1 text-[12px]">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3">
            <dt style={{ color: "var(--ink-2)" }}>{l.label}</dt>
            <dd className="font-mono shrink-0" style={{ color: "var(--accent-ink)" }}>
              {l.points}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// The four bands, each as a share of a 0–35 scale, for the gauge below.
const BAND_SEGMENTS = [
  { name: "Low", from: 0, to: 12, color: "var(--p-low)" },
  { name: "Nurture", from: 12, to: 20, color: "var(--p-nurture)" },
  { name: "Warm", from: 20, to: 30, color: "var(--p-warm)" },
  { name: "Hot", from: 30, to: 35, color: "var(--p-hot)" },
];
const GAUGE_MAX = 35;

function Gauge({ markScore }: { markScore?: number }) {
  const markPct = markScore !== undefined ? Math.min(100, (markScore / GAUGE_MAX) * 100) : null;
  return (
    <div className="mt-2">
      <div className="relative h-7 rounded-full overflow-hidden flex" style={{ background: "var(--surface-2)" }}>
        {BAND_SEGMENTS.map((b) => (
          <div
            key={b.name}
            style={{ width: `${((b.to - b.from) / GAUGE_MAX) * 100}%`, background: b.color }}
            className="h-full"
          />
        ))}
        {markPct !== null && (
          <div
            className="absolute top-[-3px] bottom-[-3px] w-[3px] rounded"
            style={{ left: `calc(${markPct}% - 1.5px)`, background: "var(--ink)" }}
          />
        )}
      </div>
      <div className="relative mt-1 h-4 text-[10.5px] font-mono" style={{ color: "var(--muted)" }}>
        {[0, 12, 20, 30, 35].map((n) => (
          <span key={n} className="absolute -translate-x-1/2" style={{ left: `${(n / GAUGE_MAX) * 100}%` }}>
            {n}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px]">
        {BAND_SEGMENTS.map((b) => (
          <span key={b.name} className="flex items-center gap-1.5" style={{ color: "var(--ink-2)" }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
            {b.name}
            <span className="font-mono" style={{ color: "var(--muted)" }}>
              {b.name === "Hot" ? `${b.from}+` : `${b.from}–${b.to - 1}`}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Example({
  heading,
  jobTitle,
  verified,
  multi,
  score,
}: {
  heading: string;
  jobTitle: string;
  verified: string;
  multi: string;
  score: number;
}) {
  const band = bandForScore(score);
  return (
    <div className={card} style={cardStyle}>
      <p className="text-[12.5px] font-medium mb-2" style={{ color: "var(--ink)" }}>
        {heading}
      </p>
      <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
        {jobTitle} · {verified} · {multi}
      </p>
      <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
        Score: <span className="font-mono" style={{ color: "var(--ink)" }}>{score}</span> → priority{" "}
        <b style={{ color: "var(--ink)" }}>{band}</b>
      </p>
    </div>
  );
}

const founderTitles = Object.entries(FN_TIER).filter(([, p]) => p === 15).map(([t]) => t);
const midTitles = Object.entries(FN_TIER).filter(([, p]) => p === 10).map(([t]) => t);
const juniorTitles = Object.entries(FN_TIER).filter(([, p]) => p === 5).map(([t]) => t);

export default function ScoringGuidePage() {
  return (
    <div className="py-5 max-w-[760px]">
      <Link href="/leads" className="text-[12.5px]" style={{ color: "var(--muted)" }}>
        ← Back
      </Link>
      <h1 className="text-[19px] font-semibold mt-2" style={{ color: "var(--ink)" }}>
        How scoring and priority work
      </h1>
      <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
        Every contact gets a score the moment they&apos;re added, and the score decides their priority — Hot, Warm,
        Nurture or Low. It&apos;s all worked out from three things already on the contact: their job title, their
        email, and whether they turned up from more than one source.
      </p>

      <section className="mt-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          The recipe
        </h2>
        <div className="flex items-stretch gap-2 mt-3 flex-wrap sm:flex-nowrap">
          <IngredientCard
            title="① Job title"
            lines={[
              { label: "Senior decision-maker", points: "+15" },
              { label: "Mid-level manager", points: "+10" },
              { label: "Everyone else", points: "+5" },
            ]}
          />
          <Plus />
          <IngredientCard
            title="② Email"
            lines={[
              { label: "Verified", points: "+12" },
              { label: "Catch-all / guessed", points: "+4" },
              { label: "No email", points: "+0" },
            ]}
          />
          <Plus />
          <IngredientCard
            title="③ Multiple sources"
            lines={[
              { label: "Found more than once", points: "+5" },
              { label: "Just the one source", points: "+0" },
            ]}
          />
        </div>
        <p className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>
          Add the three up and that&apos;s the score — nothing else about the contact changes it. A lead from
          anywhere in India can be a good fit, so where they are doesn&apos;t count for or against them.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Score → priority
        </h2>
        <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
          The score then lands on one of four bands:
        </p>
        <Gauge />
      </section>

      <section className="mt-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>
          Two worked examples
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Example
              heading="Example A"
              jobTitle="Marketing Head (+15)"
              verified="verified email (+12)"
              multi="seen on two sources (+5)"
              score={32}
            />
          </div>
          <div>
            <Example
              heading="Example B"
              jobTitle="Store Manager (+5)"
              verified="no email on file (+0)"
              multi="one source (+0)"
              score={5}
            />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[12px] mb-1" style={{ color: "var(--muted)" }}>
            Where those two land on the scale:
          </p>
          <Gauge markScore={32} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Every job title, in full
        </h2>
        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          <div className={card} style={cardStyle}>
            <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--ink)" }}>
              +15
            </p>
            <div className="flex flex-wrap gap-1">
              {founderTitles.map((t) => (
                <Pill key={t}>{t}</Pill>
              ))}
            </div>
          </div>
          <div className={card} style={cardStyle}>
            <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--ink)" }}>
              +10
            </p>
            <div className="flex flex-wrap gap-1">
              {midTitles.map((t) => (
                <Pill key={t}>{t}</Pill>
              ))}
            </div>
          </div>
          <div className={card} style={cardStyle}>
            <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--ink)" }}>
              +5
            </p>
            <div className="flex flex-wrap gap-1">
              {juniorTitles.map((t) => (
                <Pill key={t}>{t}</Pill>
              ))}
              <Pill tone="muted">any other title</Pill>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 pb-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          One thing to know
        </h2>
        <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>
          The score keeps working out the priority automatically as a contact&apos;s details change. If someone sets
          a priority by hand on a contact&apos;s page, that choice always wins over the automatic one — until it&apos;s
          reset back to auto.
        </p>
      </section>
    </div>
  );
}
