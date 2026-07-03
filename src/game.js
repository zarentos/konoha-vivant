/* Konoha Vivant - moteur v3.
   - Orbe pilotee PAR FRAME (ofx + ancre orb dans les donnees) : creation -> attaque -> dissipation.
   - Combo a la pression : 1 appui = 1 coup, re-appuyer enchaine, dash annule.
   - Naruto complet : toutes techniques, mode ermite, K.O./releve.
   Marche en double-clic (file://) et Electron. */
(function(){
  "use strict";
  var CH=(window.KV_CHARS||{}).naruto;
  var cv=document.getElementById("game"), ctx=cv.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  var W=cv.width, H=cv.height, GROUND=Math.round(H*0.84);
  var K=(CH.scaleTo||115)/(CH.refH||63);

  var img=new Image(), ready=false;
  img.onload=function(){ready=true;}; img.onerror=function(){ready="err";}; img.src=CH.sheet;
  var DECOR_DIR="../assets/backgrounds/";
  var decorImg=new Image(), decorReady=false;
  function loadDecor(name){ decorReady=false; decorImg=new Image();
    decorImg.onload=function(){decorReady=true;}; decorImg.src=(DECOR_DIR+name).replace(/ /g,"%20"); }
  loadDecor("Training Field.png");
  var dsel=document.getElementById("decor");
  if(dsel) dsel.addEventListener("change",function(){ loadDecor(dsel.value); });

  var RUN_A=110, RUN_P=205, DASH=560, JUMP=520, GRAV=1550;
  function rand(a,b){return a+Math.random()*(b-a);}
  function pick(a){return a[Math.floor(Math.random()*a.length)];}
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}
  function A(n){return CH.anims[n];}
  function has(n){return A(n)&&A(n).frames&&A(n).frames.length;}
  function durOf(n,extra){var a=A(n);return (a.frames.length/(a.fps||8))*1000+(extra||0);}

  // segments de combo : [debut, fin] inclus (indices de frames)
  var COMBOS={
    attack:[[0,3],[4,6],[7,10],[11,13]],
    attack_air:[[0,3],[4,6],[7,10],[11,13]]
  };
  var JUTSU={
    rasengan:{anim:"rasengan"},
    rising_rasengan:{anim:"rising_rasengan"},
    ryujin_rasengan:{anim:"ryujin_rasengan"},
    rasen_shuriken:{anim:"rasen_shuriken",proj:true},
    kage_bunshin:{anim:"kage_bunshin",clones:true},
    kyuubi_3t:{anim:"kyuubi_3t"},
    kyuubi_4t:{anim:"kyuubi_4t"},
    ryujinki:{anim:"ryujinki"},
    strong:{anim:"strong"}
  };
  var AUTO=["combo","combo","rasengan","rasengan","strong","rasen_shuriken","kage_bunshin","rising_rasengan","kyuubi_3t","kyuubi_4t","ryujinki"];

  var chars=[], orbs=[], puffs=[], possessed=null;

  function Char(x){
    this.x=x; this.y=GROUND; this.vx=0; this.vy=0; this.facing=Math.random()<0.5?1:-1; this.onGround=true;
    this.anim="idle"; this.frame=0; this.ft=0; this.dir=1; this.hold=0;
    this.lock=false; this.actAnim=null; this.actT=0; this.actDur=0; this.after=null;
    this.combo=null; // {anim, seg, queued}
    this.dashT=0; this.brainT=rand(300,1500); this.walkT=0; this.walkDir=0;
    this.sage=false; this.downed=false; this.possessed=false;
    this.autoChain=0;
  }
  Char.prototype.baseAnim=function(kind){
    if(this.sage){ if(kind==="idle"&&has("frog_idle"))return "frog_idle"; if(kind==="run"&&has("frog_move"))return "frog_move"; }
    return kind;
  };
  Char.prototype.setFree=function(a){ if(this.anim!==a){this.anim=a;this.frame=0;this.ft=0;this.dir=1;this.hold=0;} };
  Char.prototype.startAction=function(anim,extra,after){
    this.lock=true;this.actAnim=anim;this.actT=0;this.actDur=durOf(anim,extra);this.frame=0;this.anim=anim;this.after=after||null;this.combo=null;
  };
  // --- combo a la pression ---
  Char.prototype.comboPress=function(){
    var base=this.onGround?"attack":"attack_air";
    var segs=COMBOS[base]; if(!segs||!has(base)) return;
    if(this.combo && this.anim===base){ this.combo.queued=true; return; } // enchaine
    if(this.lock) return;
    this.lock=true; this.anim=base; this.actAnim=base;
    this.combo={anim:base,seg:0,queued:false,t:0};
    this.frame=segs[0][0];
  };
  Char.prototype.updateCombo=function(dt){
    var cb=this.combo, a=A(cb.anim), segs=COMBOS[cb.anim], sg=segs[cb.seg];
    cb.t+=dt; var st=1000/((a.fps||9));
    var f=sg[0]+Math.floor(cb.t/st);
    if(f>=sg[1]+1){ // fin du coup
      if(cb.queued && cb.seg<segs.length-1){ cb.seg++; cb.queued=false; cb.t=0; this.frame=segs[cb.seg][0]; }
      else { this.combo=null; this.lock=false; }
    } else this.frame=f;
  };
  Char.prototype.cancelToDash=function(){
    this.combo=null; this.lock=false; this.dashT=220; this.vx=this.facing*DASH;
  };
  // --- jutsu ---
  Char.prototype.cast=function(name){
    var J=JUTSU[name]; if(!J)return;
    var anim=J.anim;
    if(name==="rasengan" && Math.random()<0.2 && has("oodama_rasengan")) anim="oodama_rasengan";
    if(name==="rising_rasengan" && Math.random()<0.2 && has("rising_oodama")) anim="rising_oodama";
    if(!has(anim))return;
    var self=this;
    this.startAction(anim,120, J.proj?function(){
      var last=self._lastOrb||{x:self.x+self.facing*40*K,y:self.y-40*K};
      orbs.push({kind:"proj",anim:anim,x:last.x,y:last.y,vx:self.facing*620,t:0,life:900});
    }:null);
    var big=(anim.indexOf("oodama")>=0);
    if(A(anim).fx && A(anim).fx.length && !J.clones)
      orbs.push({kind:"attach",owner:this,anim:anim,big:big,t:0,dur:this.actDur,endT:0});
    if(J.clones) this.spawnClones();
  };
  Char.prototype.spawnClones=function(){
    for(var s=-1;s<=1;s+=2){ var cx=clamp(this.x+s*rand(70,120),50,W-50);
      puffs.push({x:cx,y:GROUND-26*K,t:0,life:520,fxAnim:"kage_bunshin"}); }
  };
  Char.prototype.think=function(){
    var r=Math.random();
    if(r<0.40){ this.walkDir=Math.random()<0.5?-1:1; this.facing=this.walkDir; this.walkT=rand(600,1700); this.brainT=this.walkT+rand(200,700); }
    else if(r<0.56){ this.walkDir=0; this.brainT=rand(700,1800); }
    else if(r<0.64 && this.onGround){ this.vy=-JUMP; this.onGround=false; this.walkDir=0; this.brainT=rand(900,1700); }
    else {
      var m=pick(AUTO);
      if(m==="combo"){ this.comboPress(); this.autoChain=1+Math.floor(Math.random()*3); }
      else this.cast(m);
      this.brainT=rand(1500,3200);
    }
  };
  Char.prototype.update=function(dt){
    var s=dt/1000;
    if(this.combo){
      this.updateCombo(dt);
      if(!this.possessed && this.autoChain>0 && !this.combo){ /* fin */ }
      else if(!this.possessed && this.combo && !this.combo.queued && this.autoChain>0){ this.autoChain--; this.combo.queued=true; }
      if(this.onGround)this.vx*=0.85;
    } else if(this.lock){
      this.actT+=dt; var a=A(this.actAnim), fps=a.fps||8;
      this.frame=Math.min(a.frames.length-1, Math.floor(this.actT/(1000/fps))); this.anim=this.actAnim;
      if(this.onGround) this.vx*=0.8;
      if(this.actT>=this.actDur){ this.lock=false; if(this.after){var cb=this.after;this.after=null;cb();} }
    } else if(this.possessed){
      if(this.dashT>0){ this.dashT-=dt; if(this.dashT<=0)this.vx*=0.3; }
      else { var mv=0; if(keys["ArrowLeft"]||keys["KeyA"])mv-=1; if(keys["ArrowRight"]||keys["KeyD"])mv+=1;
        if(mv){this.facing=mv;this.vx=mv*RUN_P;} else {this.vx*=0.6; if(Math.abs(this.vx)<6)this.vx=0;} }
    } else {
      this.brainT-=dt;
      if(this.dashT>0){ this.dashT-=dt; if(this.dashT<=0)this.vx*=0.3; }
      else if(this.walkT>0){ this.walkT-=dt; this.vx=this.walkDir*RUN_A; }
      else { this.vx*=0.6; if(Math.abs(this.vx)<6)this.vx=0; }
      if(this.brainT<=0 && this.onGround) this.think();
    }
    this.x+=this.vx*s; this.vy+=GRAV*s; this.y+=this.vy*s;
    if(this.y>=GROUND){ this.y=GROUND; this.vy=0; this.onGround=true; } else this.onGround=false;
    if(this.x<40){this.x=40; if(!this.possessed){this.walkDir=1;this.facing=1;}}
    if(this.x>W-40){this.x=W-40; if(!this.possessed){this.walkDir=-1;this.facing=-1;}}
    if(!this.lock && !this.combo){
      if(!this.onGround) this.setFree("jump");
      else if(this.dashT>0) this.setFree("dash");
      else if(Math.abs(this.vx)>12) this.setFree(this.baseAnim("run"));
      else this.setFree(this.baseAnim("idle"));
      if(this.anim==="jump"){ var jn=A("jump").frames.length; this.frame=this.vy<-60?0:(this.vy>60?Math.min(2,jn-1):Math.min(1,jn-1)); }
      else this.stepFree(dt);
    }
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

  function drawFxByIndex(animName,fxIdx,cx,cy,scale,alpha){
    var fx=A(animName)&&A(animName).fx; if(!fx||!fx.length||fxIdx<0)return;
    var f=fx[Math.min(fxIdx,fx.length-1)], r=f.r, w=r[2]*K*scale, h=r[3]*K*scale;
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
    var c=possessed;
    if(code==="ShiftLeft"||code==="ShiftRight"){ // dash annule le combo
      if(c.combo){ c.cancelToDash(); return; }
      if(!c.lock){ c.dashT=220; c.vx=c.facing*DASH; } return;
    }
    if(code==="KeyJ"){ c.comboPress(); return; }
    if(c.lock&&!c.combo) return;
    switch(code){
      case "Space": if(c.onGround&&!c.combo){c.vy=-JUMP;c.onGround=false;} break;
      case "KeyK": c.cast("rasengan"); break;
      case "KeyM": c.cast("rising_rasengan"); break;
      case "KeyP": c.cast("ryujin_rasengan"); break;
      case "KeyL": c.cast("rasen_shuriken"); break;
      case "KeyU": c.cast("kage_bunshin"); break;
      case "KeyI": c.cast("kyuubi_3t"); break;
      case "KeyO": c.cast("kyuubi_4t"); break;
      case "KeyY": c.cast("ryujinki"); break;
      case "KeyT": c.sage=!c.sage; break;
      case "KeyH": c.startAction(pick(["hurt_light","hurt_special","hurt_h1","hurt_h2","hurt_h3"]),250); break;
      case "KeyG": (function(cc){ cc.startAction("knockdown",(A("knockdown").holdMs)||900,function(){ cc.startAction("getup",200); }); })(c); break;
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

  function setCount(n){
    n=clamp(n,1,14);
    while(chars.length<n) chars.push(new Char(rand(80,W-80)));
    while(chars.length>n){ var c=chars.pop(); if(c===possessed)possessed=null; }
    document.getElementById("count").textContent=n;
  }
  document.getElementById("plus").addEventListener("click",function(){ setCount(chars.length+1); });
  document.getElementById("minus").addEventListener("click",function(){ setCount(chars.length-1); });
  setCount(1);

  function drawDecor(){
    if(decorReady){
      var iw=decorImg.width, ih=decorImg.height, sc=Math.max(W/iw,H/ih);
      var dw=iw*sc, dh=ih*sc; ctx.drawImage(decorImg,(W-dw)/2,H-dh,dw,dh);
      ctx.fillStyle="rgba(10,14,20,.16)"; ctx.fillRect(0,0,W,H);
    } else { ctx.fillStyle="#141b26"; ctx.fillRect(0,0,W,H); }
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
    for(i=orbs.length-1;i>=0;i--){ var e=orbs[i]; e.t+=dt;
      if(e.kind==="proj"){ e.x+=e.vx*(dt/1000); if(e.t>=e.life||e.x<-60||e.x>W+60) orbs.splice(i,1); }
      else {
        var a=A(e.anim), endLen=(a.fxEnd||[]).length;
        if(e.t>=e.dur){ e.endT+=dt; if(e.endT>= endLen*70+40) orbs.splice(i,1); }
      } }
    for(i=puffs.length-1;i>=0;i--){ puffs[i].t+=dt; if(puffs[i].t>=puffs[i].life) puffs.splice(i,1); }

    drawDecor();
    for(i=0;i<chars.length;i++) chars[i].draw();
    for(i=0;i<orbs.length;i++){ var e2=orbs[i]; var a2=A(e2.anim);
      if(e2.kind==="proj"){ var att=(a2.fxAttack&&a2.fxAttack.length)?a2.fxAttack:[0];
        drawFxByIndex(e2.anim, att[Math.floor(e2.t/60)%att.length], e2.x, e2.y, 1, 1); continue; }
      var o=e2.owner;
      if(e2.t<e2.dur && o.anim===e2.anim){
        var of=a2.frames[Math.min(o.frame,a2.frames.length-1)];
        var ob=of.orb, fxIdx=(of.ofx==null?-1:of.ofx);
        if(ob && fxIdx>=0){
          var ax=(of.ax==null?of.r[2]/2:of.ax), h=of.r[3];
          var wx=o.x+o.facing*(ob[0]-ax)*K, wy=o.y-(h-ob[1])*K;
          e2.lx=wx; e2.ly=wy; o._lastOrb={x:wx,y:wy};
          drawFxByIndex(e2.anim, fxIdx, wx, wy, e2.big?1.5:1.0, 1);
        }
      } else if(e2.endT>0 && (a2.fxEnd||[]).length && e2.lx!=null){
        var k=Math.min(a2.fxEnd.length-1, Math.floor(e2.endT/70));
        var al=1-(e2.endT/(a2.fxEnd.length*70+40));
        drawFxByIndex(e2.anim, a2.fxEnd[k], e2.lx, e2.ly, e2.big?1.5:1.0, Math.max(0,al));
      }
    }
    for(i=0;i<puffs.length;i++){ var pf=puffs[i], al2=Math.max(0,1-pf.t/pf.life);
      var kfa=A(pf.fxAnim); 
      if(kfa&&kfa.fx&&kfa.fx.length){ var idx=Math.min(kfa.fx.length-1,Math.floor(pf.t/55));
        drawFxByIndex(pf.fxAnim, idx, pf.x, pf.y, 1.1, al2); }
    }
  }
  requestAnimationFrame(loop);
})();
