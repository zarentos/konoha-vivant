/* Konoha Vivant — LA TETE (v2).
   Couche IA optionnelle. Si aucun LLM n'est joignable, ce fichier ne fait rien et
   le monde tourne exactement pareil avec son cerveau scripte. Aucun plantage possible.

   DEUX types de requetes, et c'est tout :

   1. UNE CONVERSATION = UNE REQUETE.
      Quand deux ou trois ninjas se mettent a parler, on demande au LLM d'ecrire
      TOUTE la discussion d'un coup (5 a 7 repliques). Le jeu la rejoue ensuite ligne
      par ligne, toutes les ~2 s. Zero attente pendant qu'ils parlent.
      Pendant que ca charge, ils marchent l'un vers l'autre — on ne voit meme pas le delai.

   2. LES INTENTIONS, rarement (toutes les 20 s), pour les 3 ninjas qui vivent un truc.

   -> ~2 a 3 requetes/minute. Sous le quota gratuit de tout le monde,
      et SANS AUCUNE LIMITE si Ollama tourne en local.
*/
(function(){
"use strict";

var W = null;
var CHARS = window.KV_CHARS || {};
var SOC   = window.KV_SOCIAL;

var backend = null;          // "electron" | "ollama-direct" | null
var cherche = false;
var busy    = 0;
var fails   = 0;
var MAX_VOL = 2;

/* --- budget : on ne crame pas le quota gratuit en 20 minutes --- */
var envois  = [];
var total   = 0;
// EN LIGNE : le vrai mur, c'est le quota JOURNALIER (Groq : 1000/jour).
//   3 req/min  ->  180/h  ->  ~5 h 30 de jeu par jour. C'est le bon reglage.
//   8 req/min  ->  480/h  ->  2 h. Non.
// EN LOCAL (Ollama) : aucun quota, on peut se lacher.
var LIMITE_MIN  = 3;
var LIMITE_JOUR = 950;
var ILLIMITE = false;

var IDEE_TOUS = 45000;       // passe a 20 s en local
var acc = IDEE_TOUS;

function libre(){
  var t = Date.now();
  while(envois.length && t - envois[0] > 60000) envois.shift();
  if(!backend) return false;
  if(busy >= MAX_VOL) return false;
  if(envois.length >= LIMITE_MIN) return false;
  if(!ILLIMITE && total >= LIMITE_JOUR) return false;
  return true;
}
function compte(){ envois.push(Date.now()); total++; maj(); }

/* ---------------------------------------------------------------- voyant */
var label = "…";
function maj(){
  var el = document.getElementById("iaState");
  if(!el) return;
  if(!backend){ el.textContent = "IA : " + label; el.className = "ia"; return; }
  el.textContent = "IA : " + label + " · " + envois.length + "/min · "
                 + (ILLIMITE ? "illimité" : (LIMITE_JOUR - total) + " restantes");
  el.className = "ia on";
}
function statut(txt, on){ label = txt; maj(); }

/* ---------------------------------------------------------------- detection */
var OLLAMA_MODEL = "qwen3:4b";

function detect(){
  if(cherche) return;
  cherche = true;
  if(window.KV_BRIDGE && window.KV_BRIDGE.status){
    window.KV_BRIDGE.status().then(function(st){
      if(st && st.ok){
        backend = "electron";
        if(st.local){ LIMITE_MIN = 25; ILLIMITE = true; IDEE_TOUS = 20000; }
        statut(st.label, true);
        W.log("Tête branchée : " + st.label);
      } else {
        statut(st && st.why ? st.why : "scriptée", false);
      }
    }).catch(function(){ statut("scriptée", false); });
    return;
  }
  fetch("http://localhost:11434/api/tags")
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){
      if(j && j.models && j.models.length){
        backend = "ollama-direct";
        OLLAMA_MODEL = j.models[0].name;
        LIMITE_MIN = 25; ILLIMITE = true; IDEE_TOUS = 20000;
        statut("Ollama · " + OLLAMA_MODEL, true);
        W.log("Tête branchée : Ollama (" + OLLAMA_MODEL + ")");
      } else statut("scriptée", false);
    })
    .catch(function(){ statut("scriptée — lance avec LANCER.bat", false); });
}

/* ---------------------------------------------------------------- l'appel */
function ask(prompt, schema){
  compte();
  busy++;
  var p;
  if(backend === "electron") p = window.KV_BRIDGE.llm({prompt: prompt, schema: schema});
  else if(backend === "ollama-direct"){
    p = fetch("http://localhost:11434/api/generate", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt: prompt, stream: false,
                             format: "json", options:{ temperature: 0.95, num_predict: 520 } })
    }).then(function(r){ return r.json(); }).then(function(j){ return {text: j.response || ""}; });
  } else p = Promise.reject("aucun backend");

  return p.then(function(r){ busy--; fails=0; return r; })
          .catch(function(e){
            busy--; fails++;
            if(fails >= 3){
              backend = null;
              statut("scriptée (le LLM ne répond plus)", false);
              W.log("La tête ne répond plus — retour au cerveau scripté.");
            }
            throw e;
          });
}
function lireJSON(txt){
  if(!txt) return null;
  var s=String(txt), a=s.indexOf("{"), b=s.lastIndexOf("}");
  if(a<0 || b<=a) return null;
  try { return JSON.parse(s.slice(a,b+1)); } catch(e){ return null; }
}

