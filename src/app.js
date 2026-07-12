/* Konoha Vivant — atelier d'animations (v4).
   Effets : orbe precise par frame (orb+ofx, ex. Naruto) OU placement auto dans
   la main avant + phases (create/attack/end) pour les persos sans orb.
   Modes proj (projectile qui part devant) et clones (aux pieds).
   Effet toujours DEVANT le corps. Planches detourees. Double-clic ou Electron. */
(function () {
  "use strict";
  var CHARS = window.KV_CHARS || {};
  var cv = document.getElementById("cv"), ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  var GROUPS = [
    ["Base", ["intro","idle","run","dash","jump","guard"]],
    ["Combat", ["attack","attack_air","strong","strong_fwd","strong_up","strong_down","strong_air","strong_dash","win"]],
    ["Degats / K.O.", ["hurt","hurt_light","hurt_special","hurt_h1","hurt_h2","hurt_h3","knockdown","downed","getup"]],
    ["Mode crapaud", ["frog_idle","frog_move","frog_hurt"]]
  ];
  var BASE_SET = {}; GROUPS.forEach(function (g){ g[1].forEach(function(k){ BASE_SET[k]=1; }); });

  var meta=null, img=null, cur="idle";
  var frame=0, holdT=0, acc=0, last=0, playing=true, speed=1, showFx=true, showGrid=true;
  var projectiles=[];

  var charSel=document.getElementById("charSel"), animList=document.getElementById("animList");
  var elCount=document.getElementById("count"), elName=document.getElementById("curName"), elInfo=document.getElementById("curInfo");

  Object.keys(CHARS).forEach(function(k){ var o=document.createElement("option"); o.value=k; o.textContent=CHARS[k].name||k; charSel.appendChild(o); });
  charSel.addEventListener("change", function(){ loadChar(charSel.value); });

  function buildList(){
    animList.innerHTML=""; var anims=meta.anims, n=0;
    function row(key){
      var a=anims[key]; if(!a||!(a.frames||[]).length) return; n++;
      var b=document.createElement("button"); b.className="anim"; b.dataset.k=key;
      var tag=a.proj?"<span class='n' style='color:#e88'>proj</span>":(a.clones?"<span class='n' style='color:#8ae'>clones</span>":(a.fx?"<span class='n' style='color:#6c6'>+fx</span>":""));
      b.innerHTML="<span>"+key+"</span><span class='n'>"+a.frames.length+"f</span> "+tag;
      b.addEventListener("click", function(){ setAnim(key); }); animList.appendChild(b);
    }
    function header(t){ var h=document.createElement("div"); h.className="grp"; h.textContent=t; animList.appendChild(h); }
    GROUPS.forEach(function(g){ var p=g[1].filter(function(k){return anims[k]&&(anims[k].frames||[]).length;}); if(!p.length)return; header(g[0]); p.forEach(row); });
    var extra=Object.keys(anims).filter(function(k){return !BASE_SET[k] && k.indexOf("unused")!==0;});
    if(extra.length){ header("Techniques"); extra.forEach(row); }
    elCount.textContent=n; highlight();
  }
  function highlight(){ [].forEach.call(animList.querySelectorAll(".anim"), function(b){ b.classList.toggle("active", b.dataset.k===cur); }); }
  function setAnim(k){ cur=k; frame=0; holdT=0; acc=0; projectiles=[]; highlight(); updateHud(); }

  function loadChar(key){
    meta=CHARS[key]; var im=new Image();
    im.onload=function(){ img=im; cur=meta.anims.idle?"idle":Object.keys(meta.anims)[0]; frame=0; holdT=0; acc=0; projectiles=[]; buildList(); updateHud(); };
    im.onerror=function(){ console.error("planche introuvable:", im.src); };
    im.src=meta.sheet.replace(/^\.\.\//,"../");
  }
  function curAnim(){ return meta.anims[cur]; }
  function updateHud(){ var a=curAnim(); if(!a)return; elName.textContent=(meta.name||"")+" · "+cur; elInfo.textContent="frame "+(frame+1)+"/"+a.frames.length+" · "+(a.fps||8)+" fps"+(a.fx?" · fx "+a.fx.length:""); }

  var SCALE=2.4;
  function groundY(){ return cv.height-46; }
  function centerX(){ return cv.width*0.5; }
  function drawFxByIndex(a, fxIdx, wx, wy, scale, alpha){
    var fx=a.fx; if(!fx||!fx.length||fxIdx<0) return;
    var f=fx[Math.min(fxIdx,fx.length-1)], r=f.r, w=r[2]*SCALE*scale, h=r[3]*SCALE*scale;
    ctx.save(); ctx.globalAlpha=(alpha==null?1:alpha);
    ctx.drawImage(img, r[0],r[1],r[2],r[3], wx-w/2, wy-h/2, w, h); ctx.restore();
  }
  // choisit la frame d'effet selon la progression du corps (phases si presentes)
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

  function render(){
    ctx.clearRect(0,0,cv.width,cv.height);
    if(showGrid){
      ctx.strokeStyle="rgba(120,80,160,.25)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,groundY()+.5); ctx.lineTo(cv.width,groundY()+.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(centerX()+.5,0); ctx.lineTo(centerX()+.5,cv.height); ctx.stroke();
    }
    var a=curAnim(); if(!a||!img) return;
    var n=a.frames.length, f=a.frames[frame]; if(!f) return;
    var r=f.r, ax=(f.ax!=null?f.ax:r[2]/2), t=frame/Math.max(1,n-1);
    var ox=centerX()-ax*SCALE, oy=groundY()-r[3]*SCALE, big=(cur.indexOf("oodama")>=0);

    // corps
    ctx.drawImage(img, r[0],r[1],r[2],r[3], Math.round(ox), Math.round(oy), r[2]*SCALE, r[3]*SCALE);

    // effets DEVANT
    if(showFx && a.fx && a.fx.length){
      if(a.clones){
        var ci=phaseFxIndex(a,t);
        drawFxByIndex(a, ci, centerX()-95, groundY()-14, 1, 1);
        drawFxByIndex(a, ci, centerX()+95, groundY()-14, 1, 1);
      } else {
        var hasOrb=(f.orb!=null && f.ofx!=null && f.ofx>=0);
        var fxIdx, wx, wy;
        if(hasOrb){ fxIdx=f.ofx; wx=centerX()+(f.orb[0]-ax)*SCALE; wy=groundY()-(r[3]-f.orb[1])*SCALE; }
        else { fxIdx=phaseFxIndex(a,t); wx=centerX()+((r[2]-6)-ax)*SCALE; wy=groundY()-(r[3]*0.58)*SCALE; }
        // lancer le projectile
        var launch = a.proj && !projectiles.length &&
          (a.launchFrame!=null ? frame>=a.launchFrame
           : hasOrb ? (a.fxAttack && a.fxAttack.indexOf(f.ofx)>=0)
           : frame>=Math.floor(n*0.6));
        if(launch) projectiles.push({x:wx,y:wy,vx:640,t:0});
        // dessine en main sauf si projectile deja parti
        if(!(a.proj && projectiles.length) && (hasOrb ? true : (frame>0)))
          drawFxByIndex(a, fxIdx, wx, wy, big?1.5:1, 1);
      }
    }
    for(var i=0;i<projectiles.length;i++){
      var p=projectiles[i], att=(a.fxAttack&&a.fxAttack.length)?a.fxAttack:[phaseFxIndex(a,0.5)];
      drawFxByIndex(a, att[Math.floor(p.t/60)%att.length], p.x, p.y, big?1.5:1, 1);
    }
  }

  function advance(a){
    var n=a.frames.length;
    if(a.loop===false){ if(frame<n-1){ frame++; } else { holdT++; if(holdT>(a.holdMs?a.holdMs/120:14)){ holdT=0; frame=0; projectiles=[]; } } }
    else { frame=(frame+1)%n; if(frame===0) projectiles=[]; }
    updateHud();
  }
  function tick(ts){
    if(!last) last=ts; var dt=(ts-last)/1000; last=ts; var a=curAnim();
    if(a&&playing){ var fps=(a.fps||8)*speed; acc+=dt; var step=1/fps; while(acc>=step){ acc-=step; advance(a); } }
    for(var i=projectiles.length-1;i>=0;i--){ var p=projectiles[i]; p.t+=dt*1000; p.x+=p.vx*dt; if(p.x>cv.width+80) projectiles.splice(i,1); }
    render(); requestAnimationFrame(tick);
  }

  document.getElementById("playBtn").addEventListener("click", function(){ playing=!playing; this.textContent=playing?"⏸ Pause":"▶ Lecture"; });
  document.getElementById("prevBtn").addEventListener("click", function(){ var a=curAnim(); if(!a)return; playing=false; document.getElementById("playBtn").textContent="▶ Lecture"; frame=(frame-1+a.frames.length)%a.frames.length; projectiles=[]; updateHud(); });
  document.getElementById("nextBtn").addEventListener("click", function(){ var a=curAnim(); if(!a)return; playing=false; document.getElementById("playBtn").textContent="▶ Lecture"; frame=(frame+1)%a.frames.length; updateHud(); });
  var sp=document.getElementById("speed"), spv=document.getElementById("speedVal");
  sp.addEventListener("input", function(){ speed=parseFloat(sp.value); spv.textContent=speed+"×"; });
  var fxc=document.getElementById("fxChk"); if(fxc){ fxc.checked=true; fxc.addEventListener("change", function(){ showFx=fxc.checked; }); }
  var gc=document.getElementById("gridChk"); if(gc) gc.addEventListener("change", function(){ showGrid=gc.checked; });

  if(Object.keys(CHARS).length){ charSel.value=Object.keys(CHARS)[0]; loadChar(charSel.value); }
  requestAnimationFrame(tick);
})();
