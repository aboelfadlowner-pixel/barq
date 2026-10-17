  /* category switcher */
  var cs=$('#cs'), csBtn=$('#csBtn');
  function csBuild(){
    var all=[{id:'all',name:'كل المنتجات'}].concat(CATS);
    $('#csGrid').innerHTML=all.map(function(c,i){
      return '<button class="cs-tile" type="button" data-go="'+c.id+'" style="--i:'+i+'"'+(c.id===state.cat?' aria-current="true"':'')+'><span class="t">'+(c.id==='all'?icon('i-all'):thumb(c))+'</span>'+c.name+'</button>';
    }).join('');
  }
  function openCS(){csBuild(); cs.inert=false; cs.classList.add('open'); scrim.classList.add('on'); doc.body.style.overflow='hidden'; csBtn.setAttribute('aria-expanded','true'); setTimeout(function(){var a=$('[aria-current="true"]',cs)||$('#csClose'); a.focus({preventScroll:true})},60)}
  function closeCS(){cs.classList.remove('open'); cs.inert=true; csBtn.setAttribute('aria-expanded','false'); if(!drawer.classList.contains('open')&&!co.classList.contains('open')&&!pd.classList.contains('open')){scrim.classList.remove('on'); doc.body.style.overflow=''}}
  csBtn.addEventListener('click',openCS); $('#csClose').addEventListener('click',closeCS); scrim.addEventListener('click',closeCS);
  cs.addEventListener('click',function(e){if(e.target.closest('[data-go]')) closeCS()});
  doc.addEventListener('keydown',function(e){if(e.key==='Escape'&&cs.classList.contains('open')) closeCS()});
