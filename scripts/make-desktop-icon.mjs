// Rendert das K-Logo der Branding-Extension als 512×512-PNG für den
// Desktop-Client. electron-builder erzeugt daraus beim Paketieren die .ico.
//
// Lauf:  cd scripts && node make-desktop-icon.mjs
// Nötig nur, wenn sich branding/src/images/kevin-logo.svg ändert – das
// Ergebnis (desktop/build/icon.png) liegt im Repo.
//
// Nutzt das Chromium aus dem Playwright-Setup dieses Verzeichnisses (siehe
// scripts/package.json), damit kein weiteres Werkzeug nötig wird.

import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, "..", "branding", "src", "images", "kevin-logo.svg");
const TARGET = path.join(HERE, "..", "desktop", "build", "icon.png");
const SIZE = 512;

const svg = await readFile(SOURCE, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: SIZE, height: SIZE },
  deviceScaleFactor: 1,
});

// Das Logo bringt seine eigene Navy-Fläche mit; ausserhalb der abgerundeten
// Ecken muss transparent bleiben, sonst bekommt das Icon schwarze Zipfel.
await page.setContent(
  `<style>
     html, body { margin: 0; background: transparent; }
     svg { display: block; width: ${SIZE}px; height: ${SIZE}px; }
   </style>
   ${svg}`,
);

await mkdir(path.dirname(TARGET), { recursive: true });
await page.screenshot({ path: TARGET, omitBackground: true });
await browser.close();

console.log(`icon geschrieben: ${path.relative(path.join(HERE, ".."), TARGET)} (${SIZE}x${SIZE})`);
