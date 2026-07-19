/* Konoha — Atelier d'animations.
   Tu prends une piece (un sprite decoupe de la planche), tu la poses sur la scene,
   tu la deplaces. Frame suivante. A la fin : "Enregistrer" te donne un <perso>.js
   directement au format du jeu.

   Une frame peut contenir PLUSIEURS pieces (corps + bras + effet...) : elles sont
   fusionnees a l'export en une seule image via un canvas hors-ecran, exactement
   comme le jeu attend une frame = un rectangle {r:[x,y,w,h]} dans la planche.
   -> l'export genere une NOUVELLE planche <perso>_anim.png avec toutes les frames
      re-packees, et le <perso>.js qui pointe dessus.
*/
"use strict";

var BASE = window.KV_PIECES;                  // atlas d'origine (lecture seule)
var ORDER = Object.keys(BASE);

// etat mutable : l'utilisateur peut ajouter / supprimer des pieces.
// on garde les modifs dans localStorage pour ne rien perdre entre deux sessions.
var ATLAS = {};
ORDER.forEach(function(k){
  ATLAS[k] = { sheet: BASE[k].sheet, pieces: BASE[k].pieces.map(function(r){ return r.slice(); }) };
});
try {
  var saved = JSON.parse(localStorage.getItem("kv_atlas_edits") || "null");
  if(saved) for(var k in saved) if(ATLAS[k]) ATLAS[k].pieces = saved[k];
} catch(e){}
function saveAtlas(){
  var o = {};
  for(var k in ATLAS) o[k] = ATLAS[k].pieces;
  try { localStorage.setItem("kv_atlas_edits", JSON.stringify(o)); } catch(e){}
}

var SHEETS = {};                              // planches detourees (Image)
function sheet(k){
  if(SHEETS[k]) return SHEETS[k];
  var im = new Image();
  im.src = "pieces/" + k + ".png";
  SHEETS[k] = im;
  return im;
}

/* ---------- etat ---------- */
var perso = ORDER[0];
var doc = {};                                 // doc[perso] = { anims: { nom: [frame,...] } }
                                              // frame = { pieces:[{pi, x, y, s, flip}] }
var curAnim = null;
var curFrame = 0;
var curPiece = -1;
var playing = false, playT = 0, playIdx = 0;

function D(){ if(!doc[perso]) doc[perso] = {anims:{}, fps:{}}; if(!doc[perso].fps) doc[perso].fps = {}; return doc[perso]; }
function animFps(){ var d=D(); return (curAnim && d.fps[curAnim]) || 8; }
function anim(){ var d=D(); return curAnim ? d.anims[curAnim] : null; }
function frame(){ var a=anim(); return a ? a[curFrame] : null; }

/* ---------- scene ---------- */
var cv = document.getElementById("stage"), cx = cv.getContext("2d");
cx.imageSmoothingEnabled = false;
var GROUND_Y = 560;                           // le sol dans la scene (y des pieds)
var ORIGIN_X = 450;

function draw(){
  cx.clearRect(0,0,cv.width,cv.height);

  if(document.getElementById("tGrid").checked){
    cx.strokeStyle = "rgba(120,150,190,.22)"; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(0, GROUND_Y+.5); cx.lineTo(cv.width, GROUND_Y+.5); cx.stroke();
    cx.strokeStyle = "rgba(120,150,190,.10)";
    cx.beginPath(); cx.moveTo(ORIGIN_X+.5, 0); cx.lineTo(ORIGIN_X+.5, cv.height); cx.stroke();
  }

  // calque : la frame precedente en transparent, pour aligner la suivante
  if(onion && anim() && curFrame > 0){
    drawFrame(anim()[curFrame-1], 0.28, -1);
  }

  var f = frame();
  if(f) drawFrame(f, 1, curPiece);
}

function drawFrame(f, alpha, hi){
  if(!f) return;
  if(f.rect){                                   // frame importee : une seule image
    var im0 = sheet(perso), r0 = f.rect;
    if(im0.complete){
      var ax0 = (f.ax==null ? r0[2]/2 : f.ax);
      cx.save(); cx.globalAlpha = alpha;
      cx.drawImage(im0, r0[0],r0[1],r0[2],r0[3], ORIGIN_X - ax0, GROUND_Y - r0[3], r0[2], r0[3]);
      cx.restore();
      if(hi === 0){
        cx.save(); cx.globalAlpha=alpha; cx.strokeStyle="#e8731c"; cx.lineWidth=1.5;
        cx.setLineDash([5,3]);
        cx.strokeRect(ORIGIN_X - ax0, GROUND_Y - r0[3], r0[2], r0[3]); cx.setLineDash([]);
        cx.fillStyle="#e8731c"; cx.fillRect(ORIGIN_X-3, GROUND_Y-3, 6, 6);
        cx.restore();
      }
    }
    return;
  }
  for(var i=0;i<f.pieces.length;i++){
    var p = f.pieces[i], im = sheet(perso), r = ATLAS[perso].pieces[p.pi];
    if(!im.complete || !r) continue;
    var w = r[2]*p.s, h = r[3]*p.s;
    cx.save();
    cx.globalAlpha = alpha;
    cx.translate(ORIGIN_X + p.x, GROUND_Y + p.y);
    if(p.flip) cx.scale(-1,1);
    cx.drawImage(im, r[0],r[1],r[2],r[3], -w/2, -h, w, h);
    cx.restore();
    if(hi === i){
      cx.save();
      cx.globalAlpha = alpha;
      cx.strokeStyle = "#e8731c"; cx.lineWidth = 1.5;
      cx.setLineDash([5,3]);
      var bx = ORIGIN_X + p.x - w/2, by = GROUND_Y + p.y - h;
      cx.strokeRect(bx, by, w, h);
      cx.setLineDash([]);
      // poignee de centre
      cx.fillStyle = "#e8731c";
      cx.fillRect(ORIGIN_X + p.x - 3, GROUND_Y + p.y - 3, 6, 6);
      cx.restore();
    }
  }
}

