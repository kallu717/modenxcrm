// The bdCRM mark: a "b" and a "d" facing each other, their loops linked.
// The square takes the theme's accent colour, so it follows every theme.
// app/icon.svg is the same drawing in Sage green, for the browser tab.
export default function Logo({ size = 26, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className="shrink-0"
    >
      {title && <title>{title}</title>}
      <rect width="32" height="32" rx="7" style={{ fill: "var(--accent)" }} />
      <rect x="6" y="6" width="3.2" height="20" rx="1.6" fill="#fff" />
      <circle cx="13.2" cy="19.4" r="5" fill="none" stroke="#fff" strokeWidth="3.2" />
      <rect x="22.8" y="6" width="3.2" height="20" rx="1.6" fill="#fff" fillOpacity="0.62" />
      <circle cx="18.8" cy="19.4" r="5" fill="none" stroke="#fff" strokeOpacity="0.62" strokeWidth="3.2" />
    </svg>
  );
}
