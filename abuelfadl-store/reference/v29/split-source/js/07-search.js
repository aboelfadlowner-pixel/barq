  /* ---------- search ---------- */
  function closeSug(){sug.hidden=true; input.setAttribute('aria-expanded','false')}
  function showSug(){
    var raw=input.value, q=norm(raw);
    if(!q){closeSug();return}
    var hits=PRODUCTS.filter(function(p){return matches(p,q)}).slice(0,6);
    sug.innerHTML=hits.length
      ? hits.map(function(p){return '<button type="button" role="option" data-pick="'+p.id+'">'+(p.img?'<img class="ph" alt="" src="'+p.img+'">':'<span class="phl" aria-hidden="true"></span>')+'<span><b>'+p.name+'</b><small>'+CAT[p.cat].name+'</small></span><i>'+money(p.price)+' ج.م</i></button>'}).join('')+'<button type="button" class="all" data-all>عرض كل النتائج</button>'
      : '<p class="none">لا توجد نتائج عن «'+esc(raw)+'»</p>';
    sug.hidden=false; input.setAttribute('aria-expanded','true');
  }
  input.addEventListener('input',function(){
    state.q=input.value;
    if(state.view==='cat'){renderCat()} else {showSug()}
  });
  input.addEventListener('keydown',function(e){
    if(e.key==='Enter'){e.preventDefault(); if(state.view==='home'){openCat('all',input.value)} else {closeSug()}}
    if(e.key==='Escape'){closeSug()}
  });
  sug.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return;
    if(b.hasAttribute('data-pick')) openCat('all',BY_ID[b.getAttribute('data-pick')].name);
    if(b.hasAttribute('data-all')) openCat('all',input.value);
  });
  doc.addEventListener('click',function(e){ if(!e.target.closest('.search')) closeSug() });
