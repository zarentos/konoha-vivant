/* Konoha Vivant — atelier d'animations.
   Lit les données découpées des planches (window.KV_CHARS) et joue chaque
   animation, ancrée par les pieds. Marche en double-clic (file://) et dans Electron. */
(function(){
  "use strict";
  var CHARS = window.KV_CHARS || {};
  var cv = document.getElementById("cv");
  var ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // groupes + libellés FR (seules les anims présentes sont affichées)
  var GROUPS = [
    ["Base", [["intro","Introduction"],["idle","Idle"],["run","Course"],["dash","Dash"],["jump","Saut"],["guard","Garde"]]],
    ["Combat", [["attack","Combo"],["strong_fwd","Strong · avant"],["strong_up","Strong · haut"],["strong_down","Strong · bas"],["strong_air","Strong · air"],["win","Victoire"]]],
    ["Jutsu", [["rasengan","Rasengan"],["kage_bunshin","Kage Bunshin"],["rasen_shuriken","Rasen-Shuriken"],["kyuubi_3t","Kyūbi · 3 queues"]]],
    ["Mode Ermite", [["frog_idle","Ermite · idle"],["frog_move","Ermite · course"]]],
    ["États", [["hurt","Touché"],["hurt_heavy","Touché fort"],["knockdown","Chute (K.O.)"],["downed","Au sol"],["getup","Se relève"]]]
  ];

  var meta=null, img=null, cur="idle", frame=0, acc=0, last=0, playing=true, speed=1;
  var showFx=false, showGrid=true, fxFrame=0, fxAcc=0;

  var charSel=document.getElementById("charSel");
  var animList=document.getElementById("animList");
  var elCount=document.getElementById("count");
  var elName=document.getElementById("curName");
  var elInfo=document.getElementById("curInfo");

  // ---- sélecteur perso ----
  Object.keys(CHARS).forEach(function(k){
    var o=document.createElement("option"); o.value=k; o.textContent=CHARS[k].name||k; charSel.appendChild(o);
  });
  charSel.addEventListener("change", function(){ loadChar(charSel.value); });

  function buildList(){
    animList.innerHTML="";
    var anims=meta.anims, n=0;
    GROUPS.forEach(function(g){
      var present=g[1].filter(function(e){return anims[e[0]] && (anims[e[0]].frames||[]).length;});
      if(!present.length) return;
      var h=document.createElement("div"); h.className="grp"; h.textContent=g[0]; animList.appendChild(h);
      present.forEach(function(e){
        n++;
        var b=document.createElement("button"); b.className="anim"; b.dataset.k=e[0];
        b.innerHTML="<span>"+e[1]+"</span><span class='n'>"+(anims[e[0]].frames.length)+"f</span>";
        b.addEventListener("click", function(){ setAnim(e[0]); });
        animList.appendChild(b);
      });
    });
    elCount.textContent=n;
    highlight();
  }
  function highlight(){
    [].forEach.call(animList.querySelectorAll(".anim"), function(b){
      b.classList.toggle("active", b.dataset.k===cur);
    });
  }

  function setAnim(k){ cur=k; frame=0; acc=0; fxFrame=0; fxAcc=0; highlight(); updateHud(); }

  function loadChar(key){
    meta=CHARS[key];
    img=new Image();
    img.onload=function(){ buildList(); if(!meta.anims[cur]) cur="idle"; setAnim(meta.anims.idle?"idle":Object.keys(meta.anims)[0]); };
    img.onerror=function(){ elName.textContent="Erreur"; elInfo.textContent="planche introuvable: "+meta.sheet; };
    img.src=meta.sheet;
  }

  function updateHud(){
    var a=meta.anims[cur]||{frames:[]};
    elName.textContent=cur;
    elInfo.textContent="frame "+(frame+1)+"/"+(a.frames.length||1)+" · "+(a.fps||12)+" fps"+(a.loop?" · boucle":"");
  }

  // ---- rendu ----
  function drawGrid(){
    var w=cv.width, h=cv.height, s=20;
    for(var y=0;y<h;y+=s){ for(var x=0;x<w;x+=s){
      ctx.fillStyle=((x/s+y/s)&1)?"#141a22":"#10151c"; ctx.fillRect(x,y,s,s);
    }}
    // sol
    var gy=groundY();
    ctx.strokeStyle="rgba(255,122,47,.5)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,gy+0.5); ctx.lineTo(w,gy+0.5); ctx.stroke();
    // axe central
    ctx.strokeStyle="rgba(63,182,255,.25)";
    ctx.beginPath(); ctx.moveTo(w/2+0.5,0); ctx.lineTo(w/2+0.5,h); ctx.stroke();
  }
  function groundY(){ return cv.height-70; }

  function drawFrame(fr, cx, K){
    var r=fr.r, ax=fr.ax==null?r[2]/2:fr.ax;
    var dw=r[2]*K, dh=r[3]*K;
    var dx=cx-ax*K, dy=groundY()-dh;
    // ombre
    ctx.save();
    ctx.fillStyle="rgba(0,0,0,.28)";
    ctx.beginPath(); ctx.ellipse(cx, groundY()+3, Math.max(14,dw*0.32), 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.drawImage(img, r[0],r[1],r[2],r[3], dx,dy,dw,dh);
  }

  function render(ts){
    requestAnimationFrame(render);
    if(!meta||!img||!img.complete){ return; }
    var a=meta.anims[cur]; if(!a||!a.frames.length){ return; }
    var dt = last?ts-last:16; last=ts;
    var K = (meta.scaleTo||150)/(meta.refH||63);

    if(playing){
      acc+=dt; var step=1000/((a.fps||12)*speed);
      while(acc>=step){ acc-=step; frame=(frame+1)%a.frames.length; if(frame===0) updateHud(); else updateHud(); }
    }

    ctx.clearRect(0,0,cv.width,cv.height);
    if(showGrid) drawGrid(); else { ctx.fillStyle="#10151c"; ctx.fillRect(0,0,cv.width,cv.height); }

    var cx=cv.width/2;
    drawFrame(a.frames[frame], cx, K);

    // effet (optionnel) : joué à côté du perso
    if(showFx && a.fx && a.fx.length){
      fxAcc+=dt; if(fxAcc>=1000/14){ fxAcc=0; fxFrame=(fxFrame+1)%a.fx.length; }
      var f=a.fx[fxFrame], fw=f.r[2]*K, fh=f.r[3]*K;
      ctx.globalAlpha=0.95;
      ctx.drawImage(img, f.r[0],f.r[1],f.r[2],f.r[3], cx+40, groundY()-fh-20, fw, fh);
      ctx.globalAlpha=1;
    }
  }
  requestAnimationFrame(render);

  // ---- contrôles ----
  var playBtn=document.getElementById("playBtn");
  playBtn.addEventListener("click", function(){
    playing=!playing; playBtn.textContent = playing?"⏸ Pause":"▶ Lecture";
  });
  document.getElementById("prevBtn").addEventListener("click", function(){
    playing=false; playBtn.textContent="▶ Lecture";
    var a=meta.anims[cur]; frame=(frame-1+a.frames.length)%a.frames.length; updateHud();
  });
  document.getElementById("nextBtn").addEventListener("click", function(){
    playing=false; playBtn.textContent="▶ Lecture";
    var a=meta.anims[cur]; frame=(frame+1)%a.frames.length; updateHud();
  });
  var sp=document.getElementById("speed"), spv=document.getElementById("speedVal");
  sp.addEventListener("input", function(){ speed=parseFloat(sp.value); spv.textContent=speed+"×"; });
  document.getElementById("fxChk").addEventListener("change", function(e){ showFx=e.target.checked; });
  document.getElementById("gridChk").addEventListener("change", function(e){ showGrid=e.target.checked; });

  // clavier : espace = play/pause, flèches = frames
  window.addEventListener("keydown", function(e){
    if(e.code==="Space"){ e.preventDefault(); playBtn.click(); }
    else if(e.code==="ArrowRight"){ document.getElementById("nextBtn").click(); }
    else if(e.code==="ArrowLeft"){ document.getElementById("prevBtn").click(); }
  });

  // go
  var first=Object.keys(CHARS)[0];
  if(first){ charSel.value=first; loadChar(first); }
  else { elName.textContent="Aucune donnée"; }
})();
