  /* ---------- cart ---------- */
  var toastT;
  function toast(msg){
    var t=$('#toast'); t.textContent=msg; t.classList.add('on');
    clearTimeout(toastT); toastT=setTimeout(function(){t.classList.remove('on')},2200);
  }
  function bump(){$$('.cc').forEach(function(c){c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump')})}
  function fly(from){
    var target=(window.innerWidth<900?$('.bnav [data-nav="cart"]'):cartBtn)||cartBtn;
    function done(){bump(); target.classList.remove('pulse2'); void target.offsetWidth; target.classList.add('pulse2')}
    if(reduce||!from||!from.getBoundingClientRect){done();return}
    var host=from.closest('.p')||from.closest('#pd');
    var srcEl=host&&host.querySelector('.pi img, .sh-img img, .pi>.art, .sh-img>.art');
    var a=(srcEl||from).getBoundingClientRect(), b=target.getBoundingClientRect();
    var size=Math.min(96,Math.max(56,Math.min(a.width,a.height)));
    var ghost;
    if(srcEl&&srcEl.tagName==='IMG'){ghost=doc.createElement('img'); ghost.src=srcEl.src; ghost.alt=''}
    else if(srcEl){ghost=doc.createElement('span'); var cl=srcEl.cloneNode(true); cl.removeAttribute('class'); cl.setAttribute('style','display:block;width:100%;height:100%'); ghost.appendChild(cl)}
    else {ghost=doc.createElement('span'); ghost.style.background='var(--brand-hi)'}
    ghost.setAttribute('class','flyimg'); ghost.setAttribute('aria-hidden','true');
    var sx=a.left+a.width/2-size/2, sy=a.top+a.height/2-size/2;
    ghost.style.cssText+=';left:'+sx+'px;top:'+sy+'px;width:'+size+'px;height:'+size+'px';
    doc.body.appendChild(ghost);
    var dx=b.left+b.width/2-(sx+size/2), dy=b.top+b.height/2-(sy+size/2);
    var anim=ghost.animate([
      {transform:'translate(0,0) scale(1) rotate(0)',opacity:1},
      {transform:'translate('+(dx*.5)+'px,'+(Math.min(dy,0)-90)+'px) scale(.62) rotate(-8deg)',opacity:1,offset:.5},
      {transform:'translate('+dx+'px,'+dy+'px) scale(.12) rotate(-14deg)',opacity:.35}
    ],{duration:620,easing:'cubic-bezier(.5,.05,.3,1)'});
    anim.onfinish=function(){ghost.remove(); done()};
  }
  function totals(){var n=0,sum=0; for(var id in cart){n+=isW(id)?1:cart[id]; sum+=cart[id]*BY_ID[id].price} return {n:n,sum:r2(sum)}}
  function renderCart(){
    var t=totals(), ids=Object.keys(cart);
    $$('.cc').forEach(function(c){c.textContent=t.n; c.hidden=t.n===0});
    $('#total').textContent=money(t.sum)+' ج.م';
    $('#fill').style.width=Math.min(100,Math.round(t.sum/MIN_ORDER*100))+'%';
    $('#minMsg').textContent = t.sum>=MIN_ORDER
      ? 'وصلت للحد الأدنى للطلب، والتوصيل متاح داخل البيطاش.'
      : 'أضف '+money(MIN_ORDER-t.sum)+' ج.م لتصل إلى الحد الأدنى للطلب (300 ج.م).';
    var btn=$('#checkout'); btn.disabled=t.sum<MIN_ORDER;
    btn.textContent = t.sum<MIN_ORDER ? 'الحد الأدنى للطلب 300 ج.م' : 'إتمام الطلب';
    var list=$('#drList');
    if(!ids.length){
      list.innerHTML='<li class="dr-empty">'+art('a-basket','0 0 120 110')+'<b>سلتك فارغة</b><span>أضف منتجات من الأقسام لتبدأ طلبك.</span></li>';
      return;
    }
    list.innerHTML=ids.map(function(id){
      var p=BY_ID[id], q=cart[id], c=CAT[p.cat];
      return '<li class="dr-item" data-line="'+id+'"><div class="di"><span class="th" style="--tint:'+c.tint+'">'+(p.img?'<img class="ph" alt="" src="'+p.img+'">':'<span class="phl" aria-hidden="true"></span>')+'</span><div><b>'+p.name+'</b><br><small>'+money(p.price)+(p.weighed?' ج.م للكيلو':' ج.م للوحدة')+'</small></div></div><span class="lt">'+money(r2(p.price*q))+' ج.م</span>'+
        '<div class="step" role="group" aria-label="كمية '+esc(p.name)+'"><button type="button" data-inc="'+id+'" aria-label="زيادة الكمية">'+icon('i-plus')+'</button><output>'+qLabel(id,q)+'</output><button type="button" data-dec="'+id+'" aria-label="تقليل الكمية">'+icon('i-minus')+'</button></div></li>';
    }).join('');
  }
  function setQty(id,q){
    if(q<=0) delete cart[id]; else cart[id]=Math.min(r2(q),capOf(id),stockOf(id));
    saveCart();
    $$('.p[data-id="'+id+'"] [data-act]').forEach(function(a){a.innerHTML=actionHTML(id)});
    renderCart();
  }
  doc.addEventListener('click',function(e){
    var add=e.target.closest('[data-add]'), inc=e.target.closest('[data-inc]'), dec=e.target.closest('[data-dec]');
    var art_=e.target.closest('.p'), line=e.target.closest('[data-line]');
    if(add){
      var id=+add.getAttribute('data-add'); fly(add); setQty(id,1); toast('أُضيف إلى السلة: '+BY_ID[id].name);
      var f=art_&&art_.querySelector('[data-inc]'); if(f) f.focus({preventScroll:true});
    } else if(inc){
      var i2=+inc.getAttribute('data-inc'); fly(inc); setQty(i2,r2((cart[i2]||0)+(isW(i2)?stepOf(i2):1)));
      var n=art_?art_.querySelector('[data-inc]'):(line&&drawer.querySelector('[data-line="'+i2+'"] [data-inc]')); if(n) n.focus({preventScroll:true});
    } else if(dec){
      var i3=+dec.getAttribute('data-dec'); setQty(i3,r2((cart[i3]||0)-(isW(i3)?stepOf(i3):1)));
      var m=art_?(art_.querySelector('[data-dec]')||art_.querySelector('[data-add]')):(drawer.querySelector('[data-line="'+i3+'"] [data-dec]')||$('#drClose'));
      if(m) m.focus({preventScroll:true});
    }
  });

  var lastFocus=null;
  function openCart(){
    $('#toast').classList.remove('on');
    lastFocus=doc.activeElement; drawer.inert=false; drawer.classList.add('open'); scrim.classList.add('on');
    doc.body.style.overflow='hidden'; setTimeout(function(){$('#drClose').focus()},50);
  }
  function closeCart(){
    drawer.classList.remove('open'); scrim.classList.remove('on'); drawer.inert=true; doc.body.style.overflow='';
    if(lastFocus&&lastFocus.focus) lastFocus.focus();
  }
  cartBtn.addEventListener('click',openCart);
  $('#drClose').addEventListener('click',closeCart);
  scrim.addEventListener('click',closeCart);
  doc.addEventListener('keydown',function(e){ if(e.key==='Escape'&&drawer.classList.contains('open')) closeCart() });
  $('#checkout').addEventListener('click',function(){ closeCart(); setTimeout(openCO,120) });
