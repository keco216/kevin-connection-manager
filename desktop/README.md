# Desktop-Client (Electron-Wrapper)

Ein natives Fenster um die **unveränderte** gebrandete Guacamole-Oberfläche.
Die App rendert nichts selbst und spricht die REST-API nicht an – sie lädt die
Weboberfläche vom Server, wie ein Browser es täte. Guacamole und die
Branding-Extension bleiben davon vollständig unberührt.

## Was der Wrapper beiträgt

- **Keine Browser-Shortcuts in der Sitzung.** Ohne Anwendungsmenü gibt es auch
  keine Accelerators: Strg+W, Strg+R und F11 landen in der RDP-Sitzung statt im
  Browser.
- **Berechtigungen vorab erteilt** statt Nachfrage-Dialoge: Zwischenablage in
  beide Richtungen, Mikrofon (`enable-audio-input`), Vollbild, Tastatur-Fang.
- **Eigenes Fenster** mit K-Logo, ohne Adressleiste; die Server-Adresse muss
  niemand kennen.
- **Eine Instanz.** Ein Zweitstart holt das vorhandene Fenster nach vorn, statt
  eine zweite Sitzung zu öffnen – bei Zielen mit nur einer erlaubten
  RDP-Sitzung (WAAGE) sonst ein sicherer Selbstabschuss.

Was er **nicht** kann: Strg+Alt+Entf abfangen. Windows verarbeitet die
Tastenfolge im Kernel, bevor irgendeine Anwendung sie sieht – das ist eine
Sicherheitsgarantie des Systems, kein Mangel des Wrappers. In der Sitzung
auslösen lässt sie sich weiterhin über Strg+Alt+Ende oder die
Bildschirmtastatur.

## Server-Adresse

Steht bewusst **nicht** im Code – das Repo ist öffentlich. Beim ersten Start
fragt die App danach und legt sie unter `%APPDATA%\kcm-desktop\config.json` ab.

**Server wechseln** geht auf drei Wegen:

| Weg | Wann |
|---|---|
| **Strg+Umschalt+F12** | jederzeit – fragt nach und zeigt dann die Einrichtung |
| Knopf *Adresse ändern* | erscheint automatisch, wenn der Server nicht antwortet |
| `config.json` löschen | wenn die App gar nicht erst startet |

Das Kürzel ist bewusst abwegig gewählt: Ein Menüeintrag wäre entdeckbarer,
brächte aber die Menü-Accelerators zurück (Alt öffnet die Menüleiste), die in
einer RDP-Sitzung nichts verloren haben. Strg+Alt+Umschalt scheidet ebenfalls
aus – damit öffnet Guacamole sein eigenes Sitzungsmenü.

Für die Entwicklung überschreibt `KCM_URL` den gespeicherten Wert:

```powershell
$env:KCM_URL = "http://localhost/guacamole/"; npm start
```

Achtung: Solange `KCM_URL` gesetzt ist, sticht sie die gespeicherte Adresse aus
– ein Wechsel über das Kürzel läuft dann ins Leere. Die App weist darauf hin,
statt scheinbar nichts zu tun.

## Bauen und Prüfen

```powershell
npm install          # einmalig
npm start            # Entwicklungslauf
npm run dist         # Installer nach dist/ (MSI, ~110 MB)
```

Das Ziel ist **MSI** statt NSIS, weil es sich unbeaufsichtigt und per
Gruppenrichtlinie/Intune verteilen lässt. Die Installation läuft
maschinenweit (`ALLUSERS=1`) und braucht deshalb Administratorrechte:

```powershell
msiexec /i "Kevin Connection Manager 1.0.0.msi" /quiet /norestart   # still installieren
msiexec /x "{79916D42-3520-44E9-A8DC-D74653A1C49B}" /quiet          # still entfernen
```

Der `UpgradeCode` `{3C8D6047-1914-589A-95BE-36040B023DD7}` leitet sich fest aus
der `appId` ab und bleibt über Versionen stabil – höhere Versionen ersetzen
niedrigere damit sauber. Der `ProductCode` oben wechselt dagegen pro Version;
zum Deinstallieren per Skript besser über den Namen suchen als ihn fest
einzutragen.

Sichtprüfung der Einrichtungsansicht (aus `scripts/`, braucht das dortige
Playwright):

