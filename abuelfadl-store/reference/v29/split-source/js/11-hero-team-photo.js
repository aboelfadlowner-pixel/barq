  /* hero: team photo enters from both sides, then tilts in 3D */
  (function(){
    var st=$('#heroPhoto'); if(!st) return;
    var wrap=st.parentNode, rx=0,ry=0,tx=0,ty=0,raf=0,live=false,gx=50,gy=50;
    function draw(){
      rx+=(tx-rx)*.1; ry+=(ty-ry)*.1;
      st.style.transform='rotateX('+rx.toFixed(2)+'deg) rotateY('+ry.toFixed(2)+'deg)';
      st.style.setProperty('--gx',gx+'%'); st.style.setProperty('--gy',gy+'%');
      st.style.setProperty('--sx',(-ry*2.2).toFixed(1)+'px'); st.style.setProperty('--sy',(rx*2.2+22).toFixed(1)+'px');
      raf=(Math.abs(tx-rx)>.02||Math.abs(ty-ry)>.02)?requestAnimationFrame(draw):0;
    }
    function kick(){if(!raf) raf=requestAnimationFrame(draw)}
    function aim(nx,ny){ if(!live) return; ty=nx*7; tx=-ny*4.5; gx=50+nx*40; gy=50+ny*40; kick() }
    var played=false, tmr=0;
    function play(){
      clearTimeout(tmr); live=false; tx=ty=rx=ry=0; st.style.transform=''; st.classList.remove('in','live');
      void st.offsetWidth;
      requestAnimationFrame(function(){requestAnimationFrame(function(){ st.classList.add('in'); tmr=setTimeout(function(){live=true; st.classList.add('live')},reduce?1100:1500) })});
    }
    function start(){ if(played) return; played=true; play() }
    var m=/url\("?([^")]+)"?\)/.exec(getComputedStyle(st).getPropertyValue('--team')), img=new Image(), go=false, seen=false;
    function tryStart(){ if(go&&seen) start() }
    img.onload=img.onerror=function(){ (img.decode?img.decode():Promise.resolve()).catch(function(){}).then(function(){go=true; tryStart()}) };
    if(m) img.src=m[1]; else go=true;
    if('IntersectionObserver' in window){ new IntersectionObserver(function(en,ob){ if(en[0].isIntersecting){seen=true; ob.disconnect(); setTimeout(tryStart,150)} },{threshold:.25}).observe(st) } else { seen=true }
    setTimeout(function(){go=true;seen=true;start()},3500);
    st.addEventListener('click',function(){ if(played) play() });
    if(!reduce){
      wrap.addEventListener('pointermove',function(e){var r=wrap.getBoundingClientRect(); aim(((e.clientX-r.left)/r.width-.5)*2,((e.clientY-r.top)/r.height-.5)*2)});
      wrap.addEventListener('pointerleave',function(){aim(0,0)});
      wrap.addEventListener('pointerup',function(e){ if(e.pointerType!=='mouse') setTimeout(function(){aim(0,0)},900) });
      function ori(e){ if(e.gamma==null) return; aim(Math.max(-1,Math.min(1,e.gamma/20)), Math.max(-1,Math.min(1,((e.beta||45)-45)/20))) }
      if(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission!=='function') window.addEventListener('deviceorientation',ori);
      else if(window.DeviceOrientationEvent) wrap.addEventListener('click',function once(){ DeviceOrientationEvent.requestPermission().then(function(s){ if(s==='granted') window.addEventListener('deviceorientation',ori) }).catch(function(){}); wrap.removeEventListener('click',once) });
    }
    window.__hero=function(x,y){live=true; tx=-y*4.5; ty=x*7; rx=tx; ry=ty; gx=50+x*40; gy=50+y*40; draw()};
  })();
