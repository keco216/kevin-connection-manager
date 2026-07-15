// Statusdialog („Verbindung wurde getrennt“) in BEIDEN Farbschemata prüfen:
// eigene Icons für Startseite/Neu verbinden/Abmelden, Knopf-Kontraste.
//
// Lauf:  cd scripts && node statusdialog-verify.mjs
// Voraussetzung: `docker compose up -d`; nutzt die Wegwerf-Verbindung
// TEST-ZWEITSERVER (127.0.0.1:1) – die schlägt sofort fehl und liefert damit
// verlässlich den Fehlerdialog.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "e2e-screenshots", "darkmode");
const URL = process.env.KCM_URL ?? "http://localhost/guacamole/";
const USER = process.env.KCM_USER ?? "guacadmin";
const PASS = process.env.KCM_PASS ?? "guacadmin";

const kontrast = (vg, hg) => {
  const z = (s) => { const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
  const l = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const a = z(vg), b = z(hg); if (!a || !b) return null;
  const l1 = l(a), l2 = l(b);
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 10) / 10;
};

const ergebnisse = [];
const pruefe = (name, ok, zusatz = "") => {
  ergebnisse.push(ok);
  console.log(`${ok ? "  ok  " : " FEHL "} ${name}${zusatz ? "  " + zusatz : ""}`);
};

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch();

for (const modus of ["light", "dark"]) {
  console.log(`\n--- ${modus === "dark" ? "Dunkel" : "Hell"} ---`);
  const ctx = await browser.newContext({ colorScheme: modus, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.fill("input[name='username']", USER);
  await page.fill("input[name='password']", PASS);
  await page.click("input[type='submit'], button[type='submit']");
  await page.waitForSelector(".connection-list-ui", { timeout: 20000 });
  await page.waitForTimeout(800);

  // Verbindung, die sofort abgewiesen wird → Fehlerdialog mit den drei Knöpfen
  await page.goto(`${URL}#/client/NzUAYwBwb3N0Z3Jlc3Fs`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForSelector(".client-status-modal .buttons button", { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const d = await page.evaluate(() => {
    const btns = [...document.querySelectorAll(".client-status-modal .notification .buttons button")];
    if (!btns.length) return null;
    return btns.map((b) => {
      const s = getComputedStyle(b);
      const v = getComputedStyle(b, "::before");
      return {
        klasse: b.className || "(ohne)",
        text: b.textContent.trim(),
        flaeche: s.backgroundColor,
        farbe: s.color,
        iconMask: (v.maskImage || v.webkitMaskImage || "none").includes("status-") ? "eigenes Icon" : (v.maskImage || "none"),
        iconFarbe: v.backgroundColor,
        iconFilter: v.filter,
      };
    });
  });

  if (!d) { pruefe("Dialog erschienen", false); await ctx.close(); continue; }
  pruefe("Dialog erschienen", true, `(${d.length} Knöpfe)`);

  for (const b of d) {
    console.log(`\n   „${b.text}“ (.${b.klasse.split(" ")[0]})`);
    console.log(`     Fläche ${b.flaeche} | Text ${b.farbe}`);
    console.log(`     Icon: ${b.iconMask} | Farbe ${b.iconFarbe} | filter ${b.iconFilter}`);
    pruefe(`  eigenes Icon statt Stock-Bild`, b.iconMask === "eigenes Icon");
    pruefe(`  Icon folgt der Textfarbe`, b.iconFarbe === b.farbe);
    const k = kontrast(b.farbe, b.flaeche);
    pruefe(`  Text lesbar (${k}:1)`, k !== null && k >= 4.5);
  }

  await page.screenshot({ path: path.join(SHOTS, `${modus}-14-statusdialog.png`) });
  await ctx.close();
}

await browser.close();
const fehler = ergebnisse.filter((e) => !e).length;
console.log(`\n${ergebnisse.length - fehler}/${ergebnisse.length} Prüfungen bestanden`);
console.log(`Screenshots: ${path.relative(path.join(HERE, ".."), SHOTS)}`);
process.exit(fehler === 0 ? 0 : 1);
