/* Konoha Vivant - atelier d'animations.
   Lit les donnees decoupees des planches (window.KV_CHARS) et joue chaque
   animation, ancree par les pieds. Marche en double-clic (file://) et dans Electron. */
(function(){
  "use strict";
  var CHARS = window.KV_CHARS || {};
  var cv = document.getElementById("cv");
  var ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  var GROUPS = [
    ["Base", [["intro","Introduction"],["idle","Idle"],["run","Course"],["dash","Dash"],["jump","Saut"],["guard","Garde"]]],
    ["Combat", [["attack","Combo sol"],["attack_air","Combo air"],["strong","Strong"],["strong_fwd","Strong avant"],["strong_up","Strong haut"],["strong_down","Strong bas"],["strong_air","Strong air"],["win","Victoire"]]],
    ["Jutsu", [["rasengan","Rasengan"],["oodama_rasengan","Oodama Rasengan"],["rising_rasengan","Rising Rasengan"],["rising_oodama","Rising Oodama"],["kage_bunshin","Kage Bunshin"],["rasen_shuriken","Rasen-Shuriken"]]],
    ["Kyubi / Secret", [["kyuubi_3t","Kyubi 3 queues"],["kyuubi_4t","Kyubi 4 queues"],["ryujinki","Ryujinki"],["ryujin_rasengan","Ryujin Rasengan"]]],
    ["Mode Ermite", [["frog_idle","Ermite idle"],["frog_move","Ermite course"],["frog_hurt","Ermite touche"]]],
    ["Degats / K.O.", [["hurt_light","Touche leger"],["hurt_special","Touche special"],["hurt_h1","Touche fort 1"],["hurt_h2","Touche fort 2"],["hurt_h3","Touche fort 3"],["knockdown","Chute K.O."],["downed","Au sol"],["getup","Se releve"]]]
  ];

  var meta=null, img=null, cur="idle";
  var frame=0, dir=1, holdT=0, acc=0, last=0, playing=true, speed=1;
  var showFx=false, showGrid=true, fxFrame=0, fxAcc=0;

  var charSel=document.getElementById("charSel");
  var animList=document.getElementById("animList");
  var elCount=document.getElementById("count");
  var elName=document.getElementById("curName");
  var elInfo=document.getElementById("curInfo");

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
  function setAnim(k){ cur=k; frame=0; dir=1; holdT=0; acc=0; fxFrame=0; fxAcc=0; highlight(); updateHud(); }

  function loadChar(key){
    meta=CHARS[key];
    img=new Image();
    img.onload=function(){ buildList(); if(!meta.anims[cur]) cur="idle"; setAnim(meta.anims.idle?"idle":Object.keys(meta.anims)[0]); };
    img.onerror=function(){ elName.textContent="Erreur"; elInfo.textContent="planche introuvable: "+meta.sheet; };
    img.src=meta.sheet;
  }

  function updateHud(){
    var a=meta.anims[cur]||{frames:[]};
    var tags=[]; if(a.yoyo)tags.push("aller-retour"); else if(a.loop&&!a.holdMs)tags.push("boucle"); if(a.holdMs)tags.push("pose tenue");
    elName.textContent=cur;
    elInfo.textContent="frame "+(Math.min(frame,a.frames.length-1)+1)+"/"+(a.frames.length||1)+" - "+(a.fps||8)+" fps"+(tags.length?" - "+tags.join(", "):"");
  }

  function groundY(){ return cv.height-70; }
  function drawGrid(){
    var w=cv.width,h=cv.height,s=20;
    for(var y=0;y<h;y+=s){ for(var x=0;x<w;x+=s){
      ctx.fillStyle=((x/s+y/s)&1)?"#141a22":"#10151c"; ctx.fillRect(x,y,s,s);
    }}
    ctx.strokeStyle="rgba(255,122,47,.5)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,groundY()+0.5); ctx.lineTo(w,groundY()+0.5); ctx.stroke();
    ctx.strokeStyle="rgba(63,182,255,.22)";
    ctx.beginPath(); ctx.moveTo(w/2+0.5,0); ctx.lineTo(w/2+0.5,h); ctx.stroke();
  }
  function drawSprite(fr,cx,K){
    var r=fr.r, ax=(fr.ax==null?r[2]/2:fr.ax);
    var dw=r[2]*K, dh=r[3]*K, dx=cx-ax*K, dy=groundY()-dh;
    ctx.save(); ctx.fillStyle="rgba(0,0,0,.28)";
    ctx.beginPath(); ctx.ellipse(cx, groundY()+3, Math.max(14,dw*0.32), 6, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
    ctx.drawImage(img, r[0],r[1],r[2],r[3], dx,dy,dw,dh);
  }

  function step(a,dt){
    var n=a.frames.length; if(n<=1) return;
    if(holdT>0){ holdT-=dt; if(holdT<=0){ frame=0; dir=1; } return; }
    acc+=dt; var st=1000/((a.fps||8)*Math.max(0.1,speed));
    while(acc>=st && holdT<=0){
      acc-=st;
      if(a.yoyo){
        frame+=dir;
        if(frame>=n-1){ frame=n-1; dir=-1; }
        else if(frame<=0){ frame=0; dir=1; }
      } else {
        if(frame>=n-1){ if(a.holdMs){ holdT=a.holdMs; } else { frame=0; } }
        else frame++;
      }
    }
  }

  function render(ts){
    requestAnimationFrame(render);
    if(!meta||!img||!img.complete) return;
    var a=meta.anims[cur]; if(!a||!a.frames.length) return;
    var dt=last?ts-last:16; last=ts;
    var K=(meta.scaleTo||160)/(meta.refH||63);
    if(playing){ var pf=frame; step(a,dt); if(pf!==frame) updateHud(); }

    ctx.clearRect(0,0,cv.width,cv.height);
    if(showGrid) drawGrid(); else { ctx.fillStyle="#10151c"; ctx.fillRect(0,0,cv.width,cv.height); }
    var cx=cv.width/2;
    drawSprite(a.frames[Math.min(frame,a.frames.length-1)], cx, K);

    if(showFx && a.fx && a.fx.length){
      fxAcc+=dt; if(fxAcc>=1000/12){ fxAcc=0; fxFrame=(fxFrame+1)%a.fx.length; }
      var f=a.fx[fxFrame], fw=f.r[2]*K, fh=f.r[3]*K;
      ctx.drawImage(img, f.r[0],f.r[1],f.r[2],f.r[3], cx+30, groundY()-fh-24, fw, fh);
    }
  }
  requestAnimationFrame(render);

  var playBtn=document.getElementById("playBtn");
  playBtn.addEventListener("click", function(){ playing=!playing; playBtn.textContent=playing?"⏸ Pause":"▶ Lecture"; });
  document.getElementById("prevBtn").addEventListener("click", function(){
    playing=false; playBtn.textContent="▶ Lecture"; holdT=0;
    var a=meta.anims[cur]; frame=(frame-1+a.frames.length)%a.frames.length; updateHud();
  });
  document.getElementById("nextBtn").addEventListener("click", function(){
    playing=false; playBtn.textContent="▶ Lecture"; holdT=0;
    var a=meta.anims[cur]; frame=(frame+1)%a.frames.length; updateHud();
  });
  var sp=document.getElementById("speed"), spv=document.getElementById("speedVal");
  sp.addEventListener("input", function(){ speed=parseFloat(sp.value); spv.textContent=speed+"×"; });
  document.getElementById("fxChk").addEventListener("change", function(e){ showFx=e.target.checked; });
  document.getElementById("gridChk").addEventListener("change", function(e){ showGrid=e.target.checked; });
  window.addEventListener("keydown", function(e){
    if(e.code==="Space"){ e.preventDefault(); playBtn.click(); }
    else if(e.code==="ArrowRight"){ document.getElementById("nextBtn").click(); }
    else if(e.code==="ArrowLeft"){ document.getElementById("prevBtn").click(); }
  });

  var first=Object.keys(CHARS)[0];
  if(first){ charSel.value=first; loadChar(first); } else { elName.textContent="Aucune donnee"; }
})();