/* ---------------------------------------------------------------- le contexte */
function traits(g){
  var T=g.S, o=[];
  o.push(T.social > .65 ? "bavard" : (T.social < .35 ? "renfermé" : "réservé"));
  o.push(T.loyal  > .75 ? "très loyal" : (T.loyal < .4 ? "égoïste" : "loyal"));
  o.push(T.calme  > .7  ? "calme" : (T.calme < .3 ? "impulsif" : "posé"));
  return o.join(", ");
}
function relMot(v){
  if(v >=  80) return "il tient énormément à lui";
  if(v >=  45) return "il l'apprécie";
  if(v >=  15) return "cordial";
  if(v >  -15) return "indifférent";
  if(v >  -45) return "il s'en méfie";
  if(v >  -80) return "il le déteste";
  return "il le hait";
}
function vus(g){
  var o=[], A=W.agents;
  for(var i=0;i<A.length;i++) if(A[i]!==g && Math.abs(A[i].x-g.x) < 420) o.push(A[i]);
  return o;
}
function fiche(g, court){
  var L=[], i;
  L.push("### " + g.name + " (" + SOC.camp(g.key) + ")");
  L.push("Caractère : " + traits(g));
  L.push("État : " + Math.round(g.hp) + "/" + g.maxHp + " PV"
         + (g.mode==="fight" ? ", EN PLEIN COMBAT" : ""));
  if(!court){
    var n=vus(g), v=[];
    for(i=0;i<n.length && i<5;i++)
      v.push(n[i].name + " (" + Math.round(Math.abs(n[i].x-g.x)/10) + " m, " + relMot(g.relTo(n[i]))
             + (n[i].mode==="ko" ? ", À TERRE" : "") + ")");
    L.push(v.length ? "Il voit : " + v.join(" · ") : "Il ne voit personne.");
  }
  var m = g.memText();
  if(m) L.push("Il se souvient :\n" + m);
  if(g.dits && g.dits.length)
    L.push("Il a DÉJÀ dit récemment (ne redis SURTOUT pas ça) :\n- " + g.dits.join("\n- "));
  return L.join("\n");
}

// un angle impose : sans ca, deux persos qui se croisent 5 fois se disent 5 fois la meme chose
var ANGLES = [
  "une provocation légère", "un souvenir commun", "une question directe et gênante",
  "un reproche", "de la fatigue, du ras-le-bol", "une vantardise",
  "un conseil non demandé", "un silence gênant qu'il faut meubler",
  "une menace à peine voilée", "on parle de bouffe", "on parle d'un absent",
  "un désaccord sur la façon de se battre", "une invitation à s'entraîner",
  "il remarque une blessure", "de l'ironie", "une confidence inattendue"
];

/* ---------------------------------------------------------------- 0. LA RESERVE
   Le coeur du truc. Le LLM ne travaille PAS quand on a besoin de lui — il travaille
   AVANT, en fond, et remplit des piles de repliques. Le jeu pioche dedans en 0 ms.
   Resultat : ils peuvent parler tout le temps, sans jamais attendre ni se repeter.
*/
var RESERVE = {};                       // RESERVE[perso][situation] = ["...", ...]
var PILE_MAX = 18;
var SITUATIONS = {
  seul:    "il marche tout seul, il pense a voix haute",
  detendu: "il parle a quelqu'un qu'il apprecie",
  tendu:   "il parle a quelqu'un qu'il n'aime pas",
  blesse:  "il est blesse, il a tres peu de forces",
  content: "il vient de gagner un combat ou d'etre soigne"
};
var RESERVE_TOUS = 4200;
var accR = 0;

