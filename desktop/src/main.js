// Kevin Connection Manager – Desktop-Client (Electron-Wrapper).
//
// Die App rendert NICHTS selbst: Sie lädt die unveränderte, gebrandete
// Guacamole-Oberfläche vom Server. Der Mehrwert liegt allein in der
// Verpackung – eigenes Fenster ohne Browser-Leiste, keine Browser-Shortcuts,
// die in eine RDP-Sitzung grätschen, Zwischenablage/Mikrofon vorab
// freigegeben.
//
// Die Server-Adresse steht bewusst NICHT im Code: Sie wird beim ersten Start
// abgefragt und liegt danach in der Konfiguration des Benutzerprofils.

const { app, BrowserWindow, Menu, dialog, shell, ipcMain, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

// --- Konfiguration -------------------------------------------------------

const CONFIG_FILE = path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

// Nur echte http(s)-Adressen zulassen – der Wert landet in loadURL und in der
// Navigations-Sperre unten, ein "javascript:"-Eintrag wäre eine offene Tür.
function normalizeServerUrl(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Guacamole lebt unter /guacamole/ – die Eingabe der nackten Domain ist der
  // erwartbare Normalfall und wird still ergänzt.
  if (url.pathname === "/" || url.pathname === "") url.pathname = "/guacamole/";
  return url.toString();
}

// KCM_URL überschreibt die gespeicherte Adresse (Entwicklung gegen den
// lokalen Stack, ohne die Konfiguration des Profils anzufassen).
function currentServerUrl() {
  return normalizeServerUrl(process.env.KCM_URL) ?? readConfig().serverUrl ?? null;
}

// --- Fenster -------------------------------------------------------------

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#0F1E3D", // Marken-Navy: kein weißes Blitzen vor dem ersten Frame
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // Wir laden entfernte Inhalte – der Renderer bekommt daher keinerlei
      // Node-Zugriff. Die Brücke in preload.js ist die einzige Verbindung.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Ohne Menü gibt es auch keine Menü-Accelerators (Strg+W, Strg+R, F11 …),
  // die sonst mitten in einer Sitzung feuern. Deshalb hängt der Serverwechsel
  // an einem Tastenkürzel statt an einem Menüeintrag.
  Menu.setApplicationMenu(null);

  // Läuft vor dem Renderer – greift also auch, während Guacamole die Tastatur
  // für die Sitzung fängt.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!CHANGE_SERVER_KEY(input)) return;
    event.preventDefault();
    askChangeServer();
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Links mit target=_blank gehören in den Standardbrowser, nicht in ein
  // zweites, menüloses Elektron-Fenster.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Navigation fest auf die konfigurierte Herkunft nageln: Ein kompromittierter
  // oder vertippter Server soll das Fenster nicht auf eine fremde Seite
  // schicken können.
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const server = currentServerUrl();
    if (!server) return; // Setup-Ansicht: file://, keine Navigation erwartet
    if (new URL(targetUrl).origin !== new URL(server).origin) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  // Der zuverlässige Weg, einen unerreichbaren Server zu bemerken: Das Promise
  // von loadURL() verwirft dabei NICHT – die Navigation gelingt aus Chromiums
  // Sicht, nur eben auf die eigene Fehlerseite. Ohne diesen Zweig landet man
  // stumm auf chrome-error://chromewebdata/.
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, failedUrl, isMainFrame) => {
    if (!isMainFrame) return; // Unterframes/Ressourcen sind hier egal
    if (errorCode === -3) return; // ERR_ABORTED: eigene Navigation, kein Fehler
    showConnectionError(failedUrl || currentServerUrl(), errorDescription);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    dialog.showErrorBox(
      "Sitzung abgestürzt",
      `Die Darstellung wurde unerwartet beendet (${details.reason}). Die App lädt neu.`,
    );
    loadEntryPoint();
  });

  loadEntryPoint();
}

// Ohne Server-Adresse zuerst die Einrichtung zeigen, sonst direkt Guacamole.
// Fehler meldet der did-fail-load-Zweig, nicht dieses Promise (s. dort).
function loadEntryPoint() {
  const server = currentServerUrl();
  if (server) mainWindow.loadURL(server).catch(() => {});
  else mainWindow.loadFile(path.join(__dirname, "setup.html"));
}

let errorDialogOpen = false;

