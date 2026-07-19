const { app, BrowserWindow, session, ipcMain } = require("electron");
const path = require("path");
const fs   = require("fs");
const os   = require("os");

/* ================================================================ CONFIG */
const DEFAULTS = {
  moteur: "auto",          // auto | embarque | ollama | groq | gemini | off
  modele: "auto",          // auto | petit | moyen | grand
  modeles: {
    petit: { uri: "hf:Qwen/Qwen3-1.7B-GGUF:Q4_K_M", nom: "Qwen3 1.7B", go: 1.2 },
    moyen: { uri: "hf:Qwen/Qwen3-4B-GGUF:Q4_K_M",   nom: "Qwen3 4B",   go: 2.6 },
    grand: { uri: "hf:Qwen/Qwen3-8B-GGUF:Q4_K_M",   nom: "Qwen3 8B",   go: 5.1 }
  },
  ollama: { url: "http://localhost:11434", model: "qwen3:4b" },
  groq:   { cle: "", model: "llama-3.3-70b-versatile" },
  gemini: { cle: "", model: "gemini-2.5-flash" }
};
let CFG = DEFAULTS;

function loadConfig() {
  const spots = [
    path.join(app.getPath("userData"), "konoha.config.json"),
    path.join(__dirname, "konoha.config.json")
  ];
  for (const p of spots) {
    try {
      if (fs.existsSync(p)) {
        const c = JSON.parse(fs.readFileSync(p, "utf8"));
        console.log("[KV] config :", p);
        return Object.assign({}, DEFAULTS, c);
      }
    } catch (e) { console.warn("[KV] config illisible :", p, e.message); }
  }
  return DEFAULTS;
}

/* ================================================================ 1. MOTEUR EMBARQUE
   node-llama-cpp : llama.cpp compile dans l'appli. Aucune installation cote utilisateur.
   Le modele (2 a 5 Go de poids) est telecharge UNE FOIS au premier lancement, par le jeu,
   avec une barre de progression. Ensuite : hors ligne, illimite, a vie.
*/
let LC = null, LLAMA = null, MODEL = null, CTX = null, SESSION = null;
let LOCAL_LABEL = null, LOCAL_KO = null;
let file = Promise.resolve();          // on serialise : une inference a la fois

// Qwen3 "reflechit" avant de repondre (<think>...</think>), et un modele libre part en vrille.
// La grammaire force la generation token par token : il ne PEUT PAS sortir autre chose que ca.
const SCHEMAS = {
  dialogue: {
    type: "object",
    properties: {
      dialogue: {
        type: "array",
        items: {
          type: "object",
          properties: { qui: { type: "string" }, dit: { type: "string" } },
          required: ["qui", "dit"]
        }
      }
    },
    required: ["dialogue"]
  },
  repliques: {
    type: "object",
    properties: { lignes: { type: "array", items: { type: "string" } } },
    required: ["lignes"]
  },
  // La REACTION : le modele COMPOSE lui-meme une suite de gestes elementaires.
  // Il n'y a pas de menu de comportements — juste une grammaire.
  reaction: {
    type: "object",
    properties: {
      suite: {
        type: "array",
        items: {
          type: "object",
          properties: {
            quoi:  { enum: ["aller_vers","s_eloigner","s_arreter","regarder","suivre",
                            "geste","dire","attendre","provoquer","toucher","soigner"] },
            cible: { type: "string" },
            texte: { type: "string" }
          },
          required: ["quoi"]
        }
      }
    },
    required: ["suite"]
  },
  actions: {
    type: "object",
    properties: {
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            qui:   { type: "string" },
            but:   { enum: ["parler", "provoquer", "venger", "eviter", "soigner", "seul"] },
            cible: { type: "string" },
            style: { enum: ["normal", "rage", "prudent", "distance", "achever"] },
            dit:   { type: "string" }
          },
          required: ["qui", "but"]
        }
      }
    },
    required: ["actions"]
  }
};
const GRAM = {};
async function grammaire(nom) {
  if (!SCHEMAS[nom]) return undefined;
  if (!GRAM[nom]) GRAM[nom] = await LLAMA.createGrammarForJsonSchema(SCHEMAS[nom]);
  return GRAM[nom];
}

function choisirNiveau() {
  if (CFG.modele && CFG.modele !== "auto" && CFG.modeles[CFG.modele]) return CFG.modele;
  const go = os.totalmem() / 1e9;
  if (go >= 15)  return "grand";       // 16 Go+ : on peut se permettre du 8B
  if (go >= 7.5) return "moyen";       // 8 Go   : 4B, le bon compromis
  return "petit";                      // en dessous : 1.7B, ou rien
}

