  /* product sheet */
  var pdId=0,pdq=1,pd=$('#pd');
  function pdPrice(){var p=BY_ID[pdId]; return '<span class="n" dir="ltr"><b>'+money(p.price)+'</b><small>.00</small></span>'+(p.old?'<s dir="ltr">'+money(p.old)+'.00</s>':'')+(p.weighed?'<span class="per">/ كيلو</span>':'')}
  function pdRefresh(){
    var id=pdId,p=BY_ID[id],w=isW(id);
    $('#pdQty').textContent=qLabel(id,pdq);
    $('#pdAdd').textContent=stockOf(id)===0?'غير متوفر':(w?(cart[id]?'تحديث · ':'أضف · ')+money(r2(p.price*pdq))+' ج.م':'أضف إلى السلة');
    if(w) $$('#pdWc button').forEach(function(b){b.setAttribute('aria-pressed',String(+b.getAttribute('data-w')===pdq))});
  }
  function openPD(id){
    var p=BY_ID[id], c=CAT[p.cat], w=isW(id); pdId=id; pdq=w?(cart[id]||stepOf(id)):1;
    $('#pdImg').style.setProperty('--tint',c.tint);
    $('#pdImg').innerHTML=p.img?'<img alt="'+esc(p.name)+'" src="'+esc(p.img)+'">':'<span class="phl" aria-hidden="true"></span>';
    $('#pdCat').textContent=c.name; $('#pdName').textContent=p.name; $('#pdPrice').innerHTML=pdPrice();
    var av=$('#pdAv'); av.outerHTML=avHTML(id).replace('class="av','id="pdAv" class="av');
    $('#pdW').hidden=!w;
    if(w){var st=stepOf(id); $('#pdWc').innerHTML=[1,2,3,4].map(function(m){var q=r2(st*m); return '<button type="button" data-w="'+q+'" aria-pressed="false"><b>'+wLabel(q)+'</b><small>'+money(r2(p.price*q))+' ج.م</small></button>'}).join('')}
    $('#pdAdd').disabled=stockOf(id)===0; pdRefresh();
    pd.inert=false; pd.classList.add('open'); scrim.classList.add('on'); doc.body.style.overflow='hidden';
    setTimeout(function(){$('#pdClose').focus()},50);
  }
  function closePD(){pd.classList.remove('open'); pd.inert=true; if(!drawer.classList.contains('open')){scrim.classList.remove('on'); doc.body.style.overflow=''}}
  $('#pdClose').addEventListener('click',closePD); scrim.addEventListener('click',closePD);
  $('#pdWc').addEventListener('click',function(e){var b=e.target.closest('[data-w]'); if(b){pdq=+b.getAttribute('data-w'); pdRefresh()}});
  $('#pdMinus').addEventListener('click',function(){var w=isW(pdId),st=w?stepOf(pdId):1; pdq=Math.max(st,r2(pdq-st)); pdRefresh()});
  $('#pdPlus').addEventListener('click',function(){var w=isW(pdId),st=w?stepOf(pdId):1; pdq=Math.min(capOf(pdId),stockOf(pdId),r2(pdq+st)); pdRefresh()});
  $('#pdAdd').addEventListener('click',function(){var id=pdId; fly($('#pdAdd')); setQty(id,isW(id)?pdq:(cart[id]||0)+pdq); toast((isW(id)?'أُضيف: '+wLabel(pdq)+' · ':'أُضيف إلى السلة: ')+BY_ID[id].name); closePD()});
  doc.addEventListener('keydown',function(e){if(e.key==='Escape'&&pd.classList.contains('open')) closePD()});
  doc.addEventListener('click',function(e){
    var card=e.target.closest('.p'); if(card&&!e.target.closest('button')&&card.closest('#featRow,#grid')) openPD(+card.getAttribute('data-id'));
    var op=e.target.closest('[data-open]'); if(op){openPD(+op.getAttribute('data-open'))}
    var sc=e.target.closest('[data-scroll]'); if(sc){var el=$('#'+sc.getAttribute('data-scroll')); if(el) el.scrollIntoView({behavior:reduce?'auto':'smooth'})}
  });
  $('#acct').addEventListener('click',function(){toast('تسجيل الدخول يتفعّل عند ربط الموقع بنظام الحسابات')});
  function renderCat(){
    var q=norm(state.q);
    var list=PRODUCTS.filter(function(p){return (state.cat==='all'||p.cat===state.cat)&&matches(p,q)});
    $('#catTitle').textContent=state.cat==='all'?'كل المنتجات':CAT[state.cat].name;
    $('#catSub').textContent='';
    countEl.textContent='';
    $('#csName').textContent=state.cat==='all'?'كل المنتجات':CAT[state.cat].name;
    $('#csTh').innerHTML=state.cat==='all'?icon('i-all'):thumb(CAT[state.cat]);
    grid.innerHTML=list.map(cardHTML).join('');
    emptyEl.hidden=list.length>0;
    $('#qtag').hidden=!state.q;
    $('#qtext').textContent=state.q;
    grid.classList.toggle('list',state.layout==='list');
    chips.hidden=true; chips.innerHTML='';
    return null;
  }
