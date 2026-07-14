/* Konoha Vivant — SON.

   Deux sources, pour deux raisons :

   1. LES VOIX  = les 370 clips ripes du jeu (assets/sounds/<perso>/<code>.ogg).
      Leurs noms d'origine sont des codes hexa : impossible de savoir lequel dit
      "Rasengan" et lequel est un grognement sans les ecouter. Ils sont donc classes
      par DUREE dans data/sons.js — ce qui suffit largement :
        court (<0,55s) = effort   ·  moyen (<1,45s) = cri
        long (<2,45s)  = technique ·  epique = ultime / K.O. / victoire

   2. LES BRUITAGES = synthetises en direct (Web Audio), zero fichier.
      Impact, garde, souffle, chute. Comme ca aucun risque de coller une replique
      de victoire sur un coup de poing.

   Tout est spatialise : panoramique selon la position a l'ecran, volume selon la
   distance a la camera. Ce qui se passe hors champ ne s'entend pas.
*/
(function(){
"use strict";

var SONS = window.KV_SONS || {};
var W = null;                 // KV_WORLD
var ctx = null;
var master = null;
var vol = 0.7, mute = false;
var CACHE = {};
var dernier = {};             // anti-spam par perso
var musDom = null, musListe = [], musIdx = -1;

/* ---------------------------------------------------------------- demarrage */
function demarre(){
  if(ctx) return true;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = mute ? 0 : vol;
    master.connect(ctx.destination);
    return true;
  } catch(e){ return false; }
}
// certains navigateurs exigent un geste avant de laisser jouer du son
function reveille(){
  if(!demarre()) return;
  if(ctx.state === "suspended") ctx.resume();
}
window.addEventListener("click",   reveille);
window.addEventListener("keydown", reveille);

/* ---------------------------------------------------------------- spatialisation */
function place(x){
  if(!W || !W.cam) return { pan: 0, v: 1 };
  var C = W.cam;
  var dx = x - C.x;
  var demi = (W.LARG || 1000) / (2 * C.z);      // demi-largeur visible, en px monde
  var pan = Math.max(-1, Math.min(1, dx / demi));

  // 1. la distance a l'ecran : ce qui est sur le bord s'entend moins
  var proche = Math.max(0, 1 - Math.abs(dx) / (demi * 1.7));

  // 2. LE ZOOM COMMANDE LE VOLUME :
  //    vue large (z≈0,35) -> un murmure  ·  zoom sur une scene (z≈1,9) -> plein pot
  var z = Math.min(1.25, Math.pow(C.z / 1.55, 1.6));

  return { pan: pan, v: proche * proche * z };
}
function sortie(pan){
  var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if(p){ p.pan.value = pan; p.connect(master); return p; }
  return master;
}

/* ---------------------------------------------------------------- les voix */
function charge(url){
  if(CACHE[url]) return CACHE[url];
  CACHE[url] = fetch(url)
    .then(function(r){ if(!r.ok) throw 0; return r.arrayBuffer(); })
    .then(function(b){
      return new Promise(function(ok, ko){ ctx.decodeAudioData(b, ok, ko); });
    })
    .catch(function(){ return null; });
  return CACHE[url];
}
var CASES = {
  effort: ["court", "moyen"],
  cri:    ["moyen", "court", "long"],
  jutsu:  ["long", "moyen", "epique"],
  ultime: ["epique", "long", "moyen"]
};
function voix(g, type, force){
  if(!ctx || mute || !g) return;
  var S = SONS[g.key];
  if(!S) return;

  var p = place(g.x);
  if(p.v < 0.05) return;                        // hors champ : on n'entend rien

  var now = performance.now();
  var att = (type === "effort") ? 900 : 1600;   // il n'a pas trois bouches
  if(dernier[g.key] && now - dernier[g.key] < att) return;

  var liste = null, ordre = CASES[type] || CASES.cri;
  for(var i=0;i<ordre.length;i++){
    if(S[ordre[i]] && S[ordre[i]].length){ liste = S[ordre[i]]; break; }
  }
  if(!liste) return;
  dernier[g.key] = now;

  var id = liste[Math.floor(Math.random()*liste.length)];
  charge("../assets/sounds/" + g.key + "/" + id + ".ogg").then(function(buf){
    if(!buf) return;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.96 + Math.random()*0.08;   // un poil de variation
    var gg = ctx.createGain();
    gg.gain.value = p.v * (force == null ? 1 : force) * 0.9;
    src.connect(gg);
    gg.connect(sortie(p.pan));
    src.start();
  });
}

/* ---------------------------------------------------------------- les bruitages */
function bruit(dur){
  var n = Math.floor(ctx.sampleRate * dur);
  var b = ctx.createBuffer(1, n, ctx.sampleRate);
  var d = b.getChannelData(0);
  for(var i=0;i<n;i++) d[i] = (Math.random()*2 - 1) * (1 - i/n);
  var s = ctx.createBufferSource();
  s.buffer = b;
  return s;
}
function impact(x, force){
  if(!ctx || mute) return;
  var p = place(x);
  if(p.v < 0.04) return;
  var t = ctx.currentTime, out = sortie(p.pan), f = Math.min(2, force || 1);

  var n = bruit(0.10);
  var flt = ctx.createBiquadFilter();
  flt.type = "lowpass";
  flt.frequency.value = 500 + f*900;
  var g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.30 * f * p.v, t);
  g1.gain.exponentialRampToValueAtTime(0.0008, t + 0.13);
  n.connect(flt); flt.connect(g1); g1.connect(out);
  n.start(t); n.stop(t + 0.14);

  var o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  var g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.34 * f * p.v, t);
  g2.gain.exponentialRampToValueAtTime(0.0008, t + 0.15);
  o.connect(g2); g2.connect(out);
  o.start(t); o.stop(t + 0.16);
}
function garde(x){
  if(!ctx || mute) return;
  var p = place(x);
  if(p.v < 0.04) return;
  var t = ctx.currentTime, out = sortie(p.pan);
  var o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(1400, t);
  o.frequency.exponentialRampToValueAtTime(600, t + 0.07);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.16 * p.v, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.09);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + 0.1);
}
function souffle(x){
  if(!ctx || mute) return;
  var p = place(x);
  if(p.v < 0.04) return;
  var t = ctx.currentTime, out = sortie(p.pan);
  var n = bruit(0.28);
  var flt = ctx.createBiquadFilter();
  flt.type = "bandpass";
  flt.Q.value = 1.6;
  flt.frequency.setValueAtTime(380, t);
  flt.frequency.exponentialRampToValueAtTime(2400, t + 0.24);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.20 * p.v, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.3);
  n.connect(flt); flt.connect(g); g.connect(out);
  n.start(t); n.stop(t + 0.3);
}
function chute(x){
  if(!ctx || mute) return;
  var p = place(x);
  if(p.v < 0.04) return;
  var t = ctx.currentTime, out = sortie(p.pan);
  var o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.2);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.42 * p.v, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.35);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + 0.36);
  var n = bruit(0.2);
  var flt = ctx.createBiquadFilter();
  flt.type = "lowpass"; flt.frequency.value = 320;
  var g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.24 * p.v, t);
  g2.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
  n.connect(flt); flt.connect(g2); g2.connect(out);
  n.start(t); n.stop(t + 0.22);
}

