// Sichtprüfung des Desktop-Clients (desktop/) – startet die echte App über
// Playwrights Electron-Anbindung und prüft die Punkte, die man einer
// laufenden Anwendung nicht ansieht: Sandbox, Menü, Brücke, Validierung.
//
// Lauf:  cd scripts && node desktop-verify.mjs
// Nötig: einmalig `npm install` hier und `npm install` in desktop/.
//
// Prüft NUR die Einrichtungsansicht – für den Rest lädt die App die
// Guacamole-Oberfläche vom Server, und die deckt branding-verify.mjs ab.

import { _electron as electron } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(HERE, "..", "desktop");
const SHOTS = path.join(HERE, "e2e-screenshots", "desktop");

// Playwright sucht Electron in DIESEM node_modules; installiert ist es aber
// nebenan in desktop/. Der Pfad zur ausführbaren Datei kommt deshalb aus
// dessen Auflösung.
//
// Fällt die Auflösung aus, prüfen wir ersatzweise das gebaute Paket aus
// `npm run dist`. Das ist kein Luxus: Windows Defender hat die nackte
// Electron-Runtime schon als Trojan:Win32/Cinjo.O!cl einkassiert (Fehlalarm,
// die gepackte App ist davon nicht betroffen) – dann ist das Paket die
// einzige lauffähige Variante.
const PACKAGED = path.join(APP, "dist", "win-unpacked", "Kevin Connection Manager.exe");
// Direkt auf die Datei prüfen statt über require("electron"): Dessen index.js
// stösst bei fehlender Binärdatei einen Neu-Download an – der landet hier
// prompt wieder in der Quarantäne, und wir starten ins Leere.
const DEV = path.join(APP, "node_modules", "electron", "dist", "electron.exe");

// Ziel bewusst explizit wählbar: Mit --packaged läuft die Prüfung gegen das
// Ergebnis von `npm run dist` statt gegen die Entwicklungs-Installation.
// Nötig, wenn ein Virenscanner die nackte Electron-Runtime kassiert (siehe
// Hinweis unten) – die gepackte App ist davon nicht betroffen.
const usePackaged = process.argv.includes("--packaged");

function pickTarget() {
  if (usePackaged) {
    if (existsSync(PACKAGED)) return { exe: PACKAGED, args: [], mode: "gebautes Paket (dist/win-unpacked)" };
    console.error("dist/win-unpacked fehlt – in desktop/ zuerst `npm run dist` ausführen.");
    process.exit(2);
  }

  if (existsSync(DEV)) return { exe: DEV, args: [APP], mode: "Entwicklung (node_modules)" };

  console.error(
    "node_modules/electron/dist/electron.exe fehlt.\n" +
      "  – In desktop/ `npm install` ausführen, oder\n" +
      "  – dort `npm run dist` bauen und hier mit --packaged prüfen.\n" +
      "  Verschwindet die Datei immer wieder, holt sie der Virenscanner:\n" +
      "  bekannter Fehlalarm auf die nackte Electron-Runtime\n" +
      "  (Trojan:Win32/Cinjo.O!cl). Das gebaute Paket ist nicht betroffen.",
  );
  process.exit(2);
}

const { exe: electronPath, args: appArgs, mode } = pickTarget();
console.log(`Prüfling: ${mode}`);

const checks = [];
const check = (name, actual, expected) => {
  const ok = actual === expected;
  checks.push({ name, ok, actual, expected });
  console.log(`${ok ? "  ok  " : " FEHL "} ${name}${ok ? "" : `  (ist: ${actual}, soll: ${expected})`}`);
};

await mkdir(SHOTS, { recursive: true });

// Ohne eigenes Profil würde eine bereits gespeicherte Server-Adresse den Test
// direkt auf den Server schicken – wir wollen aber die Einrichtung sehen.
const profile = path.join(SHOTS, "profil");
await rm(profile, { recursive: true, force: true });

const app = await electron.launch({
  executablePath: electronPath,
  args: [...appArgs, `--user-data-dir=${profile}`],
  cwd: APP,
  env: { ...process.env, KCM_URL: "" },
});

const win = await app.firstWindow();
await win.waitForLoadState("domcontentloaded");

console.log("\nEinrichtungsansicht");
check("Fenstertitel", await win.title(), "Kevin Connection Manager – Einrichtung");
check("Überschrift", (await win.locator("h1").textContent())?.trim(), "Kevin Connection Manager");
check("Adressfeld sichtbar", await win.locator("#server-url").isVisible(), true);
check("Navy-Hintergrund", await win.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(15, 30, 61)");

console.log("\nAbschottung des Renderers");
check("Brücke vorhanden", await win.evaluate(() => typeof window.kcm?.saveServerUrl), "function");
check("kein require()", await win.evaluate(() => typeof window.require), "undefined");
check("kein process", await win.evaluate(() => typeof window.process), "undefined");
check("Anwendungsmenü entfernt", await app.evaluate(({ Menu }) => Menu.getApplicationMenu()), null);

await win.screenshot({ path: path.join(SHOTS, "01-einrichtung.png") });

// Der Daseinsgrund des Wrappers: Guacamole 1.6.0 fängt die Tastatur über die
// Keyboard Lock API (GUACAMOLE-1525). Fehlt die API in der Electron-Engine,
// wäre die App gegenüber dem Browser ein Rückschritt.
// Der Daseinsgrund des Wrappers: Guacamole 1.6 fängt die Tastatur über die
// Keyboard Lock API (GUACAMOLE-1525). Fehlte die API in der Electron-Engine,
// wäre die App gegenüber dem Browser ein Rückschritt.
//
// Geprüft wird hier nur, DASS die API existiert. Ein Wirktest ist an dieser
// Stelle unmöglich – und zwar aus zwei guten Gründen:
//   1. lock() verlangt Vollbild über die Fullscreen-API (Electrons
//      setFullScreen() genügt nicht: document.fullscreenElement bleibt leer).
//   2. requestFullscreen() braucht die Berechtigung „fullscreen“, und die
//      erteilt main.js nur der konfigurierten Server-Herkunft. Diese Ansicht
//      liegt auf file:// – hier greift die Absperrung also korrekt.
// Der echte Nachweis läuft in einer Sitzung gegen den Server.
console.log("\nTastatur-Fang (Keyboard Lock API vorhanden?)");
check("navigator.keyboard", await win.evaluate(() => "keyboard" in navigator), true);
check("keyboard.lock()", await win.evaluate(() => typeof navigator.keyboard?.lock), "function");
check("keyboard.unlock()", await win.evaluate(() => typeof navigator.keyboard?.unlock), "function");

console.log("\nAdressprüfung");
// Muss abgelehnt werden: landete das ungeprüft in loadURL, wäre es eine
// Skript-Ausführung im Fenster.
await win.locator("#server-url").fill("javascript:alert(1)");
await win.locator("#submit").click();
await win.waitForTimeout(300);
check("javascript: abgelehnt", await win.locator("#error").isVisible(), true);
check("Ansicht bleibt stehen", new URL(win.url()).protocol, "file:");

await win.screenshot({ path: path.join(SHOTS, "02-fehlermeldung.png") });

await win.locator("#server-url").fill("nur-text-ohne-schema");
await win.locator("#submit").click();
await win.waitForTimeout(300);
check("Text ohne Schema abgelehnt", await win.locator("#error").isVisible(), true);

await app.close();

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} Prüfungen bestanden`);
console.log(`Screenshots: ${path.relative(path.join(HERE, ".."), SHOTS)}`);
process.exit(failed.length === 0 ? 0 : 1);
