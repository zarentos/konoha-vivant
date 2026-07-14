/* Harnais de test headless pour world.js.
   Mocke le DOM + le canvas, fait tourner le monde en accelere, et verifie
   que tout se declenche vraiment (bagarres, K.O., soins, discussions, jutsu).
   Usage : node tools/simtest.js [minutes]
*/
"use strict";
const fs = require("fs");
const path = require("path");

const MINUTES = parseFloat(process.argv[2] || "15");
const ROOT = path.join(__dirname, "..");

/* ------------------------------------------------ mock DOM */
function El(id){
  const cls = new Set();
  const kids = [];
  return {
    id, textContent:"", innerHTML:"", value:(id==="speed"?"1":(id==="alert"?"pause":"Training Field.png")),
    style:{}, children:kids,
    appendChild(c){ kids.push(c); return c; },
    querySelector(){ return El("x"); },
    getAttribute(){ return ""; },
    setAttribute(){},
    classList:{ add:c=>cls.add(c), remove:c=>cls.delete(c),
                toggle:(c,v)=>{ if(v===undefined) cls.has(c)?cls.delete(c):cls.add(c); else v?cls.add(c):cls.delete(c); },
                contains:c=>cls.has(c) },
    _cls: cls,
    addEventListener(){}, removeEventListener(){},
    getBoundingClientRect(){ return {left:0, top:0, width:1000, height:560}; },
    getContext(){ return CTX; }
  };
}
const NOOP = () => {};
const CTX = new Proxy({
  measureText: t => ({ width: (t||"").length*6 }),
  createLinearGradient: () => ({ addColorStop: NOOP }),
  canvas: {width:1000, height:560}
}, {
  get(t, k){ if(k in t) return t[k]; return NOOP; },
  set(t, k, v){ t[k]=v; return true; }
});

const els = {};
const cv = El("world");
cv.width = 1000; cv.height = 560;
els.world = cv;

global.document = {
  getElementById(id){ if(!els[id]) els[id] = El(id); return els[id]; },
  createElement(){ return El("x"); },
  querySelector(){ return El("x"); },
  addEventListener: NOOP
};

const rafQ = [];
global.requestAnimationFrame = cb => { rafQ.push(cb); return rafQ.length; };
global.Image = class {
  constructor(){ this.__ok = true; }
  set src(v){ this._src = v; if(this.onload) setImmediate(()=>{}); }
  get src(){ return this._src; }
};
global.fetch = () => Promise.reject(new Error("pas de reseau en test"));
const _ls = {};
global.localStorage = { getItem:k=>_ls[k]||null, setItem:(k,v)=>{_ls[k]=String(v);}, removeItem:k=>{delete _ls[k];} };
global.window = { addEventListener: NOOP };

/* --- faux LLM : on valide TOUTE la plomberie (prompt -> JSON -> intention -> monde)
       sans dependre d'Ollama ni d'une cle API. --- */
let llmCalls = 0, llmNinjas = 0, promptsWithMem = 0, lastPrompt = "";
const BUTS   = ["parler","provoquer","venger","eviter","soigner","seul"];
const STYLES = ["normal","rage","prudent","distance","achever"];
let dialogues = 0, lots = 0, lignesGen = 0;
global.window.KV_BRIDGE = {
  onPull: () => {},
  status: () => Promise.resolve({ ok: true, label: "FAUX-LLM (test)", local: true }),
  llm: (payload) => {
    llmCalls++;
    lastPrompt = payload.prompt;
    if(/Il se souvient/.test(lastPrompt)) promptsWithMem++;
    const blocs = lastPrompt.split("### ").slice(1);

    // requete "lot de repliques" pour la reserve
    if(/répliques COURTES/.test(lastPrompt)){
      lots++;
      const l = [];
      for(let k=0;k<12;k++) l.push("réplique fraîche n°" + (++lignesGen));
      return Promise.resolve({ text: JSON.stringify({ lignes: l }) });
    }
    // requete "conversation" : on renvoie un dialogue complet
    if(/Écris la conversation|SCÈNE IMPOSÉE/.test(lastPrompt)){
      dialogues++;
      const noms = blocs.map(b => b.split(" ")[0]);
      const dialogue = [];
      for(let k=0;k<6;k++){
        const n = noms[k % noms.length];
        llmNinjas++;
        dialogue.push({ qui: n.toLowerCase(), dit: "réplique " + (k+1) + " de " + n });
      }
      return Promise.resolve({ text: JSON.stringify({ dialogue }) });
    }

    const actions = blocs.map(b => {
      const qui = b.split(" ")[0];
      const voit = (b.match(/Il voit : (.+)/) || [])[1] || "";
      const cibles = voit.split(" · ").map(v => v.split(" (")[0]).filter(Boolean);
      llmNinjas++;
      return {
        qui: qui.toLowerCase(),
        but: BUTS[Math.floor(Math.random()*BUTS.length)],
        cible: cibles.length ? cibles[Math.floor(Math.random()*cibles.length)] : "",
        style: STYLES[Math.floor(Math.random()*STYLES.length)],
        dit: "réplique générée"
      };
    });
    return Promise.resolve({ text: JSON.stringify({ actions }) });
  }
};
global.performance = { now: () => 0 };
let NOW = 1700000000000;
Date.now = () => NOW;      // l'horloge suit le temps du monde