/* ---------------------------------------------------------------- la musique */
// Electron liste lui-meme assets/music/ : rien a declarer a la main.
function chargeMusique(){
  if(!(window.KV_BRIDGE && window.KV_BRIDGE.musique)) return;
  window.KV_BRIDGE.musique().then(function(l){
    if(!l || !l.length) return;
    musListe = l;
    if(W) W.log(l.length + " piste" + (l.length>1?"s":"") + " de musique trouvée" + (l.length>1?"s":""));
    suivante();
  }).catch(function(){});
}
function suivante(){
  if(!musListe.length || mute) return;
  musIdx = (musIdx + 1 + Math.floor(Math.random()*Math.max(1,musListe.length-1))) % musListe.length;
  if(!musDom){
    musDom = new Audio();
    musDom.addEventListener("ended", suivante);
    musDom.addEventListener("error", suivante);
  }
  musDom.src = "../assets/music/" + encodeURIComponent(musListe[musIdx]);
  musDom.volume = mute ? 0 : vol * 0.22;      // la musique reste derriere
  musDom.play().catch(function(){});
}

/* ---------------------------------------------------------------- API */
window.KV_AUDIO = {
  init: function(world){
    W = world;
    demarre();
    chargeMusique();
  },
  voix: voix,
  impact: impact,
  garde: garde,
  souffle: souffle,
  chute: chute,
  vol: function(v){
    vol = v;
    if(master) master.gain.value = mute ? 0 : vol;
    if(musDom) musDom.volume = mute ? 0 : vol * 0.22;
  },
  mute: function(m){
    mute = m;
    if(master) master.gain.value = mute ? 0 : vol;
    if(musDom){
      musDom.volume = mute ? 0 : vol * 0.22;
      if(mute) musDom.pause(); else musDom.play().catch(function(){});
    }
  }
};

})();