```powershell
cd ..\scripts
node desktop-verify.mjs              # gegen die Entwicklungs-Installation
node desktop-verify.mjs --packaged   # gegen das Ergebnis von `npm run dist`
```

## Stolperfallen

- **Virenscanner frisst die Electron-Runtime.** Windows Defender stuft
  `node_modules/electron/dist/electron.exe` als `Trojan:Win32/Cinjo.O!cl` ein
  und entfernt sie – ein Fehlalarm der Cloud-Heuristik (Suffix `!cl`) auf die
  nackte Runtime. Symptom: `npm start` bzw. Playwright melden „Process failed
  to launch", der `dist`-Ordner ist vollständig, nur die `.exe` fehlt. Das
  **gebaute Paket ist nicht betroffen** (andere Bytes) – deshalb der Schalter
  `--packaged` in der Sichtprüfung. Wer die Entwicklungs-Installation braucht,
  kommt um eine Ausnahme im Scanner nicht herum; auf verwalteten Rechnern ist
  das eine Entscheidung der IT.
- **Der Installer ist unsigniert.** SmartScreen zeigt deshalb „Der Computer
  wurde durch Windows geschützt" – Weiterklicken über *Weitere Informationen →
  Trotzdem ausführen*. Ein Zertifikat würde die Warnung übrigens **nicht**
  sofort beseitigen: Reputation wird pro Signierer aufgebaut, und
  EV-Zertifikate umgehen SmartScreen seit 2024 nicht mehr. Für den internen
  Einsatz ist der Weg über eine vertrauenswürdige Intranet-Quelle vorgesehen,
  die der SmartScreen-Prüfung nicht unterliegt.
- **Berechtigungen hängen an der Server-Herkunft.** `main.js` erteilt sie nur
  der konfigurierten Origin. Auf der Einrichtungsansicht (`file://`) werden sie
  deshalb abgelehnt – das ist Absicht und kein Fehler, führt aber in Tests in
  die Irre: Ein Vollbild-/Keyboard-Lock-Versuch scheitert dort zwangsläufig.
- **Tastatur-Fang braucht Vollbild über die Fullscreen-API.** Electrons
  `setFullScreen()` genügt nicht – dabei bleibt `document.fullscreenElement`
  leer, und `navigator.keyboard.lock()` antwortet mit `InvalidStateError`.
  Guacamole 1.6 geht den richtigen Weg selbst (GUACAMOLE-1525, „true fullscreen
  mode and keyboard lock"); die API ist in Electron 43 vorhanden und geprüft.
- **Titelleiste bleibt die von Windows.** Ein Versuch, die Navy-App-Bar zur
  Titelzeile zu machen (`titleBarStyle: "hidden"` plus Overlay in Navy), war
  technisch erfolgreich – Leiste bündig oben, Ziehbereich aktiv, 138 px
  Freiraum für die Fenstersteuerung –, wurde nach Sichtprüfung aber wieder
  verworfen. Wer es erneut angeht: Die Ziehfläche muss per `insertCSS` aus dem
  Wrapper kommen (die Extension läuft auch im Browser, dort zerstört
  `-webkit-app-region: drag` nur die Textauswahl), Links/Schaltflächen/
  `.menu-dropdown` brauchen `no-drag` (eine Ziehfläche schluckt Klicks), und
  die Overlay-Höhe gehört gemessen statt geraten – in `kevin.css` ergibt sie
  sich aus Polsterung, Logo und Akzentkante.
- **Icon:** kommt aus `branding/src/images/kevin-logo.svg`. Nach Änderungen
  dort neu rendern mit `cd scripts && node make-desktop-icon.mjs`.

## Aufbau

| Datei | Zweck |
|---|---|
| `src/main.js` | Fenster, Konfiguration, Berechtigungen, Navigations-Sperre |
| `src/preload.js` | einzige Brücke zum Renderer – nur für die Einrichtung |
| `src/setup.html` / `setup.js` | Einrichtungsansicht (Kevin-Look, ohne Server erreichbar) |
| `build/icon.png` | aus dem K-Logo gerendert |

Der Renderer läuft mit `contextIsolation`, ohne `nodeIntegration` und in der
Sandbox: Die vom Server geladene Oberfläche bekommt keinerlei Node-Zugriff.
Navigation ist auf die konfigurierte Herkunft beschränkt, alles andere geht an
den Standardbrowser.
