# Kevin Connection Manager

[![Guacamole-Image mit Branding](https://github.com/keco216/kevin-connection-manager/actions/workflows/build-image.yml/badge.svg)](https://github.com/keco216/kevin-connection-manager/actions/workflows/build-image.yml)

Selbst gehostetes Remote-Desktop-Gateway (RDP · SSH · VNC) auf Basis von
[Apache Guacamole](https://guacamole.apache.org/) 1.6 – mit eigenem Design als
aufsteckbare Theme-Extension. **Kein Fork, keine Image-Modifikation:** Das
offizielle Guacamole bleibt unverändert, das Branding kommt als `.jar` dazu.

## Screenshots

| Anmeldung | Einstellungen |
|---|---|
| ![Anmeldung](docs/screenshots/login.png) | ![Einstellungen](docs/screenshots/einstellungen.png) |

| Verbindungs-Editor | Sitzungs-Dialoge |
|---|---|
| ![Verbindungs-Editor](docs/screenshots/verbindung-bearbeiten.png) | ![Sitzungs-Dialog](docs/screenshots/sitzungsdialog.png) |

## Features

- **Apache Guacamole 1.6.0 unverändert** – Remote-Desktop im Browser für RDP,
  SSH und VNC, ohne Client-Installation
- **Eigenes Theme als Extension** – Login, App-Leiste, Formulare, Tabellen,
  Dialoge und Icons in einheitlichem Look; Deutsch und Englisch
- **Fertiges Container-Image** – `ghcr.io/keco216/kcm-guacamole`
  (Guacamole + Branding), automatisch gebaut per GitHub Action
- **Deployment-fertig** – Portainer-Stack für den Server, Compose-Stack für
  die lokale Entwicklung

## Schnellstart (lokal, Docker Compose)

```powershell
.\scripts\init-db.ps1            # DB-Schema erzeugen (einmalig)
Copy-Item .env.example .env      # dann POSTGRES_PASSWORD setzen
docker compose up -d
```

Danach <http://localhost/> öffnen und mit `guacadmin / guacadmin` anmelden –
das Passwort sofort ändern (*Einstellungen → Benutzer*).

## Deployment (Portainer)

Stack aus [`deploy/docker-compose.portainer.yml`](deploy/docker-compose.portainer.yml)
anlegen, Stack-Umgebungsvariable `POSTGRES_PASSWORD` setzen, deployen.
Guacamole lauscht auf **Port 7070** – davor gehört ein Reverse-Proxy mit TLS
und WebSocket-Unterstützung (z. B. Nginx Proxy Manager).

Das Image `ghcr.io/keco216/kcm-guacamole:1.6.0` enthält die Branding-Extension
bereits; die GitHub Action baut es bei jeder Änderung an `guacamole-home/`
oder `Dockerfile` neu.

## Branding anpassen

Die Quellen liegen unter [`branding/src/`](branding/) (CSS, SVGs,
Übersetzungs-Overrides). Build-Anleitung und alle CSS-Stolperfallen:
[`branding/README.md`](branding/README.md). Automatisierte Sichtprüfung gegen
den laufenden Stack: [`scripts/branding-verify.mjs`](scripts/branding-verify.mjs)
(Playwright, Screenshots + Style-Dumps).

## Troubleshooting

| Problem | Lösung |
|---|---|
| „Too many failed authentication attempts" | Brute-Force-Schutz von Guacamole (5 Fehlversuche → 5 min Sperre). `docker compose restart guacamole` hebt sie sofort auf. |
| Login schlägt fehl, Logs melden fehlende Tabellen | Schema fehlte beim ersten Start: `docker compose down -v`, dann die Schnellstart-Schritte wiederholen. |
| Branding nicht sichtbar | Browser-Cache – im Privatfenster testen. Ladung prüfen: `docker compose logs guacamole \| Select-String kevin` |

## Architektur

```
Browser ──► Reverse-Proxy (TLS) ──► Guacamole-Webapp + Branding-Extension
                                      ├── PostgreSQL  (Benutzer, Verbindungen, Verlauf)
                                      └── guacd ─────► Zielsysteme (RDP / SSH / VNC)
```