async function showConnectionError(server, reason) {
  // did-fail-load kann für eine Navigation mehrfach feuern – ohne die Sperre
  // stapeln sich die Dialoge.
  if (errorDialogOpen) return;
  errorDialogOpen = true;

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "error",
    title: "Server nicht erreichbar",
    message: "Der Server konnte nicht geladen werden.",
    detail: `${server}\n\n${reason ?? "Adresse falsch oder Netzwerk nicht erreichbar?"}`,
    buttons: ["Erneut versuchen", "Adresse ändern", "Beenden"],
    defaultId: 0,
    cancelId: 2,
  });

  errorDialogOpen = false;

  if (response === 0) loadEntryPoint();
  else if (response === 1) forgetServer();
  else app.quit();
}

// --- Server wechseln -----------------------------------------------------

// Verwirft die gespeicherte Adresse; loadEntryPoint zeigt daraufhin wieder die
// Einrichtung. Erreichbar über den Fehlerdialog und über CHANGE_SERVER_KEY.
function forgetServer() {
  const config = readConfig();
  delete config.serverUrl;
  writeConfig(config);

  if (process.env.KCM_URL) {
    // Sonst steht sofort wieder die alte Adresse da und das Vergessen wirkt
    // kaputt: Die Umgebungsvariable sticht die Konfiguration aus.
    dialog.showErrorBox(
      "Adresse kommt aus der Umgebung",
      "KCM_URL ist gesetzt und hat Vorrang vor der gespeicherten Adresse.\n\n" +
        "Zum Wechseln die Variable entfernen und die App neu starten.",
    );
    return;
  }

  loadEntryPoint();
}

// Bewusster Wechsel per Tastatur. Absichtlich ein Kürzel, das in einer
// RDP-Sitzung niemand braucht: Guacamole belegt Strg+Alt+Shift bereits mit
// seinem Sitzungsmenü, und alles Gängigere gehört dem entfernten Rechner.
const CHANGE_SERVER_KEY = (input) =>
  input.type === "keyDown" && input.control && input.shift && input.key === "F12";

async function askChangeServer() {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    title: "Server wechseln",
    message: "Andere Server-Adresse eingeben?",
    detail: "Eine offene Sitzung wird dabei getrennt.",
    buttons: ["Abbrechen", "Adresse ändern"],
    defaultId: 1,
    cancelId: 0,
  });

  if (response === 1) forgetServer();
}

// --- Berechtigungen ------------------------------------------------------

// Guacamole braucht diese Rechte für den normalen Betrieb; im Browser fragt
// Chrome den Nutzer, hier ist die Herkunft bekannt und fest verdrahtet.
// Alles andere wird abgelehnt.
const GRANTED_PERMISSIONS = new Set([
  "clipboard-read", // Zwischenablage Host → Sitzung
  "clipboard-sanitized-write", // Zwischenablage Sitzung → Host
  "fullscreen",
  "keyboardLock", // Tastatur-Fang: Alt+Tab, Windows-Taste … an die Sitzung
  "pointerLock",
  "media", // Mikrofon (RDP-Parameter enable-audio-input)
]);

function isTrustedOrigin(url) {
  const server = currentServerUrl();
  if (!server || !url) return false;
  try {
    return new URL(url).origin === new URL(server).origin;
  } catch {
    return false;
  }
}

function installPermissionHandlers() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents?.getURL();
    callback(GRANTED_PERMISSIONS.has(permission) && isTrustedOrigin(url));
  });

  // Manche Abfragen laufen synchron (u. a. die Vorab-Prüfung der
  // Zwischenablage) – ohne diesen Handler meldet Electron "denied", und der
  // Abgleich der Zwischenablage bleibt still tot.
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    GRANTED_PERMISSIONS.has(permission) && isTrustedOrigin(requestingOrigin),
  );
}

// --- Einrichtung (IPC aus setup.html) ------------------------------------

ipcMain.handle("kcm:save-server-url", (_event, raw) => {
  const serverUrl = normalizeServerUrl(raw);
  if (!serverUrl) return { ok: false, error: "Bitte eine vollständige Adresse angeben, z. B. https://guacamole.example.com" };

  writeConfig({ ...readConfig(), serverUrl });
  loadEntryPoint();
  return { ok: true };
});

// --- Start ---------------------------------------------------------------

// Zweitstart bringt das vorhandene Fenster nach vorn, statt eine zweite
// Sitzung zu öffnen (die das Ziel bei Single-Session-Hosts abschießen würde).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    installPermissionHandlers();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