function pile(k, sit){
  if(!RESERVE[k]) RESERVE[k] = {};
  if(!RESERVE[k][sit]) RESERVE[k][sit] = [];
  return RESERVE[k][sit];
}
// la pile la plus vide, parmi les ninjas REELLEMENT presents
function aRemplir(){
  var A = W.agents, best = null, bn = 99;
  for(var i=0;i<A.length;i++){
    for(var sit in SITUATIONS){
      var p = pile(A[i].key, sit);
      var poids = p.length + (sit === "seul" ? -3 : 0);   // "seul" sert tout le temps
      if(poids < bn && p.length < PILE_MAX && !p.__wait){
        bn = poids; best = {g:A[i], sit:sit, p:p};
      }
    }
  }
  return (bn < PILE_MAX) ? best : null;
}
function remplir(){
  var c = aRemplir();
  if(!c) return;
  c.p.__wait = true;

  var q = [];
  q.push("Univers Naruto. Écris 14 répliques COURTES et TOUTES DIFFÉRENTES que dirait "
         + c.g.name + " quand " + SITUATIONS[c.sit] + ".");
  q.push("Il est " + traits(c.g) + ".");
  q.push("Max 10 mots par réplique. En français, dans sa bouche, sans guillemets.");
  q.push("VARIÉES : drôles, absurdes, cassantes, sincères, banales. Pas deux fois la même idée.");
  if(c.p.length) q.push("Il a déjà celles-ci, trouve autre chose :\n- " + c.p.slice(0,8).join("\n- "));
  q.push("");
  q.push('Réponds en JSON : {"lignes":["...","..."]}');

  ask(q.join("\n"), "repliques").then(function(res){
    c.p.__wait = false;
    var o = lireJSON(res && res.text);
    var l = o && o.lignes;
    if(!Array.isArray(l)) return;
    for(var i=0;i<l.length;i++){
      var t = String(l[i] || "").trim().replace(/^["'\-\s]+|["'\s]+$/g, "");
      if(t.length < 2 || t.length > 74) continue;
      if(c.p.indexOf(t) >= 0) continue;
      c.p.push(t);
    }
    while(c.p.length > PILE_MAX) c.p.shift();
  }).catch(function(){ c.p.__wait = false; });
}

/* ---------------------------------------------------------------- 1. LA CONVERSATION */
function interessant(grp){
  if(grp.rite) return true;          // une scene merite toujours une vraie ecriture
  for(var i=0;i<grp.length;i++){
    if(grp[i].mem.length && (W.t - grp[i].mem[0].t) < 70000) return true;
    for(var j=0;j<grp.length;j++){
      if(i===j) continue;
      if(Math.abs(grp[i].relTo(grp[j])) > 35) return true;
    }
  }
  return Math.random() < 0.45;
}

// une scene annoncee DOIT etre ecrite. Elle ne passe pas par le budget normal :
// seul le quota journalier (en ligne) peut la refuser.
function libreScene(){
  if(!backend) return false;
  if(!ILLIMITE && total >= LIMITE_JOUR) return false;
  return true;
}
function prepareTalk(grp){
  if(grp.rite){ if(!libreScene()) return false; }
  else if(!libre() || !interessant(grp)) return false;

  var p=[], i, j;
  var RITE = {
    amour:     "%A déclare ses sentiments à %B. Sincère, maladroit, gênant.",
    guerre:    "%A déclare la guerre à %B. Froid, définitif, sans retour.",
    defi:      "%A défie %B en duel. Rivalité, provocation, mais bon enfant.",
    betise:    "%A prépare une blague ou un sale coup à %B. Ça DOIT être drôle.",
    dispute:   "%A et %B s'engueulent. Le ton monte.",
    reconcile: "%A vient faire la paix avec %B. Maladroit, pas naturel pour lui.",
    admire:    "%A admire ouvertement %B. %B est mal à l'aise."
  };
  if(grp.rite && RITE[grp.rite]){
    p.push("SCÈNE IMPOSÉE : " + RITE[grp.rite].replace(/%A/g, grp[0].name).replace(/%B/g, grp[1].name));
    p.push("Écris cette scène, en dialogue. C'est un moment fort : on ne le rate pas.");
  } else {
    p.push("Écris la conversation entre ces ninjas de l'univers Naruto. Ils viennent de se croiser.");
  }
  p.push("Chacun parle comme LUI-MÊME : selon son caractère, ce qu'il pense de l'autre, et ce qu'il vient de vivre.");
  p.push("Court, sec, crédible. Que du dialogue, aucune narration. Maximum 12 mots par réplique. En français.");
  p.push("");
  p.push((grp.length === 2 ? "5 à 6" : "6 à 7") + " répliques, en alternance.");
  p.push("ANGLE IMPOSÉ pour cette conversation : " + ANGLES[Math.floor(Math.random()*ANGLES.length)] + ".");
  p.push("Ne réutilise AUCUNE phrase qu'ils ont déjà dite.");
  p.push("");
  for(i=0;i<grp.length;i++) p.push(fiche(grp[i], true) + "\n");
  p.push("Ce qu'ils pensent les uns des autres :");
  for(i=0;i<grp.length;i++) for(j=0;j<grp.length;j++){
    if(i===j) continue;
    p.push("- " + grp[i].name + " → " + grp[j].name + " : " + relMot(grp[i].relTo(grp[j])));
  }

  ask(p.join("\n"), "dialogue").then(function(res){
    var o = lireJSON(res && res.text);
    var d = o && (o.dialogue || o.actions);
    if(!Array.isArray(d) || !d.length) return;
    var script=[];
    for(var k=0;k<d.length && k<8;k++){
      if(!d[k] || !d[k].dit) continue;
      script.push({ qui:String(d[k].qui||"").toLowerCase().trim(), dit:String(d[k].dit) });
    }
    if(script.length) W.setScript(grp, script);
  }).catch(function(){});

  return true;
}

/* ---------------------------------------------------------------- 2. LES INTENTIONS */
function pression(g, t){
  if(g.mode==="ko" || g.possessed) return -1;
  var p=0, i;
  for(i=0;i<g.mem.length;i++){
    var age=(t-g.mem[i].t)/1000;
    if(age < 60) p += (60-age)/60 * (g.mem[i].k==="ko_by" ? 60 : (g.mem[i].k==="saw_ko" ? 35 : 14));
  }
  var n=vus(g);
  for(i=0;i<n.length;i++){
    var r=Math.abs(g.relTo(n[i]));
    if(r > 60) p += 18; else if(r > 30) p += 7;
  }
  if(!n.length) p -= 30;
  if(g.mode==="fight") p += 32;
  p += Math.min(35, (t - g.mindT)/2500);
  return p + Math.random()*12;
}
function penser(){
  var A=W.agents, t=W.t, note=[], i;
  for(i=0;i<A.length;i++){
    var p=pression(A[i], t);
    if(p > 28) note.push({g:A[i], p:p});
  }
  if(!note.length) return;
  note.sort(function(x,y){ return y.p - x.p; });
  var list=[];
  for(i=0;i<note.length && i<3;i++) list.push(note[i].g);

  var q=[];
  q.push("Tu es la conscience de plusieurs ninjas dans une simulation autonome de l'univers Naruto.");
  q.push("Pour CHACUN, décide ce qu'il fait maintenant. Reste fidèle à son caractère, à ses relations");
  q.push("et à ce qu'il vient de vivre. Sois bref et crédible.");
  q.push("");
  q.push('but   : parler | provoquer | venger | eviter | soigner | seul');
  q.push('style : normal | rage | prudent | distance | achever   (utile seulement en combat)');
  q.push('cible : le nom d\'un ninja qu\'il VOIT, ou ""');
  q.push('dit   : une phrase courte dans sa bouche, en français, max 12 mots. Ou "".');
  q.push("Ne réutilise AUCUNE phrase déjà dite.");
  q.push("");
  for(i=0;i<list.length;i++) q.push(fiche(list[i], false) + "\n");

  ask(q.join("\n"), "actions").then(function(res){
    var o = lireJSON(res && res.text);
    var acts = o && (o.actions || o.dialogue);
    if(!Array.isArray(acts)) return;
    for(var k=0;k<acts.length;k++){ try { W.applyIntent(acts[k]); } catch(e){} }
    for(k=0;k<list.length;k++) list[k].mindT = W.t;
  }).catch(function(){});
}

/* ---------------------------------------------------------------- API */
window.KV_MIND = {
  get on(){ return !!backend; },
  prepareTalk: prepareTalk,
  // le jeu pioche une replique fraiche, en 0 ms. Renvoie null si la pile est vide.
  replique: function(g, sit){
    if(!RESERVE[g.key] || !RESERVE[g.key][sit]) return null;
    var p = RESERVE[g.key][sit];
    if(!p.length) return null;
    return p.splice(Math.floor(Math.random()*p.length), 1)[0];
  },
  stock: function(){
    var n = 0;
    for(var k in RESERVE) for(var s2 in RESERVE[k]) n += RESERVE[k][s2].length;
    return n;
  },
  tick: function(dt){
    if(!W){
      W = window.KV_WORLD;
      if(!W) return;
      // barre de telechargement du modele (Electron le fait tout seul)
      if(window.KV_BRIDGE && window.KV_BRIDGE.onPull){
        window.KV_BRIDGE.onPull(function(p){
          var bar = document.getElementById("pull");
          if(!bar) return;
          if(p.done){ bar.classList.remove("on"); return; }
          bar.classList.add("on");
          document.getElementById("pullTxt").textContent = p.status || "Téléchargement du cerveau…";
          document.getElementById("pullBar").style.width = (p.pct||0) + "%";
        });
      }
      detect();
    }
    if(!backend) return;

    // 1. remplir la reserve : c'est la priorite, c'est ce qu'on voit a l'ecran
    accR += dt;
    if(accR >= RESERVE_TOUS){ accR = 0; if(libre()) remplir(); }

    // 2. les intentions, plus rarement
    acc += dt;
    if(acc >= IDEE_TOUS){ acc = 0; if(libre()) penser(); }
  }
};

})();
