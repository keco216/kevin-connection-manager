# Kevin Branding – Theme-Extension für die Original-Guacamole-UI (M7 v1)

Bringt die unter `/guacamole/` erreichbare Original-UI (Admin-Fallback) ins Kevin-Design:
Navy-Hintergrund und K-Logo auf dem Login, Kopfleiste in Navy mit gelbem Akzent,
Buttons/Links in Primärblau, App-Name „Kevin Connection Manager" (via Übersetzungs-Override
`APP.NAME`, deutsch und englisch). Kein Struktur-Umbau der AngularJS-UI – reines Branding.

## Aufbau im Repo

- `branding/src/` – Quellen der Extension; `guac-manifest.json` muss im **Root** der
  .jar liegen (deshalb wird aus `src/` heraus gepackt)
- `guacamole-home/extensions/kevin-branding-1.0.0.jar` – gebaute Extension

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
- **v1-Vorbehalt:** Die CSS-Selektoren zielen auf die bekannten Klassen der
  Stock-UI (`.login-ui`, `.login-dialog .logo`, `.header`, Buttons). Einzelne
  Elemente können je nach 1.6-Feinheiten noch unverändert bleiben – dann per
  Browser-DevTools den Selektor ermitteln und in `src/css/kevin.css` ergänzen.
- **Archiv-Einträge** müssen Forward-Slashes tragen (`css/kevin.css`);
  `Compress-Archive` unter PowerShell 7 macht das korrekt – nach dem Bauen im
  Zweifel mit `unzip -l` gegenprüfen.
