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

var IDEE_TOUS = 30000;       // passe a 20 s en local
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
        if(st.local){ LIMITE_MIN = 25; ILLIMITE = true; IDEE_TOUS = 13000; }
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

/* ---------------------------------------------------------------- LE FLUX
   Le LLM ecrit son JSON token par token. Des qu'une replique complete apparait
   dans le flux, on l'envoie au monde SANS attendre la fin du bloc.
   -> la premiere phrase s'affiche apres ~30 tokens au lieu de ~160.
*/
var FLUX = {};                  // id -> { grp, buf, pris }
var fluxN = 0;
var RE_LIGNE = /\{\s*"qui"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"dit"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;

function brancheFlux(){
  if(!(window.KV_BRIDGE && window.KV_BRIDGE.onChunk)) return;
  window.KV_BRIDGE.onChunk(function(d){
    var f = FLUX[d.flux];
    if(!f) return;
    f.buf += d.t;
    RE_LIGNE.lastIndex = 0;
    var m, n = 0;
    while((m = RE_LIGNE.exec(f.buf)) !== null){
      n++;
      if(n <= f.pris) continue;             // deja transmise
      f.pris = n;
      var ligne = { qui: String(m[1]).toLowerCase().trim(),
                    dit: String(m[2]).replace(/\\"/g, '"').replace(/\\n/g, " ") };
      if(W.pushLine) W.pushLine(f.grp, ligne);
    }
  });
}

/* ---------------------------------------------------------------- l'appel */
function ask(prompt, schema, grp){
  compte();
  busy++;
  var p, idFlux = null;
  if(backend === "electron"){
    // si on ecrit un dialogue pour un groupe, on demande le flux en direct
    if(grp && schema === "dialogue"){
      idFlux = "f" + (++fluxN);
      FLUX[idFlux] = { grp: grp, buf: "", pris: 0 };
    }
    p = window.KV_BRIDGE.llm({prompt: prompt, schema: schema, flux: idFlux});
  }
  else if(backend === "ollama-direct"){
    p = fetch("http://localhost:11434/api/generate", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt: prompt, stream: false,
                             format: "json", options:{ temperature: 1.0, num_predict: 280, top_p: 0.95 } })
    }).then(function(r){ return r.json(); }).then(function(j){ return {text: j.response || ""}; });
  } else p = Promise.reject("aucun backend");

  return p.then(function(r){ busy--; fails=0; if(idFlux) delete FLUX[idFlux]; return r; })
          .catch(function(e){
            busy--; fails++;
            if(idFlux) delete FLUX[idFlux];
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
  // ce qui le tiraille : c'est ca qui fait dire des choses vraies
  var b = [];
  if(g.faim    > 65) b.push(g.faim    > 85 ? "il crève de faim"       : "il a faim");
  if(g.fatigue > 65) b.push(g.fatigue > 85 ? "il tombe de sommeil"    : "il est fatigué");
  if(g.ennui   > 65) b.push(g.ennui   > 85 ? "il s'ennuie à mourir"   : "il s'ennuie");
  if(g.faisant === "faim")    b.push("IL EST EN TRAIN DE MANGER");
  if(g.faisant === "fatigue") b.push("IL DORT");
  if(g.faisant === "ennui")   b.push("IL S'ENTRAÎNE");
  if(b.length) L.push("Il ressent : " + b.join(", ") + ".");
  // ce que la vie a fait de lui — ca change TOUT dans sa façon de parler
  if(g.motAme) L.push("État d'esprit : " + g.motAme()
    + (g.ame <= -0.5 ? " (il se lie difficilement, il voit le mal partout)"
      : (g.ame >= 0.5 ? " (il s'ouvre, il pardonne)" : "")) + ".");
  // ce qu'il pense de la Force (le joueur)
  if(g.avisForce){
    var av = g.avisForce();
    if(av !== "indifference"){
      var mots = {
        terreur:"il est TERRIFIÉ par la Force — cette présence invisible qui saisit les gens",
        peur:"il a peur de la Force, cette présence qui attrape les gens sans prévenir",
        mefiance:"il se méfie de la Force, cette présence étrange dans leur monde",
        curiosite:"il est intrigué par la Force, cette présence invisible",
        fascination:"il est fasciné par la Force, cette présence qui veille sur eux",
        devotion:"il VÉNÈRE la Force comme une divinité bienveillante"
      };
      L.push("Face à l'invisible : " + mots[av] + ".");
    }
  }
  if(W.moment) L.push("Moment de la journée : " + W.moment() + ".");
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
  "une provocation légère", "un souvenir commun qui ressort", "une question directe et gênante",
  "un reproche qu'on ressort", "le ras-le-bol, la fatigue", "une vantardise de trop",
  "un conseil que personne n'a demandé", "un silence gênant à meubler",
  "une menace à peine voilée", "la faim, l'envie de manger", "on parle d'un troisième absent",
  "un désaccord sur la façon de se battre", "un défi à l'entraînement",
  "l'un remarque une blessure de l'autre", "de l'ironie mordante", "une confidence qui échappe",
  "un vieux compte à régler", "une rumeur qui circule", "une remarque sur le temps qui passe",
  "on se chambre sur une défaite passée", "une inquiétude qu'on cache mal",
  "un pari stupide", "une jalousie qui pointe", "un malentendu qu'on traîne"
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
  content: "il vient de gagner un combat ou d'etre soigne",
  faim:    "il a une faim de loup",
  fatigue: "il tombe de sommeil",
  ennui:   "il s'ennuie ferme, il ne se passe rien"
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
  var evite = c.p.slice(0,6).concat((c.g.dits||[]).slice(0,6));
  if(evite.length) q.push("Il a déjà dit ceci, trouve VRAIMENT autre chose :\n- " + evite.join("\n- "));
  q.push("");
  q.push('Réponds en JSON : {"lignes":["...","..."]}');

  ask(q.join("\n"), "repliques").then(function(res){
    c.p.__wait = false;
    var o = lireJSON(res && res.text);
    var l = o && o.lignes;
    if(!Array.isArray(l)) return;
    var dits = c.g.dits || [];
    for(var i=0;i<l.length;i++){
      var t = String(l[i] || "").trim().replace(/^["'\-\s]+|["'\s]+$/g, "");
      if(t.length < 2 || t.length > 74) continue;
      if(c.p.indexOf(t) >= 0) continue;
      if(dits.indexOf(t) >= 0) continue;          // il vient de le dire : on ne le remet pas en pile
      c.p.push(t);
    }
    while(c.p.length > PILE_MAX) c.p.shift();
  }).catch(function(){ c.p.__wait = false; });
}

/* ---------------------------------------------------------------- 1. LA CONVERSATION */
// ce qui s'est passe entre les membres du groupe (memoire croisee)
function entreEux(grp){
  var out = [], vu = {};
  for(var i=0;i<grp.length;i++){
    var g = grp[i];
    for(var m=0; m<g.mem.length && m<4; m++){
      var ev = g.mem[m];
      if(!ev.w) continue;
      // le perso concerne est-il dans le groupe ?
      var qui = null;
      for(var k=0;k<grp.length;k++) if(grp[k].key === ev.w) qui = grp[k];
      if(!qui) continue;
      var age = (W.t - ev.t)/1000;
      if(age > 120) continue;
      var phrase = null;
      if(ev.k==="ko_by")        phrase = qui.name + " a mis " + g.name + " K.O.";
      else if(ev.k==="ko_of")   phrase = g.name + " a mis " + qui.name + " K.O.";
      else if(ev.k==="heal_by") phrase = qui.name + " a soigné " + g.name;
      else if(ev.k==="heal_of") phrase = g.name + " a soigné " + qui.name;
      else if(ev.k==="helped")  phrase = g.name + " a aidé " + qui.name;
      else if(ev.k==="hit_by")  phrase = g.name + " et " + qui.name + " se sont battus";
      if(phrase && !vu[phrase]){ vu[phrase] = 1; out.push(phrase); }
    }
  }
  return out;
}

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
function promptConversation(grp){
  var p=[], i, j;
  // Chaque scene : ce qui se passe + COMMENT elle finit (le dernier échange doit y mener).
  var RITE = {
    amour: { quoi:"%A rassemble son courage et déclare ses sentiments à %B. Sincère, maladroit, gênant.",
             fin_oui:"%B accepte : la dernière réplique de %A est une déclaration, celle de %B un oui ému.",
             fin_non:"%B le repousse : %A se déclare, et %B refuse gentiment mais clairement, puis s'en va." },
    guerre:{ quoi:"%A rompt définitivement avec %B. Froid, sans retour.",
             fin:"La scène se termine sur une menace claire : ils vont se battre à mort, là, maintenant. La dernière réplique lance le combat." },
    defi:  { quoi:"%A défie %B en duel amical. Rivalité, provocation, bon enfant.",
             fin:"Ça se termine par un défi accepté : ils se mettent en garde. La dernière réplique lance le duel." },
    betise:{ quoi:"%A fait une farce à %B (pas une agression : une BLAGUE). Ex : détourner son attention, un petit coup en douce, une moquerie.",
             fin:"La chute est comique : %A réussit sa farce, %B se fait avoir et râle (sans vraie violence). La dernière réplique de %A est le moment où il le piège, celle de %B sa réaction agacée mais pas blessée." },
    dispute:{quoi:"%A et %B s'engueulent. Le ton monte.",
             fin:"Ça finit tendu : une dernière pique de chaque côté, ils se tournent le dos ou se poussent." },
    reconcile:{quoi:"%A vient faire la paix avec %B. Maladroit, ça ne lui vient pas naturellement.",
               fin:"Ça finit par une réconciliation gauche : %A s'excuse à sa manière, %B accepte du bout des lèvres." },
    admire:{ quoi:"%A admire ouvertement %B et le lui dit. %B est mal à l'aise.",
             fin:"Ça finit sur %A encore admiratif et %B qui ne sait pas où se mettre." },

    // LA FORCE : une présence invisible dans leur monde, qui saisit les gens, les déplace,
    // les jette. Ils ne comprennent pas ce que c'est. Ils n'ont AUCUN mot pour le dire.
    secret:{ quoi:"%A confie à %B, à voix basse, qu'une PRÉSENCE INVISIBLE hante leur monde : "
                + "elle saisit les gens, les soulève, les repose ailleurs. Ils ont peur. "
                + "Ils n'ont pas de mot pour ça — ni dieu, ni démon, juste 'la chose', 'ça'.",
             fin:"Ça finit sur un pacte de silence : n'en parler à personne, se tenir à l'écart." },
    culte:{  quoi:"%A et %B parlent de la PRÉSENCE INVISIBLE avec ferveur. Pour eux, elle veille, "
                + "elle protège, elle les a choisis. C'est presque religieux.",
             fin:"Ça finit sur une promesse : être dignes d'elle, l'accueillir quand elle revient." },
    theorie:{quoi:"%A et %B essaient de comprendre ce qu'est la PRÉSENCE INVISIBLE qui hante "
              + "leur monde : elle saisit les gens, les déplace, disparaît, revient. Ils "
              + "élaborent des théories. TOUT est permis : un dieu, un rêve, un ennemi, "
              + "une punition, un enfant qui joue, ou l'idée vertigineuse qu'ils n'existent "
              + "que pour être regardés. Ne tranche pas : laisse-les douter.",
             fin:"Ça finit sans réponse. Une phrase qui donne le vertige, et un silence." },
    defiance:{quoi:"%A n'en peut plus de la PRÉSENCE INVISIBLE qui les manipule. Il veut la défier, "
                + "la provoquer, lui crier dessus. %B tente de le raisonner.",
             fin:"Ça finit sur %A qui lance un défi au vide. Rien ne répond. Le silence est pire." }
  };
  if(grp.rite && RITE[grp.rite]){
    var R = RITE[grp.rite];
    var fin = R.fin;
    if(grp.rite === "amour") fin = (grp[1].relTo(grp[0]) > 25) ? R.fin_oui : R.fin_non;
    var rep = function(t){ return t.replace(/%A/g, grp[0].name).replace(/%B/g, grp[1].name); };
    p.push("SCÈNE À ÉCRIRE : " + rep(R.quoi));
    p.push("COMMENT ÇA FINIT : " + rep(fin));
    p.push("Le dialogue doit MENER À CETTE FIN de façon naturelle. C'est un moment fort du jeu.");
  } else {
    p.push("Écris la conversation entre ces ninjas de l'univers Naruto. Ils viennent de se croiser.");
    // le passif entre eux : c'est ce qui rend l'echange vrai plutot que generique
    var hist = entreEux(grp);
    if(hist.length) p.push("Entre eux, récemment : " + hist.join(" · ") + ".");
    if(W.moment) p.push("C'est le/la " + W.moment() + ".");
  }
  p.push("RÈGLES pour que ça sonne vrai :");
  p.push("- Chaque réplique RÉPOND vraiment à la précédente. On se relance, on rebondit, on se coupe.");
  p.push("- La réaction dépend de QUI répond et de ce qu'il pense de l'autre : le même mot ne provoque pas la même réponse chez tous.");
  p.push("- Chacun garde SA voix (voir son caractère). Sasuke ne parle pas comme Naruto.");
  p.push("- Ancre-toi dans le concret : ce qu'ils viennent de vivre, l'heure, la faim, un combat récent.");
  p.push("- Zéro banalité creuse (\"salut ça va\", \"belle journée\"). Un enjeu, une pique, une vraie question.");
  p.push("Court, sec, vivant. Que du dialogue, aucune narration. Max 12 mots par réplique. En français.");
  p.push("");
  p.push((grp.length === 2 ? "5 à 6" : "6 à 7") + " répliques, en alternance.");
  var a1 = ANGLES[Math.floor(Math.random()*ANGLES.length)];
  var a2 = ANGLES[Math.floor(Math.random()*ANGLES.length)];
  p.push("Point de départ possible (libre à toi) : " + a1 + (a1!==a2 ? ", ou " + a2 : "") + ".");
  p.push("La conversation peut DÉRAILLER, changer de sujet, monter en tension — comme une vraie.");
  p.push("Ne réutilise AUCUNE phrase déjà dite (voir plus bas).");
  p.push("");
  for(i=0;i<grp.length;i++) p.push(fiche(grp[i], true) + "\n");
  p.push("Ce qu'ils pensent les uns des autres :");
  for(i=0;i<grp.length;i++) for(j=0;j<grp.length;j++){
    if(i===j) continue;
    p.push("- " + grp[i].name + " → " + grp[j].name + " : " + relMot(grp[i].relTo(grp[j])));
  }

  return p.join("\n");
}

function prepareTalk(grp){
  if(grp.rite){ if(!libreScene()) return false; }
  else if(!libre() || !interessant(grp)) return false;

  ask(promptConversation(grp), "dialogue", grp).then(function(res){
    // filet : si le flux n'a rien transmis (backend sans streaming), on pose tout d'un coup
    if(grp.fromLLM) return;
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

/* ---------------------------------------------------------------- LA REACTION IMPROVISEE
   Ici, la tete ne CHOISIT PAS dans une liste de comportements : elle COMPOSE une suite
   de gestes elementaires, comme on forme une phrase avec des mots. "Fuir" n'est pas une
   option qu'on lui propose — c'est ce qui ressort si elle enchaine "s_eloigner", puis
   "regarder", puis "dire". Deux ninjas ne composeront pas la meme chose, et le meme ninja
   ne recomposera pas la meme suite deux fois.
*/
var reactEnCours = {};

function demandeReaction(g, evenement){
  if(!libre()) return false;
  if(reactEnCours[g.key]) return false;
  reactEnCours[g.key] = 1;

  var q = [];
  q.push("Univers Naruto, monde autonome. Un personnage vient de vivre quelque chose.");
  q.push("Tu dois décider CE QU'IL FAIT — pas ce qu'un personnage ferait en général, mais ce que");
  q.push("LUI, avec son histoire et son caractère, fait à cet instant précis.");
  q.push("");
  q.push("CE QUI VIENT D'ARRIVER : " + evenement);
  q.push("");
  q.push(fiche(g, false));
  q.push("");

  // qui est autour de lui — sans dire quoi en faire
  var n = vus(g), v = [];
  for(var i=0;i<n.length && i<5;i++)
    v.push(n[i].name + " (" + Math.round(Math.abs(n[i].x-g.x)/10) + " m, " + relMot(g.relTo(n[i]))
           + (n[i].mode==="ko" ? ", à terre" : "") + ")");
  if(v.length) q.push("Autour de lui : " + v.join(" · ") + ".");
  if(W.LIEUX){
    var L = [];
    for(i=0;i<W.LIEUX.length;i++) L.push(W.LIEUX[i].nom);
    q.push("Lieux du village : " + L.join(", ") + ".");
  }
  q.push("");
  q.push("Il ne peut pas voler, grimper, ni fabriquer d'objets. Voici TOUT ce que son corps sait faire :");
  q.push('  aller_vers   (cible : un nom de personnage, un lieu, ou "la présence")');
  q.push("  s_eloigner   (cible)");
  q.push("  suivre       (cible)");
  q.push("  s_arreter");
  q.push("  regarder     (cible)");
  q.push("  geste        (cible : guard, jump, dash, downed, attack, strong, getup, intro, win)");
  q.push("  dire         (texte : une phrase courte, dans sa bouche, en français)");
  q.push("  attendre");
  q.push("  provoquer    (cible : un personnage — il va le chercher, ça peut dégénérer)");
  q.push("  toucher      (cible : une bourrade, une tape — pas un combat)");
  q.push("  soigner      (cible : s'il en est capable)");
  q.push("");
  q.push("Compose une suite de 2 à 4 de ces gestes. Pas de comportement type : ce que LUI ferait.");
  q.push("Deux personnes dans la même situation ne font pas la même chose.");
  q.push("");
  q.push('Réponds en JSON : {"suite":[{"quoi":"...","cible":"...","texte":"..."}]}');

  ask(q.join("\n"), "reaction").then(function(res){
    delete reactEnCours[g.key];
    var o = lireJSON(res && res.text);
    var suite = o && o.suite;
    if(!Array.isArray(suite) || !suite.length) return;
    var propre = [];
    for(var k=0;k<suite.length && k<5;k++){
      if(!suite[k] || !suite[k].quoi) continue;
      propre.push({ quoi:String(suite[k].quoi).toLowerCase().trim(),
                    cible:suite[k].cible ? String(suite[k].cible) : "",
                    texte:suite[k].texte ? String(suite[k].texte) : "" });
    }
    if(propre.length) W.poserSuite(g, propre);
  }).catch(function(){ delete reactEnCours[g.key]; });

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
    if(p > 24) note.push({g:A[i], p:p});
  }
  if(!note.length) return;
  note.sort(function(x,y){ return y.p - x.p; });

  // les deux qui ont le plus de raisons de faire quelque chose, la maintenant.
  // On ne leur propose PAS de menu : on leur decrit leur vie, et la tete compose.
  var lances = 0;
  for(i=0;i<note.length && lances<2;i++){
    var g = note[i].g;
    if(g.seq || g.mode !== "wander" || g.duel || g.held || g.possessed) continue;
    if(demandeReaction(g, momentDeVie(g))){ g.mindT = W.t; lances++; }
  }
}

// ce qu'il vit en ce moment, raconte simplement. Pas de consigne, pas d'options.
function momentDeVie(g){
  var bouts = [];
  if(g.mem.length){
    var ev = g.mem[0], age = Math.round((W.t - ev.t)/1000);
    var qui = ev.w ? (W.find(ev.w) ? W.find(ev.w).name : "") : "";
    var D = { ko_by:"il s'est fait mettre K.O. par " + qui,
              ko_of:"il a mis " + qui + " K.O.",
              saw_ko:"il a vu " + qui + " tomber",
              heal_by:qui + " l'a soigné",
              heal_of:"il a soigné " + qui,
              helped:"il a aidé " + qui,
              hit_by:"il s'est battu contre " + qui,
              talked:"il a discuté avec " + qui };
    if(D[ev.k] && age < 120) bouts.push("il y a " + age + " s, " + D[ev.k]);
  }
  if(g.faim    > 70) bouts.push("il a faim");
  if(g.fatigue > 70) bouts.push("il est épuisé");
  if(g.ennui   > 70) bouts.push("il s'ennuie");
  if(g.hp < g.maxHp*0.5) bouts.push("il est blessé");
  if(Math.abs(g.opMain) > 30) bouts.push("la présence invisible l'obsède");
  var n = vus(g);
  if(!n.length) bouts.push("il est seul, personne en vue");
  if(!bouts.length) bouts.push("rien de particulier, il traîne");
  return bouts.join(", ") + ".";
}

/* ---------------------------------------------------------------- API */
// dialogues prepares d'avance pour des paires qui vont se croiser
var PRECHAUFFE = {};      // "a|b" -> script
function clePaire(a, b){ return a.key < b.key ? a.key+"|"+b.key : b.key+"|"+a.key; }

window.KV_MIND = {
  get on(){ return !!backend; },
  prepareTalk: prepareTalk,
  // le monde signale un evenement marquant : la tete improvise la reaction
  reagit: function(g, evenement){ return demandeReaction(g, evenement); },

  // appele quand deux ninjas se rapprochent : on ecrit le dialogue AVANT qu'ils se parlent
  prechauffe: function(a, b){
    if(!ILLIMITE) return;          // en ligne, le quota est precieux : pas de prechauffage
    if(!libre()) return;
    if(envois.length >= LIMITE_MIN - 4) return;   // on garde de la marge pour l'essentiel
    var cle = clePaire(a, b);
    if(PRECHAUFFE[cle]) return;               // deja au chaud
    PRECHAUFFE[cle] = "wait";
    var faux = [a, b];
    faux.rite = null;
    var p = promptConversation(faux);
    ask(p, "dialogue").then(function(res){
      var o = lireJSON(res && res.text);
      var d2 = o && (o.dialogue || o.actions);
      if(!Array.isArray(d2) || !d2.length){ delete PRECHAUFFE[cle]; return; }
      var sc = [];
      for(var k=0;k<d2.length && k<8;k++){
        if(!d2[k] || !d2[k].dit) continue;
        sc.push({ qui:String(d2[k].qui||"").toLowerCase().trim(), dit:String(d2[k].dit) });
      }
      PRECHAUFFE[cle] = sc.length ? {t:Date.now(), script:sc} : null;
      if(!sc.length) delete PRECHAUFFE[cle];
    }).catch(function(){ delete PRECHAUFFE[cle]; });
  },

  // le monde vient chercher un dialogue deja pret (0 attente)
  pret: function(grp){
    if(grp.length !== 2) return null;
    var cle = clePaire(grp[0], grp[1]);
    var e = PRECHAUFFE[cle];
    if(!e || e === "wait") return null;
    if(Date.now() - e.t > 90000){ delete PRECHAUFFE[cle]; return null; }  // trop vieux
    delete PRECHAUFFE[cle];
    return e.script;
  },
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
      brancheFlux();
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