/* ---------- pieces (colonne gauche) ---------- */
function buildPieces(filter){
  var box = document.getElementById("pieces");
  box.innerHTML = "";
  var list = ATLAS[perso].pieces, im = sheet(perso), n = 0;
  filter = (filter||"").trim();
  for(var i=0;i<list.length;i++){
    var r = list[i];
    // filtre grossier : par taille si l'utilisateur tape un nombre
    if(filter){
      var f = filter.toLowerCase();
      if(/^\d+$/.test(f)){ if(String(r[2]).indexOf(f)<0 && String(r[3]).indexOf(f)<0) continue; }
    }
    (function(idx, rr){
      var d = document.createElement("div");
      d.className = "pc";
      d.title = rr[2] + "×" + rr[3];
      var c = document.createElement("canvas");
      var s = Math.min(58/rr[2], 58/rr[3], 3);
      c.width = Math.max(1, Math.round(rr[2]*s));
      c.height = Math.max(1, Math.round(rr[3]*s));
      var g = c.getContext("2d"); g.imageSmoothingEnabled = false;
      function paint(){ g.clearRect(0,0,c.width,c.height); g.drawImage(im, rr[0],rr[1],rr[2],rr[3], 0,0,c.width,c.height); }
      if(im.complete) paint(); else im.addEventListener("load", paint);
      d.appendChild(c);
      d.onclick = function(){ addPiece(idx); };
      d.oncontextmenu = function(e){ e.preventDefault(); supprimerPiece(idx); };
      var del = document.createElement("span");
      del.className = "pcDel"; del.textContent = "✕"; del.title = "supprimer";
      del.onclick = function(e){ e.stopPropagation(); supprimerPiece(idx); };
      d.appendChild(del);
      box.appendChild(d);
    })(i, r);
    n++;
  }
  document.getElementById("pieceCount").textContent = n + " / " + list.length;
}

function supprimerPiece(pi){
  // on retire la piece et on repercute sur toutes les frames (decalage des index)
  ATLAS[perso].pieces.splice(pi, 1);
  var d = D();
  for(var nom in d.anims) d.anims[nom].forEach(function(f){
    f.pieces = f.pieces.filter(function(p){ return p.pi !== pi; });
    f.pieces.forEach(function(p){ if(p.pi > pi) p.pi--; });
  });
  saveAtlas();
  curPiece = -1;
  buildPieces(document.getElementById("pieceSearch").value);
  renderFrames(); draw(); syncProps();
}

/* ---------- actions ---------- */
function addPiece(pi){
  if(!anim()){ flash("crée d'abord une animation à droite →", true); return; }
  if(!frame()){ addFrame(); }
  var r = ATLAS[perso].pieces[pi];
  // pose : centree horizontalement, posee au sol
  frame().pieces.push({ pi:pi, x:0, y:0, s:1, flip:false });
  curPiece = frame().pieces.length - 1;
  syncProps(); draw(); renderFrames();
}
function delPiece(){
  var f = frame();
  if(!f || curPiece<0) return;
  f.pieces.splice(curPiece,1);
  curPiece = Math.min(curPiece, f.pieces.length-1);
  syncProps(); draw(); renderFrames();
}
function addFrame(){
  var a = anim(); if(!a){ flash("crée d'abord une animation →", true); return; }
  // dupliquer la frame courante ? non : frame vide. "dupliquer" est un bouton a part.
  a.push({ pieces:[] });
  curFrame = a.length - 1; curPiece = -1;
  renderFrames(); draw(); syncProps();
}
function dupFrame(){
  var a = anim(), f = frame(); if(!a || !f) return;
  var copy = { pieces: f.pieces.map(function(p){ return {pi:p.pi,x:p.x,y:p.y,s:p.s,flip:p.flip}; }) };
  a.splice(curFrame+1, 0, copy);
  curFrame++; curPiece = -1;
  renderFrames(); draw(); syncProps();
}
function delFrame(i){
  var a = anim(); if(!a || a.length<=0) return;
  a.splice(i,1);
  if(curFrame >= a.length) curFrame = a.length-1;
  if(curFrame < 0) curFrame = 0;
  curPiece = -1;
  renderFrames(); draw(); syncProps();
}

