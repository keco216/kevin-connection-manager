# Kevin Connection Manager – offizielles Guacamole-Image plus Branding-Extension.
# Kein Fork: Das Original-Image bleibt unverändert, die Extension wird nur über
# GUACAMOLE_HOME aufgesteckt – derselbe Mechanismus wie das lokale Read-only-
# Volume, hier ins Image eingebacken für Deployments ohne Bind-Mounts (Portainer).
FROM guacamole/guacamole:1.6.0

ENV GUACAMOLE_HOME=/opt/kevin/guacamole-home
COPY guacamole-home/ /opt/kevin/guacamole-home/
