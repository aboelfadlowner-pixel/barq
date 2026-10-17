  /* card tilt */
  if(window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches&&!reduce){
    $$('.pcs .pc').forEach(function(c){c.classList.add('tilt');
      c.addEventListener('pointermove',function(e){var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5; c.style.setProperty('--ry',(-x*9).toFixed(2)+'deg'); c.style.setProperty('--rx',(y*9).toFixed(2)+'deg')});
      c.addEventListener('pointerleave',function(){c.style.setProperty('--rx','0deg');c.style.setProperty('--ry','0deg')})});
  }
  function setHH(){root.style.setProperty('--hh',(bar.getBoundingClientRect().height-1)+'px')}
  setHH(); window.addEventListener('resize',setHH); if('ResizeObserver' in window) new ResizeObserver(setHH).observe(bar);