/* ---------- animations (colonne droite) ---------- */
function renderAnims(){
  var box = document.getElementById("animList");
  box.innerHTML = "";
  var d = D();
  Object.keys(d.anims).forEach(function(nom){
    var el = document.createElement("div");
    el.className = "an" + (nom===curAnim ? " on" : "");
    el.innerHTML = '<span class="n">'+nom+'</span>'
                 + '<span class="afps" title="images par seconde">'+ (d.fps&&d.fps[nom]||8) +' fps</span>'
                 + '<span class="c">'+d.anims[nom].length+'f</span>'
                 + '<span class="ren" title="renommer">✎</span>'
                 + '<span class="x" title="supprimer">✕</span>';
    el.querySelector(".n").onclick = el.querySelector(".c").onclick = el.querySelector(".afps").onclick = function(){
      curAnim = nom; curFrame = 0; curPiece = -1;
      renderAnims(); renderFrames(); draw(); syncProps();
      var fi = document.getElementById("fps"); if(fi) fi.value = animFps();
    };
    function lancerRenommage(){
      var span = el.querySelector(".n");
      var inp = document.createElement("input");
      inp.className = "renInp"; inp.value = nom;
      span.replaceWith(inp); inp.focus(); inp.select();
      function valider(){
        var nv = inp.value.trim().toLowerCase().replace(/[^a-z0-9_]/g,"_");
        if(nv && nv !== nom && !d.anims[nv]){
          // on garde l'ordre : on reconstruit l'objet en remplacant la cle
          var neuf = {};
          Object.keys(d.anims).forEach(function(k){ neuf[k===nom?nv:k] = d.anims[k]; });
          d.anims = neuf;
          if(curAnim === nom) curAnim = nv;
        }
        renderAnims();
      }
      inp.addEventListener("blur", valider);
      inp.addEventListener("keydown", function(ev){
        if(ev.key === "Enter") inp.blur();
        else if(ev.key === "Escape"){ inp.value = nom; inp.blur(); }
      });
    }
    el.querySelector(".ren").onclick = function(e){ e.stopPropagation(); lancerRenommage(); };
    el.querySelector(".n").ondblclick = function(e){ e.stopPropagation(); lancerRenommage(); };
    el.querySelector(".x").onclick = function(e){
      e.stopPropagation();
      delete d.anims[nom];
      if(curAnim===nom){ curAnim=null; curFrame=0; }
      renderAnims(); renderFrames(); draw();
    };
    box.appendChild(el);
  });
}
function addAnim(){
  var inp = document.getElementById("newAnim");
  var nom = inp.value.trim().toLowerCase().replace(/[^a-z0-9_]/g,"_");
  if(!nom) return;
  var d = D();
  if(!d.anims[nom]){ d.anims[nom] = [{pieces:[]}]; d.fps[nom] = 8; }
  curAnim = nom; curFrame = 0; curPiece = -1;
  inp.value = "";
  renderAnims(); renderFrames(); draw();
}