async function localInit(win) {
  if (MODEL) return true;
  if (LOCAL_KO) return false;

  const dire = (o) => { try { win && win.webContents.send("kv-pull", o); } catch (e) {} };

  try {
    LC = await import("node-llama-cpp");
    LLAMA = await LC.getLlama({ build: "never", gpu: "auto" });

    const niveau = choisirNiveau();
    const M = CFG.modeles[niveau];
    const dir = path.join(app.getPath("userData"), "modeles");
    fs.mkdirSync(dir, { recursive: true });

    dire({ pct: 0, status: "Préparation du cerveau — " + M.nom + " (" + M.go + " Go)" });

    const modelPath = await LC.resolveModelFile(M.uri, {
      directory: dir,
      cli: false,
      onProgress({ totalSize, downloadedSize }) {
        const pct = totalSize ? Math.round(100 * downloadedSize / totalSize) : 0;
        dire({
          pct,
          status: "Téléchargement du cerveau — " + M.nom + "\n"
                + (downloadedSize / 1e9).toFixed(2) + " / " + (totalSize / 1e9).toFixed(2) + " Go"
                + "\n(une seule fois, jamais plus)"
        });
      }
    });

    dire({ pct: 100, status: "Chargement du cerveau…" });
    MODEL   = await LLAMA.loadModel({ modelPath });
    CTX     = await MODEL.createContext({ contextSize: 2048, sequences: 1 });   // nos prompts font <900 tokens
    SESSION = new LC.LlamaChatSession({ contextSequence: CTX.getSequence() });

    const acc = (LLAMA.gpu && LLAMA.gpu !== false) ? LLAMA.gpu.toUpperCase() : "CPU";
    LOCAL_LABEL = M.nom + " · " + acc;
    console.log("[KV] moteur embarqué prêt :", LOCAL_LABEL);
    dire({ done: true });
    return true;

  } catch (e) {
    LOCAL_KO = e.message || String(e);
    console.error("[KV] moteur embarqué indisponible :", LOCAL_KO);
    dire({ done: true });
    return false;
  }
}

// Combien de tokens au maximum, selon ce qu'on demande. C'est LE reglage qui decide
// du temps de reponse : un dialogue de 6 repliques courtes fait ~160 tokens, pas 620.
const PLAFOND = { dialogue: 260, repliques: 340, actions: 220, reaction: 190 };

async function localAsk(prompt, schema, envoiChunk) {
  const run = file.then(async () => {
    SESSION.resetChatHistory();
    const g = await grammaire(schema);
    return await SESSION.prompt(prompt, {
      grammar: g,
      temperature: 1.0,       // on veut de la variete, pas la meme phrase a chaque fois
      topP: 0.95,
      repeatPenalty: { penalty: 1.15, frequencyPenalty: 0.35, presencePenalty: 0.35 },
      maxTokens: PLAFOND[schema] || 300,
      // STREAMING : chaque morceau part vers le jeu des qu'il est produit.
      // La 1re replique s'affiche apres ~30 tokens au lieu d'attendre les ~160 de tout le bloc.
      onTextChunk: envoiChunk || undefined
    });
  });
  file = run.then(() => {}, () => {});
  return run;
}

/* ================================================================ 2. OLLAMA (si deja installe) */
async function grab(url, opt, ms) {
  const ctl = new AbortController();
  const to  = setTimeout(() => ctl.abort(), ms || 20000);
  try { return await fetch(url, Object.assign({ signal: ctl.signal }, opt)); }
  finally { clearTimeout(to); }
}
async function ollamaProbe() {
  try {
    const r = await grab(CFG.ollama.url + "/api/tags", {}, 2000);
    if (!r.ok) return null;
    const j = await r.json();
    const noms = (j.models || []).map(m => m.name);
    if (!noms.length) return null;
    const veut = CFG.ollama.model;
    const model = noms.find(n => n === veut || n.startsWith(veut.split(":")[0])) || noms[0];
    return { model };
  } catch (e) { return null; }
}
async function ollamaAsk(model, prompt) {
  const r = await grab(CFG.ollama.url + "/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false, format: "json",
                           options: { temperature: 1.0, num_predict: 280, top_p: 0.95 } })
  }, 60000);
  const j = await r.json();
  return j.response || "";
}

