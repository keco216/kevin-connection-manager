// Prüft den Farbschema-Umschalter (M11) gegen den laufenden Stack:
// Erscheint er in den Präferenzen, schaltet er wirklich um, und überlebt die
// Wahl einen Neuladen?
//
// Lauf:  cd scripts && node theme-switch-verify.mjs
// Voraussetzung: `docker compose up -d` im Wurzelverzeichnis.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "e2e-screenshots", "darkmode");
const URL = process.env.KCM_URL ?? "http://localhost/guacamole/";
const USER = process.env.KCM_USER ?? "guacadmin";
const PASS = process.env.KCM_PASS ?? "guacadmin";

const checks = [];
const check = (name, ist, soll) => {
  const ok = ist === soll;
  checks.push(ok);
  console.log(`${ok ? "  ok  " : " FEHL "} ${name}${ok ? "" : `  (ist: ${ist}, soll: ${soll})`}`);
};

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch();
// Systemeinstellung HELL – so beweist ein dunkles Ergebnis, dass die Wahl wirkt
// und nicht die Media-Query.
const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle" });
await page.fill("input[name='username']", USER);
await page.fill("input[name='password']", PASS);
await page.click("input[type='submit'], button[type='submit']");
await page.waitForSelector(".connection-list-ui", { timeout: 20000 });
await page.goto(`${URL}#/settings/preferences`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const feld = page.locator("#kevin-theme-select");
console.log("\nUmschalter in den Präferenzen");
check("Feld vorhanden", await feld.count(), 1);
check("sichtbar", await feld.isVisible(), true);
check("in der Sektion „Darstellung“", await page.locator(".settings.section.appearance #kevin-theme-select").count(), 1);
check("nur EINMAL im DOM", await page.locator("#kevin-theme-select").count(), 1);
check("Beschriftung übersetzt", (await page.locator("label[for='kevin-theme-select']").textContent())?.trim(), "Farbschema:");
check("Auswahl übersetzt", (await feld.locator("option").allTextContents()).join("|"), "Wie im System|Hell|Dunkel");
check("Startwert", await feld.inputValue(), "system");

console.log("\nUmschalten auf „Dunkel“ (System steht auf HELL)");
await feld.selectOption("dark");
await page.waitForTimeout(700);
check("data-kb-theme gesetzt", await page.evaluate(() => document.documentElement.getAttribute("data-kb-theme")), "dark");
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("Seite ist dunkel", bg, "rgb(14, 15, 17)");
await page.screenshot({ path: path.join(SHOTS, "20-schalter-dunkel.png"), fullPage: false });

console.log("\nÜberlebt die Wahl ein Neuladen?");
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
check("Attribut nach Neuladen", await page.evaluate(() => document.documentElement.getAttribute("data-kb-theme")), "dark");
check("Feld zeigt die Wahl", await page.locator("#kevin-theme-select").inputValue(), "dark");

console.log("\nZurück auf „Hell“");
await page.locator("#kevin-theme-select").selectOption("light");
await page.waitForTimeout(700);
check("Attribut", await page.evaluate(() => document.documentElement.getAttribute("data-kb-theme")), "light");
check("Seite ist hell", await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(255, 255, 255)");

// „Wie im System“ löst das JS selbst auf und setzt das Attribut trotzdem –
// deshalb steht die dunkle Palette in der CSS nur einmal. Der Kontext läuft
// mit colorScheme "light", erwartet wird also "light".
console.log("\n„Wie im System“ übernimmt die Systemvorgabe (hier: hell)");
await page.locator("#kevin-theme-select").selectOption("system");
await page.waitForTimeout(700);
check("Attribut aufgelöst", await page.evaluate(() => document.documentElement.getAttribute("data-kb-theme")), "light");
check("gespeicherte Wahl", await page.evaluate(() => localStorage.getItem("kevin-theme")), "system");

// Gegenprobe: System dunkel + Wahl "hell" muss HELL bleiben
console.log("\nWahl schlägt Systemeinstellung");
const ctx2 = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(URL, { waitUntil: "networkidle" });
await p2.evaluate(() => localStorage.setItem("kevin-theme", "light"));
await p2.reload({ waitUntil: "networkidle" });
await p2.waitForTimeout(1200);
check("System dunkel + Wahl hell → hell", await p2.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(255, 255, 255)");
await ctx2.close();

await ctx.close();
await browser.close();

const fehler = checks.filter((c) => !c).length;
console.log(`\n${checks.length - fehler}/${checks.length} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
