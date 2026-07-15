// Einzige Brücke zwischen Renderer und Hauptprozess. Sie existiert nur für
// die Einrichtungsansicht (setup.html); die Guacamole-Oberfläche selbst läuft
// ohne jeden Zugriff auf diese API – sie ist Original-Code vom Server und
// bekommt bewusst keine zusätzlichen Fähigkeiten.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kcm", {
  saveServerUrl: (url) => ipcRenderer.invoke("kcm:save-server-url", url),
});
