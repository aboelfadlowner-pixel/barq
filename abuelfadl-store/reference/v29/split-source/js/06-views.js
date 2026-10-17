  /* ---------- views ---------- */
  function instant(fn){root.style.scrollBehavior='auto'; fn(); root.style.scrollBehavior=''}
  function setNav(){
    $$('[data-nav]').forEach(function(b){
      var k=b.getAttribute('data-nav');
      b.classList.toggle('on',(k==='home'&&state.view==='home')||(k==='cats'&&state.view==='cat'));
    });
  }
  function showView(v){
    state.view=v;
    $('#viewHome').hidden=v!=='home';
    $('#viewCat').hidden=v!=='cat';
    instant(function(){window.scrollTo(0,0)});
    setNav(); markNav();
  }
  function openCat(id,q){
    state.cat=id||'all'; state.sub='all'; state.q=q||''; input.value=state.q; closeSug();
    showView('cat');
    var a=renderCat();
    if(a&&a.scrollIntoView) a.scrollIntoView({inline:'center',block:'nearest'});
  }
  function goHome(){ state.q=''; input.value=''; closeSug(); showView('home') }
