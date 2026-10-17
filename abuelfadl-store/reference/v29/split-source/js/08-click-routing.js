  /* ---------- click routing ---------- */
  doc.addEventListener('click',function(e){
    var t=e.target;
    var go=t.closest('[data-go]'); if(go){e.preventDefault(); openCat(go.getAttribute('data-go')); return}
    var tr=t.closest('[data-try]'); if(tr){openCat('all',tr.getAttribute('data-try')); return}
    var lay=t.closest('[data-layout]'); if(lay){state.layout=lay.getAttribute('data-layout'); $$('[data-layout]').forEach(function(x){x.setAttribute('aria-pressed',String(x===lay))}); renderCat(); return}
    var ch=t.closest('[data-chip]'); if(ch){state.sub=ch.getAttribute('data-chip'); renderCat(); return}
    if(t.closest('#back')||t.closest('#logo')){ if(t.closest('#logo')) e.preventDefault(); goHome(); return}
    if(t.closest('#qclear')){state.q=''; input.value=''; renderCat(); return}
    if(t.closest('#reset')){state.cat='all'; state.sub='all'; state.q=''; input.value=''; renderCat(); return}
    var fv=t.closest('[data-fav]');
    if(fv){var id=fv.getAttribute('data-fav'); favs[id]=!favs[id]; $$('[data-fav="'+id+'"]').forEach(function(b){b.setAttribute('aria-pressed',String(!!favs[id]))}); return}
    var nv=t.closest('[data-nav]');
    if(nv){
      var k=nv.getAttribute('data-nav');
      if(k==='home') goHome();
      else if(k==='cats'){ goHome(); var s=$('#catsSec'); if(s) instant(function(){s.scrollIntoView({block:'start'})}) }
      else if(k==='cart') openCart();
      else if(k==='acct') toast('تسجيل الدخول يتفعّل عند ربط الموقع بنظام الحسابات');
      else if(k==='search'){ var open=bar.classList.toggle('search-open'); if(open) input.focus(); else closeSug() }
    }
  });