/* ---------- frames (colonne droite) ---------- */
var dragFrame = -1;
function clearDrop(){
  document.querySelectorAll(".fr").forEach(function(e){ e.classList.remove("dropL","dropR"); });
}
function moveFrame(from, to){
  var a = anim(); if(!a || from<0) return;
  if(to > from) to--;                        // l'element part avant de se re-poser
  if(to === from){ renderFrames(); return; }
  var f = a.splice(from, 1)[0];
  a.splice(to, 0, f);
  curFrame = to; curPiece = -1;
  renderFrames(); draw(); syncProps();
}
function renderFrames(){
  var box = document.getElementById("frames");
  box.innerHTML = "";
  var a = anim();
  document.getElementById("frameCount").textContent = a ? "("+a.length+")" : "";
  if(!a) return;
  a.forEach(function(f, i){
    var el = document.createElement("div");
    el.className = "fr" + (i===curFrame ? " on" : "");
    var c = document.createElement("canvas"); c.width = 56; c.height = 56;
    thumb(c, f);
    el.appendChild(c);
    var idx = document.createElement("div"); idx.className="i"; idx.textContent=(i+1); el.appendChild(idx);
    var x = document.createElement("div"); x.className="x"; x.textContent="✕"; el.appendChild(x);
    el.onclick = function(){ curFrame=i; curPiece=-1; renderFrames(); draw(); syncProps(); };
    x.onclick = function(e){ e.stopPropagation(); delFrame(i); };

    // reordonner par glisser-deposer
    el.draggable = true;
    el.dataset.idx = i;
    el.addEventListener("dragstart", function(ev){
      dragFrame = i; el.classList.add("drag");
      ev.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragend", function(){ el.classList.remove("drag"); clearDrop(); });
    el.addEventListener("dragover", function(ev){
      ev.preventDefault();
      var mid = el.getBoundingClientRect();
      var after = ev.clientX > mid.left + mid.width/2;
      clearDrop();
      el.classList.add(after ? "dropR" : "dropL");
      el.dataset.after = after ? "1" : "0";
    });
    el.addEventListener("drop", function(ev){
      ev.preventDefault();
      var to = parseInt(el.dataset.idx,10);
      if(el.dataset.after === "1") to++;
      moveFrame(dragFrame, to);
    });
    box.appendChild(el);
  });
}
function thumb(c, f){
  var g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  g.clearRect(0,0,c.width,c.height);
  if(f.rect){
    var im=sheet(perso), r=f.rect; if(!im.complete) return;
    var sc=Math.min(52/r[2],52/r[3],2);
    g.drawImage(im, r[0],r[1],r[2],r[3], 28-(r[2]*sc)/2, 52-(r[3]*sc), r[2]*sc, r[3]*sc);
    return;
  }
  if(!f.pieces || !f.pieces.length) return;
  // cadrer le contenu de la frame dans la vignette
  var b = frameBox(f); if(!b) return;
  var s = Math.min(52/(b.w||1), 52/(b.h||1), 2);
  var im = sheet(perso);
  f.pieces.forEach(function(p){
    var r = ATLAS[perso].pieces[p.pi]; if(!im.complete || !r) return;
    var w=r[2]*p.s*s, h=r[3]*p.s*s;
    g.save();
    g.translate(28 + (p.x - b.cx)*s, 52 + (p.y - b.by)*s);
    if(p.flip) g.scale(-1,1);
    g.drawImage(im, r[0],r[1],r[2],r[3], -w/2, -h, w, h);
    g.restore();
  });
}

/* boite englobante d'une frame, en coordonnees scene (px, origine = pieds au centre) */
function frameBox(f){
  if(f && f.rect){
    var r=f.rect, ax=(f.ax==null?r[2]/2:f.ax);
    return { x0:-ax, y0:-r[3], x1:r[2]-ax, y1:0, w:r[2], h:r[3], cx:(r[2]/2)-ax, by:0 };
  }
  if(!f || !f.pieces || !f.pieces.length) return null;
  var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  f.pieces.forEach(function(p){
    var r = ATLAS[perso].pieces[p.pi]; if(!r) return;
    var w=r[2]*p.s, h=r[3]*p.s;
    x0=Math.min(x0, p.x - w/2); x1=Math.max(x1, p.x + w/2);
    y0=Math.min(y0, p.y - h);   y1=Math.max(y1, p.y);
  });
  return { x0:x0,y0:y0,x1:x1,y1:y1, w:x1-x0, h:y1-y0, cx:(x0+x1)/2, by:y1 };
}

/* ---------- proprietes de la piece selectionnee ---------- */
function syncProps(){
  var f = frame();
  var reimp = document.getElementById("reimp");
  if(f && f.rect){                        // frame importee
    document.getElementById("pSel").textContent = "image importée " + f.rect[2]+"×"+f.rect[3];
    document.getElementById("pX").value = "";
    document.getElementById("pY").value = "";
    document.getElementById("pScale").value = 1;
    document.getElementById("pFlip").checked = false;
    if(reimp) reimp.style.display = "";
    return;
  }
  if(reimp) reimp.style.display = "none";
  var p = (f && curPiece>=0) ? f.pieces[curPiece] : null;
  document.getElementById("pSel").textContent = p ? ("#"+(curPiece+1)+" / "+f.pieces.length) : "aucune";
  document.getElementById("pX").value = p ? Math.round(p.x) : "";
  document.getElementById("pY").value = p ? Math.round(p.y) : "";
  document.getElementById("pScale").value = p ? p.s : 1;
  document.getElementById("pFlip").checked = p ? p.flip : false;
}

// re-decouper une frame importee : on ouvre l'atelier, on trace le nouveau cadre,
// et il REMPLACE le rectangle de cette frame.
var reimpFrame = null;
function reDecouperFrame(){
  var f = frame(); if(!f || !f.rect) return;
  reimpFrame = f;
  if(window.__openCutterForFrame) window.__openCutterForFrame(f.rect);
}
["pX","pY","pScale"].forEach(function(id){
  document.getElementById(id).addEventListener("input", function(){
    var f=frame(); if(!f||curPiece<0) return;
    var p=f.pieces[curPiece], v=parseFloat(this.value);
    if(id==="pX") p.x=v; else if(id==="pY") p.y=v; else p.s=Math.max(0.1,v||1);
    draw(); renderFrames();
  });
});
document.getElementById("pFlip").addEventListener("change", function(){
  var f=frame(); if(!f||curPiece<0) return;
  f.pieces[curPiece].flip = this.checked; draw(); renderFrames();
});
document.getElementById("pUp").onclick = function(){
  var f=frame(); if(!f||curPiece<0||curPiece>=f.pieces.length-1) return;
  var t=f.pieces[curPiece]; f.pieces[curPiece]=f.pieces[curPiece+1]; f.pieces[curPiece+1]=t;
  curPiece++; syncProps(); draw();
};
document.getElementById("pDown").onclick = function(){
  var f=frame(); if(!f||curPiece<=0) return;
  var t=f.pieces[curPiece]; f.pieces[curPiece]=f.pieces[curPiece-1]; f.pieces[curPiece-1]=t;
  curPiece--; syncProps(); draw();
};

/* ---------- glisser une piece sur la scene ---------- */
var onion = false;
var drag = null;
function mouseScene(e){
  var r = cv.getBoundingClientRect();
  return { x:(e.clientX-r.left)*(cv.width/r.width), y:(e.clientY-r.top)*(cv.height/r.height) };
}
cv.addEventListener("mousedown", function(e){
  var m = mouseScene(e), f = frame();
  if(!f) return;
  if(f.rect){                                   // frame importee : on la deplace en bloc
    var r=f.rect, ax=(f.ax==null?r[2]/2:f.ax);
    var bx=ORIGIN_X-ax, by=GROUND_Y-r[3];
    if(m.x>=bx && m.x<=bx+r[2] && m.y>=by && m.y<=by+r[3]){
      curPiece = 0;
      drag = { rectMode:true, ax0:ax, h0:r[3], mx:m.x, my:m.y };
    } else curPiece = -1;
    syncProps(); draw();
    return;
  }
  // quelle piece sous le curseur ? (de la plus haute a la plus basse)
  for(var i=f.pieces.length-1;i>=0;i--){
    var p=f.pieces[i], r=ATLAS[perso].pieces[p.pi]; if(!r) continue;
    var w=r[2]*p.s, h=r[3]*p.s;
    var bx=ORIGIN_X+p.x-w/2, by=GROUND_Y+p.y-h;
    if(m.x>=bx && m.x<=bx+w && m.y>=by && m.y<=by+h){
      curPiece=i;
      drag={ dx:(ORIGIN_X+p.x)-m.x, dy:(GROUND_Y+p.y)-m.y };
      syncProps(); draw();
      return;
    }
  }
  curPiece=-1; syncProps(); draw();
});
window.addEventListener("mousemove", function(e){
  if(!drag) return;
  var m=mouseScene(e), f=frame(); if(!f) return;
  if(drag.rectMode){                            // deplacer une frame importee = bouger son point de pieds
    f.ax = Math.round(drag.ax0 - (m.x - drag.mx));
    // (on laisse la hauteur : le "sol" est GROUND_Y, on ne change que l ancrage horizontal)
    syncProps(); draw();
    return;
  }
  if(curPiece<0) return;
  var p=f.pieces[curPiece];
  p.x = Math.round(m.x + drag.dx - ORIGIN_X);
  p.y = Math.round(m.y + drag.dy - GROUND_Y);
  syncProps(); draw();
});
window.addEventListener("mouseup", function(){ if(drag){ drag=null; renderFrames(); } });

/* fleches = nudge de la piece */
window.addEventListener("keydown", function(e){
  if(/INPUT|SELECT/.test((e.target.tagName||""))) return;
  var f=frame();
  if(e.code==="Space"){ e.preventDefault(); togglePlay(); return; }
  if(e.code==="Delete" || e.code==="Backspace"){ e.preventDefault(); delPiece(); return; }
  if(f && curPiece>=0){
    var p=f.pieces[curPiece], st=e.shiftKey?10:1, moved=true;
    if(e.code==="ArrowLeft") p.x-=st; else if(e.code==="ArrowRight") p.x+=st;
    else if(e.code==="ArrowUp") p.y-=st; else if(e.code==="ArrowDown") p.y+=st;
    else moved=false;
    if(moved){ e.preventDefault(); syncProps(); draw(); renderFrames(); }
  }
});

/* ---------- apercu ---------- */
function togglePlay(){
  playing=!playing;
  document.getElementById("tPlay").classList.toggle("on", playing);
  document.getElementById("tPlay").textContent = playing ? "❚❚" : "▶";
  playIdx=curFrame; playT=0;
}
var last=0;
function loop(t){
  requestAnimationFrame(loop);
  var dt = last? t-last:16; last=t;
  if(playing){
    var a=anim();
    if(a && a.length){
      var fps = animFps();
      playT += dt;
      if(playT >= 1000/fps){
        playT=0; playIdx=(playIdx+1)%a.length;
      }
      cx.clearRect(0,0,cv.width,cv.height);
      if(document.getElementById("tGrid").checked){
        cx.strokeStyle="rgba(120,150,190,.22)"; cx.lineWidth=1;
        cx.beginPath(); cx.moveTo(0,GROUND_Y+.5); cx.lineTo(cv.width,GROUND_Y+.5); cx.stroke();
      }
      drawFrame(a[playIdx], 1, -1);
    }
  }
}

/* ---------- EXPORT : on repackage tout dans une planche + <perso>.js ---------- */
function exportPerso(){
  var d = D(), noms = Object.keys(d.anims);
  if(!noms.length){ flash("aucune animation à enregistrer", true); return; }

  // 1. rendre chaque frame sur un canvas serre -> collecter les images
  var im = sheet(perso);
  if(!im.complete){ flash("planche pas encore chargée, réessaie", true); return; }

  var imgs = [];   // {nom, i, canvas, w, h, ax}
  noms.forEach(function(nom){
    d.anims[nom].forEach(function(f, i){
      var pad = 1;
      if(f.rect){                                  // frame importee : on recopie l image telle quelle
        var r = f.rect, W0 = r[2]+pad*2, H0 = r[3]+pad*2;
        var c0 = document.createElement("canvas"); c0.width=W0; c0.height=H0;
        var g0 = c0.getContext("2d"); g0.imageSmoothingEnabled=false;
        g0.drawImage(im, r[0],r[1],r[2],r[3], pad, pad, r[2], r[3]);
        imgs.push({nom:nom,i:i,canvas:c0,w:W0,h:H0,ax:(f.ax==null?r[2]/2:f.ax)+pad, hx:f.hx, hy:f.hy});
        return;
      }
      var b = frameBox(f);
      if(!b){ imgs.push({nom:nom,i:i,canvas:null,w:2,h:2,ax:1}); return; }
      var W = Math.ceil(b.w)+pad*2, H = Math.ceil(b.h)+pad*2;
      var c = document.createElement("canvas"); c.width=W; c.height=H;
      var g = c.getContext("2d"); g.imageSmoothingEnabled=false;
      f.pieces.forEach(function(p){
        var r=ATLAS[perso].pieces[p.pi]; if(!r) return;
        var w=r[2]*p.s, h=r[3]*p.s;
        g.save();
        g.translate((p.x - b.x0)+pad, (p.y - b.y0)+pad);
        if(p.flip) g.scale(-1,1);
        g.drawImage(im, r[0],r[1],r[2],r[3], -w/2, -h, w, h);
        g.restore();
      });
      imgs.push({nom:nom,i:i,canvas:c,w:W,h:H,ax:(b.cx - b.x0)+pad});
    });
  });

  // 2. packer toutes les frames dans une grande planche (colonnes de 512)
  var COLW = 512, x=0, y=0, rowH=0, placed=[];
  imgs.forEach(function(o){
    if(x + o.w > COLW){ x=0; y+=rowH+2; rowH=0; }
    o.px=x; o.py=y;
    x += o.w+2; rowH=Math.max(rowH,o.h);
    placed.push(o);
  });
  var sheetW = COLW, sheetH = y+rowH+2;
  var big = document.createElement("canvas"); big.width=sheetW; big.height=sheetH;
  var bg = big.getContext("2d"); bg.imageSmoothingEnabled=false;
  placed.forEach(function(o){ if(o.canvas) bg.drawImage(o.canvas, o.px, o.py); });

  // 3. construire le KV_CHARS
  var out = { name: cap(perso), sheet: "../assets/"+perso+"_anim.png",
              scaleTo:115, refH: guessRefH(d), anims:{} };
  noms.forEach(function(nom){
    out.anims[nom] = { fps: (d.fps && d.fps[nom]) || 8, loop:true, frames:[] };
  });
  placed.forEach(function(o){
    var fr = { r:[o.px,o.py,o.w,o.h], ax:Math.round(o.ax) };
    if(o.hx!=null) fr.hx = o.hx;
    if(o.hy!=null) fr.hy = o.hy;
    out.anims[o.nom].frames[o.i] = fr;
  });

  // 4. telechargements
  var js = "/* genere par l'atelier Konoha */\n"
         + "window.KV_CHARS = Object.assign(window.KV_CHARS||{}, "
         + JSON.stringify({ [perso]: out }) + ");\n";
  dl(perso+".js", new Blob([js], {type:"text/javascript"}));
  big.toBlob(function(b){ dl(perso+"_anim.png", b); });

  // fiche de controle : ce qu'il faut pour regler hitboxes + raccords, SANS lancer le jeu.
  // pour chaque frame : taille, point des pieds (ax), et l'ecart avec la frame precedente
  // de la meme anim -> reperer les "sauts" bizarres entre deux frames.
  var ctrl = { perso: perso, refH: out.refH, anims: {} };
  noms.forEach(function(nom){
    var frs = out.anims[nom].frames, info = [];
    for(var i=0;i<frs.length;i++){
      var f = frs[i], prev = i>0 ? frs[i-1] : null;
      var row = { i:i, w:f.r[2], h:f.r[3], ax:f.ax, pieds:f.r[3] };
      if(prev){
        row.dAx = f.ax - prev.ax;          // deplacement horizontal du centre entre 2 frames
        row.dH  = f.r[3] - prev.r[3];      // variation de hauteur
      }
      info.push(row);
    }
    ctrl.anims[nom] = info;
  });
  dl(perso+"_control.json", new Blob([JSON.stringify(ctrl,null,1)], {type:"application/json"}));

  flash("✔ "+perso+".js + .png + _control.json ("+placed.length+" frames)");
}
function guessRefH(d){
  // hauteur de l'idle, sinon la premiere anim
  var a = d.anims.idle || d.anims[Object.keys(d.anims)[0]];
  if(!a || !a.length) return 68;
  var b = frameBox(a[0]);
  return b ? Math.round(b.h) : 68;
}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function dl(name, blob){
  var u = URL.createObjectURL(blob), a=document.createElement("a");
  a.href=u; a.download=name; a.click();
  setTimeout(function(){ URL.revokeObjectURL(u); }, 4000);
}
function flash(msg, err){
  var el=document.getElementById("saveMsg");
  el.textContent=msg; el.style.color = err? "#cc1518":"#3a8a4a";
  setTimeout(function(){ if(el.textContent===msg) el.textContent=""; }, 4000);
}

/* ---------- reprendre un .js existant ---------- */
document.getElementById("loadFile").onclick = function(){ document.getElementById("fileInput").click(); };
document.getElementById("fileInput").onchange = function(e){
  var file = e.target.files[0]; if(!file) return;
  var rd = new FileReader();
  rd.onload = function(){
    try {
      var txt = rd.result;
      var m = txt.match(/Object\.assign\([^,]*,\s*(\{[\s\S]*\})\s*\)/)
           || txt.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/)
           || [null, txt.match(/\{[\s\S]*\}/)[0]];
      var obj = (new Function("return ("+m[1]+")"))();
      var key = Object.keys(obj)[0];
      var src = obj[key];
      if(!src || !src.anims) throw 0;

      // on bascule sur ce perso et on IMPORTE ses anims comme frames "rect" (modifiables)
      if(ATLAS[key]){ perso = key; document.getElementById("perso").value = key; sheet(perso); }
      var d = D();
      var n = 0;
      Object.keys(src.anims).forEach(function(nom){
        var a = src.anims[nom];
        d.anims[nom] = a.frames.map(function(fr){
          return { rect: fr.r.slice(), ax: (fr.ax==null?Math.round(fr.r[2]/2):fr.ax),
                   hx: fr.hx, hy: fr.hy };
        });
        d.fps[nom] = a.fps || 8;
        n++;
      });
      curAnim = Object.keys(d.anims)[0]; curFrame = 0; curPiece = -1;
      buildPieces(""); renderAnims(); renderFrames(); draw(); syncProps();
      var fi=document.getElementById("fps"); if(fi) fi.value = animFps();
      flash("✔ "+key+" importé : "+n+" animations, prêtes à réparer");
    } catch(err){ flash("fichier .js illisible", true); }
  };
  rd.readAsText(file);
};

/* ---------- barre d'outils ---------- */
document.getElementById("tPlay").onclick = togglePlay;
document.getElementById("tDup").onclick = dupFrame;
document.getElementById("tDel").onclick = delPiece;
document.getElementById("tOnion").onclick = function(){ onion=!onion; this.classList.toggle("on", onion); draw(); };
document.getElementById("tGrid").onchange = draw;
document.getElementById("addFrame").onclick = addFrame;
document.getElementById("addAnim").onclick = addAnim;
document.getElementById("newAnim").addEventListener("keydown", function(e){ if(e.key==="Enter") addAnim(); });
var fpsInput = document.getElementById("fps");
if(fpsInput) fpsInput.addEventListener("input", function(){
  if(!curAnim) return;
  var v = Math.max(1, Math.min(30, parseInt(this.value,10)||8));
  D().fps[curAnim] = v;
  renderAnims();
});
var reimpBtn = document.getElementById("reimp");
if(reimpBtn) reimpBtn.onclick = reDecouperFrame;
document.getElementById("save").onclick = exportPerso;
document.getElementById("pieceSearch").addEventListener("input", function(){ buildPieces(this.value); });

/* ---------- perso ---------- */
var sel = document.getElementById("perso");
ORDER.forEach(function(k){
  var o=document.createElement("option"); o.value=k; o.textContent=cap(k); sel.appendChild(o);
});
sel.onchange = function(){
  perso = this.value; curAnim=null; curFrame=0; curPiece=-1;
  sheet(perso);
  buildPieces(""); renderAnims(); renderFrames(); draw(); syncProps();
};

/* ---------- go ---------- */
sheet(perso).addEventListener("load", function(){ buildPieces(""); draw(); });
buildPieces("");
renderAnims();
renderFrames();
syncProps();
requestAnimationFrame(loop);
draw();

/* ============================================================ ATELIER DE DÉCOUPE
   On isole une nouvelle pièce directement sur la planche :
   - baguette : clic sur un morceau -> bloc de pixels connexes (flood fill sur l'alpha)
   - rectangle : on trace la zone à la main
   La pièce ajoutée entre dans ATLAS[perso].pieces et devient disponible tout de suite.
*/
(function(){
  var overlay = document.getElementById("cutter");
  var cc = document.getElementById("cutCv"), cg = cc.getContext("2d");
  cg.imageSmoothingEnabled = false;
  var mode = "magic";          // magic | rect
  var zoom = 1;
  var sel = null;              // {x,y,w,h} en pixels de la planche
  var rectDrag = null;
  var pxData = null;           // ImageData de la planche (pour le flood fill)

  function open(){
    var im = sheet(perso);
    if(!im.complete){ flash("planche pas encore chargée", true); return; }
    document.getElementById("cutPerso").textContent = cap(perso);
    cc.width = im.naturalWidth; cc.height = im.naturalHeight;
    cg.clearRect(0,0,cc.width,cc.height);
    cg.drawImage(im, 0, 0);
    try { pxData = cg.getImageData(0,0,cc.width,cc.height); }
    catch(e){ pxData = null; }   // au pire, la baguette sera indispo
    sel = null; editIdx = -1; setMode("magic");
    document.getElementById("cutHint").textContent = "clique sur un morceau : ça l'isole tout seul";
    applyZoom();
    overlay.classList.add("on");
    redraw();
  }
  function close(){ overlay.classList.remove("on"); }

  function applyZoom(){
    cc.style.width = (cc.width * zoom) + "px";
    cc.style.height = (cc.height * zoom) + "px";
  }
  var editIdx = -1;   // >=0 si on est en train de corriger une decoupe existante

  function redraw(){
    var im = sheet(perso);
    cg.clearRect(0,0,cc.width,cc.height);
    cg.drawImage(im, 0, 0);

    // les decoupes DEJA faites, en bleu : cliquables pour les reprendre / re-decouper
    var lw = Math.max(1, 1/zoom);
    ATLAS[perso].pieces.forEach(function(r, idx){
      if(idx === editIdx) return;
      cg.strokeStyle = "rgba(90,160,255,.45)"; cg.lineWidth = lw;
      cg.strokeRect(r[0]+.5, r[1]+.5, r[2], r[3]);
    });

    if(sel){
      cg.strokeStyle = "#e8731c"; cg.lineWidth = Math.max(1, 2/zoom);
      cg.setLineDash([6/zoom, 3/zoom]);
      cg.strokeRect(sel.x+.5, sel.y+.5, sel.w, sel.h);
      cg.setLineDash([]);
      cg.fillStyle = "rgba(232,115,28,.14)";
      cg.fillRect(sel.x, sel.y, sel.w, sel.h);
    }
    document.getElementById("cutSel").textContent = sel
      ? ("sélection : " + sel.w + " × " + sel.h + " px  (x" + sel.x + " y" + sel.y + ")")
      : "rien de sélectionné";
  }

  function pos(e){
    var r = cc.getBoundingClientRect();
    return { x: Math.floor((e.clientX-r.left)/zoom), y: Math.floor((e.clientY-r.top)/zoom) };
  }

  // FLOOD FILL sur les pixels opaques -> boite du bloc connexe
  function magic(sx, sy){
    if(!pxData){ flash("baguette indisponible ici, utilise le rectangle", true); return; }
    var W = cc.width, H = cc.height, d = pxData.data;
    function a(x,y){ return d[(y*W+x)*4+3]; }
    if(sx<0||sy<0||sx>=W||sy>=H || a(sx,sy) <= 20){ sel=null; redraw(); return; }

    var seen = new Uint8Array(W*H);
    var stack = [[sx,sy]];
    var x0=sx,x1=sx,y0=sy,y1=sy, count=0;
    var GAP = 2;                 // on saute les micro-trous transparents (<=2px)
    while(stack.length){
      var c = stack.pop(), x=c[0], y=c[1];
      if(x<0||y<0||x>=W||y>=H) continue;
      var id = y*W+x;
      if(seen[id]) continue;
      seen[id] = 1;
      if(a(x,y) <= 20) continue;
      count++;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      // 4 voisins + tolérance de trou
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
      for(var g=2;g<=GAP+1;g++){ stack.push([x+g,y],[x-g,y],[x,y+g],[x,y-g]); }
    }
    if(count < 12){ sel=null; redraw(); return; }
    var pad = 1;
    sel = { x:Math.max(0,x0-pad), y:Math.max(0,y0-pad),
            w:Math.min(W,x1+pad+1)-Math.max(0,x0-pad),
            h:Math.min(H,y1+pad+1)-Math.max(0,y0-pad) };
    redraw();
  }

  function pieceSous(x, y){
    // la plus PETITE decoupe existante qui contient le point (pour viser juste)
    var best = -1, aire = 1e18;
    ATLAS[perso].pieces.forEach(function(r, idx){
      if(x>=r[0] && x<=r[0]+r[2] && y>=r[1] && y<=r[1]+r[3]){
        var a = r[2]*r[3];
        if(a < aire){ aire = a; best = idx; }
      }
    });
    return best;
  }

  cc.addEventListener("mousedown", function(e){
    var p = pos(e);
    if(mode === "fix"){
      // mode Corriger : clic sur un cadre bleu -> on ajuste cette decoupe
      var hit = pieceSous(p.x, p.y);
      if(hit >= 0) reprendre(hit);
      else flash("clique sur un cadre bleu à corriger", true);
      return;
    }
    if(mode === "magic"){ editIdx = -1; magic(p.x, p.y); return; }
    // mode Rectangle : on trace LIBREMENT, meme par-dessus une decoupe existante
    editIdx = -1;
    rectDrag = { x0:p.x, y0:p.y };
    sel = {x:p.x, y:p.y, w:0, h:0};
    redraw();
  });

  function reprendre(idx){
    var r = ATLAS[perso].pieces[idx];
    editIdx = idx;
    sel = { x:r[0], y:r[1], w:r[2], h:r[3] };
    rectDrag = null;
    setMode("fix");
    document.getElementById("cutHint").textContent = "re-trace le cadre, puis « ↻ remplacer »";
    redraw();
  }
  function setMode(m){
    mode = m;
    document.getElementById("cutMagic").classList.toggle("on", m==="magic");
    document.getElementById("cutRect").classList.toggle("on", m==="rect");
    document.getElementById("cutFix").classList.toggle("on", m==="fix");
  }
  window.addEventListener("mousemove", function(e){
    if(!rectDrag) return;
    var p = pos(e);
    sel = { x:Math.min(rectDrag.x0,p.x), y:Math.min(rectDrag.y0,p.y),
            w:Math.abs(p.x-rectDrag.x0), h:Math.abs(p.y-rectDrag.y0) };
    redraw();
  });
  window.addEventListener("mouseup", function(){ rectDrag = null; });

  document.getElementById("cutMagic").onclick = function(){
    mode="magic"; this.classList.add("on"); document.getElementById("cutRect").classList.remove("on");
    document.getElementById("cutHint").textContent = "clic = isoler · Alt+clic sur un cadre bleu = corriger cette découpe";
  };
  document.getElementById("cutRect").onclick = function(){
    mode="rect"; this.classList.add("on"); document.getElementById("cutMagic").classList.remove("on");
    document.getElementById("cutHint").textContent = "trace un rectangle autour de la pièce";
  };
  document.getElementById("cutZoom").oninput = function(){ zoom=parseFloat(this.value); applyZoom(); redraw(); };
  document.getElementById("cutClose").onclick = close;
  document.getElementById("cutBtn").onclick = function(){ reimpFrame = null; open(); };

  // appel depuis "re-decouper cette frame" : on ouvre pre-cible sur son rectangle
  window.__openCutterForFrame = function(rect){
    open();
    setMode("rect");
    sel = { x:rect[0], y:rect[1], w:rect[2], h:rect[3] };
    document.getElementById("cutHint").textContent = "re-trace le cadre de cette frame, puis « appliquer à la frame »";
    redraw();
  };

  document.getElementById("cutAdd").onclick = function(){
    if(!sel || sel.w < 3 || sel.h < 3){ flash("sélectionne d'abord une zone", true); return; }
    if(reimpFrame){                              // on repare une frame importee
      reimpFrame.rect = [sel.x, sel.y, sel.w, sel.h];
      reimpFrame = null;
      close();
      renderFrames(); draw(); syncProps();
      flash("✔ frame corrigée");
      return;
    }
    if(editIdx >= 0){
      ATLAS[perso].pieces[editIdx] = [sel.x, sel.y, sel.w, sel.h];  // on CORRIGE la découpe
      flash("✔ découpe corrigée ("+sel.w+"×"+sel.h+")");
      editIdx = -1;
    } else {
      ATLAS[perso].pieces.push([sel.x, sel.y, sel.w, sel.h]);       // nouvelle découpe
      flash("✔ pièce ajoutée ("+sel.w+"×"+sel.h+")");
    }
    saveAtlas();
    buildPieces(document.getElementById("pieceSearch").value);
    sel = null; redraw();
  };
  // le libellé du bouton suit le contexte
  var _cutAddBtn = document.getElementById("cutAdd");
  function majBoutonAjout(){
    _cutAddBtn.textContent = reimpFrame ? "✔ appliquer à la frame"
                           : (editIdx>=0 ? "↻ remplacer cette pièce" : "＋ ajouter cette pièce");
  }
  var _redraw0 = redraw;
  redraw = function(){ _redraw0(); majBoutonAjout(); };
})();
