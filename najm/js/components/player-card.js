// نجم أبو الفضل — رسم كارت اللاعب (زي FIFA)
const FC_SHORT=[['sales','سيلز'],['disc','انضباط'],['beh','سلوك'],['skill','قدرة'],['ideal','مثالية']];
function futCard(e,cls=''){
  const f=futStats(e);const ed=futEdition(e,f);const title=futTitle(e);const B=futBadges(e).slice(0,4);
  const pp=photoPosOf(e);   // ضبط الصورة جوه الكارت: إزاحة وتكبير
  const ph=e.photo?`<img src="${e.photo}" alt="" style="transform:translate(${pp.x}%,${pp.y}%) scale(${pp.z})" draggable="false">`:`<div class="fc-ini">${esc((e.name||'?').trim()[0])}</div>`;
  const brIcon=S.branches.find(b=>b.name===e.branch)?.kind==='factory'?'🏭':'🏪';
  return `<div class="fc ${ed} ${cls}">${ed==='neon'?'<div class="fc-flame">🔥 في الفورمة</div>':''}<div class="fc-frame"></div><div class="fc-body">
    <div class="fc-ovr"><b>${f.ovr??'—'}</b><span>${esc(posOf(e))}</span></div>
    <div class="fc-bdg">${B.map(x=>`<i title="${esc(x.t)}">${x.i}${x.n?`<sub>${x.n}</sub>`:''}</i>`).join('')}</div>
    <div class="fc-halo"></div><div class="fc-ph${e.photo?' has':''}"${e.photo&&isOps()?` onclick="event.stopPropagation();photoEditor('${esc(e.code)}')" title="اضغط واظبط الصورة" style="cursor:pointer"`:''}>${ph}</div>${ed==='icon'?laurelSVG():''}
    <div class="fc-low">${title?`<div class="fc-title">${esc(title)}</div>`:''}
      <div class="fc-name">${esc(e.name.split(' ').slice(0,2).join(' '))}</div>
      <div class="fc-icons"><span>${brIcon} ${esc(e.branch.replace('الرئيسي','').trim())}</span><i></i><img src="${ed==='neon'?LOGO_WHITE:LOGO_HEAD}" alt=""><i></i><span>${esc(e.code)}</span></div>
      <div class="fc-stats">${FC_SHORT.map(([k,l])=>`<div><b>${f[k]??'—'}</b><span>${l}</span></div>`).join('')}</div>
    </div><div class="fc-gem"></div></div><div class="fc-wing l"></div><div class="fc-wing r"></div></div>`;
}

// ---------- ضبط الصورة جوه الكارت (مدير التشغيل): اسحب الصورة فوق/تحت/جنب، واتحكم في التكبير ----------
function photoPosOf(e){const [x,y,z]=String(e?.photoPos||'').split(',').map(Number);return {x:Number.isFinite(x)?x:0,y:Number.isFinite(y)?y:0,z:Number.isFinite(z)&&z>=0.5?z:1};}
let PE=null;
function photoEditor(code){const e=emp(code);if(!e||!e.photo||!isOps())return;PE={code,...photoPosOf(e),orig:e.photoPos||''};
  openModal(`<button class="x" onclick="photoEditorClose()">✕</button><h2>🎯 اظبط صورة ${esc(e.name.split(' ').slice(0,2).join(' '))}</h2>
    <div class="small muted" style="margin-bottom:8px">اسحب الصورة بإيدك أو إصبعك عشان تحرّكها فوق/تحت/جنب، وكبّرها أو صغّرها من الشريط.</div>
    <div class="row" style="justify-content:center;align-items:flex-start;gap:14px;flex-wrap:wrap"><div id="pe_card" style="touch-action:none">${futCard(e,'sm')}</div></div>
    <label class="small" style="display:block;margin-top:10px">🔍 التكبير <b id="pe_zv">${PE.z.toFixed(2)}×</b><br><input id="pe_z" type="range" min="0.6" max="3" step="0.05" value="${PE.z}" style="width:100%"></label>
    <div class="row" style="margin-top:10px"><button class="btn pri" onclick="photoEditorSave()">💾 حفظ</button><button class="btn" onclick="photoEditorReset()">↺ رجّعها زي الأول</button></div>`);
  const box=$('#pe_card .fc-ph'),img=$('#pe_card .fc-ph img');if(!box||!img)return;box.onclick=null;box.style.cursor='grab';
  const apply=()=>{img.style.transform=`translate(${PE.x}%,${PE.y}%) scale(${PE.z})`;$('#pe_zv').textContent=PE.z.toFixed(2)+'×';};
  let d=null;
  box.onpointerdown=ev=>{d={sx:ev.clientX,sy:ev.clientY,x:PE.x,y:PE.y,w:box.clientWidth,h:box.clientHeight};box.setPointerCapture(ev.pointerId);box.style.cursor='grabbing';ev.preventDefault();};
  box.onpointermove=ev=>{if(!d)return;const lim=90;PE.x=Math.max(-lim,Math.min(lim,d.x+(ev.clientX-d.sx)/d.w*100));PE.y=Math.max(-lim,Math.min(lim,d.y+(ev.clientY-d.sy)/d.h*100));apply();};
  box.onpointerup=box.onpointercancel=()=>{d=null;box.style.cursor='grab';};
  $('#pe_z').oninput=ev=>{PE.z=+ev.target.value;apply();};}
const photoPosStr=()=>`${PE.x.toFixed(1)},${PE.y.toFixed(1)},${PE.z.toFixed(2)}`;
function photoEditorReset(){PE.x=0;PE.y=0;PE.z=1;const img=$('#pe_card .fc-ph img');if(img)img.style.transform='translate(0%,0%) scale(1)';$('#pe_z').value=1;$('#pe_zv').textContent='1.00×';}
function photoEditorClose(){PE=null;closeModal();}
async function photoEditorSave(){if(!PE)return;const e=emp(PE.code);const v=(PE.x===0&&PE.y===0&&PE.z===1)?'':photoPosStr();e.photoPos=v;if(typeof noteMedia==='function')noteMedia(PE.code,'photoPos',v);save();
  const code=PE.code;PE=null;closeModal();render();if(await push('media',{code},{photo_pos:v})!==false)toast('✔ اتحفظ ضبط الصورة');}
