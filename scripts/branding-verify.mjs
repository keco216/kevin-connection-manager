// Branding-Verifikation: /guacamole/ (Original-UI) – Screenshots + Style-Dumps
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost/guacamole/';
// Ausgabe neben dem Skript (scripts/e2e-screenshots/), unabhängig vom Aufruf-Verzeichnis
const OUT = fileURLToPath(new URL('e2e-screenshots/branding/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const PROPS = ['background-color', 'background-image', 'color', 'border-top-color',
  'border-bottom-color', 'border-bottom-width', 'border-radius', 'outline-color',
  'font-family', 'box-shadow', 'text-shadow', 'filter'];

async function dump(label, selectors) {
  const result = await page.evaluate(([selectors, PROPS]) => {
    const out = {};
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) { out[sel] = null; continue; }
      const cs = getComputedStyle(el);
      const o = {};
      for (const p of PROPS) {
        const v = cs.getPropertyValue(p);
        if (v && v !== 'none' && v !== 'normal') o[p] = v;
      }
      out[sel] = o;
    }
    return out;
  }, [selectors, PROPS]);
  console.log(`\n===== ${label} =====`);
  console.log(JSON.stringify(result, null, 1));
}

// ---------- 1) Login-Screen ----------
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.login-ui .login-dialog', { timeout: 20000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: OUT + '01-login.png' });

await dump('LOGIN', [
  '.login-ui', '.login-ui .login-dialog', '.login-ui .login-dialog .logo',
  '.login-fields input[type=text]', '.login-fields input[type=password]',
  '.login-fields .field-header',
  '.login-dialog input[type=submit]', '.login-dialog .app-name',
  '.login-dialog .version-number',
]);
const labels = await page.evaluate(() =>
  [...document.querySelectorAll('.login-fields .field-header')]
    .map(el => ({ text: el.textContent.trim(), sichtbar: getComputedStyle(el).display !== 'none' })));
console.log('\n===== LOGIN-LABELS =====\n' + JSON.stringify(labels));

// Version-Badge unten rechts identifizieren
const versionEl = await page.evaluate(() => {
  const hits = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length === 0 && /1\.6\.0/.test(el.textContent)) {
      const path = [];
      let n = el;
      while (n && n.nodeType === 1 && path.length < 5) {
        path.unshift(n.tagName.toLowerCase() +
          (typeof n.className === 'string' && n.className.trim()
            ? '.' + n.className.trim().split(/\s+/).join('.') : ''));
        n = n.parentElement;
      }
      const cs = getComputedStyle(el);
      hits.push({ path: path.join(' > '), bg: cs.backgroundColor, color: cs.color, pos: cs.position });
    }
  }
  return hits;
});
console.log('\n===== VERSION-BADGE =====');
console.log(JSON.stringify(versionEl, null, 1));

// ---------- 2) Fehlgeschlagener Login (Fehlermeldung) ----------
await page.fill('.login-dialog input[type=text]', 'falsch');
await page.fill('.login-dialog input[type=password]', 'falsch');
await page.click('.login-dialog input[type=submit]');
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + '02-login-fehler.png' });
await dump('LOGIN-FEHLER', ['.login-ui .login-error', '.login-ui.error .login-dialog']);

// ---------- 3) Echter Login ----------
await page.fill('.login-dialog input[type=text]', process.env.KCM_USER || 'guacadmin');
await page.fill('.login-dialog input[type=password]', process.env.KCM_PASS || 'guacadmin');
await page.click('.login-dialog input[type=submit]');
await page.waitForSelector('.header', { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + '03-home.png' });

await dump('HOME', [
  '.header', '.header h2', '.user-menu .menu-title', '.user-menu .menu-indicator',
  '.header .filter input', 'a',
]);

// ---------- 4) User-Menü aufklappen ----------
await page.click('.user-menu .menu-title');
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + '04-user-menu.png' });
await dump('USER-MENU OFFEN', [
  '.user-menu .menu-contents', '.user-menu .menu-contents li a',
  '.user-menu .menu-dropdown.open .menu-title',
]);
await page.keyboard.press('Escape');

// ---------- 5) Einstellungen: Verbindungen (Datasource im Pfad!) ----------
await page.goto(BASE + '#/settings/postgresql/connections', { waitUntil: 'networkidle' });
await page.waitForSelector('.settings', { timeout: 20000 });
await page.waitForTimeout(1200);
const settingsExpander = page.locator('.settings .expandable > .caption .icon.expand').first();
if (await settingsExpander.count()) {
  await settingsExpander.click();
  await page.waitForTimeout(500);
}
await page.screenshot({ path: OUT + '05-settings-connections.png' });

const settingsOutline = await page.evaluate(() => {
  const el = document.querySelector('.settings');
  if (!el) return '(kein .settings)';
  const walk = (node, d) => {
    if (node.nodeType !== 1 || d > 4) return '';
    const cls = typeof node.className === 'string' && node.className.trim()
      ? '.' + node.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
    let out = '  '.repeat(d) + node.tagName.toLowerCase() + cls + '\n';
    for (const c of node.children) out += walk(c, d + 1);
    return out;
  };
  return walk(el, 0);
});
console.log('\n===== DOM Settings =====\n' + settingsOutline.slice(0, 3000));

await dump('SETTINGS-CONNECTIONS', [
  '.header', '.header h2', '.page-tabs .page', '.page-tabs .page.current',
  '.page-tabs .page a', 'a.add-connection', 'a.add-connection-group', 'a.button',
  '.filter input', '.list-item',
]);

