  /* checkout */
  var co=$('#co'), done=$('#done'), coBusy=false;
  var LS_C='abuelfadl_customer';
  function openCO(){
    var t=totals(); if(t.sum<MIN_ORDER) return;
    $('#coSub').textContent=t.n+(t.n===1?' منتج':' منتجات')+' في طلبك';
    $('#coTotal').textContent=money(t.sum)+' ج.م';
    try{var c=JSON.parse(localStorage.getItem(LS_C)||'{}'); if(c.name&&!$('#coName').value) $('#coName').value=c.name; if(c.phone&&!$('#coPhone').value) $('#coPhone').value=c.phone; if(c.addr&&!$('#coAddr').value) $('#coAddr').value=c.addr}catch(e){}
    $$('.fld').forEach(function(f){f.classList.remove('bad')}); $$('.err').forEach(function(x){x.textContent=''});
    $('#coSubmit').disabled=false; coBusy=false;
    co.inert=false; co.classList.add('open'); scrim.classList.add('on'); doc.body.style.overflow='hidden';
    setTimeout(function(){$('#coName').focus({preventScroll:true})},60);
  }
  function closeCO(){co.classList.remove('open'); co.inert=true; if(!done.classList.contains('on')){scrim.classList.remove('on'); doc.body.style.overflow=''}}
  $('#coClose').addEventListener('click',closeCO); scrim.addEventListener('click',closeCO);
  doc.addEventListener('keydown',function(e){if(e.key==='Escape'&&co.classList.contains('open')) closeCO()});
  $('#checkout').removeEventListener&&0;
  function fail(id,fid,msg){$('#'+id).textContent=msg; $('#'+fid).closest('.fld').classList.add('bad')}
  function submitOrder(e){
    if(e&&e.preventDefault) e.preventDefault(); if(coBusy) return;
    $$('.fld').forEach(function(f){f.classList.remove('bad')}); $$('.err').forEach(function(x){x.textContent=''});
    var name=$('#coName').value.trim(), ph=$('#coPhone').value.replace(/[\s-]/g,'').replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-1632}), addr=$('#coAddr').value.trim(), bad=null;
    if(name.length<3){fail('eName','coName','اكتب اسمك من فضلك'); bad=bad||$('#coName')}
    if(!/^01[0125][0-9]{8}$/.test(ph)){fail('ePhone','coPhone','اكتب رقم موبايل مصري صحيح من 11 رقم'); bad=bad||$('#coPhone')}
    if(addr.length<8){fail('eAddr','coAddr','اكتب العنوان بالتفصيل (الشارع والعمارة والدور)'); bad=bad||$('#coAddr')}
    if(bad){bad.focus(); return}
    coBusy=true; $('#coSubmit').disabled=true;
    try{localStorage.setItem(LS_C,JSON.stringify({name:name,phone:ph,addr:addr}))}catch(x){}
    var t=totals(), items=Object.keys(cart).map(function(id){return {id:+id,qty:cart[id]}});
    var order={no:'AF-'+String(Date.now()%100000).padStart(5,'0'),name:name,phone:ph,addr:addr,note:$('#coNote').value.trim(),total:t.sum,items:items,pay:'cash'};
    closeCO(); closeCart(); runDone(order);
  }
  $('#coForm').addEventListener('submit',submitOrder);
  $('#coSubmit').addEventListener('click',submitOrder);
  $$('#coForm input').forEach(function(i){i.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault(); submitOrder(e)}})});
  function runDone(o){
    done.hidden=false; done.inert=false; done.classList.add('on'); scrim.classList.remove('on'); doc.body.style.overflow='hidden';
    $('#onum').innerHTML='رقم طلبك <b dir="ltr">'+o.no+'</b>';
    $('#osum').innerHTML='<div><span>الاسم</span><b>'+esc(o.name)+'</b></div><div><span>العنوان</span><b>'+esc(o.addr)+'</b></div><div><span>الدفع</span><b>كاش عند الاستلام</b></div><div><span>الإجمالي</span><b>'+money(o.total)+' ج.م</b></div>';
    $('#onote').textContent='هنتواصل معك على '+o.phone+' لتأكيد الطلب. (نسخة تجريبية: الطلب لا يُرسل فعليًا بعد.)';
    var msg=$('#dmsg'), tick=$('.tick path',msg), stage=$('#stage2'), cart3=$('#cart3'), drops=$('#drops');
    drops.innerHTML=''; msg.classList.remove('show'); msg.style.opacity=0; stage.style.display='';
    function reveal(){
      stage.style.display='none'; msg.classList.add('show');
      if(reduce){msg.style.opacity=1;} else {
        msg.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:450,easing:'ease-out',fill:'forwards'});
        tick.animate([{strokeDasharray:1,strokeDashoffset:1},{strokeDasharray:1,strokeDashoffset:0}],{duration:600,delay:150,easing:'ease-out',fill:'backwards'});
        $('.tick',msg).animate([{scale:.6},{scale:1.08,offset:.6},{scale:1}],{duration:550,easing:'ease-out'});
        msg.style.opacity=1;
      }
      setTimeout(function(){$('#doneBtn').focus({preventScroll:true})},300);
    }
    if(reduce){reveal(); finishOrder(); return}
    var ids=o.items.slice(0,5), offs=[-22,2,26,-6,14];
    var tiles=ids.map(function(it,i){
      var p=BY_ID[it.id], c=CAT[p.cat], d=doc.createElement('div'); d.className='dtile';
      d.innerHTML=p.img?'<img alt="" src="'+esc(p.img)+'">':'<span class="phl" aria-hidden="true"></span>';
      d.style.left=(86-23+offs[i])+'px'; d.style.top='92px'; drops.appendChild(d); return d;
    });
    var N=tiles.length, step=240, dur=520;
    tiles.forEach(function(d,i){
      d.animate([{transform:'translateY(-210px) scale(.7) rotate('+(-12+i*7)+'deg)',opacity:0},{opacity:1,offset:.25},{transform:'translateY(0) scale(1) rotate('+(i%2?6:-6)+'deg)',opacity:1}],{duration:dur,delay:300+i*step,easing:'cubic-bezier(.3,.1,.4,1)',fill:'both'});
    });
    var land=300+(N-1)*step+dur;
    cart3.animate([{transform:'translateY(0)'},{transform:'translateY(5px)',offset:.5},{transform:'translateY(0)'}],{duration:260,delay:land-80});
    var lh=stage.animate([{transform:'translateX(0) rotate(0)',opacity:1},{transform:'translateX(-14px) rotate(-2deg)',opacity:1,offset:.2},{transform:'translateX(300px) rotate(2deg)',opacity:0}],{duration:700,delay:land+260,easing:'cubic-bezier(.6,0,.9,.6)',fill:'forwards'});
    lh.onfinish=reveal;
    finishOrder();
  }
  function finishOrder(){
    Object.keys(cart).forEach(function(k){delete cart[k]}); saveCart(); renderCart();
    $$('.p [data-act]').forEach(function(a){a.innerHTML=actionHTML(+a.closest('.p').getAttribute('data-id'))});
  }
  $('#doneBtn').addEventListener('click',function(){
    done.classList.remove('on'); done.hidden=true; done.inert=true; doc.body.style.overflow=''; goHome();
  });
