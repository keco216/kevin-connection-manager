// Dark-Modus-Prototyp (M11): schiesst Login und Startseite in BEIDEN Modi und
// sucht anschliessend nach hellen Flächen, die im Dunklen stehen geblieben sind
// („Blitzer") – Stock-CSS lädt nach der Extension, deshalb bleibt Helles ohne
// gezieltes Überschreiben hell.
//
// Lauf:  cd scripts && node darkmode-preview.mjs
// Voraussetzung: `docker compose up -d` im Wurzelverzeichnis.
// Zugangsdaten via KCM_USER/KCM_PASS, Default guacadmin.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "e2e-screenshots", "darkmode");
const URL = process.env.KCM_URL ?? "http://localhost/guacamole/";
const USER = process.env.KCM_USER ?? "guacadmin";
const PASS = process.env.KCM_PASS ?? "guacadmin";

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch();

// Sucht SICHTBARE Elemente mit heller Fläche – im Dunklen sind das Fehler.
// Prüft anders als beim ersten Anlauf auch, ob das Element wirklich im
// Viewport steht: Sonst meldet es geparkte Elemente und übersieht echte.
const BLITZER_SUCHE = () => {
  const hell = [];
  for (const el of document.querySelectorAll("*")) {
    const box = el.getBoundingClientRect();
    if (box.width < 20 || box.height < 10) continue;
    if (box.bottom < 0 || box.right < 0 || box.left > window.innerWidth) continue;
    const stil = getComputedStyle(el);
    if (stil.visibility === "hidden" || stil.display === "none" || +stil.opacity < 0.1) continue;
    const m = stil.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) continue;
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    if ((m[4] === undefined ? 1 : +m[4]) < 0.5) continue;
    if (0.299 * r + 0.587 * g + 0.114 * b < 170) continue;
    const pfad = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).filter((c) => !c.startsWith("ng-")).slice(0, 2).join(".") : ""}`;
    hell.push(`${pfad}  ${stil.backgroundColor}  ${Math.round(box.width)}x${Math.round(box.height)}`);
  }
  return [...new Set(hell)];
};

// Jede Ansicht einzeln – Blitzer verstecken sich in Formularen, nicht auf der
// Startseite.
const SEITEN = [
  ["2-home", ""],
  ["3-prefs", "#/settings/preferences"],
  ["4-users", "#/settings/users"],
  ["5-connections", "#/settings/connections"],
];

for (const modus of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: modus, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("input[name='username']", { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, `${modus}-1-login.png`) });

  await page.fill("input[name='username']", USER);
  await page.fill("input[name='password']", PASS);
  await page.click("input[type='submit'], button[type='submit']");
  await page.waitForSelector(".connection-list-ui > .header:first-child", { timeout: 20000 });

  for (const [name, hash] of SEITEN) {
    if (hash) await page.goto(URL + hash, { waitUntil: "networkidle" });
    await page.waitForTimeout(1300);
    await page.screenshot({ path: path.join(SHOTS, `${modus}-${name}.png`), fullPage: true });

    if (modus === "dark") {
      const blitzer = await page.evaluate(BLITZER_SUCHE);
      const echte = blitzer.filter((b) => !b.includes("pcr-")); // Farbwähler ist geparkt
      console.log(`\n${name}: ${echte.length === 0 ? "sauber" : `${echte.length} helle Flächen`}`);
      echte.slice(0, 8).forEach((b) => console.log(`   ${b}`));
    }
  }

  if (modus === "dark") {
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.click(".menu-dropdown .menu-title").catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, "dark-6-menue.png") });
  }

  await ctx.close();
}

await browser.close();
console.log(`\nScreenshots: ${path.relative(path.join(HERE, ".."), SHOTS)}`);