/* ------------------------------------------------ chargement des sources */
const ORDER = ["naruto","sasuke","itachi","sakura","kakashi","jiraiya","orochimaru","pain",
               "deidara","konan","sai","shikamaru","suigetsu","karin","jugo"];
const load = p => eval(fs.readFileSync(path.join(ROOT, p), "utf8"));

ORDER.forEach(k => load("src/data/" + k + ".js"));
load("src/data/moves.js");
load("src/data/social.js");

const CHARS = global.window.KV_CHARS;
const MOVES = global.window.KV_MOVES;

/* ------------------------------------------------ 1. verifications statiques */
let errs = [], warns = [];

ORDER.forEach(k => {
  if(!CHARS[k]) return errs.push("perso manquant dans KV_CHARS : " + k);
  if(!MOVES[k]) return errs.push("perso manquant dans KV_MOVES : " + k);
  const A = CHARS[k].anims;

  ["idle","run","dash","jump","guard","attack","attack_air","strong",
   "hurt_light","knockdown","downed","getup"].forEach(n => {
    if(!A[n] || !A[n].frames || !A[n].frames.length) errs.push(k + " : anim de base manquante '" + n + "'");
  });
  if(!A.win) warns.push(k + " : pas d'anim 'win' (la pose de victoire sera sautee)");

  MOVES[k].moves.forEach(m => {
    if(!A[m.a] || !A[m.a].frames.length) errs.push(k + " : move '" + m.a + "' ne correspond a AUCUNE anim");
    else {
      const a = A[m.a];
      if(m.t === "proj" && (!a.fx || !a.fx.length)) errs.push(k + "." + m.a + " : type proj mais l'anim n'a pas de fx");
      if((m.t === "melee" || m.t === "dash") && !m.rc) errs.push(k + "." + m.a + " : melee/dash sans allonge (rc)");
      if(m.t !== "buff" && !m.r) errs.push(k + "." + m.a + " : pas de portee (r)");
    }
    if(m.ck > 100) errs.push(k + "." + m.a + " : cout chakra > 100, injouable");
  });
  if(MOVES[k].combo){
    const n = A.attack.frames.length;
    MOVES[k].combo.forEach(s => {
      if(s[1] >= n) errs.push(k + " : segment de combo [" + s + "] hors de l'anim attack (" + n + " frames)");
    });
  }
});

console.log("=== 1. VERIFS STATIQUES ===");
if(errs.length){ errs.forEach(e => console.log("  ERREUR  " + e)); }
else console.log("  OK — 15 persos, toutes les techniques pointent sur une anim reelle");
warns.forEach(w => console.log("  note    " + w));
if(errs.length){ process.exit(1); }

/* ------------------------------------------------ 2. simulation */
load("src/world.js");
load("src/mind.js");
const WD = global.window.KV_WORLD;
const agents = WD.agents;

const seen = {};                       // anims jouees par perso
ORDER.forEach(k => seen[k] = new Set());
let kos = 0, fights = 0, talks = 0, heals = 0, projMax = 0, events = 0, revives = 0;
let projFired = 0, projHit = 0;
const liveProj = new Set();
const prevMode = new Map();
const seenDuels = new Set();
const rites = new Map();      // grp -> {rite, script, acte}
const duelStart = new Map();
let duelDur = [];
const why = {};
const niv = {};
let zMin=1, zMax=0, repeats=0, casts=0, scenes=0;
let lastMove = new Map();
let inScene=false;

const evYes = document.getElementById("evYes");
const evNo  = document.getElementById("evNo");
const evBox = document.getElementById("event");

