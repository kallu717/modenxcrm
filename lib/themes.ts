// Colour themes. The colours live in app/globals.css under [data-theme="…"];
// this is the list the picker shows. "system" means no choice: follow the
// device's light/dark setting (Sage or Forest).

export type ThemeMode = "light" | "dark";
export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  blurb: string;
}

export const THEMES: Theme[] = [
  { id: "sage", name: "Sage", mode: "light", blurb: "Green on warm paper (default)" },
  { id: "ocean", name: "Ocean", mode: "light", blurb: "Cool white and blue" },
  { id: "plum", name: "Plum", mode: "light", blurb: "Soft lilac and purple" },
  { id: "terracotta", name: "Terracotta", mode: "light", blurb: "Cream and clay" },
  { id: "slate", name: "Slate", mode: "light", blurb: "Neutral grey and indigo" },
  { id: "forest", name: "Forest", mode: "dark", blurb: "Dark green (default)" },
  { id: "midnight", name: "Midnight", mode: "dark", blurb: "Navy and blue" },
  { id: "graphite", name: "Graphite", mode: "dark", blurb: "Charcoal and amber" },
  { id: "aubergine", name: "Aubergine", mode: "dark", blurb: "Deep purple and pink" },
  { id: "deep-sea", name: "Deep Sea", mode: "dark", blurb: "Dark teal and cyan" },
];

export const SYSTEM_THEME = "system";
export const THEME_STORAGE_KEY = "bdcrm:theme";

export function isTheme(id: unknown): id is string {
  return typeof id === "string" && THEMES.some((t) => t.id === id);
}

export function readTheme(): string {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(v) ? v : SYSTEM_THEME;
  } catch {
    return SYSTEM_THEME;
  }
}

// Unknown ids fall back to following the device, never to a broken page.
export function applyTheme(id: string): string {
  const theme = isTheme(id) ? id : SYSTEM_THEME;
  const root = document.documentElement;
  if (theme === SYSTEM_THEME) delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === SYSTEM_THEME) window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // blocked storage: the theme still applies until the page is reloaded
  }
  return theme;
}

// Runs in <head> before the page paints, so a dark theme never flashes light.
export const THEME_BOOT_SCRIPT =
  "try{var t=localStorage.getItem(" +
  JSON.stringify(THEME_STORAGE_KEY) +
  ");if(" +
  JSON.stringify(THEMES.map((t) => t.id)) +
  ".indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}";