// ---------- 6) Einstellungen: Präferenzen (Formular + Buttons) ----------
await page.goto(BASE + '#/settings/preferences', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '06-settings-preferences.png' });
await dump('SETTINGS-PREFERENCES', [
  '.header', 'button', 'input[type=password]', 'select', '.form-field input',
]);

// ---------- 7) Verlauf: Tabelle ----------
await page.goto(BASE + '#/settings/postgresql/history', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '07-settings-history.png' });
await dump('HISTORY-TABELLE', [
  'table.sorted th', 'table.sorted td', '.pager .set-page.current', 'button',
]);

// ---------- 8) Verbindung anlegen/bearbeiten (manage): Formular-Abschnitte ----------
await page.goto(BASE + '#/manage/postgresql/connections', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + '08-manage-connection.png' });
await dump('MANAGE-CONNECTION', [
  'h2.header', '.form-header', 'button.save', 'button.cancel', 'button.danger',
  '.form select', '.form input[type=text]',
]);

// ---------- 9) Home: Baum-Hover (Stock war Gelbgrün) ----------
await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const caption = page.locator('.list-item .caption').first();
if (await caption.count()) {
  await caption.hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '09-home-baum-hover.png' });
  const hoverBg = await caption.evaluate(el => getComputedStyle(el).backgroundColor);
  console.log('\n===== BAUM-HOVER bg =====\n' + hoverBg);
}

// ---------- 10) Benutzer bearbeiten (Hinweis, Berechtigungsbaum, Sektions-Tabs) ----------
await page.goto(BASE + '#/manage/postgresql/users/' + (process.env.KCM_USER || 'guacadmin'),
  { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '10-manage-user.png', fullPage: true });
await dump('MANAGE-USER', ['.notice', 'h2.header', 'button.save', 'button.delete',
  '.section-tabs li a.current', '.section-tabs li a']);

// ---------- 10b) Benutzer-/Sitzungs-Listen (Tabellen + Leer-Zustände) ----------
await page.goto(BASE + '#/settings/users', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: OUT + '10b-settings-users.png' });
await page.goto(BASE + '#/settings/sessions', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: OUT + '10c-settings-sessions.png' });
await dump('SESSIONS-LEER', ['p.placeholder']);

// ---------- 11) Import-Screen (Dropzone) ----------
await page.goto(BASE + '#/import/postgresql/connection/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '11-import.png' });
await dump('IMPORT', ['.file-upload-container', '.file-upload-container .drop-target',
  'button.import', 'button.cancel']);

// ---------- 12) Client-Statusdialog + guac-menu (Wegwerf-Verbindung) ----------
const API = 'http://localhost/guacamole/api';
const tokenRes = await fetch(API + '/tokens', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `username=${encodeURIComponent(process.env.KCM_USER || 'guacadmin')}&password=${encodeURIComponent(process.env.KCM_PASS || 'guacadmin')}`,
});
const { authToken } = await tokenRes.json();
const connRes = await fetch(API + '/session/data/postgresql/connections', {
  method: 'POST',
  headers: { 'Guacamole-Token': authToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    parentIdentifier: 'ROOT', name: 'KCM-BRANDING-VERIFY', protocol: 'rdp',
    parameters: { hostname: '127.0.0.1', port: '1' }, attributes: {},
  }),
});
const conn = await connRes.json();
try {
  // Client-URL direkt bauen (base64 von "<id>\0c\0postgresql") – robuster
  // als der Klick im Baum, der vom Lade-Timing des Home-Baums abhängt
  const clientId = Buffer.from(`${conn.identifier}\0c\0postgresql`).toString('base64');
  await page.goto(BASE + '#/client/' + clientId, { waitUntil: 'networkidle' });
  await page.waitForSelector('.client-status-modal .notification', { timeout: 20000 });
  await page.waitForTimeout(4000); // Port 1 → refused → Fehlerdialog
  await page.screenshot({ path: OUT + '12-client-fehlerdialog.png' });
  await dump('CLIENT-STATUSDIALOG', [
    '.client-status-modal', '.client-status-modal .notification',
    '.client-status-modal .notification .title-bar',
    '.client-status-modal .notification .buttons button',
  ]);

  // guac-menu (Strg+Alt+Shift)
  await page.keyboard.down('Control'); await page.keyboard.down('Alt'); await page.keyboard.down('Shift');
  await page.keyboard.up('Shift'); await page.keyboard.up('Alt'); await page.keyboard.up('Control');
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '13-guac-menu.png' });
  await dump('GUAC-MENU', ['#guac-menu', '#guac-menu .header', '#guac-menu textarea']);
  await page.keyboard.down('Control'); await page.keyboard.down('Alt'); await page.keyboard.down('Shift');
  await page.keyboard.up('Shift'); await page.keyboard.up('Alt'); await page.keyboard.up('Control');

  // Zurück zur Startseite: der Fehler-Client liegt als Kachel in
  // „Letzte Verbindungen" → Karten-Optik der Recents prüfen
  await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '14-home-recents-karte.png' });
  await dump('RECENTS-KARTE', [
    '.recent-connections .connection', '.recent-connections .connection .thumbnail > *',
  ]);
} finally {
  await fetch(API + '/session/data/postgresql/connections/' + conn.identifier, {
    method: 'DELETE', headers: { 'Guacamole-Token': authToken },
  });
  console.log('\nWegwerf-Verbindung ' + conn.identifier + ' gelöscht.');
}

await browser.close();
console.log('\nScreenshots: ' + OUT);
