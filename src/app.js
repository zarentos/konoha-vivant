/* Konoha Vivant — atelier d'animations (v2).
   Lit window.KV_CHARS, joue chaque animation ancrée par les pieds, et anime
   les effets (fx) rattachés aux jutsu : phases fxCreate / fxAttack / fxEnd,
   orbe piloté frame par frame quand la donnée le fournit (champ "orb").
   Color-key au runtime (key/keyTol). Double-clic (file://) ou Electron. */
(function () {
  "use strict";
  var CHARS = window.KV_CHARS || {};
  var cv = document.getElementById("cv");
  var ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  var GROUPS = [
    ["Base", ["intro","idle","run","dash","jump","guard"]],
    ["Combat", ["attack","attack_air","strong","strong_fwd","strong_up","strong_down","strong_air","strong_dash","win"]],
    ["Degats / K.O.", ["hurt_light","hurt_special","hurt_h1","hurt_h2","hurt_h3","knockdown","downed","getup"]],
    ["Mode crapaud", ["frog_idle","frog_move","frog_hurt"]]
  ];
  var BASE_SET = {};
  GROUPS.forEach(function (g){ g[1].forEach(function(k){ BASE_SET[k]=1; }); });

  var meta=null, img=null, imgKeyed=null, cur="idle";
  var frame=0, holdT=0, acc=0, last=0, playing=true, speed=1;
  var showFx=true, showGrid=true;

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
    animList.innerHTML=""; var anims=meta.anims, n=0;
    function row(key,label){
      var a=anims[key]; if(!a||!(a.frames||[]).length) return; n++;
      var b=document.createElement("button"); b.className="anim"; b.dataset.k=key;
      var fx=a.fx?" <span class='n' style='color:#6c6'>+fx</span>":"";
      b.innerHTML="<span>"+label+"</span><span class='n'>"+a.frames.length+"f</span>"+fx;
      b.addEventListener("click", function(){ setAnim(key); });
      animList.appendChild(b);
    }
    function header(t){ var h=document.createElement("div"); h.className="grp"; h.textContent=t; animList.appendChild(h); }
    GROUPS.forEach(function(g){
      var present=g[1].filter(function(k){return anims[k]&&(anims[k].frames||[]).length;});
      if(!present.length) return; header(g[0]); present.forEach(function(k){ row(k,k); });
    });
    var extra=Object.keys(anims).filter(function(k){return !BASE_SET[k];});
    if(extra.length){ header("Techniques"); extra.forEach(function(k){ row(k,k); }); }
    elCount.textContent=n; highlight();
  }
  function highlight(){ [].forEach.call(animList.querySelectorAll(".anim"), function(b){ b.classList.toggle("active", b.dataset.k===cur); }); }
  function setAnim(k){ cur=k; frame=0; holdT=0; acc=0; highlight(); updateHud(); }

  function keyImage(image,key,tol){
    var c=document.createElement("canvas"); c.width=image.naturalWidth; c.height=image.naturalHeight;
    var g=c.getContext("2d"); g.drawImage(image,0,0);
    var d=g.getImageData(0,0,c.width,c.height), p=d.data;
    for(var i=0;i<p.length;i+=4){
      if(Math.abs(p[i]-key[0])+Math.abs(p[i+1]-key[1])+Math.abs(p[i+2]-key[2])<=tol) p[i+3]=0;
    }
    g.putImageData(d,0,0); return c;
  }

  function loadChar(key){
    meta=CHARS[key];
    var im=new Image();
    im.onload=function(){
      img=im; imgKeyed=im;               // planches deja detourees (fond transparent)
      if(meta.key){                       // repli : color-key seulement si autorise (echoue en file://)
        try { imgKeyed=keyImage(im,meta.key,meta.keyTol||60); } catch(e){ imgKeyed=im; }
      }
      cur=meta.anims.idle?"idle":Object.keys(meta.anims)[0];
      frame=0; holdT=0; acc=0; buildList(); updateHud();
    };
    im.onerror=function(){ console.error("planche introuvable:", im.src); };
    im.src=meta.sheet.replace(/^\.\.\//,"../");
  }
  function curAnim(){ return meta.anims[cur]; }
  function updateHud(){
    var a=curAnim(); if(!a) return;
    elName.textContent=(meta.name||"")+" · "+cur;
    elInfo.textContent="frame "+(frame+1)+"/"+a.frames.length+" · "+(a.fps||8)+" fps"+(a.fx?" · fx "+a.fx.length:"");
  }

  var SCALE=2.4;
  function groundY(){ return cv.height-46; }
  function centerX(){ return cv.width*0.5; }
  function drawSprite(src,r,ox,oy){ ctx.drawImage(src,r[0],r[1],r[2],r[3],Math.round(ox),Math.round(oy),r[2]*SCALE,r[3]*SCALE); }

  function currentFxIndex(a){
    var nB=a.frames.length, phase;
    if(a.fxCreate){
      var t=frame/Math.max(1,nB-1);
      if(t<0.34) phase=a.fxCreate; else if(t<0.7) phase=a.fxAttack||a.fxCreate; else phase=a.fxEnd||a.fxAttack||a.fxCreate;
    } else { phase=a.fx.map(function(_,i){return i;}); }
    var k=Math.floor((frame/Math.max(1,nB))*phase.length*1.6)%phase.length;
    return phase[k];
  }

  function render(){
    ctx.clearRect(0,0,cv.width,cv.height);
    if(showGrid){
      ctx.strokeStyle="rgba(120,80,160,.25)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,groundY()+.5); ctx.lineTo(cv.width,groundY()+.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(centerX()+.5,0); ctx.lineTo(centerX()+.5,cv.height); ctx.stroke();
    }
    var a=curAnim(); if(!a||!imgKeyed) return;
    var f=a.frames[frame]; if(!f) return;
    var r=f.r, ax=(f.ax!=null?f.ax:r[2]/2);
    var ox=centerX()-ax*SCALE, oy=groundY()-r[3]*SCALE;
    var behind=false;
    if(a.fxCreate){ behind=(frame/Math.max(1,a.frames.length-1))<0.34; }
    function drawFxNow(){
      if(!showFx||!a.fx) return;
      var fx=a.fx[currentFxIndex(a)]; if(!fx) return; var fr=fx.r;
      var hx=(f.hx!=null?f.hx:r[2]*0.72), hy=(f.hy!=null?f.hy:r[3]*0.42);
      var fax=(fx.ax!=null?fx.ax:fr[2]/2), fxOx, fxOy;
      if(f.orb){ fxOx=ox+f.orb[0]*SCALE-fax*SCALE; fxOy=oy+f.orb[1]*SCALE-fr[3]*SCALE*0.5; }
      else { fxOx=ox+hx*SCALE-fax*SCALE; fxOy=oy+hy*SCALE-fr[3]*SCALE*0.5; }
      drawSprite(imgKeyed,fr,fxOx,fxOy);
    }
    if(behind) drawFxNow();
    drawSprite(imgKeyed,r,ox,oy);
    if(!behind) drawFxNow();
  }

  function advance(a){
    var n=a.frames.length;
    if(a.loop===false){
      if(frame<n-1){ frame++; } else { holdT++; if(holdT>(a.holdMs?a.holdMs/120:12)){ holdT=0; frame=0; } }
    } else { frame=(frame+1)%n; }
    updateHud();
  }
  function tick(ts){
    if(!last) last=ts; var dt=(ts-last)/1000; last=ts; var a=curAnim();
    if(a&&playing){ var fps=(a.fps||8)*speed; acc+=dt; var step=1/fps; while(acc>=step){ acc-=step; advance(a); } }
    render(); requestAnimationFrame(tick);
  }

  document.getElementById("playBtn").addEventListener("click", function(){ playing=!playing; this.textContent=playing?"⏸ Pause":"▶ Lecture"; });
  document.getElementById("prevBtn").addEventListener("click", function(){ var a=curAnim(); if(!a)return; playing=false; document.getElementById("playBtn").textContent="▶ Lecture"; frame=(frame-1+a.frames.length)%a.frames.length; updateHud(); });
  document.getElementById("nextBtn").addEventListener("click", function(){ var a=curAnim(); if(!a)return; playing=false; document.getElementById("playBtn").textContent="▶ Lecture"; frame=(frame+1)%a.frames.length; updateHud(); });
  var sp=document.getElementById("speed"), spv=document.getElementById("speedVal");
  sp.addEventListener("input", function(){ speed=parseFloat(sp.value); spv.textContent=speed+"×"; });
  var fxc=document.getElementById("fxChk"); if(fxc){ fxc.checked=true; fxc.addEventListener("change", function(){ showFx=fxc.checked; }); }
  var gc=document.getElementById("gridChk"); if(gc) gc.addEventListener("change", function(){ showGrid=gc.checked; });

  if(Object.keys(CHARS).length){ charSel.value=Object.keys(CHARS)[0]; loadChar(charSel.value); }
  requestAnimationFrame(tick);
})();
