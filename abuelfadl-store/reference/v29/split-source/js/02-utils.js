  var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var norm=function(s){return String(s).toLowerCase().replace(/[ً-ٟـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').trim()};
  var money=function(n){return n.toLocaleString('en-US',{maximumFractionDigits:2})};
  var r2=function(x){return Math.round(x*100)/100};
  var isW=function(id){return !!BY_ID[id].weighed}, stepOf=function(id){return BY_ID[id].step||0.25}, capOf=function(id){return isW(id)?10:20};
  function wLabel(q){
    var w=Math.floor(q+1e-9), f=r2(q-w), fn={0.25:'ربع',0.5:'نصف',0.75:'ثلاثة أرباع'}[f];
    if(f!==0&&!fn) return q<1?Math.round(q*1000)+' جم':q+' كيلو';
    if(!w) return fn+' كيلو';
    if(!f) return w+' كيلو';
    return w+' كيلو و'+fn;
  }
  var qLabel=function(id,q){return isW(id)?wLabel(q):q};
  var icon=function(id){return '<svg class="ico" aria-hidden="true"><use href="#'+id+'"/></svg>'};
  var thumb=function(c){return c.photo?'<img class="ph" alt="" src="'+c.photo+'">':art(c.art)};
  var art=function(id,vb){return '<svg class="art"'+(vb?' viewBox="'+vb+'"':'')+' aria-hidden="true"><use href="#'+id+'"/></svg>'};
