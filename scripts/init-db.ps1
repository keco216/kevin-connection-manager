# Erzeugt das Guacamole-PostgreSQL-Schema nach initdb/01-schema.sql.
#
# WICHTIG: Die Datei wird bewusst IM Container geschrieben (UTF-8 ohne BOM).
# PowerShell-Redirection auf dem Host (docker run ... > datei.sql) würde
# UTF-16 bzw. eine BOM erzeugen – PostgreSQL scheitert damit beim Init.

$ErrorActionPreference = "Stop"

# Projektwurzel = Ordner oberhalb dieses Skripts (funktioniert aus jedem Verzeichnis)
$projectRoot = Split-Path -Parent $PSScriptRoot
$initdbDir = Join-Path $projectRoot "initdb"

if (-not (Test-Path $initdbDir)) {
    New-Item -ItemType Directory -Path $initdbDir | Out-Null
}

Write-Host "Erzeuge Guacamole-Schema (guacamole/guacamole:1.6.0) ..."
docker run --rm -v "${initdbDir}:/out" guacamole/guacamole:1.6.0 `
    sh -c "/opt/guacamole/bin/initdb.sh --postgresql > /out/01-schema.sql"

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker run ist fehlgeschlagen (Exit-Code $LASTEXITCODE). Läuft Docker Desktop?"
    exit 1
}

$schemaFile = Join-Path $initdbDir "01-schema.sql"
if (-not (Test-Path $schemaFile)) {
    Write-Error "Schema-Datei wurde nicht erzeugt: $schemaFile"
    exit 1
}

$size = [math]::Round((Get-Item $schemaFile).Length / 1KB)
Write-Host "Fertig: initdb\01-schema.sql ($size KB)"
Write-Host "Hinweis: Das Schema wird nur beim ALLERERSTEN Start der Datenbank eingespielt."
Write-Host "Falls der Stack schon lief: docker compose down -v und danach neu starten."