/* ================================================================ 3. EN LIGNE (facultatif) */
async function groqAsk(prompt) {
  const r = await grab("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + CFG.groq.cle },
    body: JSON.stringify({
      model: CFG.groq.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9, max_tokens: 500,
      response_format: { type: "json_object" }
    })
  }, 20000);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "groq");
  return (j.choices && j.choices[0] && j.choices[0].message.content) || "";
}
async function geminiAsk(prompt) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/"
            + CFG.gemini.model + ":generateContent?key=" + CFG.gemini.cle;
  const r = await grab(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 600, responseMimeType: "application/json" }
    })
  }, 20000);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "gemini");
  const c = j.candidates && j.candidates[0];
  return (c && c.content && c.content.parts && c.content.parts[0].text) || "";
}

/* ================================================================ CHOIX, AVEC REPLI */
let PICK = null;
let EN_COURS = false;

async function decide(win) {
  const veut = (CFG.moteur || "auto").toLowerCase();
  if (veut === "off") { PICK = null; return { why: "désactivée" }; }

  // 1. le moteur embarque : aucune installation, aucune limite, hors ligne
  if ((veut === "auto" || veut === "embarque") && !LOCAL_KO) {
    if (!EN_COURS) {
      EN_COURS = true;
      const ok = await localInit(win);
      EN_COURS = false;
      if (ok) { PICK = { kind: "local", label: LOCAL_LABEL, local: true }; return PICK; }
    }
  }
  // 2. Ollama, s'il est deja installe sur la machine
  if (veut === "auto" || veut === "ollama") {
    const o = await ollamaProbe();
    if (o) { PICK = { kind: "ollama", model: o.model, label: "Ollama · " + o.model, local: true }; return PICK; }
  }
  // 3. en ligne, si une cle est posee dans konoha.config.json
  if ((veut === "auto" || veut === "groq") && CFG.groq.cle) {
    PICK = { kind: "groq", label: "Groq · " + CFG.groq.model, local: false };
    return PICK;
  }
  if ((veut === "auto" || veut === "gemini") && CFG.gemini.cle) {
    PICK = { kind: "gemini", label: "Gemini · " + CFG.gemini.model, local: false };
    return PICK;
  }
  // 4. rien : le monde tourne quand meme, cerveau scripte
  PICK = null;
  return { why: LOCAL_KO ? ("scriptée — moteur KO : " + LOCAL_KO) : "scriptée" };
}

ipcMain.handle("kv-llm-status", async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await decide(win);
  if (PICK) { console.log("[KV] tête :", PICK.label); return { ok: true, label: PICK.label, local: !!PICK.local }; }
  console.log("[KV] tête : aucune —", r.why);
  return { ok: false, why: r.why };
});

// Electron liste lui-meme assets/music/ : Raph depose ses fichiers, ca marche.
ipcMain.handle("kv-musique", async () => {
  const dirs = [
    path.join(__dirname, "assets", "music"),
    path.join(process.resourcesPath || __dirname, "assets", "music")
  ];
  for (const d of dirs) {
    try {
      if (!fs.existsSync(d)) continue;
      const l = fs.readdirSync(d).filter(f => /\.(ogg|mp3|wav|m4a|flac)$/i.test(f));
      if (l.length) { console.log("[KV] musique :", l.length, "pistes"); return l; }
    } catch (e) {}
  }
  return [];
});

ipcMain.handle("kv-llm", async (e, payload) => {
  if (!PICK) throw new Error("aucun backend");
  const prompt = String((payload && payload.prompt) || "");
  const schema = (payload && payload.schema) || null;
  const flux   = (payload && payload.flux) || null;   // identifiant de flux, si le jeu veut du direct
  let text = "";

  let envoiChunk = null;
  if (flux) {
    const wc = e.sender;
    envoiChunk = (morceau) => {
      try { wc.send("kv-llm-chunk", { flux, t: morceau }); } catch (err) {}
    };
  }

  if      (PICK.kind === "local")  text = await localAsk(prompt, schema, envoiChunk);
  else if (PICK.kind === "ollama") text = await ollamaAsk(PICK.model, prompt);
  else if (PICK.kind === "groq")   text = await groqAsk(prompt);
  else if (PICK.kind === "gemini") text = await geminiAsk(prompt);
  return { text };
});

/* ================================================================ FENETRE */
function createWindow() {
  const win = new BrowserWindow({
    width: 1060, height: 800, minWidth: 760, minHeight: 560,
    backgroundColor: "#0a0d12",
    title: "Konoha Vivant",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "src", "world.html"));
}

app.whenReady().then(() => {
  CFG = loadConfig();
  console.log("[KV] RAM :", (os.totalmem() / 1e9).toFixed(1), "Go → modèle", choisirNiveau());
  session.defaultSession.setPermissionRequestHandler((wc, p, cb) => cb(true));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
