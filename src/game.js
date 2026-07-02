/* Konoha Vivant - moteur (persos autonomes).
   Naruto vit tout seul (IA a venir : comportement scripte pour l'instant).
   Clique un ninja pour le controler. Marche en double-clic (file://) et Electron. */
(function(){
  "use strict";
  var CH=(window.KV_CHARS||{}).naruto;
  var cv=document.getElementById("game"), ctx=cv.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  var W=cv.width, H=cv.height, GROUND=Math.round(H*0.84);
  var K=(CH.scaleTo||115)/(CH.refH||63);

  // planche perso
  var img=new Image(), ready=false;
  img.onload=function(){ready=true;}; img.onerror=function(){ready="err";}; img.src=CH.sheet;
  // decors
  var DECOR_DIR="../assets/backgrounds/";
  var decorImg=new Image(), decorReady=false;
  function loadDecor(name){ decorReady=false; decorImg=new Image();
    decorImg.onload=function(){decorReady=true;}; decorImg.src=(DECOR_DIR+name).replace(/ /g,"%20"); }
  loadDecor("Training Field.png");
  var dsel=document.getElementById("decor");
  if(dsel) dsel.addEventListener("change",function(){ loadDecor(dsel.value); });

  var RUN_A=115, RUN_P=210, DASH=560, JUMP=520, GRAV=1550;
  function rand(a,b){return a+Math.random()*(b-a);}
  function pick(a){return a[Math.floor(Math.random()*a.length)];}
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}
  function A(n){return CH.anims[n];}
  function has(n){return A(n)&&A(n).frames&&A(n).frames.length;}
  function hasFx(n){return A(n)&&A(n).fx&&A(n).fx.length;}
  function durOf(n,extra){var a=A(n);return (a.frames.length/(a.fps||8))*1000+(extra||0);}

  var JUTSU={
    rasengan:{anim:"rasengan",fx:"rasengan",mode:"attach"},
    rising_rasengan:{anim:"rising_rasengan",fx:"rising_rasengan",mode:"attach"},
    ryujin_rasengan:{anim:"ryujin_rasengan",fx:"ryujin_rasengan",mode:"attach"},
    rasen_shuriken:{anim:"rasen_shuriken",fx:"rasen_shuriken",mode:"proj"},
    kage_bunshin:{anim:"kage_bunshin",mode:"clones"},
    kyuubi_3t:{anim:"kyuubi_3t",mode:"transform"},
    attack:{anim:"attack",mode:"melee"},
    strong:{anim:"strong",mode:"melee"}
  };
  var AUTO_MOVES=["rasengan","rasengan","rasen_shuriken","kage_bunshin","attack","strong","rising_rasengan","kyuubi_3t"];

  var chars=[], fxList=[], puffs=[], possessed=null;

  function Char(x){
    this.x=x; this.y=GROUND; this.vx=0; this.vy=0; this.facing=Math.random()<0.5?1:-1; this.onGround=true;
    this.anim="idle"; this.frame=0; this.ft=0; this.dir=1; this.hold=0;
    this.lock=false; this.actAnim=null; this.actT=0; this.actDur=0;
    this.dashT=0; this.brainT=rand(300,1600); this.walkT=0; this.walkDir=0; this.pending=null;
    this.possessed=false;
  }
  Char.prototype.setFree=function(a){ if(this.anim!==a){this.anim=a;this.frame=0;this.ft=0;this.dir=1;this.hold=0;} };
  Char.prototype.startAction=function(anim,extra){ this.lock=true;this.actAnim=anim;this.actT=0;this.actDur=durOf(anim,extra);this.frame=0;this.anim=anim; };
  Char.prototype.cast=function(name){
    var J=JUTSU[name]; if(!J)return;
    var anim=J.anim, fx=J.fx||name, big=false;
    if(name==="rasengan" && Math.random()<0.2 && has("oodama_rasengan")){ anim="oodama_rasengan"; fx="oodama_rasengan"; big=true; } // Oodama = variante rare
    if(!has(anim))return;
    this.startAction(anim, J.mode==="transform"?400:120);
    if(J.mode==="attach") fxList.push({owner:this,fx:(hasFx(fx)?fx:"rasengan"),big:big,t:0,dur:this.actDur,diss:420});
    else if(J.mode==="proj"){ fxList.push({owner:this,fx:fx,big:false,t:0,dur:this.actDur,diss:0}); this.pending="proj_"+name; }
    else if(J.mode==="clones") this.spawnClones();
  };
  Char.prototype.spawnClones=function(){
    for(var s=-1;s<=1;s+=2){ var cx=clamp(this.x+s*rand(70,120),50,W-50);
      puffs.push({x:cx,y:GROUND-30*K,t:0,life:520}); }
  };
  Char.prototype.think=function(){
    var r=Math.random();
    if(r<0.42){ this.walkDir=Math.random()<0.5?-1:1; this.facing=this.walkDir; this.walkT=rand(600,1700); this.brainT=this.walkT+rand(200,700); }
    else if(r<0.60){ this.walkDir=0; this.brainT=rand(700,1800); }
    else if(r<0.68 && this.onGround){ this.vy=-JUMP; this.onGround=false; this.walkDir=0; this.brainT=rand(900,1700); }
    else { var m=pick(AUTO_MOVES); if(Math.random()<0.04) m="ryujin_rasengan"; this.cast(m); this.brainT=rand(1400,3000); }
  };
  Char.prototype.handWorld=function(){
    var a=A(this.anim), f=a.frames[Math.min(this.frame,a.frames.length-1)];
    var hx=(f.hx==null?f.r[2]*0.8:f.hx), hy=(f.hy==null?f.r[3]*0.4:f.hy), ax=(f.ax==null?f.r[2]/2:f.ax), h=f.r[3];
    return { x:this.x + this.facing*(hx-ax)*K, y:this.y - (h-hy)*K };
  };
  Char.prototype.stepFree=function(dt){
    var a=A(this.anim); if(!a||a.frames.length<=1)return;
    var n=a.frames.length;
    if(this.hold>0){ this.hold-=dt; if(this.hold<=0){this.frame=0;this.dir=1;} return; }
    this.ft+=dt; var st=1000/(a.fps||8);
    while(this.ft>=st){ this.ft-=st;
      if(a.yoyo){ this.frame+=this.dir; if(this.frame>=n-1){this.frame=n-1;this.dir=-1;} else if(this.frame<=0){this.frame=0;this.dir=1;} }
      else this.frame=(this.frame+1)%n;
    }
  };
  Char.prototype.update=function(dt){
    var s=dt/1000;
    if(this.lock){
      this.actT+=dt; var a=A(this.actAnim), fps=a.fps||8;
      this.frame=Math.min(a.frames.length-1, Math.floor(this.actT/(1000/fps))); this.anim=this.actAnim;
      if(this.onGround) this.vx*=0.8;
      if(this.actT>=this.actDur){
        this.lock=false;
        if(this.pending && this.pending.indexOf("proj_")===0){
          var jn=this.pending.slice(5), J=JUTSU[jn], hp=this.handWorld();
          fxList.push({kind:"proj",fx:J.fx,x:hp.x,y:hp.y,vx:this.facing*620,t:0,life:900});
        }
        this.pending=null;
      }
    } else if(this.possessed){
      if(this.dashT>0){ this.dashT-=dt; if(this.dashT<=0)this.vx*=0.3; }
      else { var mv=0; if(keys["ArrowLeft"]||keys["KeyA"])mv-=1; if(keys["ArrowRight"]||keys["KeyD"])mv+=1;
        if(mv){this.facing=mv;this.vx=mv*RUN_P;} else {this.vx*=0.6; if(Math.abs(this.vx)<6)this.vx=0;} }
    } else {
      // cerveau autonome
      this.brainT-=dt;
      if(this.walkT>0){ this.walkT-=dt; this.vx=this.walkDir*RUN_A; }
      else { this.vx*=0.6; if(Math.abs(this.vx)<6)this.vx=0; }
      if(this.brainT<=0 && this.onGround) this.think();
    }
    // physique
    this.x+=this.vx*s; this.vy+=GRAV*s; this.y+=this.vy*s;
    if(this.y>=GROUND){ this.y=GROUND; this.vy=0; this.onGround=true; } else this.onGround=false;
    if(this.x<40){this.x=40; if(!this.possessed){this.walkDir=1;this.facing=1;}}
    if(this.x>W-40){this.x=W-40; if(!this.possessed){this.walkDir=-1;this.facing=-1;}}
    // anim libre
    if(!this.lock){
      if(!this.onGround) this.setFree("jump");
      else if(this.dashT>0) this.setFree("dash");
      else if(Math.abs(this.vx)>12) this.setFree("run");
      else this.setFree("idle");
      if(this.anim==="jump"){ var jn=A("jump").frames.length; this.frame=this.vy<-60?0:(this.vy>60?Math.min(2,jn-1):Math.min(1,jn-1)); }
      else this.stepFree(dt);
    }
  };
  Char.prototype.draw=function(){
    var a=A(this.anim); if(!a||!a.frames.length)return;
    var f=a.frames[Math.min(this.frame,a.frames.length-1)], r=f.r, ax=(f.ax==null?r[2]/2:f.ax);
    var w=r[2]*K, h=r[3]*K;
    ctx.save();
    ctx.globalAlpha=0.26; ctx.fillStyle="#000";
    ctx.beginPath(); ctx.ellipse(this.x,this.y+2,Math.max(12,w*0.34),5,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    ctx.translate(this.x,0); ctx.scale(this.facing,1);
    ctx.drawImage(img, r[0],r[1],r[2],r[3], -ax*K, this.y-h, w, h);
    ctx.restore();
    if(this.possessed){ ctx.strokeStyle="#3fb6ff"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(this.x-6,this.y-h-8); ctx.lineTo(this.x,this.y-h-2); ctx.lineTo(this.x+6,this.y-h-8); ctx.stroke(); }
  };

  function drawFxFrame(fxName,idx,cx,cy,scale,alpha){
    var fx=A(fxName)&&A(fxName).fx; if(!fx||!fx.length)return;
    var f=fx[Math.min(idx,fx.length-1)], r=f.r, w=r[2]*K*scale, h=r[3]*K*scale;
    ctx.save(); ctx.globalAlpha=(alpha==null?1:alpha);
    ctx.drawImage(img, r[0],r[1],r[2],r[3], cx-w/2, cy-h/2, w, h); ctx.restore();
  }

  // ---- input ----
  var keys={};
  window.addEventListener("keydown",function(e){
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].indexOf(e.code)>=0)e.preventDefault();
    if(!keys[e.code]) onPress(e.code); keys[e.code]=true;
  });
  window.addEventListener("keyup",function(e){keys[e.code]=false;});
  function onPress(code){
    if(!possessed) return;
    var c=possessed; if(c.lock) return;
    switch(code){
      case "ShiftLeft": case "ShiftRight": c.dashT=220; c.vx=c.facing*DASH; break;
      case "Space": if(c.onGround){c.vy=-JUMP;c.onGround=false;} break;
      case "KeyJ": c.startAction(c.onGround?"attack":"attack_air",60); break;
      case "KeyK": c.cast("rasengan"); break;
      case "KeyL": c.cast("rasen_shuriken"); break;
      case "KeyU": c.cast("kage_bunshin"); break;
      case "KeyI": c.cast("kyuubi_3t"); break;
    }
  }
  cv.addEventListener("click",function(e){
    var rect=cv.getBoundingClientRect(), mx=(e.clientX-rect.left)*(W/rect.width), my=(e.clientY-rect.top)*(H/rect.height);
    var hit=null;
    for(var i=chars.length-1;i>=0;i--){ var c=chars[i]; var a=A(c.anim), f=a.frames[Math.min(c.frame,a.frames.length-1)];
      var h=f.r[3]*K, w=f.r[2]*K; if(mx>c.x-w*0.6 && mx<c.x+w*0.6 && my>c.y-h && my<c.y+6){ hit=c; break; } }
    if(possessed){ possessed.possessed=false; }
    if(hit && hit!==possessed){ hit.possessed=true; possessed=hit; } else { possessed=null; }
  });

  // ---- population ----
  function setCount(n){
    n=clamp(n,1,14);
    while(chars.length<n) chars.push(new Char(rand(80,W-80)));
    while(chars.length>n){ var c=chars.pop(); if(c===possessed)possessed=null; }
    document.getElementById("count").textContent=n;
  }
  document.getElementById("plus").addEventListener("click",function(){ setCount(chars.length+1); });
  document.getElementById("minus").addEventListener("click",function(){ setCount(chars.length-1); });
  setCount(1);

  // ---- boucle ----
  function drawDecor(){
    if(decorReady){
      var iw=decorImg.width, ih=decorImg.height, sc=Math.max(W/iw,H/ih);
      var dw=iw*sc, dh=ih*sc; ctx.drawImage(decorImg,(W-dw)/2,H-dh,dw,dh);
      ctx.fillStyle="rgba(10,14,20,.18)"; ctx.fillRect(0,0,W,H);
    } else { ctx.fillStyle="#141b26"; ctx.fillRect(0,0,W,H); }
    ctx.fillStyle="rgba(0,0,0,.22)"; ctx.fillRect(0,GROUND+6,W,H-GROUND);
  }
  var last=0;
  function loop(ts){
    requestAnimationFrame(loop);
    var dt=last?ts-last:16; last=ts; if(dt>60)dt=60;
    if(ready!==true){ ctx.fillStyle="#0d1017";ctx.fillRect(0,0,W,H);
      ctx.fillStyle=ready==="err"?"#ff6b6b":"#8895a7";ctx.font="14px monospace";ctx.textAlign="center";
      ctx.fillText(ready==="err"?("planche introuvable: "+CH.sheet):"chargement...",W/2,H/2);ctx.textAlign="left"; return; }
    var i;
    for(i=0;i<chars.length;i++) chars[i].update(dt);
    for(i=fxList.length-1;i>=0;i--){ var e=fxList[i]; e.t+=dt;
      if(e.kind==="proj"){ e.x+=e.vx*(dt/1000); if(e.t>=e.life||e.x<-60||e.x>W+60) fxList.splice(i,1); }
      else { if(e.t>=e.dur+e.diss) fxList.splice(i,1); } }
    for(i=puffs.length-1;i>=0;i--){ puffs[i].t+=dt; if(puffs[i].t>=puffs[i].life) puffs.splice(i,1); }

    drawDecor();
    chars.sort(function(a,b){return a.y-b.y;});
    for(i=0;i<chars.length;i++) chars[i].draw();
    for(i=0;i<fxList.length;i++){ var ef=fxList[i];
      if(ef.kind==="proj"){ var pl=A(ef.fx).fx.length; drawFxFrame(ef.fx,Math.floor(ef.t/60)%pl,ef.x,ef.y,1,1); }
      else { var fxN=hasFx(ef.fx)?ef.fx:null; if(!fxN)continue; var flen=A(fxN).fx.length;
        var idx=Math.floor(ef.t/55)%flen;
        var al=ef.t<=ef.dur?1:Math.max(0,1-(ef.t-ef.dur)/ef.diss);
        var hp=ef.owner.handWorld(); drawFxFrame(fxN,idx,hp.x,hp.y,ef.big?1.6:1.0,al); } }
    for(i=0;i<puffs.length;i++){ var pf=puffs[i], a=Math.max(0,1-pf.t/pf.life);
      ctx.save(); ctx.globalAlpha=a*0.85; ctx.fillStyle="#e6ecf4";
      for(var k=0;k<7;k++){ var an=k/7*Math.PI*2; var rr=6+pf.t*0.05; ctx.beginPath(); ctx.arc(pf.x+Math.cos(an)*rr,pf.y+Math.sin(an)*rr*0.7,7,0,Math.PI*2); ctx.fill(); }
      ctx.restore(); }
  }
  requestAnimationFrame(loop);
})();
