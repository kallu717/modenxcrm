import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { THEMES, THEME_BOOT_SCRIPT, isTheme } from "../lib/themes";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("THEME. Colour themes", () => {
  it("THEME1 five light and five dark themes, each with a unique id", () => {
    expect(THEMES.filter((t) => t.mode === "light")).toHaveLength(5);
    expect(THEMES.filter((t) => t.mode === "dark")).toHaveLength(5);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(10);
  });

  it("THEME2 every theme in the picker has its colours in the stylesheet, with the right light/dark mode", () => {
    for (const t of THEMES) {
      const block = css.split(`[data-theme="${t.id}"] {`)[1]?.split("}")[0];
      expect(block, t.id).toBeTruthy();
      for (const v of ["--bg", "--surface", "--ink", "--accent", "--crit", "--good"]) expect(block, `${t.id} ${v}`).toContain(v + ":");
      expect(block, t.id).toContain(`color-scheme: ${t.mode}`);
    }
  });

  it("THEME3 ✗ an unknown or tampered theme name is ignored (the app follows the device)", () => {
    expect(isTheme("ocean")).toBe(true);
    for (const bad of ["", "system", "OCEAN", "ocean;color:red", null, 7]) expect(isTheme(bad)).toBe(false);
  });

  it("THEME4 the start-up script only ever applies a known theme and never throws", () => {
    const html = { dataset: {} as Record<string, string> };
    const run = (stored: string | null, throws = false) => {
      html.dataset = {};
      const localStorage = { getItem: () => { if (throws) throw new Error("blocked"); return stored; } };
      new Function("localStorage", "document", THEME_BOOT_SCRIPT)(localStorage, { documentElement: html });
      return html.dataset.theme;
    };
    expect(run("midnight")).toBe("midnight");
    expect(run("<script>")).toBeUndefined();
    expect(run(null)).toBeUndefined();
    expect(run("ocean", true)).toBeUndefined();
  });
});
