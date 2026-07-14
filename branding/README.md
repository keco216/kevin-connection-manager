# Kevin Branding – Theme-Extension für die Original-Guacamole-UI (M7 v1 + M7.1)

Bringt die unter `/guacamole/` erreichbare Original-UI (Admin-Fallback) ins Kevin-Design:
Navy-Hintergrund und K-Logo auf dem Login, Kopfleiste in Navy mit gelbem Akzent,
Buttons/Links in Primärblau, App-Name „Kevin Connection Manager" (via Übersetzungs-Override
`APP.NAME`, deutsch und englisch). Kein Struktur-Umbau der AngularJS-UI – reines Branding.
Seit M7.1 zusätzlich: selbst gehostete IBM-Plex-Schrift (WOFF2 in der .jar), Pager im
Keeper-Look, Bildschirmtastatur, Recording-Player und die Sonderansichten der index-Ebene
(429-Sperre/„Abgemeldet"/fataler Fehler) im Kevin-Design.

## Aufbau im Repo

- `branding/src/` – Quellen der Extension; `guac-manifest.json` muss im **Root** der
  .jar liegen (deshalb wird aus `src/` heraus gepackt)
- `guacamole-home/extensions/kevin-branding-1.0.0.jar` – gebaute Extension

## HTML-Patches (App-Bar-Navigation)

Guacamole-Extensions dürfen neben CSS auch **HTML-Patches** liefern
(`"html"` im Manifest) – der offizielle Weg, Elemente in die UI einzufügen,
ohne das Original anzufassen. Ein Patch-File enthält `<meta name="OP"
content="CSS-SELEKTOR">`-Direktiven (OP: before / after / replace /
before-children / after-children / replace-children); das übrige Markup
wird beim Laden JEDES Angular-Templates, in dem der Selektor matcht,
VOR dem Compile eingefügt – `translate`-Attribute funktionieren also.
`html/kevin-nav.html` hängt so die Keeper-Navigation („Meine
Verbindungen", „Einstellungen", Keys `KEVIN.NAV_*` aus den
Übersetzungs-Overrides) vor jedes `guac-user-menu`; im schmalen
Sitzungsmenü blendet kevin.css sie aus (`#guac-menu .kevin-nav`).
Achtung: EIN Patch-File = EIN Markup-Block – bei mehreren
Meta-Direktiven im selben File wird derselbe Block mehrfach eingefügt.

## Extension-JS (Favicon)

Die `<link rel="icon">`-Tags stehen in der index.html – KEIN
Angular-Template, HTML-Patches greifen dort nicht. Dafür liefert die
Extension `js/kevin-favicon.js` (`"js"` im Manifest, wird in das
gebündelte `app.js` der Webapp aufgenommen und nach dem DOM-Aufbau
ausgeführt): entfernt Guacamoles Favicon-/Touch-Icon-Links, setzt das
K-Logo (`kevin-logo.svg`, bereits Extension-Ressource) als
SVG-Favicon und `meta[name=theme-color]` auf Marken-Navy – Vivaldi &
Co. färben den Tab sonst nach dem grünen Stock-Logo ein. Browser
cachen Favicons hartnäckig: Nach dem Update ggf. neuer Tab oder
Browser-Neustart statt nur F5.

Die Verdrahtung übernimmt `docker-compose.yml` (Service `guacamole`):
`GUACAMOLE_HOME: /opt/kevin/guacamole-home` plus Read-only-Volume
`./guacamole-home:/opt/kevin/guacamole-home:ro`. Das Startskript des Images kopiert
den Inhalt beim Start in sein eigenes GUACAMOLE_HOME – Extensions dort werden
zusätzlich zur automatisch konfigurierten JDBC-Extension geladen.

## Neu bauen (nach Änderungen an den Quellen)

```powershell
cd branding\src
Compress-Archive -Path * -DestinationPath ..\kevin-branding-1.0.0.zip -Force
Move-Item ..\kevin-branding-1.0.0.zip ..\..\guacamole-home\extensions\kevin-branding-1.0.0.jar -Force
cd ..\..
docker compose up -d --force-recreate guacamole
```

(`Move-Item -Force` statt `Rename-Item -Force`: Letzteres überschreibt keine
existierende Ziel-Datei und scheitert ab dem zweiten Build.)

Danach prüfen:

```powershell
docker compose logs guacamole | Select-String -Pattern "kevin"
```

Erwartet: eine Log-Zeile, dass die Extension „Kevin Connection Manager Branding"
geladen wurde. Danach `http://localhost/guacamole/` im Privatfenster öffnen (Cache!) –
Login sollte navy mit K-Logo erscheinen.

## Wartungshinweise

- **Versionsbindung:** `guacamoleVersion` im Manifest ist auf `1.6.0` gepinnt und
  muss bei einem Guacamole-Upgrade mit angehoben werden, sonst verweigert der
  Server das Laden der Extension.
- **Extension-CSS lädt VOR dem Stock-CSS** (1.6.0, ein Webpack-Chunk
  `1.guacamole.<hash>.css`): Bei gleicher Selektor-Spezifität gewinnt also
  IMMER Stock – Layout-Overrides (`display`, `width`) brauchen deshalb
  `!important` oder eine höhere Spezifität. Die Stock-Regeln lassen sich
  gezielt nachschlagen: CSS-Datei von `http://localhost/guacamole/` laden
  und nach der Klasse greppen (kein Raten über DevTools nötig).
- **Formular-Layout (Keeper):** Die guac-form-Zeilen (`.labeled-field`)
  sind bei Stock `display:table-row`; die Extension stellt auf Flex um –
  kompakte Controls (`.number-field`/`.checkbox-field`/`.time-field`/
  `.date-field` via `:has()`) als Zeile mit Feld rechtsbündig, Text/Select
  als Label über vollbreitem Feld. Stolperfallen: `.connection-parameters`
  gibt den `form-field`-Zellen `width:100%` (→ `width:auto !important` in
  den Flex-Zeilen), `.location` erbt Stocks `max-width:16em`, und die
  `.fields`-Tabelle schrumpft auf Inhaltsbreite (→ `display:block`).
- **Baum-/Listen-Icons:** eigene `tree-*.svg` ersetzen die Stock-Bilder
  über deren Original-Selektoren (`.connection-group > .caption .icon`,
  `.connection > .caption .icon.rdp` …, `.icon.user`); `:not(.expand)`
  schützt die Chevron-Expander, `:not(.add)` die weißen Icons der
  Toolbar-Buttons. Gruppen = Primärblau gefüllt (zu/offen), Verbindungen
  = Outline (Monitor/Terminal/Stecker), Benutzer/Benutzergruppen =
  Outline-Personen. Weitere Stock-Fallen aus dem Feinschliff:
  `.placeholder` hat `opacity:.5` + Text-Schatten, `.header .filter`
  bringt `.5em` Eigen-Padding mit (bricht Fluchtlinien), und die
  Toolbar-Buttons sind auf `.8em` verkleinert (Keeper: volle Größe).
- **Einheitliche Kontroll-Metrik:** Stock rendert Felder mit
  `font-size:.8em`/`padding:.25em` (Text-, Zahl- und Datumsfelder werden
  unterschiedlich hoch) und Buttons ohne geerbte Schrift – die generische
  Feld-/Buttonregel setzt deshalb 14px/festes Padding (alle ~32–34px).
  Der Kartenschatten der manage-Formulare liegt auf JEDEM Segment;
  blur == |spread| ist Pflicht, sonst malt jedes Segment eine
  Schattennaht über seinen Nachbarn.
- **Benutzer-Menü:** Zeilen einheitlich (Padding/Icon-Raster), eigene
  `menu-*.svg` (Zuordnung über li-Position, NICHT über href – der
  Startseiten-Link verliert sein href, wenn er der aktuelle Ort ist);
  den aktuellen Ort markiert Stock mit `a.current` und `opacity:.25`
  (→ lesbares Grau), Aktions-Links (Abmelden) haben nie ein href.
  **Hover-Regeln NUR mit background-color:** Das background-Shorthand
  löscht die Zeilen-Icons (background-image) beim Hover – Abmelden und
  Vollbild verloren so ihr Icon unterm Cursor (gefixt). **Vollbild im
  Sitzungsmenü trägt KEINE Klasse** (Guacamole-Tippfehler `classname:`
  statt `className:` in der Action-Definition) – das eigene
  `menu-fullscreen.svg` hängt deshalb an der Listen-Position
  `ul.action-list > li:nth-child(2) > a`; bei einem Guacamole-Upgrade
  prüfen, ob der Tippfehler gefixt wurde (dann besser `a.fullscreen`).
  Die `.header`-Grundlinie (border-bottom) braucht `!important` –
  und damit auch die gelbe Akzentkante der App-Bar.
  **ACHTUNG verschachtelte page-list:** Die page-list im Menü enthält
  UNTEREBENEN (Settings-Unterseiten) – Icon-/Padding-Regeln strikt über
  `> ul.page-list-level > li > a` binden und die tieferen Ebenen per
  display:none verbergen, sonst kachelt das Zahnrad über die Zeile.
- **Tabellen/Statusdialog:** `table.sorted th` hat bei Stock KEIN
  text-align (Browser zentriert → Spaltentitel standen neben den
  Werten, deshalb text-align:left). Die Statusdialog-Buttons
  home/reconnect/logout tragen Stock-::before-Icons in WEISS – auf
  hellen Kevin-Buttons per `filter: brightness(0)` einfärben (ebenso
  button.back auf der grauen Sekundärfläche).
- **Verlauf im Verbindungsformular:** Die history-Tabelle ist KEIN
  `table.sorted` (eigene Regeln über `.view .history`): Kopfbalken,
  linksbündig, Zebra, Uhr-Icon vor Spalte 3 (tab-history als mask).
  Wegen nowrap läuft sie per negativem margin bis kurz vor die
  Kartenkanten (Keeper), sonst ragt sie aus dem 40px-Segment-Padding.
  Pager global als Keeper-Kästchen (`.pager .set-page`), Danger-Buttons
  als Outline-Rot mit Vollrot erst im Hover (Keeper-„Löschen").
- **Präferenzen-Seite:** Sprache/Zeitzone als kompakte Keeper-Zeilen
  mit Globus-/Uhr-Icon (field-globe.svg bzw. tab-history.svg als mask;
  Zuordnung per nth-of-type), Eingabemethoden-Icons wie im Sitzungs-
  menü (gemeinsame `.choice`-Regeln), Mausemulations-Blöcke unter-
  einander linksbündig. Die Appearance-Sektion hat in 1.6.0 KEINE
  deutsche Übersetzung – die vier SETTINGS_PREFERENCES-Keys liefert
  unsere de.json nach („Darstellung" …).
- **Recents-Hover:** Keeper legt einen GRAUEN Schleier über das ganze
  Thumbnail (::before, rgba-grau) unter dem „Öffnen"-Button; Stocks
  „remove-recent"-X oben rechts ist ausgeblendet (Keeper zeigt keins –
  Einträge verdrängen sich ohnehin selbst aus der Liste).
- **Sitzungsmenü (Client):** Die Geräte-Kachel NUR über
  background-color stylen – das background-Shorthand löscht Stocks
  drive.svg. „Trennen" wie Keeper weiß mit rotem Text (Vollrot im
  Hover); Stocks x.svg ist WEISS → eigenes X als mask in currentColor
  (menu-disconnect.svg).
- **Verbindungs-Dropdown im Sitzungsmenü:** Erscheint NATIV, sobald
  der Baum MEHR ALS EINE Verbindung/Balancing-Gruppe enthält (Client-
  Controller: `getClientPages(tree).length > 1` → erst dann wird
  `rootConnectionGroups` gesetzt; im Template ng-show, der schlichte
  Namens-Titel ng-hide). Mit nur WAAGE im System bleibt es also
  bewusst weg – KEIN ng-hide-Override versuchen (zeigt eine leere
  Hülle, Angular befüllt den Baum nicht). Die Extension stylt Feld
  (weiß in der Navy-Bar) und Baum-Karte; text-transform:none nötig,
  sonst erben die Einträge das VERSAL der Kopfzeilen-h2.
- **Schrift (IBM Plex, M7.1):** WOFF2-Schnitte liegen unter `src/fonts/`
  (Sans 400/500/600/700 + Mono 400, „complete"-Builds von github.com/IBM/plex,
  SIL-OFL-Lizenz liegt bei) und sind im Manifest als Ressourcen (`font/woff2`)
  deklariert. `@font-face` in kevin.css lädt sie über
  `app/ext/kevin-branding/fonts/…`; die Aktivierung braucht `body { font-family
  … !important }`, weil Stocks `body{font-family:Carlito,…}` dieselbe
  Spezifität hat und später lädt. Kursive Schnitte sind bewusst nicht dabei.
- **Pager-Pfeile (M7.1):** Stock legt die Pfeil-SVGs als `background-image`
  auf `.pager .icon.first/prev/next/last-page` (24px-`.icon`-Metrik). Kevin:
  `background:#fff` (löscht das Stock-Bild mit), 30px-Kästchen wie
  `.set-page`, eigenes Chevron als mask-::before in currentColor; linke
  Varianten per `transform: scaleX(-1)` am ::before (nicht am Kästchen,
  sonst wandert der 1px-Rahmen). `.set-page.current` braucht
  `border-radius !important` – Stock setzt dort `.2em` auf gleicher
  Spezifität.
- **Bildschirmtastatur (M7.1):** `.keyboard-container` (Stock #222,
  opacity .85) → Navy mit gelber 2px-Oberkante, opacity 1. Tasten
  `--kb-osk-key`/`--kb-osk-key-border`, Zustände: `.highlight` Primary,
  `.guac-keyboard-pressed` Primary-Hover mit Accent-Rand, aktive Modifier
  (Selektorliste 1:1 aus dem Stock-CSS: modifier-shift/-caps/-control/
  -alt/-alt-gr/-super) Accent-Gelb mit Navy-Schrift. Alles !important
  (gleiche Spezifität wie Stock). Test ohne echte Session: Verbindung auf
  `203.0.113.1` (Dauer-Spinner), Menü → Bildschirmtastatur.
- **Sonderansichten der index-Ebene (M7.1):** Die drei applicationState-
  Modals AUSSERHALB der login-ui (`.logged-out-modal`,
  `.automatic-login-rejected-modal`, `.fatal-page-error-modal`) sind
  weiße Kevin-Karten (K-Logo als ::before) auf Navy-`guac-modal`.
  WICHTIG zur 429-Sperre: Der gebannte POST /tokens liefert
  `type: BAD_REQUEST` – die Sonderansicht erscheint aber NUR, wenn die
  login-ui noch nicht offen war (z. B. Login über URL-Parameter). Der
  Normalfall (Login-Versuch in der offenen login-ui während Sperre)
  landet als `.login-error` IN der login-ui – beide Wege zeigen die
  deutsche Meldung aus unserer de.json (`LOGIN.ERROR_TOO_MANY_ATTEMPTS`
  fehlt im 1.6.0-Sprachpaket). Reproduktion der Sonderansicht:
  `/guacamole/?username=x&password=y` bei aktiver Sperre aufrufen.
- **Recording-Player (M7.1, ungeprüft bis M8):** Ladekreis
  (`guac-player-progress-indicator`, Stock #5af) → Accent; Steuerleiste
  → Navy-transparent; Seek ist ein `input type="range"` → `accent-color`;
  `.guac-player-button` → Primärbutton. Nach Stock-Selektoren gebaut,
  echte Sichtprüfung erst mit Session-Recording (M8).
- **Versteckte Service-textareas (Weißer-Kasten-Bug, gefixt):** Guacamole
  hängt zwei unsichtbare textareas DIREKT an den body: die Zwischenablage-
  Synchronisation (`.clipboard-service-target`, Stock parkt sie 1em×1em bei
  `left:-1em` – exakt außerhalb) und den 0×0-Tastatur-Sink (Inline-Styles,
  ohne Klasse). Die generische Feld-Metrik (`textarea { padding; border }`)
  machte das Clipboard-Element 22px breit → 8px weißer Streifen ragte in
  den Viewport, dank `overflow:hidden` MIT Resize-Griff: einmal angefasst
  wurde daraus ein großer weißer Kasten (in RDP-Sitzungen aufgefallen;
  beim Fenster-Fokuswechsel bekam er zusätzlich unseren Fokus-Ring).
  Fix in kevin.css: `body > textarea` neutralisieren (padding/border/
  background weg, `resize:none`, `pointer-events:none`) + `opacity:0`,
  und die Fokus-Ring-Regel nimmt `body > textarea` per
  `:not(:where(…))` aus. NIEMALS `display:none`/`visibility:hidden` –
  der Service braucht das Element fokussier-/selektierbar, sonst bricht
  die Zwischenablage der Original-UI.
- **v1-Vorbehalt:** Die CSS-Selektoren zielen auf die bekannten Klassen der
  Stock-UI (`.login-ui`, `.login-dialog .logo`, `.header`, Buttons). Einzelne
  Elemente können je nach 1.6-Feinheiten noch unverändert bleiben – dann per
  Browser-DevTools den Selektor ermitteln und in `src/css/kevin.css` ergänzen.
- **Archiv-Einträge** müssen Forward-Slashes tragen (`css/kevin.css`);
  `Compress-Archive` unter PowerShell 7 macht das korrekt – nach dem Bauen im
  Zweifel mit `unzip -l` gegenprüfen.
