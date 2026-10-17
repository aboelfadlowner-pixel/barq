  /* ---------- motion ---------- */
  var tick=false;
  function onScroll(){ if(tick) return; tick=true; requestAnimationFrame(function(){bar.classList.toggle('scrolled',window.scrollY>8); tick=false}) }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();

  var stage=$('#stage');
  if(stage&&!reduce){
    stage.addEventListener('pointermove',function(e){
      var r=stage.getBoundingClientRect();
      stage.style.setProperty('--mx',((e.clientX-r.left)/r.width-.5).toFixed(3));
      stage.style.setProperty('--my',((e.clientY-r.top)/r.height-.5).toFixed(3));
    });
    stage.addEventListener('pointerleave',function(){stage.style.setProperty('--mx',0); stage.style.setProperty('--my',0)});
  }

  var rv=$$('.rv');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(en){ if(en.isIntersecting){en.target.classList.add('in'); io.unobserve(en.target)} })},{rootMargin:'0px 0px -6% 0px',threshold:.06});
    rv.forEach(function(el){io.observe(el)});
  } else { rv.forEach(function(el){el.classList.add('in')}) }
