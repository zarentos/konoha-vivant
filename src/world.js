/* Konoha Vivant — LE MONDE (v1)
   15 ninjas vivent seuls : ils marchent, se parlent, se cherchent, se battent,
   tombent K.O., se font soigner, se vengent. Rien a faire, on regarde.
   Clic sur un ninja = le posseder. Alerte + zoom sur les scenes notables.
   Marche en double-clic (file://) et dans Electron.
*/
(function(){
"use strict";

var CHARS = window.KV_CHARS || {};
var MOVES = window.KV_MOVES || {};
var SOC   = window.KV_SOCIAL;

var ROSTER = ["naruto","sasuke","itachi","sakura","kakashi","jiraiya","orochimaru","pain",
              "deidara","konan","sai","shikamaru","suigetsu","karin","jugo"];

/* ---------------------------------------------------------------- constantes */
var cv = document.getElementById("world"), ctx = cv.getContext("2d");
ctx.imageSmoothingEnabled = false;
var BASE_W = 1000, BASE_H = 560;
var W = cv.width, H = cv.height;

// presets qualite : le seul vrai levier sur un PC faible, c'est la resolution de rendu.
var QUAL = {
  haut:  {res:1.00, shadows:1, sparks:1, flash:1, parallax:1, cap:0},
  moyen: {res:0.80, shadows:1, sparks:1, flash:1, parallax:1, cap:0},
  bas:   {res:0.60, shadows:0, sparks:0, flash:0, parallax:0, cap:30}
};
var Q = QUAL.haut;
function setQuality(name){
  Q = QUAL[name] || QUAL.haut;
  cv.width  = Math.round(BASE_W * Q.res);
  cv.height = Math.round(BASE_H * Q.res);
  W = cv.width; H = cv.height;
  ctx.imageSmoothingEnabled = false;   // changer width remet le contexte a zero
}

var WORLD_W = 2800;       // largeur du monde
var SCALE   = 1.70;       // UNE SEULE echelle pour tout le monde : les planches viennent
                          // du meme jeu, donc les vraies proportions reviennent d'elles-memes.
                          // (avant : scaleTo=115 forcait Naruto a la taille de Pain)
var Z_SPAN  = 96;         // profondeur : z=0 (fond) .. z=1 (devant) -> 96px de bande de sol
var Z_HIT   = 0.24;       // au-dela, on ne se touche plus : on est sur un autre plan
var GRAV    = 1550;
var JUMP    = 520;
var DASH    = 560;
var WALK    = 78;         // balade
var RUN     = 155;        // approche en combat
var FLEE    = 195;

var HP_MUL  = 1.6;        // les combats duraient 15s : on epaissit les PV
var TENSION = 1;          // multiplicateur global d'agressivite (slider)

var STRONG_DEF = {a:"strong", t:"melee", r:[0,100], d:12, cd:2600, ck:0, rc:74, kb:280, h:"heavy", w:2.2};

/* ---- LE TEMPS ---- */
var JOUR_MS = 20*60*1000;      // 20 minutes reelles = 24 h dans le monde
var heure   = 9;               // on demarre le matin
function nuit(){ return heure < 6 || heure >= 21; }
function momentDuJour(){
  if(heure < 6)  return "nuit";
  if(heure < 8)  return "aube";
  if(heure < 12) return "matin";
  if(heure < 14) return "midi";
  if(heure < 18) return "après-midi";
  if(heure < 21) return "soir";
  return "nuit";
}
function teinte(){
  if(heure >= 6  && heure < 8)  return {c:"255,150,90",  a:.16};   // aube
  if(heure >= 8  && heure < 17) return {c:"255,255,255", a:0};     // plein jour
  if(heure >= 17 && heure < 19) return {c:"255,140,60",  a:.16};   // fin d'apres-midi
  if(heure >= 19 && heure < 21) return {c:"120,90,180",  a:.26};   // crepuscule
  return {c:"20,35,90", a:.52};                                    // nuit
}

/* ---- LES LIEUX : c'est ce qui donne une structure au village ---- */
var LIEUX = [
  {nom:"Ichiraku",     ic:"🍜", x: 340,  b:"faim"},
  {nom:"Sous le saule",ic:"💤", x: 980,  b:"fatigue"},
  {nom:"Les poteaux",  ic:"🎯", x: 1480, b:"ennui"},
  {nom:"L'échoppe",    ic:"🍡", x: 1980, b:"faim"},
  {nom:"Le grand arbre",ic:"🌳",x: 2480, b:"fatigue"}
];
function lieuPour(b, x){
  var best=null, bd=1e9;
  for(var i=0;i<LIEUX.length;i++){
    if(LIEUX[i].b !== b) continue;
    var d = Math.abs(LIEUX[i].x - x);
    if(d < bd){ bd = d; best = LIEUX[i]; }
  }
  return best;
}

/* ---------------------------------------------------------------- utilitaires */
function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function pickOne(a){ return a[Math.floor(Math.random()*a.length)]; }
function overlap(a,b){ return a.x0<b.x1 && b.x0<a.x1 && a.y0<b.y1 && b.y0<a.y1; }

/* ---------------------------------------------------------------- images */
var IMG = {};
function sheet(path){
  if(IMG[path]) return IMG[path];
  var im = new Image();
  im.__ok = false;
  im.onload  = function(){ im.__ok = true; };
  im.onerror = function(){ im.__err = true; console.error("planche introuvable:", path); };
  im.src = path;
  IMG[path] = im;
  return im;
}

/* ---------------------------------------------------------------- lecture des data d'anim */
// frames ou la technique "touche" : celles dont l'ofx est dans fxAttack, sinon le milieu
function activeOf(a){
  if(a.__act) return a.__act;
  var act = [], i;
  if(a.fx && a.fxAttack && a.fxAttack.length){
    for(i=0;i<a.frames.length;i++){
      var o = a.frames[i].ofx;
      if(o!=null && a.fxAttack.indexOf(o)>=0) act.push(i);
    }
  }
  if(!act.length){
    var n = a.frames.length;
    var s = Math.floor(n*0.40), e = Math.max(s, Math.floor(n*0.78));
    for(i=s;i<=e && i<n;i++) act.push(i);
  }
  a.__act = act;
  return act;
}
// frame ou le projectile quitte la main
function launchOf(a){
  if(a.__lf!=null) return a.__lf;
  var lf = -1;
  if(a.launchFrame!=null) lf = a.launchFrame;
  else {
    if(a.fxAttack && a.fxAttack.length){
      for(var i=0;i<a.frames.length;i++){
        var o = a.frames[i].ofx;
        if(o!=null && a.fxAttack.indexOf(o)>=0){ lf = i; break; }
      }
    }
    if(lf<0) lf = Math.floor(a.frames.length*0.6);
  }
  a.__lf = lf;
  return lf;
}
function hasOrbData(a){
  if(a.__ho!=null) return a.__ho;
  var ho = false;
  for(var i=0;i<a.frames.length;i++) if(a.frames[i].orb!=null || a.frames[i].ofx!=null){ ho = true; break; }
  a.__ho = ho;
  return ho;
}
// index d'effet quand il n'y a pas d'ancre par frame (phases create/attack/end)
function phaseFxIndex(a, t){
  if(a.fxCreate){
    var list, lt;
    if(t<0.34){ list=a.fxCreate; lt=t/0.34; }
    else if(t<0.7){ list=a.fxAttack||a.fxCreate; lt=(t-0.34)/0.36; }
    else { list=a.fxEnd||a.fxAttack||a.fxCreate; lt=(t-0.7)/0.3; }
    return list[Math.min(list.length-1, Math.floor(lt*list.length))];
  }
  return Math.min(a.fx.length-1, Math.floor(t*a.fx.length));
}
// decoupe l'anim d'attaque en segments de combo
function segsOf(n){
  if(n<=4) return [[0,n-1]];
  if(n<=8){ var m=Math.floor(n/2); return [[0,m-1],[m,n-1]]; }
  var a=Math.floor(n/3), b=Math.floor(2*n/3);
  return [[0,a-1],[a,b-1],[b,n-1]];
}

/* ---------------------------------------------------------------- etat global */
var agents=[], projs=[], sparks=[], duels=[], bubbles=[], logLines=[];
var worldT=0, socialAcc=0, shake=0, timeScale=1, tsTarget=1, paused=false;
var possessed=null, uid=0, lastEventT=-99999;
var AUD = null;   // KV_AUDIO, branche au demarrage
var fps=0, fpsAcc=0, fpsN=0, showDiag=false, lastDraw=0, nbNinjas=15;
var speedMul = 1;

/* ---------------------------------------------------------------- AGENT */
function Agent(key, x){
  this.id      = ++uid;
  this.key     = key;
  this.def     = CHARS[key];
  this.M       = MOVES[key] || {};
  this.S       = (SOC.TRAITS[key]) || {social:.5, loyal:.5, calme:.5};
  this.name    = this.def.name || key;
  this.img     = sheet(this.def.sheet);
  this.K       = SCALE;
  // hauteur debout : mesuree sur son idle, pas imposee
  var ia = this.def.anims.idle, ih = 0;
  for(var q=0;q<ia.frames.length;q++) ih += ia.frames[q].r[3];
  this.Ht      = (ih/ia.frames.length) * SCALE;

  this.maxHp   = Math.round((this.M.hp || 110) * HP_MUL);
  this.hp      = this.maxHp;
  this.ck      = 100;

  this.x=x; this.y=0; this.vx=0; this.vy=0; this.facing = Math.random()<.5?1:-1; this.onGround=true;
  this.z = 0.22 + Math.random()*0.60;   // profondeur (0 = fond, 1 = devant)
  this.goalZ = this.z;
  this.anim="idle"; this.frame=0; this.ft=0; this.dir=1;

  this.st="free";                       // free | act | combo
  this.actAnim=null; this.actT=0; this.actDur=0; this.after=null; this.curMove=null;
  this.combo=null; this.hitSet=null; this.projDone=false;

  this.dashT=0; this.invT=0; this.guardT=0; this.stunT=0; this.flash=0;
  this.atkMul=1; this.defMul=1; this.buffT=0; this.sage=false; this.sageT=0;
  this.cd={};

  this.mode="wander";                   // wander | talk | watch | fight | heal | flee | ko
  this.modeT=0; this.brainT=rand(200,1200);
  this.walkDir=0; this.walkT=0; this.goalX=null;
  this.duel=null; this.side=-1; this.target=null;
  this.talkGrp=null; this.talkX=0; this.sayT=0; this.talkCd=rand(2000,9000);
  this.healTarget=null; this.avenge=null; this.fleeFrom=null;
  this.airAtk=false; this.possessed=false; this.downT=0; this.fightCd=rand(0,8000); this.spd=WALK;
  this.held=false;                       // attrape a la souris
  this.parleT=rand(2500,12000);          // il pense a voix haute, tout le temps
  this.riteCd=rand(8000,40000);
  this.fait={};                          // les scenes deja jouees (on ne se declare pas 10 fois)
  // CE QU'IL PENSE DE LA FORCE (le joueur). Personne ne commence avec un avis.
  this.opMain = 0;                       // -100 terreur .. +100 devotion
  this.ame = 0;                          // -1 aigri .. +1 serein — CE QUE LA VIE A FAIT DE LUI
  this.coups = 0; this.douceurs = 0;     // ce qu'il a encaisse / recu de bon
  this.memF = [];                        // ce que la Force lui a fait
  this.peurT = 0;                        // temps restant de fuite devant la Force
  this.reactF = null;                    // sa reaction actuelle a la Force (sert a la contagion)
  this.seq = null; this.seqI = 0;        // suite de gestes composee par la tete
  // LES BESOINS : le vrai moteur. Ils montent tout seuls et il faut y repondre.
  this.faim    = rand(0, 45);
  this.fatigue = rand(0, 40);
  this.ennui   = rand(0, 50);
  this.lieu=null; this.faisant=null; this.besoinT=0;

  this.recent=[];              // les 4 dernieres techniques : on ne se repete pas
  this.mem=[];                 // journal : ce qui m'est arrive, en clair
  this.mstat={};               // ce qui touche / ce qui rate, par technique
  this.style="normal";         // style de combat, la "tete" peut le changer
  this.mindLines=[]; this.mindT=-99999;
  this.dits=[];                // ce qu'il a deja dit : le LLM doit l'eviter
  this.rel={}; this.grudge={};
  for(var i=0;i<ROSTER.length;i++){
    var o=ROSTER[i];
    if(o!==key) this.rel[o] = SOC.rel(key, o);
  }

  this.moves = (this.M.moves||[]).concat([STRONG_DEF]);
  this.aggr  = (this.M.aggr!=null ? this.M.aggr : .7);
}
var P = Agent.prototype;

P.A     = function(n){ var a=this.def.anims[n]; return (a && a.frames && a.frames.length) ? a : null; };
P.has   = function(n){ return !!this.A(n); };
P.durOf = function(n,extra){ var a=this.A(n); if(!a) return 0; return (a.frames.length/(a.fps||8))*1000 + (extra||0); };
P.relTo = function(o){ var v=this.rel[o.key]; return v==null?0:v; };
P.pickAnim = function(list){
  var ok=[];
  for(var i=0;i<list.length;i++) if(this.has(list[i])) ok.push(list[i]);
  return ok.length ? pickOne(ok) : "idle";
};
/* L'ETAT D'AME.
   Ce n'est pas un trait de caractere : c'est le RESULTAT de ce qu'il a vecu.
   Le meme ninja, dans deux parties differentes, ne sera pas la meme personne.
   Aigri : il se lie difficilement, il s'emporte vite, il voit le mal partout.
   Serein : il s'ouvre, il pardonne, il cherche la compagnie.
*/
P.calculeAme = function(){
  var i, n = 0, somme = 0, amis = 0, ennemis = 0;
  for(i=0;i<agents.length;i++){
    var o = agents[i];
    if(o === this) continue;
    var r = this.relTo(o);
    somme += r; n++;
    if(r > 35) amis++;
    else if(r < -35) ennemis++;
  }
  var moy = n ? somme/n : 0;

  var cible = 0;
  cible += moy / 60;                                  // le climat general autour de lui
  cible += Math.min(0.60, amis * 0.22);               // avoir des amis rassure BEAUCOUP
  cible -= Math.min(0.45, ennemis * 0.11);            // etre entoure d'ennemis ronge
  cible += (this.douceurs*1.5 - this.coups) * 0.035;  // le bilan de ce qu'il a subi
  cible += (this.opMain/100) * 0.30;                  // ce qu'il pense de la Force compte
  cible -= (100 - this.humeur()) / 220;               // faim, fatigue, ennui pesent aussi

  return clamp(cible, -1, 1);
};

// combien il est capable de s'attacher, maintenant. Aigri : tres peu.
P.ouverture = function(){ return 0.35 + 0.85 * (this.ame + 1) / 2; };
// combien il est a cran. Aigri : beaucoup.
P.aCran = function(){ return 1.35 - 0.7 * (this.ame + 1) / 2; };

P.motAme = function(){
  var a = this.ame;
  if(a <= -0.55) return "aigri";
  if(a <= -0.2)  return "sur ses gardes";
  if(a <   0.2)  return "neutre";
  if(a <   0.55) return "apaisé";
  return "serein";
};

// il retient ce que la Force lui a fait
P.memMain = function(quoi, gravite){
  this.memF.unshift({t:worldT, k:quoi, g:gravite});
  if(this.memF.length > 6) this.memF.pop();
};
// comment il voit la Force, en clair
P.avisForce = function(){
  var o = this.opMain || 0;
  if(o <= -70) return "terreur";
  if(o <= -30) return "peur";
  if(o <= -10) return "mefiance";
  if(o <   12) return "indifference";
  if(o <   45) return "curiosite";
  if(o <   75) return "fascination";
  return "devotion";
};
P.remember = function(kind, who){
  this.mem.unshift({t:worldT, k:kind, w:who?who.key:null});
  if(this.mem.length > 8) this.mem.pop();
};
P.memText = function(){
  var out=[], i;
  for(i=0;i<this.mem.length;i++){
    var m=this.mem[i], ago=Math.round((worldT-m.t)/1000);
    if(ago > 240) continue;                       // au-dela de 4 min, on oublie
    var n = m.w && CHARS[m.w] ? CHARS[m.w].name : "";
    var L = {
      ko_by:   n+" m'a mis K.O.",
      ko_of:   "j'ai mis "+n+" K.O.",
      hit_by:  n+" m'a frappe",
      heal_by: n+" m'a soigne",
      heal_of: "j'ai soigne "+n,
      saw_ko:  "j'ai vu "+n+" tomber",
      helped:  n+" est venu m'aider",
      talked:  "j'ai parle avec "+n
    }[m.k];
    if(L) out.push("il y a "+ago+"s : "+L);
  }
  return out.join("\n");
};
P.grudgeUp = function(o,n){
  this.grudge[o.key] = Math.min(100, (this.grudge[o.key]||0) + n);
  this.rel[o.key]    = clamp((this.rel[o.key]||0) - n*0.35, -100, 100);
};

P.fy = function(){ return this.y + (this.z - 0.5) * Z_SPAN; };
P.setFree = function(n){ if(this.anim!==n){ this.anim=n; this.frame=0; this.ft=0; this.dir=1; } };
P.baseAnim = function(k){
  if(this.sage){
    if(k==="idle" && this.has("frog_idle")) return "frog_idle";
    if(k==="run"  && this.has("frog_move")) return "frog_move";
  }
  return k;
};
P.startAction = function(n, extra, after){
  if(!this.A(n)){ if(after) after(); return; }
  this.st="act"; this.actAnim=n; this.anim=n; this.actT=0;
  this.actDur=this.durOf(n, extra);
  this.frame=0; this.ft=0; this.after=after||null;
  this.combo=null; this.curMove=null; this.projDone=false;
  this.walkT=0; this.goalX=null;
};

/* ---- boites ---- */
P.hurtBox = function(){
  var hw = this.Ht*0.20, f = this.fy();
  return {x0:this.x-hw, x1:this.x+hw, y0:f-this.Ht*0.96, y1:f+2};
};
P.hitBox = function(rc){
  var a=this.x, b=this.x + this.facing*rc, f = this.fy();
  return {x0:Math.min(a,b), x1:Math.max(a,b), y0:f-this.Ht*0.98, y1:f-this.Ht*0.05};
};
P.hostile = function(t){
  if(t===this || t.mode==="ko") return false;
  if(this.possessed) return true;
  if(this.duel && t.duel===this.duel) return t.side!==this.side;
  return false;
};
P.swing = function(rc, d, kb, h, hs){
  var box=this.hitBox(rc), any=false;
  for(var i=0;i<agents.length;i++){
    var t=agents[i];
    if(!this.hostile(t)) continue;
    if(hs && hs[t.id]) continue;
    if(Math.abs(t.z - this.z) > Z_HIT) continue;   // il est sur un autre plan
    if(overlap(box, t.hurtBox())){
      if(hit(this, t, d, kb, h)){ if(hs) hs[t.id]=1; any=true; }
    }
  }
  return any;
};

/* ---- degats ---- */
function hit(att, tgt, dmg, kb, h, fromX){
  if(!tgt || tgt.mode==="ko" || tgt.invT>0 || tgt.hp<=0) return false;
  var fx = (fromX==null ? att.x : fromX);
  var dir = (tgt.x >= fx) ? 1 : -1;
  var blocked = tgt.guardT>0 && ((fx - tgt.x) * tgt.facing > 0);
  var niv = (att.duel && att.duel.niveau) || "serieux";
  var d = dmg * att.atkMul * tgt.defMul * (niv==="amical" ? 0.65 : (niv==="mortel" ? 1.15 : 1));

  if(blocked){
    tgt.hp -= d*0.22; tgt.vx = dir*110; tgt.flash=70; tgt.invT=70;
    spark(tgt.x + dir*-16, tgt.fy() - tgt.Ht*0.55, "#8fd0ff", .7);
    if(AUD) AUD.garde(tgt.x);
    return true;
  }

  tgt.hp   -= d;
  tgt.flash = 130;
  tgt.invT  = 80;
  tgt.guardT= 0;
  spark(tgt.x, tgt.fy() - tgt.Ht*0.55, "#ffd07a", h==="light"?.8:1.35);
  shake += (h==="launch"?7:(h==="heavy"?4:1.6));
  if(AUD){
    AUD.impact(tgt.x, h==="launch" ? 1.8 : (h==="heavy" ? 1.2 : 0.6));
    if(h!=="light" && Math.random() < 0.5) AUD.voix(tgt, "effort", 0.8);   // il encaisse
  }
  tgt.grudgeUp(att, h==="light"?3:6);
  if(!tgt._hitMem || worldT-tgt._hitMem > 8000){ tgt.remember("hit_by", att); tgt._hitMem=worldT; }
  // qui touche avec quoi : l'IA s'en sert pour arreter ce qui rate
  if(att.curMove && !att._landed){
    att._landed=true;
    var ms=att.mstat[att.curMove.a];
    if(ms) ms.hit++;
  }

  if(tgt.hp<=0){ tgt.hp=0; tgt.knockout(att); return true; }
  if(h==="stun"){ tgt.stun(1300); return true; }

  // si c'est le joueur qui provoque, l'autre se defend
  if(att.possessed && !att.duel && !tgt.duel && tgt.mode!=="ko") startFight(tgt, att, "provocation");

  tgt.vx = dir * (kb==null?140:kb);
  if(h==="launch"){ tgt.vy=-340; tgt.onGround=false; }
  tgt.combo=null;
  var n = (h==="light")  ? tgt.pickAnim(["hurt_light","hurt_h1","hurt"])
        : (h==="launch") ? tgt.pickAnim(["hurt_special","hurt_h3","hurt_h2"])
        :                  tgt.pickAnim(["hurt_h2","hurt_h3","hurt_h1","hurt_special"]);
  tgt.startAction(n, h==="light"?60:160, null);
  return true;
}

P.stun = function(ms){
  this.combo=null;
  this.stunT=ms;
  this.startAction(this.pickAnim(["hurt_light","hurt_h1","guard"]), ms, null);
};

P.knockout = function(by){
  var self=this;
  this.mode="ko"; this.combo=null; this.guardT=0; this.stunT=0;
  this.buffT=0; this.atkMul=1; this.defMul=1; this.sage=false; this.sageT=0;
  this.hp=0;
  this.vx = (this.x>=by.x?1:-1) * 280;
  this.vy = -270; this.onGround=false;
  this.downT = 14000 + Math.random()*11000;
  if(AUD){ AUD.chute(this.x); AUD.voix(this, "ultime", 1); }

  this.startAction("knockdown", 120, function(){
    self.startAction("downed", self.downT, function(){
      self.startAction("getup", 140, function(){
        self.st="free";
        self.mode="flee"; self.modeT=4000+Math.random()*3500; self.fleeFrom=by;
        self.hp = Math.round(self.maxHp*0.45);
        self.ck = 45; self.invT=1400;
      });
    });
  });

  // il SORT du duel tout de suite : sinon il reste compte comme "debout",
  // se releve, fuit, et son adversaire le repoursuit a l'infini.
  var d = this.duel;
  if(d){
    var arr = (this.side===0) ? d.A : d.B;
    var ix = arr.indexOf(this);
    if(ix>=0) arr.splice(ix, 1);
    this.duel=null; this.side=-1; this.target=null;
  }

  this.grudgeUp(by, 45);
  this.remember("ko_by", by);
  by.remember("ko_of", this);
  this.coups += 2;
  logIt(by.name + " met " + this.name + " K.O.");

  // les proches encaissent : rancune, puis vengeance
  var demi = W/(2*cam.z);
  for(var i=0;i<agents.length;i++){
    var f=agents[i];
    if(f===this || f===by) continue;
    if(f.mode==="ko") continue;
    f.remember("saw_ko", this);
    var proche = f.relTo(this);
    // reaction VISIBLE des temoins a l'ecran : ils se figent et lancent un mot
    var visible = Math.abs(f.x - cam.x) < demi + 100;
    if(visible && f.mode==="wander" && Math.random() < 0.5){
      if(proche > 40)       f.dire("blesse", true);      // choqué pour un ami
      else if(proche < -40) f.dire("content", true);     // ravi pour un ennemi
      else                  f.dire("tendu", true);
      f.facing = (this.x >= f.x) ? 1 : -1;               // il se tourne vers la scène
    }
    if(proche > 55 && f.S.loyal > .5){
      f.grudgeUp(by, 18 + 30*f.S.loyal);
      if(!f.avenge && Math.random() < f.S.loyal*0.40)
        f.avenge = {who:by, of:this, at: worldT + 8000 + Math.random()*18000};
    }
  }
  // le temoin le plus concerne : la tete improvise sa reaction
  if(window.KV_MIND && window.KV_MIND.reagit){
    var meilleur = null, fort = 40;
    for(i=0;i<agents.length;i++){
      var t2 = agents[i];
      if(t2===this || t2===by || t2.mode==="ko" || t2.duel) continue;
      if(Math.abs(t2.x - this.x) > 380) continue;
      var lien2 = Math.abs(t2.relTo(this));
      if(lien2 > fort){ fort = lien2; meilleur = t2; }
    }
    if(meilleur) window.KV_MIND.reagit(meilleur,
      "Sous ses yeux, " + by.name + " vient de mettre " + this.name + " à terre, inconscient.");
  }

  // un K.O. spectaculaire (haine reciproque forte) devient un evenement — mais rarement
  if(by.relTo(this) < -55 && this.relTo(by) < -30 && !scene && Math.random() < 0.5){
    raiseEvent("💥 " + by.name + " a terrassé " + this.name + " !", [by, this], null);
  }
  if(d) d.check();
};

P.healedBy = function(h, amount){
  var self=this;
  this.hp = Math.min(this.maxHp, this.hp + amount);
  this.rel[h.key] = clamp((this.rel[h.key]||0) + 22*this.ouverture(), -100, 100);
  this.douceurs += 2;
  spark(this.x, this.fy() - this.Ht*0.55, "#7dffb2", 1.2);
  if(AUD) AUD.voix(h, "cri");
  this.remember("heal_by", h); h.remember("heal_of", this);
  if(this.mode==="ko"){
    logIt(h.name + " remet " + this.name + " sur pied.");
    this.downT=0;
    if(this.hp < this.maxHp*0.35) this.hp = Math.round(this.maxHp*0.5);
    this.startAction("getup", 140, function(){
      self.st="free"; self.mode="wander"; self.modeT=0; self.invT=1200; self.brainT=200;
    });
  }
};

/* ---- lancement des techniques ---- */
P.usable = function(m, d, ctx2){
  if(!this.A(m.a)) return false;
  if((this.cd[m.a]||0) > 0) return false;
  if((m.ck||0) > this.ck) return false;
  // dans une bagarre amicale, on ne sort pas le Kirin ni le Chibaku Tensei
  if(this.duel && this.duel.niveau === "amical"){
    if((m.d||0) > 16 || m.h === "launch" || (m.ck||0) > 22) return false;
  }
  if(m.need==="sage" && !this.sage) return false;
  if(m.sage && this.sage) return false;
  if(m.ally) return !!(ctx2 && ctx2.wounded);
  if(m.lowhp!=null && this.hp > this.maxHp*m.lowhp) return false;
  if((m.atk || m.def) && this.buffT>0) return false;
  if(m.t==="buff") return true;
  if(d < m.r[0] || d > m.r[1]) return false;
  return true;
};
P.applyBuff = function(m, ally){
  if(m.ally && ally){
    ally.healedBy(this, m.heal||30);
    this.rel[ally.key] = clamp((this.rel[ally.key]||0)+6, -100, 100);
    return;
  }
  if(m.heal) this.hp = Math.min(this.maxHp, this.hp + m.heal);
  if(m.atk || m.def){ this.atkMul = m.atk||1; this.defMul = m.def||1; this.buffT = m.dur||8000; }
  if(m.inv)  this.invT  = Math.max(this.invT, m.inv);
  if(m.sage){ this.sage = true; this.sageT = m.dur||12000; }
  if(m.tp && this.target){
    var t=this.target;
    this.x = clamp(t.x - t.facing*70, 40, WORLD_W-40);
    this.facing = (t.x>=this.x) ? 1 : -1;
  }
};
P.cast = function(m, ally){
  if(!this.A(m.a)) return false;
  this.cd[m.a] = m.cd || 4000;
  this.ck = Math.max(0, this.ck - (m.ck||0));
  this.startAction(m.a, 80, null);
  this.curMove = m; this.hitSet = {}; this.projDone = false;
  this._landed = false;
  this.recent.unshift(m.a);
  if(this.recent.length > 4) this.recent.pop();
  if(AUD){
    var dd = m.d || 0;
    AUD.voix(this, dd >= 22 ? "ultime" : (dd >= 15 ? "jutsu" : "cri"));
  }
  if(!this.mstat[m.a]) this.mstat[m.a] = {n:0, hit:0};
  this.mstat[m.a].n++;
  if(m.t==="dash"){ this.vx = this.facing * (m.ds||430); this.dashT = 220; }
  if(m.t==="buff") this.applyBuff(m, ally);
  return true;
};

/* ---- combo ---- */
P.segsFor = function(base){
  var a=this.A(base); if(!a) return [[0,0]];
  if(base==="attack" && this.M.combo) return this.M.combo;
  return segsOf(a.frames.length);
};
P.comboStart = function(){
  var base = this.onGround ? "attack" : "attack_air";
  if(!this.has(base)) return;
  var segs = this.segsFor(base);
  this.st="combo"; this.anim=base; this.actAnim=base; this.curMove=null;
  this.walkT=0; this.goalX=null;
  this.combo = {base:base, segs:segs, seg:0, t:0, queued:false, done:{}, hs:{},
                chain: 1 + Math.floor(Math.random()*3)};
  if(AUD && Math.random() < 0.45) AUD.voix(this, "effort");
  this.frame = segs[0][0];
};
P.comboUpdate = function(dt){
  var cb=this.combo, a=this.A(cb.base);
  if(!a){ this.combo=null; this.st="free"; return; }
  var step = 1000/(a.fps||8);
  cb.t += dt;
  var sg = cb.segs[cb.seg];
  var f  = sg[0] + Math.floor(cb.t/step);

  if(f > sg[1]){
    var go = cb.queued || (!this.possessed && cb.chain>0);
    if(go && cb.seg < cb.segs.length-1){
      cb.seg++; cb.chain--; cb.queued=false; cb.t=0;
      this.frame = cb.segs[cb.seg][0];
    } else { this.combo=null; this.st="free"; }
    return;
  }
  this.frame = f;

  if(f === sg[1] && !cb.done[cb.seg]){
    var last = (cb.seg === cb.segs.length-1);
    if(!cb.hs[cb.seg]) cb.hs[cb.seg] = {};
    if(this.swing(last?68:60, last?10:4.5, last?280:110, last?"heavy":"light", cb.hs[cb.seg]))
      cb.done[cb.seg]=1;
  }
};

/* ---- cerveau de combat ---- */
P.woundedAlly = function(range){
  if(!this.duel) return null;
  var mates = (this.side===0 ? this.duel.A : this.duel.B), best=null;
  for(var i=0;i<mates.length;i++){
    var g=mates[i];
    if(g===this) continue;
    if(g.hp < g.maxHp*0.6 && Math.abs(g.x-this.x) < range){
      if(!best || g.hp<best.hp) best=g;
    }
  }
  return best;
};
P.readTarget = function(t){
  // ce que je "vois" de lui, comme un vrai joueur qui lit son adversaire
  var o = {charge:false, vent:false, air:false, garde:false, gros:0};
  if(t.st==="act"){
    var prog = t.actT / Math.max(1, t.actDur);
    if(t.curMove){
      o.charge = prog < 0.55;        // il monte son coup
      o.gros   = t.curMove.d || 0;
    }
    o.vent = prog >= 0.72;           // fin d'animation : il est dans le vent, punissable
  }
  o.air   = !t.onGround;
  o.garde = t.guardT > 0;
  return o;
};
P.styleMul = function(m){
  switch(this.style){
    case "rage":     return 1 + (m.d||0)/26;
    case "prudent":  return (m.t==="proj") ? 1.5 : (m.t==="dash" ? 0.45 : 1);
    case "distance": return (m.t==="proj") ? 2.2 : ((m.rc||0) > 200 ? 1.6 : 0.45);
    case "achever":  return 1 + (m.d||0)/16;
  }
  return 1;
};
P.scoreMove = function(m, d, t, rd){
  var s = (m.w||1);

  // 1. est-ce que la portee colle vraiment, ou je suis au bord ?
  if(m.t !== "buff"){
    var mid=(m.r[0]+m.r[1])/2, span=Math.max(1,(m.r[1]-m.r[0])/2);
    s *= Math.max(0.35, 1.30 - 0.60*Math.abs(d-mid)/span);
  }
  // 2. PUNITION : il est dans le vent et a portee -> on tape le plus fort possible
  if(rd.vent && (m.t==="melee"||m.t==="dash") && d < (m.rc||0)+40)
    s *= 1 + (m.d||0)/11;
  // 3. anti-air
  if(rd.air){
    if(m.h==="launch" || m.a.indexOf("rising")>=0) s *= 2.4;
    else if(m.t==="proj") s *= 0.45;
  }
  // 4. il charge un gros coup : on l'interrompt de loin, on ne fonce PAS dedans
  if(rd.charge && rd.gros > 16){
    if(m.t==="proj") s *= 1.7;
    if(m.t==="dash") s *= 0.40;
  }
  // 5. il garde : les etourdissements passent, les coups normaux se font bloquer
  if(rd.garde) s *= (m.h==="stun") ? 2.6 : 0.5;
  // 6. achever
  if(t.hp < t.maxHp*0.28) s *= 1 + (m.d||0)/22;
  // 7. economie : on ne claque pas tout son chakra si le combat est loin d'etre fini
  if(this.ck < 45 && (m.ck||0) > 22 && t.hp > t.maxHp*0.35) s *= 0.35;
  // 8. ce qui rate en boucle, on arrete d'insister
  var ms = this.mstat[m.a];
  if(ms && ms.n >= 3) s *= 0.35 + 0.95*(ms.hit/ms.n);
  // 8bis. on ne ressort pas la meme technique en boucle
  var rp = this.recent.indexOf(m.a);
  if(rp >= 0) s *= 0.14 + 0.21*rp;      // la derniere : x0.14 · l'avant-derniere : x0.35 ...
  // 9. style impose par la "tete"
  s *= this.styleMul(m);
  return Math.max(0, s);
};
P.fightDecide = function(){
  var t = this.target;
  if(!t || t.mode==="ko") return 400;

  var dx = t.x - this.x, d = Math.abs(dx);
  if(this.onGround) this.facing = dx>=0 ? 1 : -1;

  if(Math.abs(t.z - this.z) > 0.05) this.goalZ = t.z;   // se mettre a sa hauteur
  var rd  = this.readTarget(t);
  var agr = this.aggr * (this.style==="rage" ? 1.5 : (this.style==="prudent" ? 0.6 : 1));
  var wounded = this.woundedAlly(240);
  var cx = {wounded: wounded};

  var cands=[], TW=0, i, m, w;
  for(i=0;i<this.moves.length;i++){
    m = this.moves[i];
    if(!this.usable(m, d, cx)) continue;
    w = this.scoreMove(m, d, t, rd);
    if(m.heal && !m.ally && this.hp > this.maxHp*0.5) w *= 0.2;
    if(w > 0){ cands.push({m:m, w:w}); TW += w; }
  }
  function add(tag, ww){ if(ww > 0){ cands.push({tag:tag, w:ww}); TW += ww; } }

  add("combo",    d<110 ? (2.0 + 3*agr) * (rd.vent?2.4:1) * (rd.garde?0.5:1) * (this.style==="distance"?0.4:1) : 0);
  add("approach", d>135 ? (d>320 ? 4.4 : 2.6) * (0.4+agr) * (this.style==="distance"?0.3:1) : 0);
  add("dash",     (d>240 && this.onGround) ? 2.0*agr * (rd.charge?0.35:1) : 0);
  // reculer, et surtout : DEGAGER quand il charge un gros truc
  add("back",     d<95 ? 1.4*(1.25-agr) * (rd.charge && rd.gros>16 ? 4.0 : 1) : 0);
  add("jump",     (d>110 && d<290 && this.onGround) ? 0.9*agr : 0);
  add("jump",     (rd.charge && rd.gros>18 && d<170 && this.onGround) ? 3.2 : 0);
  add("guard",    (rd.charge && d<150) ? 2.2 * this.S.calme * (1.5-agr) : 0);

  if(TW <= 0){ this.walkDir = this.facing; this.walkT = 400; return 450; }

  var r = Math.random()*TW, c = null;
  for(i=0;i<cands.length;i++){ r -= cands[i].w; if(r<=0){ c = cands[i]; break; } }
  if(!c) c = cands[cands.length-1];

  if(c.m){
    this.cast(c.m, c.m.ally ? wounded : null);
    return 260 + Math.random()*360;
  }
  switch(c.tag){
    case "combo":    this.comboStart(); return 420 + Math.random()*380;
    case "approach": this.walkDir=this.facing;  this.walkT=250+Math.random()*400; return this.walkT+50;
    case "dash":     this.dashT=230; this.vx=this.facing*DASH; return 370;
    case "back":     this.walkDir=-this.facing; this.walkT=200+Math.random()*280; return this.walkT+70;
    case "jump":     this.vy=-JUMP; this.onGround=false; this.airAtk=Math.random()<0.7; return 600;
    case "guard":    this.guardT=380+Math.random()*380; this.vx=0; this.walkT=0; return 280+Math.random()*220;
  }
  return 460;
};

/* ---- cerveau social ---- */
P.walkTo = function(gx, spd){
  this.goalX = clamp(gx, 60, WORLD_W-60);
  this.spd = spd || WALK;
};
P.wanderDecide = function(){
  var r = Math.random();
  if(r < 0.55){
    // on ne marche pas au hasard : on derive vers ceux qu'on apprecie
    var vers = null, meilleur = 28;
    for(var q=0;q<agents.length;q++){
      var o2 = agents[q];
      if(o2 === this || o2.mode === "ko") continue;
      var l2 = this.relTo(o2);
      if(l2 > meilleur && Math.abs(o2.x - this.x) < 900){ meilleur = l2; vers = o2; }
    }
    if(vers && Math.random() < 0.55){
      this.walkTo(vers.x + rand(-70, 70), WALK*rand(.9,1.25));
      this.goalZ = clamp(vers.z + rand(-0.10, 0.10), 0.16, 0.94);
      return rand(1400, 3000);
    }
    this.walkTo(this.x + rand(-380, 380), WALK*rand(.8,1.25));
    if(Math.random() < 0.45) this.goalZ = clamp(this.z + rand(-0.30, 0.30), 0.16, 0.94);
    return rand(1400, 3600);
  }
  if(r < 0.72 && this.has("intro") && Math.random()<0.3){
    this.startAction("intro", 200, null);
    return rand(1500, 3000);
  }
  this.goalX = null; this.walkT = 0; this.vx = 0;
  return rand(900, 2600);
};
/* COMMENT IL REAGIT A LA FORCE.
   Aucune regle du type "il a peur donc il fuit". On PESE une quinzaine de facteurs pour
   chaque reaction possible, puis on tire au sort proportionnellement aux poids obtenus.
   Consequence : deux ninjas dans la meme situation ne font pas la meme chose, et le meme
   ninja ne refait pas forcement deux fois pareil. Un fervent PEUT avoir peur. Un terrifie
   PEUT venir voir. C'est le meme principe que l'IA de combat, qui marche depuis le debut.
*/
P.reagirForce = function(){
  var dF   = Math.abs(this.x - FORCE.x);
  var op   = (this.opMain||0) / 100;          // -1 .. +1
  var ame  = this.ame || 0;                   // -1 aigri .. +1 serein
  var T    = this.S;
  var pv   = this.hp / this.maxHp;
  var hum  = this.humeur() / 100;
  var pres = Math.max(0, 1 - dF/420);         // a quel point elle est proche
  var i;

  // --- CE QUE FONT LES AUTRES : la panique et la ferveur sont contagieuses ---
  var voisins = 0, fuient = 0, venerent = 0, allie = null, faible = null;
  for(i=0;i<agents.length;i++){
    var o = agents[i];
    if(o === this || Math.abs(o.x - this.x) > 320) continue;
    voisins++;
    if(o.reactF === "fuir" || o.reactF === "cacher") fuient++;
    if(o.reactF === "saluer" || o.reactF === "approcher") venerent++;
    if(this.relTo(o) > 30 && !allie) allie = o;
    if(o.mode === "ko" || o.hp < o.maxHp*0.35){ if(this.relTo(o) > 15) faible = o; }
  }
  var contagionPeur   = voisins ? fuient/voisins   : 0;
  var contagionFerveur= voisins ? venerent/voisins : 0;

  // --- son vecu personnel avec elle ---
  var brutalise = 0, aide = 0;
  for(i=0;i<this.memF.length;i++){
    var age = (worldT - this.memF[i].t)/1000;
    var frais = Math.max(0, 1 - age/150);
    if(this.memF[i].g < 0) brutalise += -this.memF[i].g * frais;
    else                   aide      +=  this.memF[i].g * frais;
  }

  // --- combien de temps elle est la sans rien faire ---
  var calmeDepuis = Math.min(1, (worldT - FORCE.derniere) / 30000);
  var nuitFacteur = nuit() ? 1.35 : 1;

  var S = {};
  // FUIR : la peur brute, amplifiee par la fragilite, la nuit, et les autres qui fuient
  S.fuir = (-op*2.4 + brutalise*0.9) * pres * nuitFacteur
         * (1.6 - T.calme) * (1.5 - pv*0.6) * (1 - ame*0.35)
         + contagionPeur * 2.2 * (1.3 - T.calme);

  // RECULER : la meme chose en moins violent — pour les calmes et les fiers
  S.reculer = (-op*1.5 + brutalise*0.4) * pres * (0.6 + T.calme) + contagionPeur*0.7;

  // SE CACHER derriere quelqu'un : quand on a peur ET qu'on n'est pas seul
  S.cacher = allie ? ((-op*1.8 + brutalise*0.7) * pres * (1.4 - T.calme) * (0.5 + T.social)) : 0;

  // FIGER : ni fuir ni approcher. La sideration. Frequent quand on ne sait pas quoi penser.
  S.figer = (1.4 - Math.abs(op)*1.6) * pres * (0.7 + T.calme*0.6) + (1 - hum)*0.5;

  // OBSERVER de loin : la mefiance prudente, ou la curiosite des calmes
  S.observer = (0.8 - op*0.6) * pres * (0.5 + T.calme) * (0.8 + Math.abs(op)*0.4);

  // APPROCHER : la fascination, la curiosite, le courage
  S.approcher = (op*2.6 + aide*0.8) * (0.4 + pres*0.9) * (0.6 + ame*0.5)
              * (0.7 + T.calme*0.5) + contagionFerveur*1.6;
  if(dF < 80) S.approcher *= 0.25;              // deja tout pres : moins de raison d'avancer

  // SALUER / se recueillir : la ferveur, quand elle est proche
  S.saluer = (op*2.2 - 0.5) * pres * (0.5 + T.loyal*0.8) + contagionFerveur*1.9;

  // DEFIER : la rage. Il faut de la haine, de l'amertume et pas de sang-froid.
  S.defier = (-op*1.9 - 0.6) * (1.5 - T.calme*1.4) * (0.5 - ame*0.8) * (0.6 + pres*0.7);

  // CHERCHER QUELQU'UN a qui en parler : les sociables, quand ils sont troubles
  S.chercher = Math.abs(op) * 1.5 * T.social * (0.5 + contagionPeur*0.8) * (allie ? 1.4 : 0.7);

  // PROTEGER un plus faible : la loyaute passe avant la peur
  S.proteger = faible ? ((-op*1.2 + 0.5) * T.loyal * 2.2 * pres) : 0;

  // IGNORER : elle ne fait rien depuis longtemps, ou il a autre chose a faire
  S.ignorer = 1.2 + calmeDepuis*2.6 + (1-pres)*1.8 + (1-hum)*1.4 - Math.abs(op)*0.8;

  // un peu de hasard partout : personne n'est une machine
  var noms = Object.keys(S), total = 0;
  for(i=0;i<noms.length;i++){
    S[noms[i]] = Math.max(0, S[noms[i]] * (0.75 + Math.random()*0.5));
    total += S[noms[i]];
  }
  if(total <= 0.001) return 0;

  // tirage proportionnel : le plus probable n'est pas le seul possible
  var tir = Math.random() * total, acc = 0, choix = "ignorer";
  for(i=0;i<noms.length;i++){
    acc += S[noms[i]];
    if(tir <= acc){ choix = noms[i]; break; }
  }
  this.reactF = choix;
  return this.appliquerReaction(choix, dF, allie, faible);
};

/* Il joue une suite de gestes que la TETE a composee elle-meme.
   Ce ne sont pas des comportements pre-ecrits : le LLM assemble des briques
   elementaires comme on assemble des mots. "Fuir" n'existe pas en tant que tel —
   c'est ce qui ressort quand il enchaine "s_eloigner" puis "regarder" puis "dire".
*/
var LIEUX_NOM = null;
function cibleDe(g, nom){
  if(!nom) return null;
  var n = String(nom).toLowerCase().trim();
  if(/presence|force|chose|invisible|ciel|elle|ca|ça/.test(n)) return {x:FORCE.x, z:g.z, force:true};
  var a2 = findAgent(n);
  if(a2) return a2;
  for(var i=0;i<LIEUX.length;i++)
    if(LIEUX[i].nom.toLowerCase().indexOf(n) >= 0 || n.indexOf(LIEUX[i].nom.toLowerCase()) >= 0)
      return {x:LIEUX[i].x, z:0.5};
  return null;
}
var GESTES_OK = {idle:1, guard:1, jump:1, dash:1, downed:1, getup:1, attack:1, strong:1,
                 hurt_light:1, run:1, intro:1, win:1};

P.jouerSuite = function(){
  if(!this.seq || this.seqI >= this.seq.length){ this.seq = null; return 0; }
  var pas = this.seq[this.seqI++];
  var quoi = String(pas.quoi||"").toLowerCase();
  var c = cibleDe(this, pas.cible);

  switch(quoi){
    case "aller_vers":
      if(!c) return 300;
      this.walkTo(c.x + rand(-40, 40), WALK * rand(1.0, 1.45));
      if(c.z != null) this.goalZ = clamp(c.z + rand(-0.08,0.08), 0.16, 0.94);
      return rand(1100, 2100);

    case "s_eloigner":
      var dir = c ? (this.x < c.x ? -1 : 1) : (Math.random()<.5?-1:1);
      this.walkTo(this.x + dir * rand(180, 400), RUN * rand(0.72, 0.95));
      this.goalZ = clamp(this.z + dir*0.04 - rand(0.05,0.25), 0.16, 0.94);
      return rand(900, 1900);

    case "suivre":
      if(!c) return 300;
      this.walkTo(c.x + (this.x < c.x ? -45 : 45), WALK*1.2);
      return rand(1200, 2200);

    case "s_arreter":
      this.goalX = null; this.walkT = 0; this.vx = 0;
      return rand(500, 1200);

    case "regarder":
      this.goalX = null; this.vx = 0;
      if(c) this.facing = (c.x >= this.x) ? 1 : -1;
      return rand(700, 1600);

    case "geste":
      var gn = String(pas.cible || pas.texte || "idle").toLowerCase().replace(/[^a-z_]/g,"");
      if(!GESTES_OK[gn] || !this.has(gn)) gn = this.has("guard") ? "guard" : "idle";
      this.startAction(gn, rand(400, 1100), null);
      return rand(600, 1400);

    case "dire":
      if(pas.texte){
        var t = String(pas.texte).slice(0,74);
        bubbles.push({o:this, txt:t, t:0, life:1500 + t.length*30});
        this.dits.unshift(t.slice(0,60));
        if(this.dits.length > 8) this.dits.pop();
      }
      return rand(1200, 2200);

    case "attendre":
      this.goalX = null; this.vx = 0;
      return rand(900, 2400);

    case "provoquer":
      // il va le chercher. Ca peut degenerer, ou pas.
      if(!c || !c.key) return 300;
      this.facing = (c.x >= this.x) ? 1 : -1;
      if(Math.abs(c.x - this.x) > 120){ this.walkTo(c.x + (this.x<c.x?-60:60), RUN*0.8); return rand(900,1600); }
      this.fightCd = 0; c.fightCd = 0;
      startFight(this, c, "provocation");
      return rand(1200, 2000);

    case "toucher":
      // une bourrade, une tape. Pas un combat.
      if(!c || !c.key) return 300;
      this.facing = (c.x >= this.x) ? 1 : -1;
      if(Math.abs(c.x - this.x) > 90){ this.walkTo(c.x + (this.x<c.x?-45:45), WALK*1.3); return rand(800,1500); }
      this.startAction(this.pickAnim(["attack","strong"]), 0, null);
      c.vx = (c.x >= this.x ? 1 : -1) * 90;
      c.startAction(c.pickAnim(["hurt_light","guard"]), 220, null);
      c.rel[this.key] = clamp((c.rel[this.key]||0) - 3, -100, 100);
      if(AUD){ AUD.impact(c.x, 0.5); }
      return rand(900, 1700);

    case "soigner":
      if(!c || !c.key) return 300;
      if(Math.abs(c.x - this.x) > 90){ this.walkTo(c.x + (this.x<c.x?-40:40), RUN*0.8); return rand(900,1600); }
      for(var Mi=0; Mi<this.moves.length; Mi++){
        var mv = this.moves[Mi];
        if(mv.heal && mv.ally && !(this.cd[mv.a]>0) && (mv.ck||0) <= this.ck){
          this.cast(mv); return rand(1000, 1800);
        }
      }
      return rand(600, 1200);
  }
  return 400;
};

// la tete depose une suite composee
P.poserSuite = function(seq){
  if(!seq || !seq.length) return false;
  if(this.mode !== "wander" || this.duel || this.held || this.possessed) return false;
  this.seq = seq.slice(0, 5);
  this.seqI = 0;
  this.brainT = 40;
  return true;
};

P.appliquerReaction = function(choix, dF, allie, faible){
  var loin = (this.x < FORCE.x ? -1 : 1);
  switch(choix){
    case "fuir":
      this.peurT = rand(2500, 5200);
      this.walkTo(this.x + loin*rand(240, 430), RUN*rand(0.8,0.95));
      this.goalZ = clamp(this.z - rand(0.15,0.32), 0.16, 0.94);
      if(Math.random() < 0.4) this.dire("blesse", true);
      return rand(900, 1800);

    case "reculer":
      this.walkTo(this.x + loin*rand(110, 210), WALK*rand(1.0,1.2));
      this.facing = -loin;
      return rand(1100, 2300);

    case "cacher":
      if(!allie) return rand(600, 1200);
      this.walkTo(allie.x + (allie.x < FORCE.x ? -34 : 34), RUN*0.75);
      this.goalZ = clamp(allie.z - 0.06, 0.16, 0.94);
      if(Math.random() < 0.3) this.dire("blesse", true);
      return rand(1300, 2600);

    case "figer":
      this.goalX = null; this.vx = 0;
      this.facing = -loin;
      if(this.has("guard") && Math.random() < 0.5) this.startAction("guard", rand(500,1100), null);
      return rand(900, 2000);

    case "observer":
      this.goalX = null; this.vx = 0;
      this.facing = -loin;
      if(Math.random() < 0.25) this.dire(this.situation());
      return rand(1200, 2600);

    case "approcher":
      this.walkTo(FORCE.x + rand(-50, 50), WALK*rand(1.05,1.45));
      if(Math.random() < 0.3) this.dire("content", true);
      return rand(1300, 2500);

    case "saluer":
      this.goalX = null; this.vx = 0;
      this.facing = -loin;
      if(this.has("intro")) this.startAction("intro", rand(400,900), null);
      spark(this.x, this.fy() - this.Ht*0.8, "#ffd07a", 0.7);
      return rand(1500, 3000);

    case "defier":
      this.goalX = null; this.vx = 0;
      this.facing = -loin;
      this.startAction(this.pickAnim(["strong","attack"]), 0, null);
      spark(this.x - loin*46, this.fy() - this.Ht*0.7, "#cc1518", 0.9);
      shake += 1.4;
      if(AUD) AUD.voix(this, "cri");
      this.dire("tendu", true);
      return rand(1400, 2800);

    case "chercher":
      if(allie){ this.walkTo(allie.x + rand(-45,45), WALK*1.2); return rand(1200, 2400); }
      return rand(700, 1400);

    case "proteger":
      if(!faible) return rand(600, 1200);
      this.walkTo(faible.x + (FORCE.x > faible.x ? 40 : -40), RUN*0.8);
      this.facing = -loin;
      return rand(1300, 2500);
  }
  return 0;   // "ignorer" : il continue sa vie, le cerveau normal reprend la main
};

P.socialDecide = function(){
  var i;

  // Une suite composee par la tete est en cours ? Elle passe avant tout le reste.
  if(this.seq && this.mode === "wander" && !this.duel && !this.held){
    var r0 = this.jouerSuite();
    if(r0) return r0;
  }

  // Que fait-il de la presence de la Force ? Voir P.reagirForce() : rien n'est scripte,
  // tout est pese. Le meme ninja peut fuir aujourd'hui et s'approcher demain.
  if(FORCE.la && this.mode === "wander" && !this.possessed && !this.held && !this.duel){
    var rf = this.reagirForce();
    if(rf) return rf;
  }

  switch(this.mode){
    case "wander":
      return this.wanderDecide();

    case "talk": {
      var grp = this.talkGrp || [];
      // se placer
      if(Math.abs(this.x - this.talkX) > 14) this.walkTo(this.talkX, WALK*1.1);
      else { this.goalX=null; this.vx=0; }
      // regarder le groupe
      var other=null;
      for(i=0;i<grp.length;i++) if(grp[i]!==this){ other=grp[i]; break; }
      if(other && Math.abs(this.x-this.talkX)<20) this.facing = (other.x>=this.x)?1:-1;
      return 420;
    }

    case "watch": {
      if(this.goalX!=null && Math.abs(this.x-this.goalX)<16){
        this.goalX=null; this.vx=0;
        if(this.watchAt!=null) this.facing = (this.watchAt>=this.x)?1:-1;
      }
      return 500;
    }

    case "heal": {
      var w = this.healTarget;
      if(!w || (w.mode!=="ko" && w.hp >= w.maxHp*0.92)){ this.mode="wander"; this.healTarget=null; return 300; }
      var d = Math.abs(w.x - this.x);
      this.facing = (w.x>=this.x)?1:-1;
      if(d > 62){ this.walkTo(w.x - this.facing*46, RUN*0.9); return 260; }
      this.goalX=null; this.vx=0;
      var m=null;
      for(i=0;i<this.moves.length;i++) if(this.moves[i].ally){ m=this.moves[i]; break; }
      if(m && (this.cd[m.a]||0)<=0 && this.ck>=(m.ck||0)){
        this.cast(m, w);
        this.mode="wander"; this.healTarget=null;
        return 900;
      }
      return 400;
    }

    case "besoin": {
      var L = this.lieu;
      if(!L){ this.mode="wander"; this.faisant=null; return 300; }
      if(!this.faisant){
        var dd = Math.abs(L.x - this.x);
        if(dd > 26){ this.walkTo(L.x, RUN*0.72); this.goalZ = 0.52; return 380; }
        this.goalX=null; this.vx=0;
        this.faisant = L.b;
        this.besoinT = (L.b === "fatigue") ? rand(13000, 24000) : rand(7000, 12000);
        this.dire(L.b, true);
        logIt(this.name + (L.b==="faim" ? " mange à " + L.nom
                        : (L.b==="fatigue" ? " s'endort — " + L.nom
                                           : " s'entraîne aux poteaux")));
        if(L.b === "fatigue") this.startAction("downed", this.besoinT, null);
      }
      // pendant qu'il y est
      if(this.faisant === "ennui" && this.st === "free" && Math.random() < 0.55) this.comboStart();
      if(this.faisant !== "fatigue" && Math.random() < 0.30) this.dire(this.faisant);
      return 700;
    }

    case "flee": {
      var f = this.fleeFrom;
      var dirx = f ? ((this.x >= f.x) ? 1 : -1) : (Math.random()<.5?-1:1);
      this.walkTo(this.x + dirx*400, FLEE);
      return 700;
    }
  }
  return 600;
};

/* ---- boucle de l'agent ---- */
P.update = function(dt){
  var s = dt/1000, k;

  for(k in this.cd) if(this.cd[k] > 0) this.cd[k] -= dt;
  if(this.invT>0)  this.invT  -= dt;
  if(this.guardT>0)this.guardT -= dt;
  if(this.stunT>0) this.stunT -= dt;
  if(this.flash>0) this.flash -= dt;
  if(this.talkCd>0) this.talkCd -= dt;
  if(this.fightCd>0) this.fightCd -= dt;
  if(this.riteCd>0)  this.riteCd  -= dt;
  if(this.peurT>0)   this.peurT   -= dt;
  // LE TEMPS PASSE. On oublie les rancunes, les liens tiedes s'estompent, les blessures
  // se referment. Sans ca, un monde ne peut QUE s'aigrir : chaque bagarre laisse une trace
  // definitive et rien ne la repare. Ici, ce qui n'est pas entretenu retombe vers zero.
  this.oubliT = (this.oubliT||0) + dt;
  if(this.oubliT > 4000){
    this.oubliT = 0;
    for(var kk in this.rel){
      var v = this.rel[kk];
      if(v > 0.4)       this.rel[kk] = v - 0.14;      // une amitie sans entretien se refroidit doucement
      else if(v < -0.4) this.rel[kk] = v + 0.40;      // mais une rancune s'oublie ~3x plus vite
      else this.rel[kk] = 0;
    }
    for(var gg in this.grudge) if(this.grudge[gg] > 0) this.grudge[gg] = Math.max(0, this.grudge[gg] - 1.1);
    // les coups encaisses s'effacent aussi
    // sans manifestation, l'avis sur la Force s'estompe : on doute, on oublie, on passe a autre chose
    if(worldT - FORCE.derniere > 25000 && this.opMain !== 0){
      this.opMain += (this.opMain > 0 ? -0.5 : 0.5);
      if(Math.abs(this.opMain) < 0.6) this.opMain = 0;
    }
    if(this.coups > 0)    this.coups    = Math.max(0, this.coups - 0.10);
    if(this.douceurs > 0) this.douceurs = Math.max(0, this.douceurs - 0.035); // le bon dure plus longtemps
  }

  // l'ame bouge lentement : il faut du temps pour aigrir quelqu'un, et du temps pour l'apaiser
  this.ameT = (this.ameT||0) + dt;
  if(this.ameT > 2000){
    this.ameT = 0;
    var vise = this.calculeAme();
    this.ame += (vise - this.ame) * 0.06;
    this.ame = clamp(this.ame, -1, 1);
  }
  if(this.buffT>0){ this.buffT -= dt; if(this.buffT<=0){ this.atkMul=1; this.defMul=1; } }
  if(this.sageT>0){ this.sageT -= dt; if(this.sageT<=0) this.sage=false; }
  if(this.modeT>0){
    this.modeT -= dt;
    if(this.modeT<=0 && (this.mode==="talk" || this.mode==="flee")) this.endMode();
  }
  if(this.faisant){
    if(this.mode !== "besoin"){            // on l'a embarque ailleurs (duel, scene…)
      this.faisant = null; this.lieu = null; this.besoinT = 0;
    } else {
      this.besoinT -= dt;
      if(this.besoinT <= 0){
        this[this.faisant] = 0;
        var quoi = this.faisant;
        this.faisant = null; this.lieu = null;
        this.mode = "wander"; this.modeT = 0; this.brainT = 200; this.st = "free";
        this.dire("content", true);
        if(quoi === "fatigue") this.hp = Math.min(this.maxHp, this.hp + this.maxHp*0.25);
      }
    }
  }
  for(k in this.grudge) if(this.grudge[k]>0) this.grudge[k] = Math.max(0, this.grudge[k] - dt*0.0012);

  this.ck = Math.min(100, this.ck + (this.mode==="fight" ? 7 : 12) * s);

  // les besoins montent tout seuls. C'est ce qui les fait bouger.
  if(this.mode !== "ko" && !this.faisant && !this.held){
    var eff = (this.mode==="fight") ? 2.2 : 1;
    this.faim    = Math.min(100, this.faim    + 0.150*s*eff);
    this.fatigue = Math.min(100, this.fatigue + 0.125*s*eff*(nuit()?1.9:1));
    this.ennui   = Math.min(100, this.ennui   + 0.210*s*(this.mode==="wander"?1:0.15));
  }
  if(this.mode!=="fight" && this.mode!=="ko" && this.hp < this.maxHp)
    this.hp = Math.min(this.maxHp, this.hp + 1.8*s);

  // dans la main de la souris : il gigote, il rale, il ne fait rien d'autre
  if(this.held){
    this.vx = 0; this.vy = 0; this.onGround = false;
    this.st = "free"; this.combo = null;
    this.setFree(this.has("hurt_light") ? "hurt_light" : "idle");
    this.stepAnim(dt);
    this.talkTick(dt);
    return;
  }
  if(this.mode==="ko"){ this.tickAct(dt); this.physics(s); return; }

  if(this.st==="combo"){
    this.comboUpdate(dt);
  } else if(this.st==="act"){
    this.tickAct(dt);
  } else if(this.possessed){
    this.inputMove(dt);
  } else if(this.stunT>0){
    this.vx *= 0.8;
  } else {
    // deplacement continu
    if(this.walkT > 0){ this.walkT -= dt; this.vx = this.walkDir * RUN; }
    else if(this.goalX != null){
      var dx = this.goalX - this.x;
      if(Math.abs(dx) < 10){ this.goalX = null; this.vx = 0; }
      else { this.facing = dx>0?1:-1; this.vx = this.facing * (this.spd||WALK); }
    }
    // attaque aerienne
    if(!this.onGround && this.airAtk && this.target && Math.abs(this.target.x-this.x)<95){
      this.airAtk=false; this.comboStart();
    }
    this.brainT -= dt;
    if(this.brainT <= 0){
      this.brainT = (this.mode==="fight") ? this.fightDecide() : this.socialDecide();
    }
  }

  this.physics(s);
  this.poseFree(dt);
  this.talkTick(dt);

  // il pense a voix haute, meme tout seul. C'est ca, l'esprit Tomodachi.
  if(this.mode !== "talk" && this.mode !== "ko" && !this.held){
    this.parleT -= dt;
    if(this.parleT <= 0){
      var demi = W/(2*cam.z);
      if(Math.abs(this.x - cam.x) < demi + 140){    // seulement s'il est a l'ecran
        this.parleT = rand(6500, 17000);
        this.dire(this.situation());
      } else {
        this.parleT = rand(2500, 6000);             // sinon il attend son tour
      }
    }
  }
};

P.tickAct = function(dt){
  var a = this.A(this.actAnim);
  this.actT += dt;
  if(a){
    var fps = a.fps||8;
    this.frame = Math.min(a.frames.length-1, Math.floor(this.actT/(1000/fps)));
    this.anim  = this.actAnim;
    var m = this.curMove;
    if(m && this.actT < this.actDur){
      if(m.t==="melee" || m.t==="dash"){
        if(activeOf(a).indexOf(this.frame) >= 0)
          this.swing(m.rc||70, m.d, m.kb, m.h, this.hitSet);
      } else if(m.t==="proj" && !this.projDone && this.frame >= launchOf(a)){
        this.projDone = true;
        var p = this.orbWorld(a, this.frame);
        if(!p || p.i<0) p = {x:this.x + this.facing*44, y:this.fy() - this.Ht*0.55, i:0};
        projs.push({
          own:this, side:(this.duel?this.side:-1), anim:m.a, a:a, img:this.img, K:this.K, z:this.z,
          x:p.x, y:p.y, vx:this.facing*(m.ps||560), t:0, life:m.pl||1800,
          d:m.d, kb:m.kb, h:m.h||"heavy", r:m.pr||40,
          big:(m.a.indexOf("oodama")>=0), hs:{}
        });
        if(AUD) AUD.souffle(this.x);
      }
    }
  }
  if(this.actT >= this.actDur){
    this.st="free"; this.curMove=null;
    var cb=this.after; this.after=null;
    if(cb) cb();
  }
};

P.physics = function(s){
  if(this.dashT>0) this.dashT -= s*1000;
  // profondeur : on glisse vers son plan cible
  if(this.goalZ != null){
    var dz = this.goalZ - this.z;
    if(Math.abs(dz) < 0.005) this.z = this.goalZ;
    else this.z += Math.sign(dz) * Math.min(Math.abs(dz), 0.42*s);
    this.z = clamp(this.z, 0.15, 0.96);
  }
  // un seul frottement : le deplacement volontaire re-impose vx a chaque tick,
  // donc ca ne freine que le recul et les glissades de fin d'action.
  if(this.onGround && this.dashT<=0) this.vx *= Math.exp(-4.5*s);
  this.x  += this.vx*s;
  this.vy += GRAV*s;
  var avant = this.vy;
  this.y  += this.vy*s;
  if(this.y >= 0){
    if(!this.onGround && avant > 380){          // il retombe : ca claque
      if(AUD) AUD.chute(this.x);
      if(avant > 780 && this.st === "free"){    // de haut : il se vautre
        this.startAction(this.pickAnim(["hurt_light","hurt_h1"]), 120, null);
        this.dire("blesse", true);
      }
    }
    this.y=0; this.vy=0; this.onGround=true;
  }
  else this.onGround=false;
  this.x = clamp(this.x, 40, WORLD_W-40);
};

P.poseFree = function(dt){
  if(this.st!=="free" || this.mode==="ko") return;
  if(this.guardT>0){ this.setFree(this.baseAnim("guard")); this.stepAnim(dt); return; }
  if(!this.onGround){
    this.setFree("jump");
    var ja=this.A("jump");
    if(ja){ var n=ja.frames.length;
      this.frame = this.vy<-60 ? 0 : (this.vy>60 ? Math.min(2,n-1) : Math.min(1,n-1)); }
    return;
  }
  if(this.dashT>0){ this.setFree("dash"); this.stepAnim(dt); return; }
  if(Math.abs(this.vx) > 20){ this.setFree(this.baseAnim("run")); this.stepAnim(dt); return; }
  this.setFree(this.baseAnim("idle")); this.stepAnim(dt);
};
P.stepAnim = function(dt){
  var a=this.A(this.anim); if(!a || a.frames.length<=1) return;
  var n=a.frames.length, step=1000/(a.fps||8);
  this.ft += dt;
  while(this.ft >= step){
    this.ft -= step;
    if(a.yoyo){
      this.frame += this.dir;
      if(this.frame>=n-1){ this.frame=n-1; this.dir=-1; }
      else if(this.frame<=0){ this.frame=0; this.dir=1; }
    } else this.frame = (this.frame+1) % n;
  }
};

// un seul ninja pilote le groupe : ils parlent CHACUN SON TOUR, pas tous en meme temps.
// dans quelle humeur il est, pour choisir la bonne pile de repliques
P.humeur = function(){
  return clamp(100 - (this.faim + this.fatigue + this.ennui)/3, 0, 100);
};
P.besoinUrgent = function(){
  var seuilF = nuit() ? 45 : 78;                 // la nuit, on tombe de sommeil
  if(this.fatigue >= seuilF) return "fatigue";
  if(this.faim    >= 74)     return "faim";
  if(this.ennui   >= 76)     return "ennui";
  return null;
};
P.situation = function(){
  if(this.faisant)               return this.faisant;   // il mange / il dort / il s'entraine
  if(this.hp < this.maxHp*0.42)  return "blesse";
  if(this.faim    > 70)          return "faim";
  if(this.fatigue > 72)          return "fatigue";
  if(this.ennui   > 72)          return "ennui";
  if(this.mode === "fight")     return "tendu";
  if(this.mode === "flee")      return "blesse";
  if(this.derniereVictoire && worldT - this.derniereVictoire < 12000) return "content";
  return "seul";
};
// il dit un truc. Reserve du LLM en priorite, banque ecrite a la main sinon.
P.dire = function(cat, force){
  if(this.mode === "ko" || this.held && !force) { if(!force) return; }
  var txt = null;
  if(window.KV_MIND && window.KV_MIND.replique) txt = window.KV_MIND.replique(this, cat);
  if(!txt) txt = SOC.line(this.key, cat);
  if(!txt || txt === "...") return;
  if(this.dits.indexOf(txt) >= 0) return;      // jamais deux fois de suite
  var _t2=String(txt).slice(0,74);
  bubbles.push({o:this, txt:_t2, t:0, life:1500 + _t2.length*30});
  this.dits.unshift(txt);
  if(this.dits.length > 8) this.dits.pop();
  if(AUD && Math.random() < 0.22) AUD.voix(this, "effort", 0.45);
};

P.talkTick = function(dt){
  if(this.mode!=="talk" || !this.talkGrp) return;
  var grp = this.talkGrp;
  // le pilote = le premier du groupe encore en discussion. Si grp[0] s'est fait
  // embarquer ailleurs, quelqu'un d'autre reprend le fil — sinon la scene s'arrete net.
  var pilote = null;
  for(var k=0;k<grp.length;k++)
    if(grp[k].mode==="talk" && grp[k].talkGrp===grp){ pilote = grp[k]; break; }
  if(pilote !== this) return;

  // PRIORITE AU LLM : tant que l'attente n'est pas ecoulee et qu'aucun dialogue ecrit
  // n'est arrive, on garde le silence (ils se regardent, se rejoignent). Le script en
  // dur ne sort QUE si le LLM tarde vraiment trop. C'est ce qui fait qu'on voit presque
  // toujours du texte unique, et non les memes phrases pre-ecrites.
  if(grp.attenteLLM > 0 && !grp.script){
    grp.attenteLLM -= dt;
    // pendant que le LLM ecrit : ils se rejoignent et se regardent. Ca ne se voit pas
    // comme une attente, ca se voit comme deux personnes qui s'appretent a parler.
    for(var q=0;q<grp.length;q++){
      var gq = grp[q];
      if(gq.mode !== "talk") continue;
      var cible = grp[(q+1) % grp.length];
      if(cible && cible !== gq) gq.facing = (cible.x >= gq.x) ? 1 : -1;
    }
    if(grp.script){ grp.attenteLLM = 0; }
    else if(grp.attenteLLM > 0){ return; }
    else if(grp.secours){ grp.script = grp.secours; grp.si = 0; }  // filet de dernier recours
  }

  grp.nextT -= dt;
  if(grp.nextT > 0) return;

  var sp = null, txt = null, i;
  if(grp.script && grp.si < grp.script.length){
    var line = grp.script[grp.si++];
    sp = findAgent(line.qui);
    if(!sp || grp.indexOf(sp) < 0) sp = grp[grp.turn % grp.length];
    txt = line.dit;
  } else if(grp.script){
    // le LLM ecrit peut-etre encore la suite : on patiente un peu avant de conclure
    if(grp.fromLLM && !grp.__finFlux){
      if(!grp.__flux0) grp.__flux0 = worldT;
      if(worldT - grp.__flux0 < 2200){ grp.nextT = 200; return; }
      grp.__finFlux = true;
    }
    // le dialogue est fini. Si c'etait une scene : L'ACTE, et on le laisse voir.
    if(grp.rite && !grp.__acte){
      grp.__acte = 1;
      acteRite(grp);
      for(i=0;i<grp.length;i++) grp[i].modeT = 3000;
      return;
    }
    for(i=0;i<grp.length;i++) grp[i].modeT = Math.min(grp[i].modeT, 900);
    return;
  } else {
    // aucun dialogue ecrit : on pioche dans la reserve (deja fabriquee d'avance par le LLM,
    // donc c'est du texte unique, pas une phrase en dur qui se repete)
    sp = grp[grp.turn % grp.length];
    var tense = false;
    for(i=0;i<grp.length;i++) if(grp[i]!==sp && (sp.relTo(grp[i]) < -5 || grp[i].relTo(sp) < -5)) tense = true;
    var cat = tense ? "tendu" : "detendu";
    if(window.KV_MIND && window.KV_MIND.replique) txt = window.KV_MIND.replique(sp, cat);
    if(!txt) txt = SOC.line(sp.key, cat);
  }
  grp.turn++;

  if(sp && txt){
    var _t=String(txt).slice(0,74);
    bubbles.push({o:sp, txt:_t, t:0, life:1400 + _t.length*30});
    sp.dits.unshift(String(txt).slice(0,60));
    if(sp.dits.length > 5) sp.dits.pop();
    for(i=0;i<grp.length;i++){
      var o=grp[i]; if(o===sp) continue;
      var t2 = (sp.relTo(o) < -5 || o.relTo(sp) < -5);
      sp.rel[o.key] = clamp((sp.rel[o.key]||0) + (t2? -1.1*sp.aCran() : 4.6*sp.ouverture()), -100, 100);
      o.rel[sp.key] = clamp((o.rel[sp.key]||0) + (t2? -1.1*o.aCran()  : 4.0*o.ouverture()),  -100, 100);
      o.facing = (sp.x >= o.x) ? 1 : -1;
    }
  }
  grp.nextT = 1700 + Math.random()*1100;    // rythme Tomodachi : une replique toutes les ~2s
};
P.endMode = function(){
  if(this.mode==="talk"){
    var grp=this.talkGrp||[];
    // une scene ne se coupe pas au milieu : on la laisse aller au bout, puis a son acte
    if(grp.rite && grp.script && (grp.si < grp.script.length || !grp.__acte)){
      for(var q=0;q<grp.length;q++) grp[q].modeT = 4000;
      return;
    }
    if(grp.rite && !grp.__fait){ grp.__fait = 1; appliqueRite(grp); }
    // une discussion tendue peut degenerer
    for(var i=0;i<grp.length;i++){
      var o=grp[i];
      if(o===this || o.duel || o.mode==="ko") continue;
      if(this.relTo(o) < -25 && this.fightCd<=0 && o.fightCd<=0 && Math.random() < 0.16){
        for(var j=0;j<grp.length;j++){ grp[j].talkGrp=null; if(grp[j].mode==="talk"){ grp[j].mode="wander"; grp[j].modeT=0; } }
        startFight(this, o, "dispute");
        return;
      }
    }
    for(var k=0;k<grp.length;k++){
      grp[k].talkGrp=null; grp[k].talkCd = rand(14000, 34000);
      for(var q=0;q<grp.length;q++) if(grp[q]!==grp[k]) grp[k].remember("talked", grp[q]);
      if(grp[k].mode==="talk"){ grp[k].mode="wander"; grp[k].modeT=0; grp[k].brainT=100; }
    }
    return;
  }
  this.mode="wander"; this.modeT=0; this.brainT=150; this.fleeFrom=null;
};
P.enScene = function(){ return !!(this.talkGrp && this.talkGrp.rite); };
P.leaveTalk = function(){
  if(this.mode==="talk"){
    var grp=this.talkGrp||[];
    // on l'arrache a une scene ? Tant pis, mais elle produit quand meme ses consequences.
    if(grp.rite && !grp.__fait){ grp.__fait = 1; appliqueRite(grp); }
    for(var i=0;i<grp.length;i++) if(grp[i]!==this && grp[i].mode==="talk" && grp.length<=2){
      grp[i].mode="wander"; grp[i].talkGrp=null; grp[i].modeT=0;
    }
  }
  this.talkGrp=null;
};

/* ---- ancrage de l'effet (orb/ofx) ---- */
P.orbWorld = function(a, fi, K){
  var f=a.frames[fi]; if(!f) return null;
  K = K || this.K;
  var r=f.r, ax=(f.ax==null ? r[2]/2 : f.ax), fy=this.fy();
  var hasOrb = (f.orb!=null && f.ofx!=null && f.ofx>=0);
  if(hasOrbData(a)){
    if(!hasOrb) return {x:0, y:0, i:-1};
    return { x: this.x + this.facing*(f.orb[0]-ax)*K,
             y: fy - (r[3]-f.orb[1])*K,
             i: f.ofx };
  }
  if(fi===0) return {x:0, y:0, i:-1};
  var t = fi/Math.max(1, a.frames.length-1);
  return { x: this.x + this.facing*((r[2]-6)-ax)*K,
           y: fy - (r[3]*0.58)*K,
           i: phaseFxIndex(a, t) };
};

/* ---- controle manuel ---- */
var keys={};
P.inputMove = function(dt){
  if(this.dashT>0) return;
  var mv=0;
  if(keys.ArrowLeft || keys.KeyA)  mv -= 1;
  if(keys.ArrowRight|| keys.KeyD)  mv += 1;
  if(keys.KeyK){ this.guardT=140; this.vx*=0.5; return; }
  if(mv){ this.facing=mv; this.vx = mv*RUN*1.25; }
  else { this.vx *= 0.6; if(Math.abs(this.vx)<8) this.vx=0; }
};

/* ================================================================ DUELS */
function niveauDe(a, b){
  var r = Math.min(a.relTo(b), b.relTo(a));
  var g = Math.max(a.grudge[b.key]||0, b.grudge[a.key]||0);
  if(r < -55 || g > 55) return "mortel";
  if(r < -10 || g > 20) return "serieux";
  return "amical";                       // ils s'apprecient : c'est un entrainement
}
function Duel(A, B, reason){
  this.A=A; this.B=B; this.reason=reason; this.dead=false; this.t=0; this.endT=0; this.joinT=2500;
  // un entrainement reste un entrainement, meme entre deux qui ne s'aiment pas trop
  this.niveau = (reason === "entraînement") ? "amical" : niveauDe(A[0], B[0]);
  var all=A.concat(B), i;
  for(i=0;i<all.length;i++){
    var g=all[i];
    g.leaveTalk();
    g.duel=this; g.side=(A.indexOf(g)>=0)?0:1;
    g.mode="fight"; g.modeT=0; g.goalX=null; g.walkT=0; g.brainT=120+i*90;
    g.healTarget=null;
    g.faisant=null; g.lieu=null; g.besoinT=0;     // il lachera son bol de ramen
  }
  this.cx=(A[0].x+B[0].x)/2;
  duels.push(this);
}
Duel.prototype.standing = function(arr){
  var o=[]; for(var i=0;i<arr.length;i++) if(arr[i].mode!=="ko") o.push(arr[i]);
  return o;
};
Duel.prototype.names = function(){
  return this.A.map(function(g){return g.name;}).join(" + ") + " vs " + this.B.map(function(g){return g.name;}).join(" + ");
};
Duel.prototype.check = function(){
  var a=this.standing(this.A), b=this.standing(this.B);
  if(!a.length || !b.length) this.finish(a.length?0:1);
};
Duel.prototype.tick = function(dt){
  if(this.dead) return;
  this.t += dt;
  var a=this.standing(this.A), b=this.standing(this.B), i, sx=0, all=a.concat(b);
  if(!a.length || !b.length){ this.finish(a.length?0:1); return; }

  // entrainement : on s'arrete avant de s'entretuer
  if(this.niveau === "amical"){
    for(i=0;i<all.length;i++){
      if(all[i].hp < all[i].maxHp*0.32 || this.t > 50000){
        var perd = all[i];
        logIt(perd.name + " s'avoue vaincu. C'était pour rire.");
        perd.hp = Math.max(perd.hp, perd.maxHp*0.35);
        this.finish(perd.side === 0 ? 1 : 0);
        return;
      }
    }
  }
  for(i=0;i<all.length;i++) sx += all[i].x;
  this.cx = sx/all.length;

  for(i=0;i<all.length;i++){
    var g=all[i], foes=(g.side===0)?b:a, best=null, bd=1e9;
    for(var j=0;j<foes.length;j++){
      var d=Math.abs(foes[j].x-g.x);
      if(d<bd){ bd=d; best=foes[j]; }
    }
    g.target=best;
  }

  // renforts : un allie loyal proche rejoint le camp le plus faible
  this.joinT -= dt;
  if(this.joinT<=0){
    this.joinT = 3000;
    var weak = (a.length<=b.length) ? 0 : 1;
    var arr  = weak===0 ? this.A : this.B;
    if(arr.length < 2){
      for(i=0;i<agents.length;i++){
        var f=agents[i];
        if(f.duel || f.mode==="ko" || f.possessed) continue;
        if(f.enScene()) continue;                // il joue une scene
        if(Math.abs(f.x-this.cx) > 640) continue;
        if(f.S.loyal < .55) continue;
        var friend=arr[0];
        if(f.relTo(friend) < 55) continue;
        if(Math.random() < 0.5){
          arr.push(f);
          f.leaveTalk();
          f.duel=this; f.side=weak; f.mode="fight"; f.modeT=0; f.goalX=null; f.brainT=150;
          friend.rel[f.key] = clamp((friend.rel[f.key]||0) + 18*friend.ouverture(), -100, 100);
          friend.douceurs += 1;
          friend.remember("helped", f);
          logIt(f.name + " vient prêter main-forte à " + friend.name + " !");
          break;
        }
      }
    }
  }
};
Duel.prototype.finish = function(win){
  if(this.dead) return;
  this.dead = true;
  var winners = this.standing(win===0 ? this.A : this.B);
  var losers  = (win===0 ? this.B : this.A);
  var i;
  // se battre laisse des traces
  for(i=0;i<winners.length;i++) for(var q=0;q<losers.length;q++){
    losers[q].rel[winners[i].key] = clamp((losers[q].rel[winners[i].key]||0) + (this.niveau==="amical"? 3 : -11), -100, 100);
    winners[i].rel[losers[q].key] = clamp((winners[i].rel[losers[q].key]||0) + (this.niveau==="amical"? 7 : -3), -100, 100);
    if(this.niveau === "amical"){
      losers[q].douceurs += 0.5; winners[i].douceurs += 0.5;
      if(this.reason === "entraînement"){
        losers[q].rel[winners[i].key] = clamp((losers[q].rel[winners[i].key]||0) + 5, -100, 100);
        winners[i].rel[losers[q].key] = clamp((winners[i].rel[losers[q].key]||0) + 5, -100, 100);
        losers[q].ennui = Math.max(0, losers[q].ennui - 45);
        winners[i].ennui = Math.max(0, winners[i].ennui - 45);
      }
    }
  }
  for(i=0;i<winners.length;i++){
    var w=winners[i];
    w.duel=null; w.side=-1; w.target=null; w.fightCd=rand(22000,45000); w.style="normal"; w.mstat={}; w.recent=[];
    if(w.mode==="fight"){ w.mode="wander"; w.modeT=0; w.brainT=600; w.goalX=null; }
    w.derniereVictoire = worldT;
    if(w.st==="free" && !w.possessed){
      w.startAction("win", 500, null);
      if(AUD) AUD.voix(w, "ultime", 1);
    }
  }
  for(i=0;i<losers.length;i++){
    var l=losers[i];
    l.duel=null; l.side=-1; l.target=null; l.fightCd=rand(50000,95000); l.style="normal"; l.mstat={}; l.recent=[];
    if(l.mode==="fight"){ l.mode="wander"; l.modeT=0; l.brainT=600; }
  }
  for(i=0;i<agents.length;i++){
    var g=agents[i];
    if(g.mode==="watch" && g.watchDuel===this){ g.mode="wander"; g.modeT=0; g.watchDuel=null; g.brainT=rand(200,900); }
  }
  if(winners.length) logIt(winners[0].name + " l'emporte.");
};

function startFight(a, b, reason){
  if(a.duel || b.duel || a.mode==="ko" || b.mode==="ko") return null;
  var d = new Duel([a],[b], reason);
  logIt((d.niveau==="amical" ? "🥊 " : (d.niveau==="mortel" ? "☠ " : "⚔ "))
        + a.name + " vs " + b.name
        + (d.niveau==="amical" ? " — entraînement" : (reason ? " — "+reason : "")));

  // spectateurs
  var n=0;
  for(var i=0;i<agents.length;i++){
    var g=agents[i];
    if(g===a || g===b || g.duel || g.mode==="ko" || g.possessed) continue;
    if(g.enScene()) continue;                    // il joue une scene
    if(Math.abs(g.x - d.cx) > 620) continue;
    if(g.S.social < 0.3) continue;
    if(n>=5) break;
    g.leaveTalk();
    g.mode="watch"; g.modeT=0; g.watchDuel=d; g.watchAt=d.cx;
    g.walkTo(d.cx + (g.x<d.cx ? -1:1) * rand(230, 400), WALK*1.3);
    g.brainT=200;
    n++;
  }

  // evenement notable ?
  var notable = (reason==="vengeance") || (d.niveau==="mortel")
             || (SOC.spark(a.key,b.key) > 0.2 && d.niveau!=="amical")
             || Math.abs(a.relTo(b)) >= 70 || Math.abs(b.relTo(a)) >= 70;
  if(notable) raiseEvent("⚔ " + a.name + " et " + b.name + " vont s'affronter"
      + (reason==="vengeance" ? " — vengeance" : ""), [a, b], d);
  return d;
}

/* ================================================================ SCENE (facon Tomodachi) */
// Pendant une scene : SEULS les participants bougent et sont visibles.
// Le reste du monde est en pause et disparait de l'ecran.
var scene = null;   // {list:[agents], duel, t, max}

function openScene(list, duel, max){
  if(!list || !list.length) return;
  scene = {list:list.slice(), duel:duel||null, t:0, max:max||45000};
  camMode="focus"; camFocus = duel || sceneFocus(scene);
}
function sceneFocus(sc){
  return { get cx(){ var s=0; for(var i=0;i<sc.list.length;i++) s+=sc.list[i].x; return s/sc.list.length; },
           get dead(){ return false; } };
}
function closeScene(){
  if(!scene) return;
  scene = null;
  camMode="auto"; camFocus=null;
}
function sceneTick(dt){
  if(!scene) return;
  scene.t += dt;
  var fini = false;
  if(scene.duel && scene.duel.dead && scene.t > 1500) fini = true;
  if(!scene.duel){
    // scene de soin / discussion : finie quand plus personne n'est occupe
    var busy2 = false;
    for(var i=0;i<scene.list.length;i++){
      var g=scene.list[i];
      if(g.mode==="heal" || g.mode==="talk" || g.mode==="ko") busy2 = true;
    }
    if(!busy2 && scene.t > 3000) fini = true;
  }
  if(scene.t >= scene.max) fini = true;
  if(fini) closeScene();
}

/* ================================================================ EVENEMENTS */
var ev=null;
var elEvent=document.getElementById("event"), elEventTxt=document.getElementById("eventTxt");
var alertMode="pause";

function raiseEvent(txt, acteurs, duel){
  if(alertMode==="off") return;
  if(scene) return;
  if(worldT - lastEventT < 14000) return;
  lastEventT = worldT;
  ev = {txt:txt, acteurs:acteurs, duel:duel||null, t:0, life:6500};
  elEventTxt.textContent = txt;
  elEvent.classList.add("on");
  if(alertMode==="pause"){ tsTarget=0; timeScale=0; }
}
function answerEvent(watch){
  if(!ev) return;
  if(watch && ev.acteurs && ev.acteurs.length){
    openScene(ev.acteurs, ev.duel, ev.duel ? 60000 : 25000);
    timeScale=0.30; tsTarget=1;
  } else { timeScale=1; tsTarget=1; }
  ev=null;
  elEvent.classList.remove("on");
}
document.getElementById("evYes").onclick = function(){ answerEvent(true); };
document.getElementById("evNo").onclick  = function(){ answerEvent(false); };

/* ================================================================ FX / LOG */
function spark(x,y,c,s){ sparks.push({x:x, y:y, c:c||"#fff", s:s||1, t:0, life:280}); }
var chronique = [];
function logIt(txt){
  var hh = Math.floor(heure), mm = Math.floor((heure - hh) * 60);
  chronique.unshift({h:(hh<10?"0":"")+hh+":"+(mm<10?"0":"")+mm, t:txt});
  if(chronique.length > 200) chronique.pop();
  var el2 = document.getElementById("chronList");
  if(el2 && document.getElementById("chron").classList.contains("on")) majChronique();

  logLines.unshift(txt);
  if(logLines.length>7) logLines.pop();
  var el=document.getElementById("log");
  if(el) el.innerHTML = logLines.map(function(l,i){ return "<div style='opacity:"+(1-i*0.12).toFixed(2)+"'>"+l+"</div>"; }).join("");
}

function majChronique(){
  var el = document.getElementById("chronList");
  if(!el) return;
  el.innerHTML = chronique.map(function(c){
    return "<div><em>" + c.h + "</em>" + c.t + "</div>";
  }).join("");
}

/* ================================================================ TICK SOCIAL */
function fightChance(a, b, d){
  if(a.fightCd>0 || b.fightCd>0) return 0;      // on ne se remet pas sur la gueule dans la foulee
  if(a.mode==="watch") return 0;                // un spectateur regarde, il ne demarre rien
  var ra=a.relTo(b), rb=b.relTo(a);
  var g =(a.grudge[b.key]||0);
  var prox = 1 - d/440;
  var hostility = Math.max(0, -Math.min(ra, rb))/100;
  var sp = SOC.spark(a.key, b.key);
  var c = hostility*0.0045 + (g/100)*0.007 + sp*0.0022;
  c *= prox * (1.25 - a.S.calme*0.85) * TENSION;
  if(a.hp < a.maxHp*0.5) c *= 0.25;
  c *= (0.55 + (100 - a.humeur())/85) * a.aCran();   // de mauvaise humeur et aigri : on cherche la bagarre
  // Le probleme de fond : avec des relations neutres, RIEN ne pousse au conflit et le monde
  // s'endort. La friction ne vient pas que de la haine — elle vient des caracteres qui se
  // heurtent, de la mauvaise humeur, de la competition pour les memes choses, de l'orgueil.
  var lien = Math.min(a.relTo(b), b.relTo(a));
  if(lien > -12 && !(a.grudge[b.key] > 12)){
    var friction = 0.42;
    friction += (1 - a.S.calme) * (1 - b.S.calme) * 0.9;      // deux impulsifs : etincelles
    friction += (1 - a.humeur()/100) * 0.7;                    // il va mal, il supporte mal
    if(a.lieu && b.lieu && a.lieu === b.lieu) friction += 0.5; // ils veulent la meme chose
    if(b.derniereVictoire && worldT - b.derniereVictoire < 20000) friction += 0.45;
    if(a.ennui > 65) friction += 0.5;                          // l'ennui cherche l'incident
    c *= Math.min(1.15, friction);
  }
  if(nuit()) c *= 0.45;                   // la nuit, on dort plutot
  return c;
}
function reasonOf(a,b){
  if((a.grudge[b.key]||0) > 35) return "rancune";
  if(a.relTo(b) > 20 && b.relTo(a) > 20) return "provocation";
  return null;
}
function findWounded(a){
  var best=null, bs=-1;
  for(var i=0;i<agents.length;i++){
    var g=agents[i];
    if(g===a || g.duel || g.possessed) continue;
    if(g.mode!=="ko" && g.hp >= g.maxHp*0.55) continue;
    if(a.relTo(g) < 35) continue;
    if(Math.abs(g.x-a.x) > 900) continue;
    var s = a.relTo(g) + (g.mode==="ko" ? 60 : 0) - Math.abs(g.x-a.x)*0.05;
    if(s > bs){ bs=s; best=g; }
  }
  return best;
}

function socialTick(dt){
  var i, j, a, b;
  for(i=duels.length-1;i>=0;i--){
    if(duels[i].dead) duels.splice(i,1);
    else if(!scene || scene.duel === duels[i]) duels[i].tick(dt);
  }
  if(scene) return;                     // pendant une scene, le monde attend

  for(i=0;i<agents.length;i++){
    a = agents[i];
    if(a.mode==="ko" || a.mode==="fight" || a.possessed) continue;
    if(a.enScene()) continue;                    // il joue une scene : on ne le derange pas

    // soigner un proche
    if(a.M.healer && a.mode!=="heal"){
      var w = findWounded(a);
      if(w && Math.random() < 0.45){
        a.leaveTalk();
        a.mode="heal"; a.healTarget=w; a.modeT=0; a.brainT=100;
        if(w.mode==="ko") raiseEvent("✚ " + a.name + " va secourir " + w.name, [a, w], null);
        continue;
      }
    }

    // vengeance
    if(a.avenge && worldT >= a.avenge.at){
      var v = a.avenge.who;
      if(!v || v.mode==="ko" || v.duel || a.duel || a.fightCd>0){
        if(worldT - a.avenge.at > 60000) a.avenge = null;   // elle finit par retomber
      } else if(Math.abs(v.x - a.x) < 760 && a.hp > a.maxHp*0.7){
        a.avenge = null;
        startFight(a, v, "vengeance");
        continue;
      }
    }

    if(a.mode==="heal" || a.mode==="flee" || a.mode==="besoin") continue;

    // un besoin qui crie : on y va
    if(a.mode==="wander"){
      var bes = a.besoinUrgent();
      if(bes && Math.random() < 0.55){
        var L = lieuPour(bes, a.x);
        if(L){ a.mode="besoin"; a.lieu=L; a.faisant=null; a.modeT=0; a.brainT=80; continue; }
      }
    }

    // ANTICIPATION : deux ninjas qui se rapprochent vont probablement se parler.
    // On previent la tete des maintenant : elle aura fini d'ecrire quand ils s'arreteront.
    if(a.mode==="wander" && !a.duel && a.talkCd < 4000 && !a.__preAvis){
      for(j=0;j<agents.length;j++){
        b = agents[j];
        if(b===a || b.duel || b.mode!=="wander" || b.possessed || b.held) continue;
        var dd2 = Math.abs(b.x - a.x);
        if(dd2 > 60 && dd2 < 260 && Math.abs(b.z - a.z) < 0.3){
          a.__preAvis = worldT;
          if(window.KV_MIND && window.KV_MIND.prechauffe) window.KV_MIND.prechauffe(a, b);
          break;
        }
      }
    }
    if(a.__preAvis && worldT - a.__preAvis > 12000) a.__preAvis = 0;

    // S'ENTRAINER ENSEMBLE. C'est ainsi qu'on progresse dans ce monde, et ca resout
    // proprement ce que je cherchais a obtenir en fabriquant de l'hostilite : les
    // techniques servent, il se passe quelque chose, et ca RAPPROCHE au lieu de diviser.
    if(a.mode==="wander" && !a.duel && a.fightCd<=0 && a.hp > a.maxHp*0.72){
      var envie = 0.0016
        + (a.ennui/100) * 0.010          // on s'ennuie : autant s'entrainer
        + (a.humeur()/100) * 0.004       // en forme, on a de l'energie a depenser
        + (1 - a.S.calme) * 0.004;       // les impulsifs ont la bougeotte
      if(nuit()) envie *= 0.25;
      if(Math.random() < envie){
        var part = null, best2 = 8;
        for(j=0;j<agents.length;j++){
          b = agents[j];
          if(b===a || b.duel || b.mode!=="wander" || b.possessed || b.held) continue;
          if(b.fightCd > 0 || b.hp < b.maxHp*0.72) continue;
          if(Math.abs(b.x - a.x) > 340) continue;
          // on s'entraine avec quelqu'un qu'on apprecie, ou qu'on veut mesurer
          var sc3 = a.relTo(b) * 1.2 + SOC.spark(a.key,b.key) * 60 + Math.random()*30;
          if(sc3 > best2){ best2 = sc3; part = b; }
        }
        if(part){
          startFight(a, part, "entraînement");
          continue;
        }
      }
    }

    // une scene ? c'est ce qui vaut la peine d'etre regarde
    if(a.mode==="wander" && !a.duel){
      var rite=false;
      for(j=0;j<agents.length;j++){
        b = agents[j];
        if(b===a || b.duel || b.mode!=="wander" || b.possessed || b.held) continue;
        if(Math.abs(b.x - a.x) > 330) continue;
        if(tenteRite(a, b)){ rite=true; break; }
      }
      if(rite) continue;
    }

    // bagarre spontanee — mais on n'interrompt PAS une discussion en cours
    if(a.mode==="talk") continue;
    var started=false;
    for(j=0;j<agents.length;j++){
      b = agents[j];
      if(b===a || b.duel || b.mode==="ko" || b.possessed || b.mode==="flee") continue;
      if(b.mode==="talk") continue;
      var d = Math.abs(b.x - a.x);
      if(d > 440) continue;
      if(Math.random() < fightChance(a,b,d)){
        startFight(a, b, reasonOf(a,b));
        started=true; break;
      }
    }
    if(started || a.duel) continue;

    // conversation
    if(a.mode==="wander" && a.talkCd<=0 && Math.random() < 0.20*a.S.social*(0.45 + a.humeur()/90)*a.ouverture()){
      var best = null, bestS = -1e9;
      for(j=0;j<agents.length;j++){
        b = agents[j];
        if(b===a || b.duel || b.mode!=="wander" || b.possessed || b.talkCd>0) continue;
        if(Math.abs(b.x - a.x) > 130) continue;
        if(a.relTo(b) < -25 || b.relTo(a) < -25) continue;
        // on va vers ceux qu'on apprecie : c'est ainsi que se creent les amities
        var sc2 = a.relTo(b) * 1.6 + b.relTo(a) * 0.8
                - Math.abs(b.x - a.x) * 0.12
                + Math.random() * 22;
        if(sc2 > bestS){ bestS = sc2; best = b; }
      }
      if(best) startTalk(a, best);
    }
  }
}

/* ---- LES SCENES : ce qui vaut la peine d'etre regarde ---- */
var RITES = [
  {id:"amour",     txt:"💗 %A va déclarer sa flamme à %B",   p:.85,
   test:function(a,b){ return a.relTo(b) > 72 && !a.fait["amour_"+b.key]; }},
  {id:"guerre",    txt:"☠ %A déclare la guerre à %B",        p:.55,
   test:function(a,b){ return a.relTo(b) < -72 && a.fightCd <= 0; }},
  {id:"defi",      txt:"🥊 %A défie %B",                     p:.62,
   test:function(a,b){ return SOC.spark(a.key,b.key) > .10 && a.hp > a.maxHp*.75 && a.fightCd <= 0; }},
  {id:"betise",    txt:"😈 %A prépare un mauvais coup à %B", p:.34,
   test:function(a,b){ return a.S.calme < .45 && a.relTo(b) > 14 && a.relTo(b) < 62; }},
  {id:"dispute",   txt:"💢 %A et %B s'engueulent",           p:.55,
   test:function(a,b){ return (a.relTo(b) < -14 && a.relTo(b) > -62) || (a.grudge[b.key]||0) > 15; }},
  {id:"reconcile", txt:"🤝 %A vient faire la paix avec %B",  p:.70,
   test:function(a,b){ return (a.grudge[b.key]||0) > 22 && a.relTo(b) > -25; }},
  {id:"admire",    txt:"✨ %A ne quitte plus %B des yeux",   p:.42,
   test:function(a,b){ return a.relTo(b) > 42 && !a.fait["admire_"+b.key]; }},

  // ILS PARLENT DE TOI. En secret, avec peur, ou avec ferveur.
  {id:"secret",    txt:"🤫 %A confie quelque chose à %B",    p:.75,
   test:function(a,b){ return a.opMain <= -32 && b.opMain <= -12 && a.relTo(b) > -20; }},
  {id:"culte",     txt:"🙏 %A et %B parlent de la Présence", p:.75,
   test:function(a,b){ return a.opMain >= 55 && b.opMain >= 30; }},
  {id:"defiance",  txt:"✊ %A veut défier la Présence",       p:.60,
   test:function(a,b){ return a.opMain <= -60 && a.ame <= -0.25 && a.S.calme < .55; }},

  // Ils cherchent a COMPRENDRE. Aucune reponse n'est imposee : le LLM invente,
  // et deux parties ne donneront pas les memes theories.
  {id:"theorie",   txt:"❓ %A et %B tentent de comprendre",   p:.55,
   test:function(a,b){
     return Math.abs(a.opMain) > 22 && Math.abs(b.opMain) > 12
         && a.memF.length >= 2 && a.S.calme > .35;
   }}
];
var RITE_SCENE = {
  amour:     "%A déclare ses sentiments à %B. C'est sincère, maladroit, un peu gênant.",
  guerre:    "%A déclare la guerre à %B. C'est froid, définitif, sans retour.",
  defi:      "%A défie %B en duel. Rivalité, provocation, mais bon enfant.",
  betise:    "%A prépare une blague ou un sale coup à %B. Ça DOIT être drôle.",
  dispute:   "%A et %B s'engueulent. Le ton monte.",
  reconcile: "%A vient faire la paix avec %B. C'est maladroit et pas naturel pour lui.",
  admire:    "%A admire ouvertement %B. %B est mal à l'aise."
};
function riteTexte(t, a, b){ return t.replace(/%A/g, a.name).replace(/%B/g, b.name); }

// Le filet : si le LLM n'ecrit rien, la scene se joue QUAND MEME comme annonce.
var SCRIPTS = {
  // La BETISE est une farce, pas une agression. Le dernier mot de A = le moment ou il piege ;
  // l'acte (acteRite) = un petit coup pour rire, pas un vrai coup de poing.
  betise:[
    [[0,"%B, t'as un truc juste derrière toi..."],[1,"Quoi ? Où ça ?"],[0,"Pff, t'as vraiment regardé !"],[1,"...Très malin. Vraiment."]],
    [[0,"Tiens, goûte ça, c'est bon."],[1,"...T'es sûr ?"],[0,"Ha ! Fallait voir ta tête !"],[1,"Espèce de crétin."]],
    [[0,"Approche, faut que je te montre un truc."],[1,"J'ai un mauvais pressentiment, là."],[0,"Et t'avais raison !"],[1,"J'aurais dû m'en douter..."]]
  ],
  amour_oui:[
    [[0,"%B... attends. Faut que je te dise."],[1,"Qu'est-ce qu'il y a ?"],[0,"Tu comptes énormément pour moi. Voilà."],[1,"...Moi aussi. Vraiment."]],
    [[0,"J'y pense depuis un moment, alors je me lance."],[1,"Je t'écoute."],[0,"C'est toi. Ça a toujours été toi."],[1,"...Viens là, idiot."]]
  ],
  amour_non:[
    [[0,"%B, je peux te parler ? C'est important."],[1,"Bien sûr, vas-y."],[0,"Voilà... tu me plais. Depuis longtemps."],[1,"Je suis désolé... je ne peux pas. Pardonne-moi."]],
    [[0,"Faut que je sois honnête avec toi."],[1,"Qu'est-ce qui se passe ?"],[0,"Je tiens à toi. Plus que je devrais."],[1,"...Je ne ressens pas la même chose. Désolé."]]
  ],
  guerre:[
    [[0,"%B. C'est terminé, entre nous."],[1,"Il était temps que tu l'admettes."],[0,"Ici et maintenant. L'un de nous ne se relèvera pas."],[1,"Alors ce sera toi."]],
    [[0,"Je ne te laisserai plus rien passer."],[1,"Grands mots. Prouve-le."],[0,"Avec plaisir. En garde."],[1,"Viens mourir, alors."]]
  ],
  defi:[
    [[0,"%B ! On règle ça tout de suite, un vrai duel ?"],[1,"Tu es sûr de toi ?"],[0,"Rien de mortel. Juste toi et moi. En garde !"],[1,"Ça marche. Montre-moi ce que tu vaux."]],
    [[0,"Paraît que t'as progressé."],[1,"Viens vérifier toi-même."],[0,"C'est exactement ce que je vais faire !"],[1,"En garde, alors."]]
  ],
  dispute:[
    [[0,"Tu te fous de moi, %B ?"],[1,"Baisse d'un ton, toi."],[0,"Sinon quoi, hein ?"],[1,"Ne me pousse pas à bout."]],
    [[0,"J'en ai marre de tes conneries."],[1,"C'est toi qui commences, à chaque fois."],[0,"Répète un peu pour voir."],[1,"Tu m'as très bien entendu."]]
  ],
  reconcile:[
    [[0,"%B... écoute. C'était idiot de ma part."],[1,"Tiens, tu l'admets enfin."],[0,"Bon. On oublie tout ça ?"],[1,"...D'accord. On oublie."]],
    [[0,"J'aurais pas dû réagir comme ça."],[1,"Non, en effet."],[0,"Voilà. Je m'excuse. C'est dit."],[1,"C'est bon. On repart à zéro."]]
  ],
  admire:[
    [[0,"Franchement %B, t'es vraiment impressionnant."],[1,"...Arrête."],[0,"Non mais je suis sérieux, là !"],[1,"Tu veux bien arrêter de me fixer comme ça ?"]]
  ],
  secret:[
    [[0,"%B... tu l'as senti, toi aussi ?"],[1,"Baisse d'un ton."],[0,"Quelque chose nous attrape. Sans prévenir."],[1,"Je sais. N'en parle à personne."]],
    [[0,"Il y a une chose ici. Je ne l'invente pas."],[1,"Moi aussi je la sens."],[0,"Elle nous soulève comme des poupées."],[1,"Alors il faut rester à l'écart."]]
  ],
  culte:[
    [[0,"%B. Elle est là. Je la sens qui veille."],[1,"Moi aussi. Elle nous protège."],[0,"Elle nous a choisis, tu comprends ?"],[1,"Alors soyons dignes d'elle."]],
    [[0,"Tu as vu ? Elle est revenue."],[1,"Elle revient toujours."],[0,"Rien ne peut nous arriver."],[1,"Rien. Tant qu'elle regarde."]]
  ],
  defiance:[
    [[0,"J'en ai assez de cette chose, %B."],[1,"Tu ne peux rien contre elle."],[0,"On verra bien. Qu'elle vienne."],[1,"...Tu vas le regretter."]]
  ],
  theorie:[
    [[0,"%B. À ton avis, qu'est-ce que c'est ?"],[1,"Je n'en sais rien. Rien de vivant."],[0,"Elle choisit. Elle décide. Donc elle pense."],[1,"Alors elle nous observe depuis le début."]],
    [[0,"Pourquoi nous ? Pourquoi ici ?"],[1,"Peut-être qu'il n'y a pas de pourquoi."],[0,"Il y en a toujours un."],[1,"Pas forcément un qui nous plaise."]],
    [[0,"Et si on n'était là que pour ça ?"],[1,"Pour quoi ?"],[0,"Pour être regardés."],[1,"...Ne redis jamais ça."]]
  ]
};
function scriptDeSecours(grp){
  var cle = grp.rite;
  if(grp.rite === "amour") cle = (grp[1].relTo(grp[0]) > 25) ? "amour_oui" : "amour_non";
  var L = SCRIPTS[cle];
  if(!L || !L.length) return null;
  var m = L[Math.floor(Math.random()*L.length)], out = [], i;
  for(i=0;i<m.length;i++){
    var qui = grp[m[i][0]] || grp[0];
    out.push({ qui: qui.key, dit: riteTexte(m[i][1], grp[0], grp[1] || grp[0]) });
  }
  return out;
}

/* ---- L'ACTE : une scene doit SE VOIR, pas seulement se lire ---- */
function acteRite(grp){
  var id = grp.rite, a = grp[0], b = grp[1];
  if(!id || !a || !b || a.mode==="ko" || b.mode==="ko") return;
  a.facing = (b.x >= a.x) ? 1 : -1;
  b.facing = (a.x >= b.x) ? 1 : -1;

  function frappe(att, vic, force, coul){
    att.startAction(att.pickAnim(["strong","attack"]), 0, function(){
      att.startAction("win", 400, null);
    });
    vic.vx = (vic.x >= att.x ? 1 : -1) * (140 * force);
    vic.startAction(vic.pickAnim(["hurt_light","hurt_h1"]), 220, null);
    vic.flash = 130;
    spark(vic.x, vic.fy() - vic.Ht*0.6, coul || "#ffd07a", force);
    shake += 3 * force;
    if(AUD){ AUD.impact(vic.x, force); AUD.voix(vic, "effort"); }
  }

  switch(id){
    case "betise": {
      // une FARCE, pas une agression : petit coup en douce, la victime sursaute et râle.
      a.facing = (b.x >= a.x) ? 1 : -1;
      a.startAction(a.pickAnim(["attack","strong"]), 0, function(){
        a.startAction("win", 600, null);           // il se marre
      });
      b.vx = (b.x >= a.x ? 1 : -1) * 70;            // juste un sursaut, pas un envol
      b.startAction(b.pickAnim(["hurt_light","guard"]), 260, null);
      b.flash = 80;
      spark(b.x, b.fy() - b.Ht*0.55, "#ffe08a", 0.5);   // petite étincelle jaune, pas un choc
      shake += 1;
      if(AUD){ AUD.impact(b.x, 0.4); AUD.voix(b, "effort", 0.6); }
      // pas de perte de PV réelle : c'est pour rire (appliqueRite ne fait qu'un +grudge léger)
      break;
    }

    case "amour":
      if(b.relTo(a) > 25){               // acceptee : les deux rayonnent
        a.startAction("win", 700, null);
        b.startAction("win", 700, null);
        spark(a.x, a.fy() - a.Ht*0.75, "#ff7ab0", 1.4);
        spark(b.x, b.fy() - b.Ht*0.75, "#ff7ab0", 1.4);
      } else {                           // repoussee : il tourne les talons
        b.facing = -b.facing;
        b.mode="flee"; b.modeT=4000; b.fleeFrom=a; b.brainT=80; b.leaveTalk();
        a.startAction(a.pickAnim(["hurt_special","hurt_light"]), 500, null);
        spark(a.x, a.fy() - a.Ht*0.7, "#5b6472", 1.2);
      }
      break;

    case "dispute":                      // ils se poussent
      a.vx = -a.facing * 190; b.vx = -b.facing * 190;
      a.startAction(a.pickAnim(["hurt_light"]), 150, null);
      b.startAction(b.pickAnim(["hurt_light"]), 150, null);
      if(AUD){ AUD.impact(a.x, 0.6); AUD.garde(b.x); }
      shake += 2;
      break;

    case "reconcile":                    // ils se saluent
      a.startAction(a.has("intro") ? "intro" : "win", 500, null);
      b.startAction(b.has("intro") ? "intro" : "win", 500, null);
      spark(a.x, a.fy() - a.Ht*0.6, "#7dffb2", 1.1);
      spark(b.x, b.fy() - b.Ht*0.6, "#7dffb2", 1.1);
      break;

    case "admire":                       // il lui colle aux basques
      a.mode="wander"; a.goalX = b.x - b.facing*70; a.spd = WALK*1.3; a.brainT = 5000;
      b.startAction(b.has("guard") ? "guard" : "idle", 400, null);
      break;

    case "theorie":                      // ils lèvent les yeux, cherchent quelque chose
      a.goalX = null; b.goalX = null; a.vx = 0; b.vx = 0;
      a.facing = (FORCE.x >= a.x) ? 1 : -1;
      b.facing = (b.x >= a.x) ? -1 : 1;
      break;

    case "secret":                       // ils regardent autour d'eux, inquiets
      a.startAction(a.has("guard") ? "guard" : "idle", 500, null);
      b.startAction(b.has("guard") ? "guard" : "idle", 500, null);
      a.peurT = 3000; b.peurT = 3000;
      break;

    case "culte":                        // ils se tournent vers la Force
      a.facing = (FORCE.x >= a.x) ? 1 : -1;
      b.facing = (FORCE.x >= b.x) ? 1 : -1;
      if(a.has("intro")) a.startAction("intro", 700, null);
      if(b.has("intro")) b.startAction("intro", 700, null);
      spark(a.x, a.fy() - a.Ht*0.8, "#ffd07a", 1.2);
      spark(b.x, b.fy() - b.Ht*0.8, "#ffd07a", 1.2);
      break;

    case "defiance":                     // il frappe dans le vide, vers la Force
      a.facing = (FORCE.x >= a.x) ? 1 : -1;
      a.startAction(a.pickAnim(["strong","attack"]), 0, null);
      spark(a.x + a.facing*50, a.fy() - a.Ht*0.7, "#cc1518", 1.1);
      shake += 2;
      if(AUD) AUD.voix(a, "ultime", 1);
      break;

    // guerre et defi : le combat qui suit EST l'acte
  }
}

var derniereScene = -99999;
function tenteRite(a, b){
  if(worldT - derniereScene < 7000) return false;     // on laisse un peu respirer entre deux scenes
  if(a.riteCd > 0 || b.riteCd > 0) return false;
  if(a.duel || b.duel || a.mode==="ko" || b.mode==="ko") return false;
  var ok = [];
  for(var i=0;i<RITES.length;i++) if(RITES[i].test(a, b)) ok.push(RITES[i]);
  if(!ok.length) return false;
  var R = ok[Math.floor(Math.random()*ok.length)];
  if(Math.random() > R.p) return false;

  derniereScene = worldT;
  a.riteCd = rand(30000, 70000);
  b.riteCd = rand(22000, 55000);
  startTalk(a, b, R.id);
  raiseEvent(riteTexte(R.txt, a, b), [a, b], null);
  return true;
}

// ce qui se passe VRAIMENT a la fin de la scene
function appliqueRite(grp){
  var id = grp.rite, a = grp[0], b = grp[1];
  if(!id || !a || !b) return;
  function bouge(x, y, n){ x.rel[y.key] = clamp((x.rel[y.key]||0) + n, -100, 100); }

  switch(id){
    case "amour":
      a.fait["amour_"+b.key] = 1;
      if(b.relTo(a) > 25){
        bouge(a,b,25); bouge(b,a,30);
        logIt("❤ " + b.name + " a dit oui à " + a.name + ".");
      } else {
        bouge(a,b,-18);
        logIt("💔 " + b.name + " a repoussé " + a.name + ". Aïe.");
        a.dire("blesse", true);
      }
      break;
    case "guerre":
      logIt("☠ " + a.name + " a déclaré la guerre à " + b.name + ".");
      a.fightCd = 0; b.fightCd = 0;
      startFight(a, b, "guerre");
      break;
    case "defi":
      a.fightCd = 0; b.fightCd = 0;
      startFight(a, b, "défi");
      break;
    case "betise":
      bouge(b,a,-14);
      b.grudgeUp(a, 18);
      b.dire("tendu", true);
      logIt("😈 " + a.name + " a piégé " + b.name + ".");
      break;
    case "dispute":
      bouge(a,b,-12); bouge(b,a,-12);
      if(Math.random() < .35){ a.fightCd=0; b.fightCd=0; startFight(a, b, "dispute"); }
      break;
    case "reconcile":
      a.grudge[b.key] = 0; b.grudge[a.key] = 0;
      bouge(a,b,26); bouge(b,a,22);
      logIt("🤝 " + a.name + " et " + b.name + " se sont réconciliés.");
      break;
    case "admire":
      a.fait["admire_"+b.key] = 1;
      bouge(a,b,9); bouge(b,a,5);
      break;

    case "secret":
      // partager une peur, ca rapproche. Et ca la propage.
      bouge(a,b,16); bouge(b,a,16);
      b.opMain = clamp(b.opMain - 10, -100, 100);
      logIt("🤫 " + a.name + " et " + b.name + " se sont confié leur peur.");
      break;

    case "culte":
      bouge(a,b,20); bouge(b,a,20);
      b.opMain = clamp(b.opMain + 12, -100, 100);
      logIt("🙏 " + a.name + " et " + b.name + " partagent la même foi.");
      break;

    case "theorie":
      // chercher a comprendre ensemble, ca rapproche. Et ca ancre la croyance.
      bouge(a,b,14); bouge(b,a,14);
      // celui qui doute le plus deteint sur l'autre : les avis convergent
      var moyenne = (a.opMain + b.opMain) / 2;
      a.opMain = clamp(a.opMain + (moyenne - a.opMain)*0.30, -100, 100);
      b.opMain = clamp(b.opMain + (moyenne - b.opMain)*0.30, -100, 100);
      logIt("❓ " + a.name + " et " + b.name + " ont parlé de la Présence.");
      break;

    case "defiance":
      // il defie l'invisible. Il n'en sortira rien, et ca le ronge.
      a.opMain = clamp(a.opMain - 8, -100, 100);
      a.ame = clamp(a.ame - 0.08, -1, 1);
      logIt("✊ " + a.name + " a défié la Présence. Elle n'a pas répondu.");
      break;
  }
}

function startTalk(a, b, rite){
  var grp=[a,b], i;
  for(i=0;i<agents.length && grp.length<3;i++){
    var c=agents[i];
    if(c===a || c===b || c.duel || c.mode!=="wander" || c.possessed) continue;
    if(Math.abs(c.x - a.x) > 150) continue;
    if(c.relTo(a) < -25 || c.relTo(b) < -25) continue;
    if(Math.random() < 0.45) grp.push(c);
  }
  var cx=0, zc=0;
  for(i=0;i<grp.length;i++){ cx += grp[i].x; zc += grp[i].z; }
  cx /= grp.length; zc /= grp.length;

  grp.turn  = 0;
  grp.nextT = 900;                 // le temps qu'ils se rejoignent
  grp.script = null;               // rempli par la tete si elle repond a temps
  grp.secours = null;              // le script en dur, garde en reserve au cas ou
  grp.wait  = 0;
  grp.fromLLM = false;
  grp.__meuble = false;
  grp.rite  = rite || null;        // amour / guerre / defi / betise / dispute / reconcile / admire

  var dur = 6500 + grp.length*2600 + Math.random()*3000;
  for(i=0;i<grp.length;i++){
    var g=grp[i];
    g.mode="talk"; g.modeT=dur; g.talkGrp=grp;
    g.walkT=0; g.goalX=null; g.vx=0;
    g.talkX = cx + (i - (grp.length-1)/2) * 70;
    g.goalZ = clamp(zc + (i - (grp.length-1)/2) * 0.05, 0.18, 0.92);
    g.brainT = 60;
  }
  // On PREPARE un script de secours mais on ne l'affiche pas tout de suite : on laisse
  // au LLM le temps d'ecrire un dialogue unique. Le secours ne sort que s'il tarde trop.
  if(rite){
    grp.secours = scriptDeSecours(grp);
    var d2 = 2500 + (grp.secours ? grp.secours.length : 4)*3100 + 3500;
    for(i=0;i<grp.length;i++) grp[i].modeT = d2;
  }
  // un dialogue prepare d'avance pour cette paire ? -> zero attente
  if(window.KV_MIND && window.KV_MIND.pret){
    var dejaPret = window.KV_MIND.pret(grp);
    if(dejaPret){ grp.script = dejaPret; grp.si = 0; grp.fromLLM = true; grp.attenteLLM = 0; }
  }
  var demande = false;
  if(!grp.script && window.KV_MIND && window.KV_MIND.prepareTalk){
    // Le LLM ecrit TOUTE la conversation. On lui laisse largement le temps : la frappe
    // lettre par lettre nous donne ~12 s de marge, donc patienter 6-7 s avant le premier
    // mot ne se voit pas — ils se rejoignent pendant.
    demande = window.KV_MIND.prepareTalk(grp);
  }
  grp.attenteLLM = demande ? (rite ? 7000 : 6000) : 0;
  // Pas de LLM (absent, occupe, budget serre) ? Une SCENE joue tout de suite son script
  // ecrit a la main. Sans ca elle se rabat sur des repliques generiques et ne raconte rien.
  if(!demande && !grp.script && rite && grp.secours){ grp.script = grp.secours; grp.si = 0; }
}

/* ================================================================ LA "TETE" (mind.js, optionnel) */
function findAgent(key){
  if(!key) return null;
  key = String(key).toLowerCase().trim();
  for(var i=0;i<agents.length;i++) if(agents[i].key===key) return agents[i];
  for(i=0;i<agents.length;i++) if(agents[i].name.toLowerCase()===key) return agents[i];
  return null;
}
// une intention decidee par le LLM -> une action reelle dans le monde
function applyIntent(it){
  var g = findAgent(it.qui);
  if(!g || g.mode==="ko" || g.possessed) return false;
  if(g.talkGrp && g.talkGrp.rite) return false;      // on ne derange pas une scene
  var t = it.cible ? findAgent(it.cible) : null;
  if(t === g) t = null;

  if(it.style) g.style = String(it.style);
  if(it.dit){
    var txt = String(it.dit).slice(0, 74);
    g.dits.unshift(txt.slice(0,60));
    if(g.dits.length > 5) g.dits.pop();
    g.mindLines.push(txt);
    if(g.mindLines.length > 3) g.mindLines.shift();
    if(g.mode!=="talk") bubbles.push({o:g, txt:txt, t:0, life:3400});
  }
  g.mindT = worldT;

  switch(String(it.but||"")){
    case "parler":
      if(t && !t.duel && !g.duel && t.mode==="wander" && g.mode!=="fight"){ startTalk(g, t); return true; }
      break;
    case "provoquer":
    case "venger":
      if(t && !t.duel && !g.duel && t.mode!=="ko"){
        // un modele leger peut delirer : on refuse l'absurde.
        var raison = (g.relTo(t) < 30) || ((g.grudge[t.key]||0) > 15) || (SOC.spark(g.key,t.key) > 0.05);
        if(!raison) break;                                   // Konan n'attaquera pas Pain.
        if(g.fightCd > 20000 || t.fightCd > 20000) break;    // il vient de se prendre une raclee
        g.fightCd=0; t.fightCd=0;
        startFight(g, t, it.but==="venger" ? "vengeance" : "provocation");
        return true;
      }
      break;
    case "eviter":
      if(t && !g.duel){ g.leaveTalk(); g.mode="flee"; g.modeT=6000; g.fleeFrom=t; g.brainT=100; return true; }
      break;
    case "soigner":
      if(t && g.M.healer && !g.duel){ g.leaveTalk(); g.mode="heal"; g.healTarget=t; g.modeT=0; g.brainT=100; return true; }
      break;
    case "seul":
      if(!g.duel){ g.leaveTalk(); g.mode="wander"; g.talkCd=18000; g.brainT=100; return true; }
      break;
  }
  return true;
}

/* ================================================================ CAMERA */
var cam={x:WORLD_W/2, y:-110, z:1}, camT={x:WORLD_W/2, y:-110, z:1};
var camMode="auto", camFocus=null, wide=false;

function hottest(){
  if(duels.length){
    var best=duels[0];
    for(var i=1;i<duels.length;i++) if((duels[i].A.length+duels[i].B.length) > (best.A.length+best.B.length)) best=duels[i];
    return {x:best.cx, z:1.45};
  }
  var big=null, bn=0;
  for(var j=0;j<agents.length;j++){
    var g=agents[j];
    if(g.mode==="talk" && g.talkGrp && g.talkGrp.length>bn){ bn=g.talkGrp.length; big=g; }
  }
  if(big) return {x:big.talkX, z:1.2};
  var sx=0, n=0;
  for(var k=0;k<agents.length;k++){ sx+=agents[k].x; n++; }
  return {x: n?sx/n:WORLD_W/2, z:0.9};
}
function camTick(dt){
  if(camFocus && camFocus.dead){ camFocus=null; camMode="auto"; }
  if(possessed){ camT.x=possessed.x; camT.y=-115; camT.z=1.25; }
  else if(wide){ camT.x=WORLD_W/2; camT.y=-95; camT.z = Math.max(0.34, W/(WORLD_W+120)); }
  else if(camMode==="focus" && camFocus){ camT.x=camFocus.cx; camT.y=-120; camT.z=1.9; }
  else if(camMode==="free"){ /* pilote a la souris */ }
  else { var f=hottest(); camT.x=f.x; camT.y=-110; camT.z=f.z; }

  var k = 1 - Math.pow(0.0022, Math.min(0.05, dt/1000));
  cam.x += (camT.x-cam.x)*k;
  cam.y += (camT.y-cam.y)*k;
  cam.z += (camT.z-cam.z)*k*0.75;
  var half = W/(2*cam.z);
  if(WORLD_W > 2*half) cam.x = clamp(cam.x, half, WORLD_W-half);
  else cam.x = WORLD_W/2;
}
function w2s(x,y){ return {x:(x-cam.x)*cam.z + W/2, y:(y-cam.y)*cam.z + H/2}; }
function s2w(x,y){ return {x:(x-W/2)/cam.z + cam.x, y:(y-H/2)/cam.z + cam.y}; }

/* ================================================================ DECOR */
// Mesure sur les images, pas devine :
//   sol  = a quelle hauteur de l'image se trouve le sol (fraction)
//   ciel = couleur moyenne du haut  (remplit au-dessus du decor)
//   bas  = couleur moyenne du bas   (remplit en dessous : le sol continue)
var DECORS = {
  "Training Field.png": { sol:0.955, ciel:"#108ec3", bas:"#e0c361" },
  "Uchiha Hideout.png": { sol:0.860, ciel:"#93a7af", bas:"#2b3031" },
  "Rocks day.png":      { sol:0.940, ciel:"#89a3a1", bas:"#6b2110" },
  "Rocks night.png":    { sol:0.940, ciel:"#2d3240", bas:"#393942" },
  "Suigetsu Stage.png": { sol:0.965, ciel:"#121718", bas:"#1f3b48" }
};
function solSave(){
  try{
    var o={};
    for(var k in DECORS) o[k]=DECORS[k].sol;
    localStorage.setItem("kv_sol", JSON.stringify(o));
  }catch(e){}
}
try{
  var _s=JSON.parse(localStorage.getItem("kv_sol")||"null");
  if(_s) for(var _k in _s) if(DECORS[_k]) DECORS[_k].sol=_s[_k];
}catch(e){}

var DECOR_DIR="../assets/backgrounds/";
var decorImg=new Image(), decorReady=false, decorName="Training Field.png";
var decorSol=0.955, decorCiel="#108ec3", decorBas="#e0c361";

function loadDecor(name){
  decorReady=false;
  decorName = name;
  var D = DECORS[name] || {sol:0.92, ciel:"#0b0e14", bas:"#0b0e14"};
  decorSol = D.sol; decorCiel = D.ciel; decorBas = D.bas;
  var sl=document.getElementById("sol");
  if(sl){ sl.value = decorSol; document.getElementById("solVal").textContent = decorSol.toFixed(3); }
  decorImg=new Image();
  decorImg.onload=function(){ decorReady=true; };
  decorImg.src=(DECOR_DIR+name).replace(/ /g,"%20");
}
loadDecor("Training Field.png");
var dsel=document.getElementById("decor");
if(dsel) dsel.addEventListener("change", function(){ loadDecor(dsel.value); });

var DH = 1050;   // hauteur du decor dans le monde

// Dessine dans les coordonnees du MONDE : le sol de l'image tombe pile sur y = 0.
// Au-dessus, on remplit avec la couleur du ciel ; en dessous, avec celle du sol.
// (avant : j'etirais les 2 dernieres lignes de pixels sur 900 px -> grosse bavure)
function drawDecor(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle="#0b0e14"; ctx.fillRect(0,0,W,H);
  if(!decorReady) return;

  ctx.setTransform(cam.z, 0, 0, cam.z, W/2 - cam.x*cam.z, H/2 - cam.y*cam.z);

  var sc  = DH / decorImg.height;
  var dw  = decorImg.width * sc;
  var top = -decorSol * DH;
  var bot = top + DH;

  var hx = W/(2*cam.z), hy = H/(2*cam.z);
  var vx0 = cam.x-hx-8, vx1 = cam.x+hx+8;
  var vy0 = cam.y-hy-8, vy1 = cam.y+hy+8;

  if(vy0 < top){ ctx.fillStyle=decorCiel; ctx.fillRect(vx0, vy0, vx1-vx0, Math.min(vy1,top)-vy0); }
  if(vy1 > bot){ ctx.fillStyle=decorBas;  ctx.fillRect(vx0, bot,  vx1-vx0, vy1-bot); }

  var x0 = Math.floor((vx0-dw)/dw)*dw;
  for(var x=x0; x<vx1; x+=dw){
    var i = Math.round(x/dw);
    ctx.save();
    if(i & 1){ ctx.translate(x+dw, 0); ctx.scale(-1,1); ctx.drawImage(decorImg, 0, top, dw, DH); }
    else     { ctx.drawImage(decorImg, x, top, dw, DH); }
    ctx.restore();
  }
  ctx.fillStyle="rgba(10,14,20,.18)";
  ctx.fillRect(vx0, vy0, vx1-vx0, vy1-vy0);

  // les lieux du village
  ctx.textAlign = "center";
  for(var L=0; L<LIEUX.length; L++){
    var lu = LIEUX[L];
    if(lu.x < vx0-160 || lu.x > vx1+160) continue;
    ctx.globalAlpha = 0.90;
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(lu.ic, lu.x, -Z_SPAN/2 - 16);
    ctx.font = "600 10px ui-monospace, Consolas, monospace";
    ctx.fillStyle = "rgba(233,221,194,.85)";
    ctx.fillText(lu.nom, lu.x, -Z_SPAN/2 - 3);
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = "#e9ddc2";
    ctx.beginPath(); ctx.ellipse(lu.x, 0, 34, 8, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";

  // en mode diagnostic : on VOIT le sol et la bande de profondeur
  if(showDiag){
    ctx.strokeStyle="rgba(255,80,80,.85)"; ctx.lineWidth=1.5/cam.z;
    ctx.beginPath(); ctx.moveTo(vx0, 0); ctx.lineTo(vx1, 0); ctx.stroke();
    ctx.strokeStyle="rgba(80,180,255,.55)";
    ctx.beginPath(); ctx.moveTo(vx0, -Z_SPAN/2); ctx.lineTo(vx1, -Z_SPAN/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vx0,  Z_SPAN/2); ctx.lineTo(vx1,  Z_SPAN/2); ctx.stroke();
  }
}

/* ================================================================ RENDU */
function drawFx(img, a, idx, wx, wy, K, sc, alpha, dir){
  var fx=a.fx;
  if(!fx || !fx.length || idx==null || idx<0) return;
  var f=fx[Math.min(idx, fx.length-1)], r=f.r;
  var w=r[2]*K*sc, h=r[3]*K*sc;
  ctx.save();
  ctx.globalAlpha = (alpha==null?1:alpha);
  ctx.translate(wx, wy);
  ctx.scale(dir||1, 1);
  ctx.drawImage(img, r[0],r[1],r[2],r[3], -w/2, -h/2, w, h);
  ctx.restore();
}
function drawAgent(g){
  var a=g.A(g.anim);
  if(!a || !g.img.__ok) return;
  // hors champ : inutile de le dessiner. Sa simulation, elle, continue normalement,
  // donc rien ne se voit quand on dezoome.
  var demiL = W/(2*cam.z) + 160;
  if(Math.abs(g.x - cam.x) > demiL) return;
  var fi=Math.min(g.frame, a.frames.length-1), f=a.frames[fi], r=f.r;
  var ax=(f.ax==null ? r[2]/2 : f.ax);
  var ds = 0.93 + 0.13*g.z;              // leger effet de perspective
  var K  = g.K * ds;
  var w=r[2]*K, h=r[3]*K, fy=g.fy();

  if(Q.shadows){
    ctx.globalAlpha=0.32; ctx.fillStyle="#000";
    ctx.beginPath(); ctx.ellipse(g.x, fy+2, Math.max(13, w*0.30), 5*ds, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  ctx.save();
  ctx.translate(g.x, 0); ctx.scale(g.facing, 1);
  ctx.drawImage(g.img, r[0],r[1],r[2],r[3], -ax*K, fy-h, w, h);
  if(Q.flash && g.flash>0){
    ctx.globalCompositeOperation="lighter";
    ctx.globalAlpha=Math.min(0.55, g.flash/240);
    ctx.drawImage(g.img, r[0],r[1],r[2],r[3], -ax*K, fy-h, w, h);
  }
  ctx.restore();

  if(a.fx && a.fx.length && !(g.curMove && g.curMove.t==="proj" && g.projDone)){
    var big=(g.anim.indexOf("oodama")>=0);
    if(a.clones){
      var ci=phaseFxIndex(a, fi/Math.max(1,a.frames.length-1));
      drawFx(g.img, a, ci, g.x-95*ds, fy-16*ds, K, 1, 1, 1);
      drawFx(g.img, a, ci, g.x+95*ds, fy-16*ds, K, 1, 1, -1);
    } else {
      var p=g.orbWorld(a, fi, K);
      if(p && p.i>=0) drawFx(g.img, a, p.i, p.x, p.y, K, big?1.5:1, 1, g.facing);
    }
  }
}
function drawProjs(){
  for(var i=0;i<projs.length;i++){
    var p=projs[i], a=p.a;
    var att=(a.fxAttack && a.fxAttack.length) ? a.fxAttack : [0];
    var idx=att[Math.floor(p.t/60) % att.length];
    drawFx(p.img, a, idx, p.x, p.y, p.K, p.big?1.5:1, 1, p.vx>0?1:-1);
  }
}
function drawSparks(){
  if(!Q.sparks) return;
  for(var i=0;i<sparks.length;i++){
    var s=sparks[i], k=s.t/s.life;
    ctx.save();
    ctx.globalAlpha=Math.max(0, 1-k);
    ctx.strokeStyle=s.c; ctx.lineWidth=2.4;
    ctx.beginPath(); ctx.arc(s.x, s.y, 8 + 34*k*s.s, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}

function drawOverlays(vis){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.textAlign="center";
  var i;
  for(i=0;i<vis.length;i++){
    var g=vis[i];
    var top=w2s(g.x, g.fy() - g.Ht*1.06);
    if(top.x < -80 || top.x > W+80) continue;
    var y=top.y;

    // barre de vie
    var hurt=(g.hp < g.maxHp - 0.5) || g.mode==="fight" || g.mode==="ko";
    if(hurt){
      var bw=44, bh=4;
      ctx.fillStyle="rgba(0,0,0,.55)";
      ctx.fillRect(top.x-bw/2-1, y-12, bw+2, bh+2);
      var r2=Math.max(0, g.hp/g.maxHp);
      ctx.fillStyle = g.mode==="ko" ? "#4a5568" : (r2<0.3 ? "#ff5a5a" : (r2<0.6 ? "#ffb44d" : "#5ad48a"));
      ctx.fillRect(top.x-bw/2, y-11, bw*r2, bh);
      y -= 16;
    }
    // nom
    ctx.font="600 10px ui-monospace, Consolas, monospace";
    ctx.fillStyle = g.possessed ? "#3fb6ff" : (g.mode==="ko" ? "#6b7684" : "#c8d2e0");
    ctx.fillText(g.name, top.x, y-2);
    if(g.possessed){
      ctx.strokeStyle="#3fb6ff"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(top.x-6, y-14); ctx.lineTo(top.x, y-8); ctx.lineTo(top.x+6, y-14); ctx.stroke();
    }
  }
  // bulles
  for(i=0;i<bubbles.length;i++){
    var b=bubbles[i], o=b.o;
    if(o.mode==="ko") continue;
    if(vis.indexOf(o) < 0) continue;
    var pt=w2s(o.x, o.fy() - o.Ht*1.22);
    if(pt.x<-120 || pt.x>W+120) continue;
    var al=Math.min(1, Math.min(b.t/120, (b.life-b.t)/300));
    ctx.font="11px ui-monospace, Consolas, monospace";
    // la bulle garde sa taille FINALE (pas de tremblement pendant la frappe)
    var tw=ctx.measureText(b.txt).width;
    // lettres revelees : ~26 ms par caractere, comme une frappe naturelle
    var n = b.full ? b.txt.length : Math.floor(b.t / 26);
    if(n >= b.txt.length){ n = b.txt.length; b.full = true; }
    var vu = b.txt.slice(0, n);
    ctx.globalAlpha=Math.max(0, al);
    ctx.fillStyle="rgba(16,21,29,.92)";
    ctx.strokeStyle="rgba(120,140,170,.35)"; ctx.lineWidth=1;
    var bx=pt.x-tw/2-8, by=pt.y-30, bw2=tw+16, bh2=20;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(bx, by, bw2, bh2, 6); else ctx.rect(bx, by, bw2, bh2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle="#dfe7f2";
    ctx.textAlign="left";
    ctx.fillText(vu, bx+8, by+14);
    // le curseur qui clignote pendant la frappe
    if(!b.full && (Math.floor(b.t/380) % 2 === 0)){
      var cw = ctx.measureText(vu).width;
      ctx.fillStyle="rgba(232,115,28,.85)";
      ctx.fillRect(bx+8+cw+1, by+5, 1.5, 11);
    }
    ctx.textAlign="center";
    ctx.globalAlpha=1;
  }
  // l'heure
  ctx.textAlign = "left";
  ctx.font = "600 11px ui-monospace, Consolas, monospace";
  var hh = Math.floor(heure), mm = Math.floor((heure - hh) * 60);
  ctx.fillStyle = "rgba(10,13,20,.6)";
  ctx.fillRect(10, 10, 132, 20);
  ctx.fillStyle = nuit() ? "#8fa8e0" : "#ffd7a0";
  ctx.fillText((nuit() ? "🌙 " : "☀ ") + (hh<10?"0":"") + hh + ":" + (mm<10?"0":"") + mm
               + "  " + momentDuJour(), 17, 24);

  // diagnostic (touche D)
  if(showDiag){
    ctx.textAlign="left";
    ctx.font="11px ui-monospace, Consolas, monospace";
    var L=[ fps + " fps",
            agents.length + " ninjas · " + duels.length + " duels · " + projs.length + " projectiles",
            "rendu " + cv.width + "×" + cv.height + " · zoom " + cam.z.toFixed(2) ];
    if(window.performance && performance.memory)
      L.push(Math.round(performance.memory.usedJSHeapSize/1048576) + " Mo de RAM (JS)");
    var bw=208, bh=16*L.length+10;
    ctx.fillStyle="rgba(0,0,0,.62)";
    ctx.fillRect(W-bw-8, 8, bw, bh);
    ctx.fillStyle = fps>=50 ? "#7dffb2" : (fps>=28 ? "#ffd27a" : "#ff6b6b");
    for(var q=0;q<L.length;q++) ctx.fillText(L[q], W-bw, 24+q*16);
  }
  ctx.textAlign="left";
}

/* ================================================================ BOUCLE */
function step(dt){
  worldT += dt;
  heure = (heure + 24 * dt / JOUR_MS) % 24;
  var i;

  sceneTick(dt);
  var act = scene ? scene.list : agents;

  socialAcc += dt;
  if(socialAcc >= 380){ socialTick(socialAcc); socialAcc = 0; }

  for(i=0;i<act.length;i++) act[i].update(dt);

  // pas de superposition
  for(i=0;i<act.length;i++){
    for(var j=i+1;j<act.length;j++){
      var a=act[i], b=act[j];
      if(a.mode==="ko" || b.mode==="ko" || a.held || b.held) continue;
      var d=b.x-a.x, ad=Math.abs(d);
      // ils ne se bloquent QUE s'ils sont sur le meme plan de profondeur
      if(ad < 32 && Math.abs(a.z-b.z) < 0.09 && a.onGround && b.onGround){
        var push=(32-ad)*0.5*(d>=0?1:-1);
        a.x -= push*0.5; b.x += push*0.5;

        // BUG CORRIGE : il faut deplacer goalZ, pas z. Sinon la physique remet le ninja
        // sur son plan cible a la frame suivante et le contournement ne se produit jamais.
        var meme = (a.duel && a.duel === b.duel);   // ils se battent l'un contre l'autre : on se bloque, c'est normal
        if(!meme){
          var sz = (a.z <= b.z) ? -1 : 1;
          if(a.duel && !b.duel)       b.goalZ = clamp(b.z - sz*0.30, 0.16, 0.95);  // le passant s'ecarte
          else if(b.duel && !a.duel)  a.goalZ = clamp(a.z + sz*0.30, 0.16, 0.95);
          else { a.goalZ = clamp(a.z + sz*0.26, 0.16, 0.95);
                 b.goalZ = clamp(b.z - sz*0.26, 0.16, 0.95); }
        }
      }
    }
  }

  // projectiles
  for(i=projs.length-1;i>=0;i--){
    var p=projs[i];
    p.t += dt;
    p.x += p.vx*(dt/1000);
    var gone = (p.t>=p.life || p.x<-100 || p.x>WORLD_W+100);
    if(!gone){
      for(var k=0;k<act.length;k++){
        var g=act[k];
        if(g===p.own || g.mode==="ko" || p.hs[g.id]) continue;
        if(Math.abs(g.z - p.z) > Z_HIT) continue;             // pas sur le meme plan
        if(p.side>=0 && g.duel && g.duel===p.own.duel && g.side===p.side) continue;
        var hb=g.hurtBox();
        if(p.x+p.r>hb.x0 && p.x-p.r<hb.x1 && p.y+p.r>hb.y0 && p.y-p.r<hb.y1){
          p.hs[g.id]=1;
          hit(p.own, g, p.d, p.kb, p.h, p.x);
          if(!g.duel && g.mode!=="ko") g.grudgeUp(p.own, 25);
          gone=true; break;
        }
      }
    }
    if(gone) projs.splice(i,1);
  }

  for(i=sparks.length-1;i>=0;i--){ sparks[i].t += dt; if(sparks[i].t>=sparks[i].life) sparks.splice(i,1); }
  for(i=bubbles.length-1;i>=0;i--){ bubbles[i].t += dt; if(bubbles[i].t>=bubbles[i].life) bubbles.splice(i,1); }

  ficheT += dt;
  if(ficheT > 260){ ficheT = 0; if(fiche) majFiche(); majRoster(); }
  if(shake>0) shake = Math.max(0, shake - dt*0.03);
  if(timeScale < tsTarget) timeScale = Math.min(tsTarget, timeScale + dt*0.0016);
}

function render(){
  drawDecor();
  var vis = scene ? scene.list : agents;

  var sx=(Math.random()-0.5)*shake, sy=(Math.random()-0.5)*shake;
  ctx.setTransform(cam.z, 0, 0, cam.z, W/2 - cam.x*cam.z + sx, H/2 - cam.y*cam.z + sy);

  var order=vis.slice().sort(function(p,q){
    var k = (p.mode==="ko"?0:1) - (q.mode==="ko"?0:1);
    return k !== 0 ? k : (p.z - q.z);
  });
  for(var i=0;i<order.length;i++) drawAgent(order[i]);
  drawProjs();
  drawSparks();

  // la lumiere du moment
  ctx.setTransform(1,0,0,1,0,0);
  var T = teinte();
  if(T.a > 0.005){
    ctx.fillStyle = "rgba(" + T.c + "," + T.a + ")";
    ctx.fillRect(0, 0, W, H);
  }

  drawOverlays(vis);
}

var last=0;
function loop(ts){
  requestAnimationFrame(loop);
  if(Q.cap && ts - lastDraw < 1000/Q.cap - 1) return;   // plafond FPS (mode Bas)
  lastDraw = ts;
  var raw = last ? ts-last : 16;
  last = ts;
  if(raw > 60) raw = 60;
  fpsAcc += raw; fpsN++;
  if(fpsAcc >= 500){ fps = Math.round(1000*fpsN/fpsAcc); fpsAcc=0; fpsN=0; }
  var dt = raw * timeScale * speedMul;
  if(ev){                      // la banniere vit en temps reel, pas en temps de monde
    ev.t += raw;
    if(ev.t >= ev.life) answerEvent(false);
  }
  if(!paused && dt>0){
    camTick(raw);
    step(dt);
  } else camTick(raw);

  // LA TETE TOURNE TOUJOURS — meme en pause, meme pendant une scene.
  // Ce temps d'arret est du temps de reflexion gagne : les reserves se remplissent
  // et les conversations a venir s'ecrivent pendant qu'on regarde.
  if(window.KV_MIND && window.KV_MIND.tick) window.KV_MIND.tick(raw);
  render();
}

/* ================================================================ MONDE */
function build(){
  agents.length=0; projs.length=0; sparks.length=0; duels.length=0; bubbles.length=0; scene=null;
  chronique.length=0; heure=9;
  logLines.length=0; possessed=null; camFocus=null; camMode="auto"; ev=null;
  elEvent.classList.remove("on");
  timeScale=1; tsTarget=1;
  var order=ROSTER.slice();
  for(var i=order.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=order[i]; order[i]=order[j]; order[j]=t; }
  for(i=0;i<order.length;i++){
    if(!CHARS[order[i]]) continue;
    if(present[order[i]] === false) continue;
    var x = 120 + (i+0.5) * ((WORLD_W-240)/order.length) + rand(-50,50);
    agents.push(new Agent(order[i], x));
  }
  logIt("Le monde s'éveille. " + agents.length + " ninjas.");
  fiche = null;
  if(elFiche) elFiche.classList.remove("on");
  majRoster();
}

/* ================================================================ LA FORCE
   Le joueur n'est pas un spectateur : c'est une PRESENCE dans leur monde.
   Ils la voient agir, ils s'en font une opinion, et ils se comportent en consequence.
   Rien n'est ecrit d'avance : tout depend de ce que la Force fait, partie apres partie.
*/
var FORCE = {
  x: 0, y: 0,              // ou elle se manifeste (le curseur, en coordonnees monde)
  la: false,               // est-elle presente maintenant ?
  vue: 0,                  // depuis combien de temps sans interruption
  actes: 0,                // combien de fois elle a agi
  derniere: -99999
};

// La Force agit. Tout le monde qui VOIT en tire une conclusion.
// gravite : de -1 (cruel) a +1 (bienveillant). cible : qui a subi/recu.
function forceAgit(gravite, cible, quoi){
  FORCE.actes++;
  FORCE.derniere = worldT;
  var demi = W/(2*cam.z);
  for(var i=0;i<agents.length;i++){
    var g = agents[i];
    if(g.mode === "ko" && g !== cible) continue;
    var direct = (g === cible);
    // on ne juge que ce qu'on voit (ou ce qu'on subit)
    if(!direct && Math.abs(g.x - cam.x) > demi + 120) continue;
    if(!direct && Math.abs(g.x - (cible ? cible.x : FORCE.x)) > 420) continue;

    var poids;
    if(direct) poids = gravite * 7;
    else {
      // ce que j'en pense depend de ce que je pense de la victime
      var lien = cible ? g.relTo(cible) : 0;
      poids = gravite * (1.8 + Math.abs(lien)/30);
      if(lien < -25) poids = -poids * 0.7;      // il maltraite quelqu'un que je deteste : tant mieux
    }
    // rendements decroissants : convaincre quelqu'un qui a deja un avis tranche est difficile.
    // Et un avis oppose se corrige plus vite qu'il ne s'enfonce (on doute, puis on revise).
    var op0 = g.opMain || 0;
    var memeSens = (poids >= 0) === (op0 >= 0);
    poids *= memeSens ? (1 - Math.abs(op0)/118) : 1.5;
    g.opMain = clamp(op0 + poids, -100, 100);
    if(direct && quoi) g.memMain(quoi, gravite);
    else if(Math.abs(poids) > 3) g.memMain("vu_" + (quoi||"acte"), gravite);

    // LA TETE IMPROVISE : pour la victime, et pour un temoin marque.
    // Elle compose elle-meme la reaction ; le moteur pese ne sert que si elle est absente.
    if(window.KV_MIND && window.KV_MIND.reagit && Math.abs(gravite) > 0.3){
      if(direct){
        window.KV_MIND.reagit(g, decritActe(quoi, gravite, null));
      } else if(Math.abs(poids) > 3.5 && Math.random() < 0.45){
        window.KV_MIND.reagit(g, decritActe(quoi, gravite, cible));
      }
    }
  }
}

// ce que la victime / le temoin a vecu, en clair, pour que la tete comprenne
function decritActe(quoi, gravite, victime){
  var moi = !victime;
  var qui = victime ? victime.name : "lui";
  var D = {
    saisi:                "une force invisible l'a saisi et soulevé de terre, puis relâché",
    lache:                "une force invisible l'a soulevé puis lâché",
    lache_de_haut:        "une force invisible l'a soulevé très haut et lâché — la chute a fait mal",
    repose:               "une force invisible l'a soulevé puis reposé doucement au sol",
    jete_sur_ennemi:      "une force invisible l'a jeté sur quelqu'un qu'il déteste, déclenchant un combat",
    ennemi_jete_sur_moi:  "une force invisible a lâché un ennemi juste sur lui",
    presente_a_un_ami:    "une force invisible l'a déposé auprès de quelqu'un qu'il apprécie",
    menee_ou_il_fallait:  "une force invisible l'a porté exactement là où il avait besoin d'aller",
    sauve_du_combat:      "une force invisible l'a arraché à un combat qu'il était en train de perdre",
    menee_vers_un_soigneur:"une force invisible l'a porté, inconscient, jusqu'à quelqu'un capable de le soigner",
    possede:              "une force invisible a pris le contrôle de son corps"
  };
  var base = D[String(quoi||"").replace(/^vu_/,"")] || "une force invisible s'est manifestée";
  if(moi) return "À l'instant, " + base + ".";
  return "Il vient de voir, sous ses yeux : " + qui + " — " + base + ".";
}

/* ================================================================ QUI EST LA */
var present = {};
for(var _r=0;_r<ROSTER.length;_r++) present[ROSTER[_r]] = true;

function agentDe(key){
  for(var i=0;i<agents.length;i++) if(agents[i].key===key) return agents[i];
  return null;
}
function ajouter(key){
  if(!CHARS[key] || agentDe(key)) return;
  var x = rand(120, WORLD_W-120);
  var g = new Agent(key, x);
  agents.push(g);
  logIt(g.name + " arrive.");
  majRoster();
}
function retirer(g){
  if(!g) return;
  var i, j;
  // on le sort proprement de tout ce qui le referencait
  if(g.duel){
    var arr = (g.side===0) ? g.duel.A : g.duel.B;
    j = arr.indexOf(g); if(j>=0) arr.splice(j,1);
    var d = g.duel; g.duel=null; g.side=-1;
    d.check();
  }
  g.leaveTalk();
  for(i=0;i<agents.length;i++){
    var o = agents[i];
    if(o===g) continue;
    if(o.target === g) o.target = null;
    if(o.healTarget === g) { o.healTarget = null; if(o.mode==="heal") o.mode="wander"; }
    if(o.fleeFrom === g) o.fleeFrom = null;
    if(o.avenge && o.avenge.who === g) o.avenge = null;
    if(o.watchDuel && !o.watchDuel.A.length && !o.watchDuel.B.length){ o.mode="wander"; o.watchDuel=null; }
  }
  for(i=projs.length-1;i>=0;i--) if(projs[i].own === g) projs.splice(i,1);
  for(i=bubbles.length-1;i>=0;i--) if(bubbles[i].o === g) bubbles.splice(i,1);
  if(scene){
    j = scene.list.indexOf(g);
    if(j>=0){ scene.list.splice(j,1); if(!scene.list.length) closeScene(); }
  }
  if(possessed === g) release();
  if(fiche === g) fermerFiche();
  j = agents.indexOf(g);
  if(j>=0) agents.splice(j,1);
  logIt(g.name + " s'en va.");
  majRoster();
}

var elRoster = document.getElementById("roster");
function buildRoster(){
  if(!elRoster) return;
  elRoster.innerHTML = "";
  for(var i=0;i<ROSTER.length;i++){
    (function(key){
      var d = document.createElement("div");
      d.className = "nin";
      d.title = (CHARS[key] ? CHARS[key].name : key);
      d.innerHTML = '<img src="../assets/portraits/' + key + '.png" alt=""><em>'
                  + (CHARS[key] ? CHARS[key].name : key).slice(0,7) + '</em>';
      d.onclick = function(){
        var g = agentDe(key);
        if(g){ present[key] = false; retirer(g); }
        else { present[key] = true;  ajouter(key); }
      };
      d.__key = key;
      elRoster.appendChild(d);
    })(ROSTER[i]);
  }
  majRoster();
}
function majRoster(){
  if(!elRoster) return;
  var kids = elRoster.children;
  for(var i=0;i<kids.length;i++){
    var g = agentDe(kids[i].__key);
    kids[i].classList.toggle("off", !g);
    kids[i].classList.toggle("ko",  !!g && g.mode==="ko");
    kids[i].classList.toggle("sel", !!g && (g===possessed || g===fiche));
  }
}

/* ================================================================ LA FICHE */
var fiche = null, ficheT = 0;
var elFiche = document.getElementById("fiche");

function joli(n){
  return n.replace(/_/g," ").replace(/^./, function(c){ return c.toUpperCase(); });
}
function ouvrirFiche(g){
  fiche = g; ficheT = 0;
  if(!elFiche) return;
  elFiche.classList.add("on");
  document.getElementById("fImg").src = "../assets/portraits/" + g.key + ".png";
  document.getElementById("fNom").textContent = g.name;
  var T = g.S;
  document.getElementById("fCamp").textContent =
    SOC.camp(g.key) + " · "
    + (T.social>.65?"bavard":(T.social<.35?"renfermé":"réservé")) + ", "
    + (T.loyal>.75?"très loyal":(T.loyal<.4?"égoïste":"loyal")) + ", "
    + (T.calme>.7?"calme":(T.calme<.3?"impulsif":"posé"));
  // ses techniques (fixe)
  var h = "";
  for(var i=0;i<g.moves.length;i++){
    var m = g.moves[i];
    var por = (m.t==="buff") ? "sur lui" : (Math.round(m.r[0]/10) + "-" + Math.round(m.r[1]/10) + " m");
    h += '<div class="t" data-a="'+m.a+'"><u>'+joli(m.a)+'</u><s>'
       + (m.d ? m.d+" dég" : (m.heal ? "+"+m.heal+" PV" : "buff")) + " · " + por + '</s></div>';
  }
  document.getElementById("fTech").innerHTML = h;
  majFiche();
  majRoster();
}
function fermerFiche(){
  fiche = null;
  if(elFiche) elFiche.classList.remove("on");
  majRoster();
}
function majFiche(){
  if(!fiche || !elFiche) return;
  var g = fiche, i;
  if(agents.indexOf(g) < 0){ fermerFiche(); return; }

  document.getElementById("fPv").style.width = Math.round(100*g.hp/g.maxHp) + "%";
  document.getElementById("fPv").style.background =
    g.hp < g.maxHp*0.3 ? "#cc1518" : (g.hp < g.maxHp*0.6 ? "#e8731c" : "#3a8a4a");
  document.getElementById("fPvN").textContent = Math.round(g.hp) + "/" + g.maxHp;
  document.getElementById("fCk").style.width = Math.round(g.ck) + "%";
  document.getElementById("fCk").style.background = "#3fb6ff";
  document.getElementById("fCkN").textContent = Math.round(g.ck) + "/100";

  var B = [["fFaim","faim","🍜"],["fFatigue","fatigue","💤"],["fEnnui","ennui","🎯"]];
  for(i=0;i<B.length;i++){
    var el = document.getElementById(B[i][0]);
    if(!el) continue;
    var v = g[B[i][1]];
    el.style.width = Math.round(v) + "%";
    el.style.background = v > 75 ? "#cc1518" : (v > 50 ? "#e8731c" : "#5b6472");
  }
  var ea = document.getElementById("fAme");
  if(ea){
    ea.textContent = g.motAme();
    ea.style.color = g.ame <= -0.5 ? "#cc1518" : (g.ame <= -0.2 ? "#e8731c"
                   : (g.ame >= 0.5 ? "#5ad48a" : "#e8ecf2"));
  }
  var ef = document.getElementById("fForce");
  if(ef){
    var av = g.avisForce();
    var lbl = {terreur:"terreur",peur:"peur",mefiance:"méfiance",indifference:"—",
               curiosite:"curiosité",fascination:"fascination",devotion:"dévotion"};
    ef.textContent = lbl[av];
    ef.style.color = g.opMain <= -30 ? "#cc1518" : (g.opMain <= -10 ? "#e8731c"
                   : (g.opMain >= 45 ? "#ffd07a" : "#8a93a4"));
  }
  var eh = document.getElementById("fHumeur");
  if(eh){
    var hu = Math.round(g.humeur());
    eh.textContent = hu > 70 ? "en pleine forme" : (hu > 45 ? "ça va" : (hu > 25 ? "grognon" : "au bout du rouleau"));
    eh.style.color = hu > 70 ? "#5ad48a" : (hu > 45 ? "#e8ecf2" : (hu > 25 ? "#e8731c" : "#cc1518"));
  }

  // ce qu'il fait
  var f = "Il se balade.";
  if(g.possessed)          f = "<b style='color:#e8731c'>Tu le contrôles.</b>";
  else if(g.faisant==="faim")    f = "Il mange à <b>" + (g.lieu?g.lieu.nom:"table") + "</b>.";
  else if(g.faisant==="fatigue") f = "Il <b>dort</b>" + (g.lieu?" — " + g.lieu.nom : "") + ".";
  else if(g.faisant==="ennui")   f = "Il <b>s'entraîne</b>.";
  else if(g.mode==="besoin" && g.lieu) f = "Il va vers <b>" + g.lieu.nom + "</b> " + g.lieu.ic + ".";
  else if(g.mode==="ko")   f = "Il est à terre. Il se relève dans " + Math.max(0, Math.round((g.actDur-g.actT)/1000)) + " s.";
  else if(g.mode==="fight" && g.target)
    f = "Il se bat contre <b>" + g.target.name + "</b>."
      + (g.duel ? " (" + g.duel.niveau + ")" : "")
      + (g.style!=="normal" ? " Style : <b>" + g.style + "</b>." : "");
  else if(g.mode==="talk" && g.talkGrp){
    var au = [];
    for(i=0;i<g.talkGrp.length;i++) if(g.talkGrp[i]!==g) au.push(g.talkGrp[i].name);
    f = "Il discute avec <b>" + au.join(" et ") + "</b>.";
  }
  else if(g.mode==="heal" && g.healTarget) f = "Il va secourir <b>" + g.healTarget.name + "</b>.";
  else if(g.mode==="watch") f = "Il regarde le combat.";
  else if(g.mode==="flee")  f = "Il fuit" + (g.fleeFrom ? " <b>" + g.fleeFrom.name + "</b>" : "") + ".";
  if(g.avenge && g.avenge.who) f += "<br><span style='color:#cc1518'>Il veut se venger de " + g.avenge.who.name + ".</span>";
  document.getElementById("fFait").innerHTML = f;

  // ce qu'il pense : les 4 liens les plus forts, dans un sens comme dans l'autre
  var rels = [];
  for(i=0;i<agents.length;i++){
    var o = agents[i];
    if(o===g) continue;
    rels.push({o:o, v:g.relTo(o)});
  }
  rels.sort(function(a,b){ return Math.abs(b.v) - Math.abs(a.v); });
  var hp = "";
  for(i=0;i<rels.length && i<4;i++){
    var v = rels[i].v, pos = v >= 0;
    var lg = Math.min(50, Math.abs(v)/2);
    hp += '<div class="r"><u>' + rels[i].o.name + '</u><div class="tr">'
        + '<i style="left:50%;width:' + (pos?lg:0) + '%;background:#3a8a4a"></i>'
        + '<i style="left:' + (50-(pos?0:lg)) + '%;width:' + (pos?0:lg) + '%;background:#cc1518"></i>'
        + '</div><s>' + (v>0?"+":"") + Math.round(v) + '</s></div>';
  }
  document.getElementById("fPense").innerHTML = hp || "<div style='color:#8a93a4'>Il ne connaît personne.</div>";

  // sa memoire
  var mt = g.memText();
  document.getElementById("fMem").innerHTML = mt
    ? mt.split("\n").map(function(l){ return "<div>" + l + "</div>"; }).join("")
    : "<div>Rien de récent.</div>";

  // recharge des techniques
  var ts = document.getElementById("fTech").children;
  for(i=0;i<ts.length;i++){
    var a = ts[i].getAttribute("data-a");
    var cd = g.cd[a] || 0;
    ts[i].classList.toggle("pret", cd <= 0);
    if(cd > 0) ts[i].querySelector("s").textContent = "recharge " + (cd/1000).toFixed(1) + " s";
    else {
      var mv = null;
      for(var k=0;k<g.moves.length;k++) if(g.moves[k].a===a) mv = g.moves[k];
      if(mv){
        var por = (mv.t==="buff") ? "sur lui" : (Math.round(mv.r[0]/10)+"-"+Math.round(mv.r[1]/10)+" m");
        ts[i].querySelector("s").textContent =
          (mv.d ? mv.d+" dég" : (mv.heal ? "+"+mv.heal+" PV" : "buff")) + " · " + por;
      }
    }
  }
}
if(document.getElementById("ficheX")) document.getElementById("ficheX").onclick = fermerFiche;
if(document.getElementById("fPoss")) document.getElementById("fPoss").onclick = function(){
  if(fiche){ if(fiche===possessed) release(); else possess(fiche); majFiche(); majRoster(); }
};

/* ================================================================ ENTREES */
window.addEventListener("keydown", function(e){
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].indexOf(e.code)>=0) e.preventDefault();
  if(!keys[e.code]) onPress(e.code);
  keys[e.code]=true;
});
window.addEventListener("keyup", function(e){ keys[e.code]=false; });

function onPress(code){
  if(code==="Escape"){ if(fiche) fermerFiche(); else release(); return; }
  if(code==="KeyF"){ wide=!wide; document.getElementById("wide").classList.toggle("on", wide); return; }
  if(code==="KeyD" && !possessed){ showDiag=!showDiag; return; }
  if(code==="Space" && !possessed){ paused=!paused; return; }
  if(!possessed) return;
  var c=possessed;
  if(code==="ShiftLeft"||code==="ShiftRight"){
    if(c.combo){ c.combo=null; c.st="free"; }
    if(c.st!=="act"){ c.dashT=230; c.vx=c.facing*DASH; }
    return;
  }
  if(code==="KeyJ"){
    if(c.st==="combo"){ c.combo.queued=true; return; }
    if(c.st==="free") c.comboStart();
    return;
  }
  if(code==="Space"){ if(c.onGround && c.st==="free"){ c.vy=-JUMP; c.onGround=false; } return; }
  var m=code.match(/^Digit(\d)$/);
  if(m && c.st==="free"){
    var idx=(m[1]==="0") ? 9 : (parseInt(m[1],10)-1);
    var mv=c.moves[idx];
    if(mv && (c.cd[mv.a]||0)<=0 && c.ck>=(mv.ck||0)){
      var ally = mv.ally ? c.woundedAlly(300) : null;
      if(!mv.ally || ally) c.cast(mv, ally);
    }
  }
}

function possess(g){
  release();
  possessed=g; g.possessed=true;
  g.leaveTalk();
  g.mode = g.duel ? "fight" : "wander";
  g.goalX=null; g.walkT=0;
  buildLegend(g);
  document.getElementById("legend").classList.add("on");
  forceAgit(-0.5, g, "possede");     // etre habite par la Force : troublant
  majRoster();
}
function release(){
  if(!possessed) return;
  possessed.possessed=false;
  possessed.brainT=200;
  possessed=null;
  document.getElementById("legend").classList.remove("on");
  majRoster();
}
function buildLegend(g){
  var h = "<b>←→</b> bouger · <b>Espace</b> saut · <b>Maj</b> dash · <b>J</b> coup (re-appuie = enchaîne) · <b>K</b> garde · <b>Échap</b> lâcher";
  var parts=[];
  for(var i=0;i<g.moves.length && i<10;i++){
    var key=(i===9) ? "0" : String(i+1);
    parts.push("<b>"+key+"</b> "+g.moves[i].a);
  }
  document.getElementById("legend").innerHTML = h + "<br>" + parts.join(" · ");
}

var drag=null, attrape=null;

function souris(e){
  var r = cv.getBoundingClientRect();
  return { x:(e.clientX-r.left)*(W/r.width), y:(e.clientY-r.top)*(H/r.height) };
}
cv.addEventListener("mouseenter", function(){ FORCE.la = true;  FORCE.vue = 0; });
cv.addEventListener("mouseleave", function(){ FORCE.la = false; FORCE.vue = 0; });

cv.addEventListener("mousedown", function(e){
  var m = souris(e), wp = s2w(m.x, m.y), hitG = null;
  for(var i=agents.length-1;i>=0;i--){
    var g=agents[i], hb=g.hurtBox();
    if(wp.x>hb.x0-12 && wp.x<hb.x1+12 && wp.y>hb.y0-12 && wp.y<hb.y1+12){ hitG=g; break; }
  }
  if(hitG){ attrape = {g:hitG, mx:m.x, my:m.y, bouge:false}; return; }
  drag = {mx:m.x, cx:cam.x, moved:false};
});

window.addEventListener("mousemove", function(e){
  var m = souris(e);
  var wf = s2w(m.x, m.y);
  FORCE.x = wf.x; FORCE.y = wf.y; FORCE.la = true;

  // --- ON L'A DANS LA MAIN ---
  if(attrape){
    if(!attrape.bouge && (Math.abs(m.x-attrape.mx) > 4 || Math.abs(m.y-attrape.my) > 4)){
      attrape.bouge = true;
      var g = attrape.g;
      g.leaveTalk();
      if(g.duel){
        g.__sortiDuel = true;
        var arrD = (g.side===0) ? g.duel.A : g.duel.B;
        var jD = arrD.indexOf(g); if(jD>=0) arrD.splice(jD,1);
        var dD = g.duel; g.duel=null; g.side=-1; g.target=null;
        dD.check();
      }
      g.held = true;
      g.vx=0; g.vy=0; g.combo=null; g.st="free"; g.walkT=0; g.goalX=null;
      // se faire saisir : desagreable, sauf si on venere la Force
      forceAgit(g.opMain > 50 ? 0.3 : -0.35, g, "saisi");
      g.dire(g.opMain > 40 ? "content" : "tendu", true);
      if(AUD) AUD.voix(g, "effort");
      cv.style.cursor = "grabbing";
    }
    if(attrape.bouge){
      var w2 = s2w(m.x, m.y), gg = attrape.g;
      gg.x = clamp(w2.x, 40, WORLD_W-40);
      gg.y = Math.min(0, w2.y - (gg.z - 0.5)*Z_SPAN);   // on peut le soulever
    }
    return;
  }

  if(!drag) return;
  if(Math.abs(m.x-drag.mx) > 3) drag.moved = true;
  camMode="free"; camFocus=null; wide=false;
  document.getElementById("wide").classList.remove("on");
  camT.x = drag.cx - (m.x-drag.mx)/cam.z;
  camT.y = -110;
});

window.addEventListener("mouseup", function(){
  cv.style.cursor = "";

  if(attrape){
    var g = attrape.g;
    if(!attrape.bouge){
      // simple clic : sa fiche
      if(fiche === g) fermerFiche(); else ouvrirFiche(g);
    } else {
      // on le lache : la hauteur de chute decide s'il en veut a la Force
      var haut = -g.y;                     // 0 = pose au sol, grand = lache de haut
      g.held = false;
      g.onGround = false;
      g.vy = 0;
      g.brainT = 500;
      if(haut > 210)      forceAgit(-0.85, g, "lache_de_haut");
      else if(haut > 90)  forceAgit(-0.35, g, "lache");
      else                forceAgit(0.12, g, "repose");   // pose delicatement : ca compte
      // 1. LE POSER LA OU IL A BESOIN D'ETRE : c'est le vrai geste de soin.
      var bes = g.besoinUrgent();
      if(bes){
        for(var L=0; L<LIEUX.length; L++){
          if(LIEUX[L].b === bes && Math.abs(LIEUX[L].x - g.x) < 110){
            g.mode="besoin"; g.lieu=LIEUX[L]; g.faisant=null; g.modeT=0; g.brainT=60;
            forceAgit(0.9, g, "menee_ou_il_fallait");        // elle a compris ce dont j'avais besoin
            logIt("✨ La Présence a mené " + g.name + " vers " + LIEUX[L].nom + ".");
            attrape = null; return;
          }
        }
      }

      // 2. LE SORTIR D'UN COMBAT PERDU : on lui sauve la mise.
      if(g.__sortiDuel && g.hp < g.maxHp*0.45){
        forceAgit(1.0, g, "sauve_du_combat");
        g.__sortiDuel = false;
      }

      // 3. LE POSER PRES DE QUELQU'UN QUI PEUT LE SOIGNER
      if(g.mode === "ko"){
        for(var H=0;H<agents.length;H++){
          var soigneur = agents[H];
          if(soigneur === g || soigneur.mode === "ko") continue;
          if(Math.abs(soigneur.x - g.x) > 130) continue;
          var peutSoigner = false;
          for(var Mi=0; Mi<soigneur.moves.length; Mi++)
            if(soigneur.moves[Mi].heal && soigneur.moves[Mi].ally){ peutSoigner = true; break; }
          if(!peutSoigner) continue;
          forceAgit(1.0, g, "menee_vers_un_soigneur");
          logIt("✨ La Présence a confié " + g.name + " à " + soigneur.name + ".");
          break;
        }
      }

      // ... et si on le pose sur quelqu'un, il se passe un truc
      for(var i=0;i<agents.length;i++){
        var o = agents[i];
        if(o===g || o.mode==="ko" || o.held || o.duel || o.possessed) continue;
        if(Math.abs(o.x - g.x) < 78 && Math.abs(o.z - g.z) < 0.22){
          if(g.relTo(o) < -25 || o.relTo(g) < -25){
            g.fightCd=0; o.fightCd=0;
            startFight(g, o, "provocation");
            forceAgit(-0.7, g, "jete_sur_ennemi");     // elle m'a jete dans un combat
            forceAgit(-0.5, o, "ennemi_jete_sur_moi");
          } else if(!g.duel){
            startTalk(g, o);
            forceAgit(0.45, g, "presente_a_un_ami");   // elle m'a fait rencontrer quelqu'un
          }
          break;
        }
      }
    }
    attrape = null;
    return;
  }

  if(drag && !drag.moved && !possessed){ camMode="auto"; camFocus=null; }
  drag = null;
});
cv.addEventListener("wheel", function(e){
  e.preventDefault();
  camMode="free"; camFocus=null; wide=false;
  document.getElementById("wide").classList.remove("on");
  camT.z = clamp((camT.z||cam.z) * (e.deltaY<0 ? 1.14 : 0.88), 0.34, 2.6);
}, {passive:false});

/* ================================================================ UI */
var chr=document.getElementById("chron");
var bch=document.getElementById("bchron");
if(bch) bch.onclick = function(){
  chr.classList.toggle("on");
  this.classList.toggle("on", chr.classList.contains("on"));
  if(chr.classList.contains("on")) majChronique();
};
var chx=document.getElementById("chronX");
if(chx) chx.onclick = function(){ chr.classList.remove("on"); bch.classList.remove("on"); };

var cog=document.getElementById("cog");
if(cog) cog.onclick = function(){
  var r=document.getElementById("reg");
  r.classList.toggle("on");
  this.classList.toggle("on", r.classList.contains("on"));
};
var vsl=document.getElementById("volume");
if(vsl) vsl.oninput = function(){ if(AUD) AUD.vol(parseFloat(this.value)); };
var mut=document.getElementById("mute");
if(mut) mut.onclick = function(){
  var m = this.textContent === "🔊";
  this.textContent = m ? "🔇" : "🔊";
  this.classList.toggle("on", m);
  if(AUD) AUD.mute(m);
};
document.getElementById("wide").onclick = function(){
  wide=!wide; this.classList.toggle("on", wide);
  document.getElementById("follow").classList.toggle("on", !wide);
  if(!wide){ camMode="auto"; camFocus=null; }
};
document.getElementById("follow").onclick = function(){
  wide=false; camMode="auto"; camFocus=null;
  document.getElementById("wide").classList.remove("on");
  this.classList.add("on");
};
document.getElementById("pause").onclick = function(){
  paused=!paused; this.textContent = paused ? "▶ Reprendre" : "⏸ Pause";
};
document.getElementById("reset").onclick = function(){ build(); };
document.getElementById("alert").onchange = function(){ alertMode=this.value; };
var slSol=document.getElementById("sol");
if(slSol) slSol.oninput = function(){
  decorSol = parseFloat(this.value);
  if(DECORS[decorName]) DECORS[decorName].sol = decorSol;
  document.getElementById("solVal").textContent = decorSol.toFixed(3);
  solSave();
};
var rsel=document.getElementById("depart");
if(rsel) rsel.onchange = function(){ SOC.depart(this.value); build(); };
var tns=document.getElementById("tension");
if(tns) tns.oninput = function(){
  TENSION = parseFloat(this.value);
  document.getElementById("tensionVal").textContent = TENSION.toFixed(1)+"×";
};
var spd=document.getElementById("speed");
spd.oninput = function(){
  speedMul = parseFloat(this.value);
  document.getElementById("speedVal").textContent = speedMul.toFixed(1)+"×";
};

/* ================================================================ API */
window.KV_WORLD = {
  agents:agents, duels:duels, projs:projs,
  cam:cam, LARG:W,
  step:step, build:build, startFight:startFight,
  find:findAgent, applyIntent:applyIntent, log:logIt,
  moment:momentDuJour,
  // la Force : expose pour les tests et pour la camera (a venir)
  FORCE:FORCE, forceAgit:forceAgit,
  // la tete compose une suite de gestes pour un ninja
  poserSuite:function(g, seq){ return g && g.poserSuite ? g.poserSuite(seq) : false; },
  LIEUX:LIEUX,
  // la tete depose le dialogue qu'elle a ecrit
  // le LLM ecrit en direct : chaque replique arrive des qu'elle est prete.
  // La conversation DEMARRE des la premiere, sans attendre les autres.
  pushLine:function(grp, ligne){
    if(!grp || !ligne || !ligne.dit) return false;
    if(grp.__acte) return false;
    if(!grp.fromLLM){
      // premiere replique du LLM : on jette le secours et on demarre tout de suite
      grp.script = [];
      grp.si = 0;
      grp.fromLLM = true;
      grp.attenteLLM = 0;
      grp.nextT = Math.min(grp.nextT, 120);
    }
    grp.script.push(ligne);
    grp.__flux0 = 0;              // une replique vient d'arriver : on repart pour un tour
    var dur = 2500 + grp.script.length * 3100 + (grp.rite ? 3500 : 0);
    for(var i=0;i<grp.length;i++) if(grp[i].mode==="talk") grp[i].modeT = Math.max(grp[i].modeT, dur);
    return true;
  },

  setScript:function(grp, script){
    if(!grp || !script || !script.length) return false;
    if(grp.__acte) return false;                 // trop tard, l'acte est joue
    if(grp.fromLLM) return false;                // deja ecrit par le LLM : on ne rechange pas
    // Cas normal : rien n'est encore affiche, on installe le dialogue du LLM.
    // Cas limite (le secours a demarre) : on greffe la suite sans repeter l'affiche.
    var depart = Math.min(grp.si || 0, script.length);
    if(depart > 0 && grp.script){
      grp.script = grp.script.slice(0, depart).concat(script.slice(depart));
    } else {
      grp.script = script; grp.si = 0;
    }
    grp.fromLLM = true; grp.wait = 0; grp.attenteLLM = 0;
    var dur = 2500 + grp.script.length * 3100 + (grp.rite ? 3500 : 0);
    for(var i=0;i<grp.length;i++) if(grp[i].mode==="talk") grp[i].modeT = dur;
    return true;
  },
  say:function(g,txt){ bubbles.push({o:g, txt:String(txt).slice(0,74), t:0, life:3400}); },
  get t(){ return worldT; }
};

/* ================================================================ GO */
buildRoster();
build();
if(window.KV_AUDIO){ AUD = window.KV_AUDIO; AUD.init(window.KV_WORLD); }
requestAnimationFrame(loop);

// pour les tests headless


})();
