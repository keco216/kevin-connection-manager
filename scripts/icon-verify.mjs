// Prüft, dass KEIN Icon mehr als starr eingefärbtes Bild ausgeliefert wird.
//
// Hintergrund: SVGs, die per background-image eingebunden sind, tragen ihre
// Farbe im Datei-Inhalt – sie können im dunklen Modus nicht aufhellen und
// verschwinden dort. Richtig ist mask + Farbe aus der CSS (--kb-icon bzw.
// currentColor). Diese Prüfung findet Rückfälle.
//
// Lauf:  cd scripts && node icon-verify.mjs
// Voraussetzung: `docker compose up -d` im Wurzelverzeichnis.

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "e2e-screenshots", "darkmode");
const URL = process.env.KCM_URL ?? "http://localhost/guacamole/";
const USER = process.env.KCM_USER ?? "guacadmin";
const PASS = process.env.KCM_PASS ?? "guacadmin";

// Bekannte, gewollte Ausnahmen
const ERLAUBT = [
  "kevin-logo.svg",       // Marke: Navy-Kachel mit gelbem K, soll NICHT umfärben
  "guac-user.svg",        // App-Bar: liegt unter brightness(0) invert(1) -> weiss
  "down.svg",             // dito (Menü-Indikator in der App-Bar)
  "guac-user-add.svg",    // Stock-Weiss auf Primärblau -> passt in beiden Modi
  "guac-group-add.svg",
  "guac-connection-add.svg",
  "guac-monitor.svg",
  "data:image",           // Farbwähler (Fremdbibliothek Pickr)
];

const SEITEN = [
  ["Startseite", ""],
  ["Benutzer", "#/settings/users"],
  ["Verbindungen", "#/settings/connections"],
  ["Verlauf", "#/settings/history"],
];

const suche = () => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    if (box.bottom < 0 || box.top > window.innerHeight) continue;
    for (const pseudo of [null, "::before", "::after"]) {
      const s = getComputedStyle(el, pseudo);
      const bi = s.backgroundImage;
      if (!bi || bi === "none" || bi.startsWith("linear") || bi.startsWith("radial")) continue;
      if ((s.maskImage || s.webkitMaskImage || "none") !== "none") continue;
      const datei = (bi.match(/\/([a-z0-9-]+\.svg)/i) || bi.match(/(data:image)/) || ["", "?"])[1];
      const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter((c) => !c.startsWith("ng-")).slice(0, 2).join(".") : "";
      out.push({ datei, wo: `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${pseudo || ""}`, filter: s.filter });
    }
  }
  return out;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle" });
await page.fill("input[name='username']", USER);
await page.fill("input[name='password']", PASS);
await page.click("input[type='submit'], button[type='submit']");
await page.waitForSelector(".connection-list-ui", { timeout: 20000 });

let verstoesse = 0;
for (const [name, hash] of SEITEN) {
  if (hash) await page.goto(URL + hash, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const alle = await page.evaluate(suche);
  const schlimm = alle.filter((i) => !ERLAUBT.some((e) => i.datei.includes(e)));
  console.log(`\n${name}: ${schlimm.length === 0 ? "alle Icons färbbar" : `${schlimm.length} starr eingefärbt`}`);
  schlimm.forEach((i) => { console.log(`   ${i.wo}  →  ${i.datei}  (filter: ${i.filter})`); verstoesse++; });
}

// Benutzermenü zusätzlich
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.click(".menu-dropdown .menu-title").catch(() => {});
await page.waitForTimeout(600);
const menue = (await page.evaluate(suche)).filter((i) => !ERLAUBT.some((e) => i.datei.includes(e)));
console.log(`\nBenutzermenü offen: ${menue.length === 0 ? "alle Icons färbbar" : `${menue.length} starr eingefärbt`}`);
menue.forEach((i) => { console.log(`   ${i.wo}  →  ${i.datei}`); verstoesse++; });
await page.screenshot({ path: path.join(SHOTS, "dark-15-icons.png") });

await browser.close();
console.log(`\n${verstoesse === 0 ? "OK – kein Icon mehr starr eingefärbt" : `${verstoesse} Icon(s) können im dunklen Modus nicht aufhellen`}`);
process.exit(verstoesse === 0 ? 0 : 1);
