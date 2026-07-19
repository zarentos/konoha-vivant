// Pont entre la fenetre du jeu et Node. C'est main.js qui parle au LLM :
// depuis la page, un fetch vers localhost serait bloque par CORS.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("KV_BRIDGE", {
  status: ()      => ipcRenderer.invoke("kv-llm-status"),
  llm:    payload => ipcRenderer.invoke("kv-llm", payload),
  // progression du telechargement du modele
  onPull: cb      => ipcRenderer.on("kv-pull", (_e, data) => cb(data)),
  musique: ()     => ipcRenderer.invoke("kv-musique"),
  // le texte du LLM arrive au fur et a mesure qu'il est ecrit
  onChunk: cb     => ipcRenderer.on("kv-llm-chunk", (_e, data) => cb(data))
});
