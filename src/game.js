/* Konoha Vivant - moteur (tranche verticale : Naruto jouable).
   Reutilise le decoupage valide de window.KV_CHARS.naruto.
   Marche en double-clic (file://) et dans Electron. */
(function(){
  "use strict";
  var CH=(window.KV_CHARS||{}).naruto;
  var cv=document.getElementById("game"), ctx=cv.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  var W=cv.width, H=cv.height, GROUND=H-64;
  var K=(CH.scaleTo||170)/(CH.refH||63);

  var img=new Image(), ready=false;
  img.onload=function(){ready=true;}; img.onerror=function(){ready="err";}; img.src=CH.sheet;

  // reglages en direct (orbe dans la main)
  var reach=0.34, handh=0.55;
  function bind(id,fn){var e=document.getElementById(id);if(e)e.addEventListener("input",fn);}
  bind("reach",function(e){reach=parseFloat(e.target.value);document.getElementById("reachV").textContent=reach.toFixed(2);});
  bind("handh",function(e){handh=parseFloat(e.target.value);document.getElementById("handhV").textContent=handh.toFixed(2);});

  // physique (px/s)
  var RUN=210, DASH=560, JUMP=560, GRAV=1550;

  var keys={};
  window.addEventListener("keydown",function(e){
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].indexOf(e.code)>=0)e.preventDefault();
    if(!keys[e.code]) onPress(e.code);
    keys[e.code]=true;
  });
  window.addEventListener("keyup",function(e){keys[e.code]=false;});

  var p={x:W*0.42,y:GROUND,vx:0,vy:0,facing:1,onGround:true,
         anim:"idle",frame:0,ft:0,dir:1,hold:0,
         lock:false,actAnim:null,actT:0,actDur:0,dashT:0,pending:null};

  var fxList=[], clones=[], puffs=[];

  function A(n){return CH.anims[n];}
  function dur(n,extra){var a=A(n);return (a.frames.length/(a.fps||8))*1000+(extra||0);}
  function setFree(anim){ if(p.anim!==anim){p.anim=anim;p.frame=0;p.ft=0;p.dir=1;p.hold=0;} }

  function startAction(anim,extra){ p.lock=true;p.actAnim=anim;p.actT=0;p.actDur=dur(anim,extra);p.frame=0;p.anim=anim; }

  var JUTSU={
    rasengan:{anim:"rasengan",fx:"rasengan",mode:"attach",big:false},
    oodama_rasengan:{anim:"oodama_rasengan",fx:"oodama_rasengan",mode:"attach",big:true},
    rasen_shuriken:{anim:"rasen_shuriken",fx:"rasen_shuriken",mode:"proj"},
    kage_bunshin:{anim:"kage_bunshin",mode:"clones"},
    kyuubi_3t:{anim:"kyuubi_3t",mode:"transform"}
  };
  function hasFx(n){return A(n)&&A(n).fx&&A(n).fx.length;}

  function cast(name){
    var J=JUTSU[name]; if(!J||!A(J.anim))return;
    startAction(J.anim, J.mode==="transform"?400:150);
    if(J.mode==="attach") fxList.push({kind:"attach",fx:(hasFx(J.fx)?J.fx:name),big:J.big,t:0,dur:p.actDur,diss:450});
    else if(J.mode==="proj"){ fxList.push({kind:"attach",fx:J.fx,big:false,t:0,dur:p.actDur,diss:0}); p.pending="proj_"+name; }
    else if(J.mode==="clones") spawnClones();
  }

  function spawnClones(){
    for(var s=-1;s<=1;s+=2){
      var cx=clamp(p.x+s*95,50,W-50);
      clones.push({x:cx,facing:p.facing,t:0,life:2600});
      puffs.push({x:cx,y:GROUND-40,t:0,life:520,fx:hasFx("kage_bunshin")?"kage_bunshin":null});
    }
  }
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}

  function onPress(code){
    if(code==="KeyR"){ /* reset */ p.lock=false;p.dashT=0;fxList=[];clones=[];puffs=[];p.x=W*0.42;p.y=GROUND;p.vx=p.vy=0;setFree("idle");return; }
    if(p.lock) return;
    switch(code){
      case "ShiftLeft": case "ShiftRight":
        p.dashT=220; p.vx=p.facing*DASH; break;
      case "Space":
        if(p.onGround){ p.vy=-JUMP; p.onGround=false; } break;
      case "KeyJ":
        startAction(p.onGround?"attack":"attack_air",60); break;
      case "KeyK": cast("rasengan"); break;
      case "KeyO": cast("oodama_rasengan"); break;
      case "KeyL": cast("rasen_shuriken"); break;
      case "KeyU": cast("kage_bunshin"); break;
      case "KeyI": cast("kyuubi_3t"); break;
      case "KeyH": startAction("hurt_light",250); break;
      case "KeyG":
        startAction("knockdown",(A("knockdown").holdMs)||900);
        p.pending="getup"; break;
    }
  }

  // ---- update ----
  function stepFreeAnim(dt){
    var a=A(p.anim); if(!a||a.frames.length<=1) return;
    var n=a.frames.length;
    if(p.hold>0){ p.hold-=dt; if(p.hold<=0){p.frame=0;p.dir=1;} return; }
    p.ft+=dt; var st=1000/(a.fps||8);
    while(p.ft>=st){ p.ft-=st;
      if(a.yoyo){ p.frame+=p.dir; if(p.frame>=n-1){p.frame=n-1;p.dir=-1;} else if(p.frame<=0){p.frame=0;p.dir=1;} }
      else { p.frame=(p.frame+1)%n; }
    }
  }

  function update(dtms){
    var dt=dtms/1000;

    if(p.lock){
      p.actT+=dtms;
      var a=A(p.actAnim), fps=a.fps||8;
      p.frame=Math.min(a.frames.length-1, Math.floor(p.actT/(1000/fps)));
      p.anim=p.actAnim;
      // amortir le deplacement pendant une action au sol
      if(p.onGround) p.vx*=0.8;
      if(p.actT>=p.actDur){
        p.lock=false;
        if(p.pending && p.pending.indexOf("proj_")===0){
          var jn=p.pending.slice(5), J=JUTSU[jn];
          var hp=handPoint();
          fxList.push({kind:"proj",fx:J.fx,x:hp.x,y:hp.y,vx:p.facing*640,t:0,life:900});
          p.pending=null;
        } else if(p.pending==="getup"){
          startAction("getup",0); p.pending=null; // enchaine la releve
        } else { p.pending=null; }
      }
    } else {
      // dash
      if(p.dashT>0){ p.dashT-=dtms; if(p.dashT<=0) p.vx*=0.3; }
      else {
        var mv=0;
        if(keys["ArrowLeft"]||keys["KeyA"]) mv-=1;
        if(keys["ArrowRight"]||keys["KeyD"]) mv+=1;
        if(mv!==0){ p.facing=mv; p.vx=mv*RUN; } else { p.vx*=0.6; if(Math.abs(p.vx)<6)p.vx=0; }
      }
    }

    // physique
    p.x+=p.vx*dt;
    p.vy+=GRAV*dt; p.y+=p.vy*dt;
    if(p.y>=GROUND){ p.y=GROUND; p.vy=0; p.onGround=true; } else p.onGround=false;
    p.x=clamp(p.x,40,W-40);

    // choix anim libre
    if(!p.lock){
      if(!p.onGround) setFree("jump");
      else if(p.dashT>0) setFree("dash");
      else if(Math.abs(p.vx)>12) setFree("run");
      else setFree("idle");
      if(p.anim==="jump"){ var jn=A("jump").frames.length; p.frame= p.vy<-60?0 : (p.vy>60?Math.min(2,jn-1):Math.min(1,jn-1)); }
      else stepFreeAnim(dtms);
    }

    // effets
    for(var i=fxList.length-1;i>=0;i--){ var e=fxList[i]; e.t+=dtms;
      if(e.kind==="proj"){ e.x+=e.vx*dt; if(e.t>=e.life||e.x<-60||e.x>W+60) fxList.splice(i,1); }
      else { if(e.t>=e.dur+e.diss) fxList.splice(i,1); }
    }
    for(var c=clones.length-1;c>=0;c--){ clones[c].t+=dtms;
      if(clones[c].t>=clones[c].life){ puffs.push({x:clones[c].x,y:GROUND-40,t:0,life:520,fx:hasFx("kage_bunshin")?"kage_bunshin":null}); clones.splice(c,1); } }
    for(var q=puffs.length-1;q>=0;q--){ puffs[q].t+=dtms; if(puffs[q].t>=puffs[q].life) puffs.splice(q,1); }
  }

  function handPoint(){
    var a=A(p.anim), f=a.frames[Math.min(p.frame,a.frames.length-1)];
    var h=f.r[3]*K;
    return { x:p.x + p.facing*(reach*160), y:p.y - handh*h };
  }

  // ---- rendu ----
  function drawBg(){
    var g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#1a2740"); g.addColorStop(0.55,"#243a4e"); g.addColorStop(1,"#3a4a3a");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // collines
    ctx.fillStyle="rgba(30,50,45,.6)";
    for(var k=0;k<4;k++){ var cx=k*280-40, cy=GROUND-40; ctx.beginPath(); ctx.ellipse(cx,cy,180,90,0,Math.PI,0); ctx.fill(); }
    // sol
    ctx.fillStyle="#2c3326"; ctx.fillRect(0,GROUND,W,H-GROUND);
    ctx.fillStyle="#3a4432"; ctx.fillRect(0,GROUND,W,4);
    ctx.strokeStyle="rgba(0,0,0,.25)"; ctx.lineWidth=1;
    for(var x=0;x<W;x+=48){ ctx.beginPath(); ctx.moveTo(x,GROUND+10); ctx.lineTo(x-14,H); ctx.stroke(); }
  }
  function drawChar(anim,frame,x,footY,facing,alpha){
    var a=A(anim); if(!a||!a.frames.length)return;
    var f=a.frames[Math.min(frame,a.frames.length-1)], r=f.r, ax=(f.ax==null?r[2]/2:f.ax);
    var w=r[2]*K, h=r[3]*K;
    ctx.save();
    ctx.globalAlpha=(alpha==null?1:alpha)*0.28; ctx.fillStyle="#000";
    ctx.beginPath(); ctx.ellipse(x,footY+3,Math.max(16,w*0.32),7,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=(alpha==null?1:alpha);
    ctx.translate(x,0); ctx.scale(facing,1);
    ctx.drawImage(img, r[0],r[1],r[2],r[3], -ax*K, footY-h, w, h);
    ctx.restore();
  }
  function drawFxFrame(fxName,idx,cx,cy,scale,alpha){
    var fx=A(fxName)&&A(fxName).fx; if(!fx||!fx.length)return;
    var f=fx[Math.min(idx,fx.length-1)], r=f.r, w=r[2]*K*scale, h=r[3]*K*scale;
    ctx.save(); ctx.globalAlpha=(alpha==null?1:alpha);
    ctx.drawImage(img, r[0],r[1],r[2],r[3], cx-w/2, cy-h/2, w, h); ctx.restore();
  }

  function render(){
    drawBg();
    // clones (derriere)
    for(var c=0;c<clones.length;c++){ var cl=clones[c]; var fade=Math.min(1,(cl.life-cl.t)/300); drawChar("idle",Math.floor(cl.t/120)%A("idle").frames.length, cl.x, GROUND, cl.facing, 0.9*fade); }
    // joueur
    drawChar(p.anim,p.frame,p.x,p.y,p.facing,1);
    // effets attaches (orbe dans la main) + projectiles
    for(var i=0;i<fxList.length;i++){ var e=fxList[i];
      if(e.kind==="attach"){
        var fxN=A(e.fx)&&A(e.fx).fx? e.fx : null; if(!fxN) continue;
        var flen=A(fxN).fx.length;
        var prog=Math.min(1,e.t/Math.max(1,e.dur));
        var idx= e.t<=e.dur ? Math.floor(prog*flen) : flen-1;
        var alpha= e.t<=e.dur ? 1 : Math.max(0,1-(e.t-e.dur)/e.diss);
        var hp=handPoint();
        drawFxFrame(fxN, idx, hp.x, hp.y, e.big?1.5:1.0, alpha);
      } else if(e.kind==="proj"){
        var pl=A(e.fx).fx.length; drawFxFrame(e.fx, Math.floor(e.t/60)%pl, e.x, e.y, 1.0, 1);
      }
    }
    // puffs de fumee
    for(var q=0;q<puffs.length;q++){ var pf=puffs[q]; var a=Math.max(0,1-pf.t/pf.life);
      if(pf.fx){ var pfl=A(pf.fx).fx.length; drawFxFrame(pf.fx, Math.floor(pf.t/50)%pfl, pf.x, pf.y, 1.1, a); }
      else { ctx.save(); ctx.globalAlpha=a*0.8; ctx.fillStyle="#dfe6ef"; ctx.beginPath(); ctx.arc(pf.x,pf.y,10+pf.t*0.05,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    }
    // HUD etat
    ctx.fillStyle="rgba(0,0,0,.35)"; ctx.fillRect(0,0,W,26);
    ctx.fillStyle="#ff7a2f"; ctx.font="13px monospace"; ctx.textAlign="left";
    ctx.fillText("Naruto", 12, 18);
    ctx.fillStyle="#cfd8e6";
    ctx.fillText("etat: "+(p.lock?p.actAnim:p.anim), 90, 18);
    ctx.textAlign="right"; ctx.fillStyle="#6f7c8e";
    ctx.fillText("R = reset", W-12, 18); ctx.textAlign="left";
  }

  // ---- boucle ----
  var last=0;
  function loop(ts){
    requestAnimationFrame(loop);
    var dt=last?ts-last:16; last=ts; if(dt>60)dt=60;
    if(ready===true){ update(dt); render(); }
    else {
      ctx.fillStyle="#0d1017"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle=ready==="err"?"#ff6b6b":"#8895a7"; ctx.font="14px monospace"; ctx.textAlign="center";
      ctx.fillText(ready==="err"?("planche introuvable: "+CH.sheet):"chargement...", W/2, H/2);
      ctx.textAlign="left";
    }
  }
  requestAnimationFrame(loop);
})();
