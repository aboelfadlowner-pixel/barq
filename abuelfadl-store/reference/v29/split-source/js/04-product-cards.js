  /* ---------- product cards ---------- */
  function stockOf(id){return STOCK[id]===undefined?99:STOCK[id]}
  function avHTML(id){var n=stockOf(id); return n===0?'<div class="av no">غير متوفر حاليًا</div>':n<=5?'<div class="av low">آخر '+n+' قطع</div>':'<div class="av">متوفر</div>'}
  function actionHTML(id){
    var p=BY_ID[id], q=cart[id]||0;
    if(stockOf(id)===0) return '<button class="add" type="button" disabled aria-label="غير متوفر">'+icon('i-plus')+'</button>';
    if(isW(id)) return q?'<button class="wchip" type="button" data-open="'+id+'" aria-label="تعديل الوزن">'+wLabel(q)+'</button>':'<button class="add" type="button" data-open="'+id+'" aria-label="اختر وزن '+esc(p.name)+'">'+icon('i-plus')+'</button>';
    if(!q) return '<button class="add" type="button" data-add="'+id+'" aria-label="أضف '+esc(p.name)+' إلى السلة">'+icon('i-plus')+'</button>';
    return '<div class="step" role="group" aria-label="كمية '+esc(p.name)+'"><button type="button" data-inc="'+id+'" aria-label="زيادة الكمية">'+icon('i-plus')+'</button><output aria-live="polite">'+q+'</output><button type="button" data-dec="'+id+'" aria-label="تقليل الكمية">'+icon('i-minus')+'</button></div>';
  }
  function cardHTML(p,i){
    var c=CAT[p.cat];
    return '<article class="p'+(stockOf(p.id)===0?' out':'')+'" data-id="'+p.id+'" style="--i:'+Math.min(i,9)+'">'+
      '<div class="pi" style="--tint:'+c.tint+'">'+(p.img?'<img src="'+esc(p.img)+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async">':'<span class="phl" aria-hidden="true"></span>')+
      (p.tag?'<span class="tag">'+p.tag+'</span>':'')+
      '<button class="fav" type="button" data-fav="'+p.id+'" aria-pressed="'+(favs[p.id]?'true':'false')+'" aria-label="إضافة '+esc(p.name)+' للمفضلة">'+icon('i-heart')+'</button>'+
      '<div class="act" data-act>'+actionHTML(p.id)+'</div></div>'+
      '<div class="pp"><span class="n" dir="ltr"><b>'+money(p.price)+'</b><small>.00</small></span>'+(p.old?'<s dir="ltr">'+money(p.old)+'.00</s>':'')+(p.weighed?'<span class="per">/ كيلو</span>':'')+'</div>'+
      '<h3>'+p.name+'</h3>'+avHTML(p.id)+'</article>';
  }
  function matches(p,q){return !q||norm(p.name+' '+CAT[p.cat].name).indexOf(q)>-1}

  var tab='best';
  function renderFav(){
    var ids=tab==='best'?FEATURED:tab==='offers'?PRODUCTS.filter(function(p){return p.old}).map(function(p){return p.id}):NEWIDS;
    if(!$('#featRow')) return;
    $('#featRow').innerHTML=ids.map(function(id,i){return cardHTML(BY_ID[id],i)}).join('');
  }
  $$('[data-tab]').forEach(function(b){b.addEventListener('click',function(){
    tab=b.getAttribute('data-tab');
    $$('[data-tab]').forEach(function(x){x.setAttribute('aria-selected',String(x===b))}); renderFav();
  })});
  function markNav(){}