const FRAME = 16;
const steps = Math.round(MINUTES * 60 * 1000 / FRAME);
let ts = 0, crashed = null;

let intents = 0;
const realApply = WD.applyIntent;
WD.applyIntent = (it) => { intents++; return realApply(it); };

async function run(){
try {
  for(let i = 0; i < steps; i++){
    if(i % 30 === 0) await new Promise(r => setImmediate(r));   // laisse les promesses se resoudre
    ts += FRAME;
    NOW += FRAME;
    const cb = rafQ.shift();
    if(!cb){ crashed = "la boucle rAF s'est arretee a l'iteration " + i; break; }
    cb(ts);

    // repondre a l'alerte (sinon le monde reste fige)
    if(evBox._cls.has("on")){
      events++;
      (Math.random() < 0.5 ? evYes : evNo).onclick();
    }

    for(const g of agents){
      if(g.talkGrp && g.talkGrp.rite){
        const grp = g.talkGrp;
        if(!rites.has(grp)) rites.set(grp, {rite:grp.rite, script:0, acte:false});
        const sc = rites.get(grp);
        if(grp.script) sc.script = grp.script.length;
        if(grp.__acte) sc.acte = true;
      }
      seen[g.key].add(g.anim);
      if(g.z < zMin) zMin = g.z;
      if(g.z > zMax) zMax = g.z;
      if(g.curMove){
        const lm = lastMove.get(g.id);
        if(lm !== g.curMove.a){
          casts++;
          if(g.recent[1] === g.curMove.a) repeats++;   // il refait la meme qu'avant
          lastMove.set(g.id, g.curMove.a);
        }
      } else lastMove.set(g.id, null);
      if(!Number.isFinite(g.x) || !Number.isFinite(g.y) || !Number.isFinite(g.hp))
        throw new Error("valeur NaN sur " + g.key + " x=" + g.x + " y=" + g.y + " hp=" + g.hp);
      if(g.hp > g.maxHp + 0.01) throw new Error(g.key + " depasse ses PV max (" + g.hp + "/" + g.maxHp + ")");
      const pm = prevMode.get(g.id);
      if(pm !== g.mode){
        if(g.mode === "ko") kos++;
        if(g.mode === "talk") talks++;
        if(g.mode === "heal") heals++;
        if(pm === "ko" && g.mode !== "ko") revives++;
        prevMode.set(g.id, g.mode);
      }
    }
    for(const d of WD.duels) if(!seenDuels.has(d)){ seenDuels.add(d); fights++; duelStart.set(d, ts); const r=d.reason||"hostilité"; why[r]=(why[r]||0)+1; niv[d.niveau]=(niv[d.niveau]||0)+1; }
    for(const [d, t0] of duelStart) if(d.dead){ duelDur.push(ts - t0); duelStart.delete(d); }
    for(const p of WD.projs) if(!liveProj.has(p)){ liveProj.add(p); projFired++; p.__t0 = ts; }
    for(const p of liveProj) if(!WD.projs.includes(p)){
      liveProj.delete(p);
      if(Object.keys(p.hs).length) projHit++;   // il a touche quelqu'un avant de disparaitre
    }
    if(WD.projs.length > projMax) projMax = WD.projs.length;
  }
} catch(e){
  crashed = e.stack || String(e);
}

console.log("\n=== 2. SIMULATION (" + MINUTES + " min de monde) ===");
if(crashed){ console.log("  CRASH :\n" + crashed); process.exit(1); }
console.log("  aucune exception, aucun NaN, aucun PV aberrant");
console.log("  bagarres declenchees : " + fights);
console.log("  K.O.                 : " + kos);
console.log("  relevees             : " + revives);
console.log("  discussions          : " + talks);
console.log("  soins d'un allie     : " + heals);
console.log("  alertes evenement    : " + events);
const avg = duelDur.length ? Math.round(duelDur.reduce((a,b)=>a+b,0)/duelDur.length/1000) : 0;
const mx  = duelDur.length ? Math.round(Math.max(...duelDur)/1000) : 0;
console.log("  duree d'un combat    : " + avg + "s en moyenne, " + mx + "s au plus long");
console.log("  rythme               : une bagarre toutes les " + Math.round(MINUTES*60/Math.max(1,fights)) + "s");
console.log("  origine              : " + Object.entries(why).map(([k,v])=>k+" ×"+v).join(", "));
console.log("  intensité            : " + Object.entries(niv).map(([k,v])=>k+" ×"+v).join(", "));
console.log("  profondeur utilisée  : z de " + zMin.toFixed(2) + " à " + zMax.toFixed(2) + " (0=fond, 1=devant)");
console.log("  répétitions          : " + repeats + "/" + casts + " techniques enchaînées à l'identique ("
            + (casts?Math.round(100*repeats/casts):0) + "%)");
console.log("  projectiles lances   : " + projFired + "  (dont " + projHit + " au but, " +
            (projFired ? Math.round(100*projHit/projFired) : 0) + "%)");

/* ------------------------------------------------ 3. couverture des techniques */
console.log("\n=== 3. COUVERTURE DES TECHNIQUES ===");
let tot = 0, used = 0, dead = [];
ORDER.forEach(k => {
  const list = MOVES[k].moves.map(m => m.a);
  const ok = list.filter(a => seen[k].has(a));
  tot += list.length; used += ok.length;
  const miss = list.filter(a => !seen[k].has(a));
  const pct = Math.round(100 * ok.length / list.length);
  console.log("  " + k.padEnd(11) + String(pct).padStart(3) + "%  " + ok.length + "/" + list.length +
              (miss.length ? "   jamais vu : " + miss.join(" ") : ""));
  miss.forEach(m => dead.push(k + "." + m));
});
console.log("\n  total : " + used + "/" + tot + " techniques declenchees au moins une fois (" +
            Math.round(100*used/tot) + "%)");

let cast=0, land=0;
for(const g of agents) for(const k in g.mstat){ cast += g.mstat[k].n; land += g.mstat[k].hit; }
console.log("\n=== 4. PRÉCISION DE L'IA DE COMBAT (duels en cours) ===");
console.log("  techniques lancées : " + cast + " · au but : " + land +
            "  (" + (cast ? Math.round(100*land/cast) : 0) + "%)");

console.log("\n=== 5. LES SCÈNES — est-ce qu'elles TIENNENT leur promesse ? ===");
const parType = {};
let muettes = 0, sansActe = 0;
for(const sc of rites.values()){
  parType[sc.rite] = (parType[sc.rite] || 0) + 1;
  if(!sc.script) muettes++;
  if(!sc.acte)   sansActe++;
}
console.log("  scènes jouées        : " + rites.size);
console.log("  par type             : " + Object.entries(parType).map(([k,v])=>k+" ×"+v).join(", "));
console.log("  SANS dialogue        : " + muettes + "   (doit être 0 : une scène ne ment jamais)");
console.log("  SANS acte visible    : " + sansActe + "   (les 'guerre' et 'défi' n'en ont pas : le combat EST l'acte)");

console.log("\n=== 6. LA TÊTE (faux LLM) ===");
console.log("  requêtes envoyées    : " + llmCalls + "  (soit " + (llmCalls/MINUTES).toFixed(1) + " par minute)");
console.log("  dont conversations   : " + dialogues + " (1 requête = toute la discussion)");
console.log("  dont lots de réserve : " + lots + " → " + lignesGen + " répliques fabriquées d'avance");
console.log("  en réserve à la fin  : " + (global.window.KV_MIND.stock ? global.window.KV_MIND.stock() : 0) + " répliques prêtes");
console.log("  intentions appliquées: " + intents);
console.log("  prompts contenant un souvenir : " + promptsWithMem + "/" + llmCalls);
const rpm = llmCalls / MINUTES;
const local = /local: true/.test(fs.readFileSync(__filename,"utf8"));
console.log("  " + (local
  ? "mode LOCAL : aucun quota, le moteur tourne chez toi"
  : (rpm <= 8 ? "OK — " + Math.round(1000/Math.max(0.1,rpm*60)) + " h de jeu par jour (quota Groq : 1000/jour)"
              : "TROP pour le quota gratuit en ligne")));
if(lastPrompt){
  console.log("\n  --- extrait du dernier prompt envoyé ---");
  console.log(lastPrompt.split("\n").slice(11, 22).map(l => "  | " + l).join("\n"));
}

const health = (fights > 3 && kos > 2 && talks > 5 && used / tot > 0.75 && llmCalls > 5 && dialogues > 3 && lots > 3 && rites.size > 2 && muettes === 0);
console.log("\n" + (health ? "==> MONDE VIABLE" : "==> A REGLER"));
process.exit(health ? 0 : 2);
}
run();
