// نجم أبو الفضل — تاب التارجت والكابتن
// ---------- Targets & captain ----------
let TG={branch:'',dept:'',mode:'view'};
function catalog(){ // product list: code -> name (from uploaded sales; linked to dc_products once the database is live)
  const out={};
  const add=o=>{for(const[k,v]of Object.entries(o||{}))if(!out[k])out[k]=v.name;};
  for(const m of Object.values(S.baseSales))for(const b of Object.values(m))add(b);
  for(const d of Object.values(S.sales))for(const b of Object.values(d))add(b);
  return out;
}
function vTarget(){
  const m=monthOf(DATE);
  // الموظف بيشوف تارجت قسمه بس · مدير الفرع فرعه بس · التشغيل كل الفروع
  if(isEmp()){const e=emp(ME);TG.branch=e.branch;TG.dept=e.dept;TG.mode='view';
    return `<div class="sec-title"><h2>🎯 تارجت قسمك — ${esc(e.dept)} · ${monthName(m)}</h2></div>${targetDetail(m)}`;}
  if(USER?.branch&&!isOps())TG.branch=USER.branch;
  if(!TG.branch)TG.branch=USER?.branch||branches()[0];
  const cards=deptsOf(TG.branch).map(d=>{
    const p=deptProgress(m,TG.branch,d,DATE);const caps=captainsIn(m,DATE,e=>e.branch===TG.branch&&e.dept===d);const capPeople=new Set(caps.map(c=>c.code)).size;
    return `<div class="card" style="cursor:pointer" onclick="TG.dept='${esc(d)}';TG.mode='view';render()">
      <div class="sec-title" style="margin:0 0 6px"><b>${esc(d)}</b>${p?`<span class="badge ${p.type==='sales'?'b-blue':'b-green'}">${p.type==='sales'?'مبيعات (كميات)':'تشغيلي'}</span>`:'<span class="badge b-gray">لم يُحدد</span>'}</div>
      ${p&&p.pct!=null?`${barHTML(p.pct,p.pace)}<div class="kv"><span>${p.pace!=null?`المفروض لحد النهارده ${fmt(p.pace)}%`:'الإنجاز'}</span><b>${fmt(p.pct)}% · ${(c=>+c?.pts>0?`${fmt(Math.round(+c.pts*tgtRatio(p.pct)))} / ${fmt(c.pts)}`:fmt(p.points))(tgtCfg(m,TG.branch,d))} نقطة</b></div>`:p?'<div class="small muted">مفيش بيانات لسه</div>':''}
      ${(c=>+c?.pts>0?`<div class="small muted">⭐ ${fmt(c.pts)} نقطة لو اتقفل</div>`:isOps()?'<div class="small" style="color:var(--red)">⭐ لسه محددتش نقط القسم ده</div>':'')(tgtCfg(m,TG.branch,d))}
      ${caps.length?`<div class="kv"><span><span class="cap-c" style="width:16px;height:16px;font-size:10px">C</span> كابتن شخصي</span><b style="color:var(--purple)">${fmt(capPeople)} موظف · ${fmt(caps.length)} منتج</b></div>`:''}
    </div>`;}).join('');
  const canUpload=isMgr()&&USER.role!=='fresh'&&!isHy();
  return `<div class="sec-title"><h2>🎯 التارجت والكابتن — ${monthName(m)}</h2>
    <div class="row">${canUpload?`<button class="btn pri" onclick="importSales()">📥 تقرير المبيعات اليومي</button>`:''}${isOps()?`<button class="btn" onclick="importSales(true)">📊 مبيعات شهر كامل (للتخطيط)</button>`:''}${canUpload?`<button class="btn" onclick="openImports()">📂 الملفات المرفوعة</button>`:''}</div></div>
    <div class="lock" style="margin-bottom:10px"><b>النقط بيحددها مدير التشغيل أول كل شهر:</b> نقط تارجت كل قسم، ونقط كل كابتن، والمطلوب للعشرة الأوائل — والتطبيق بيحسب الباقي لوحده. التارجت بالكميات للقسم كله. <b>الكابتن</b>: تارجت شخصي إضافي لكل شيف/سيلز على صنف أو أكتر، بالكيلو المتباع من شيت فوديكس. الأقسام اللي مش مبيعات: نضافة + تقييم المدير المباشر. شكوى ضغط في البيع = −${S.settings.complaintPenalty}%.</div>
    <div class="chips" style="margin-bottom:12px">${(USER?.branch&&!isOps()?[USER.branch]:branches()).map(b=>`<button class="chip ${TG.branch===b?'on':''}" onclick="TG.branch='${esc(b)}';TG.dept='';render()">${esc(b)}</button>`).join('')}</div>
    ${ribbonHTML([TG.branch])}
    ${TG.dept?(TG.mode==='edit'&&isOps()?targetEditor(m):targetDetail(m)):''}
    <div class="grid g-2" style="margin-top:12px">${cards||'<div class="empty">مفيش أقسام</div>'}</div>`;
}
function captainPanel(m){
  const L=activeEmps().filter(e=>e.branch===TG.branch&&e.dept===TG.dept);
  const rows=L.map(e=>({e,caps:captainsOfEmp(e,m,DATE,false)})).filter(x=>x.caps.length);
  const team=L.filter(e=>inScope(e));const can=team.length>0;
  return `<div class="card" style="margin-top:10px;border-color:#cfc4ff;background:#faf8ff"><div class="sec-title" style="margin:0 0 6px"><h3>🎗️ الكابتن الشخصي</h3><span class="small muted">كل موظف ليه صنف أو أكتر — بيتحسب من كيلوهات الفرع في شيت فوديكس</span></div>
    ${rows.length?`<table><thead><tr><th>الموظف</th><th>المنتج</th><th>التارجت</th><th>المتباع</th><th>الإنجاز</th><th>النقاط</th>${can?'<th></th>':''}</tr></thead><tbody>${rows.map(x=>x.caps.map((c,i)=>`<tr style="${c.active===false?'opacity:.5':''}">${i===0?`<td rowspan="${x.caps.length}"><div class="row" style="flex-wrap:nowrap;gap:6px">${ava(x.e,'sm')}<b>${esc(x.e.name)}</b></div></td>`:''}<td><span class="cap-c" style="width:18px;height:18px;font-size:11px">C</span> ${esc(c.name)} <span class="small muted">${esc(c.sku)}</span></td><td>${fmt(c.target,1)}</td><td>${fmt(c.sold,1)}</td><td style="min-width:110px">${barHTML(c.pct,null,'cap')}<span class="small">${fmt(c.pct)}%</span></td><td><b>${fmt(c.points)}</b> <span class="small muted">/ ${fmt(c.max)}${+c.pts>0?'':' (× '+S.settings.captainMult+')'}</span></td>${can?`<td class="row" style="gap:4px">${inScope(x.e)?`<button class="btn sm" onclick="toggleCap('${x.e.code}','${esc(c.sku)}')">${c.active===false?'تفعيل':'إيقاف'}</button><button class="btn sm red" onclick="delCap('${x.e.code}','${esc(c.sku)}')">حذف</button>`:''}</td>`:''}</tr>`).join('')).join('')}</tbody></table>`:'<div class="small muted">لسه محدش واخد كابتن في القسم ده</div>'}
    ${can?`<div class="row" style="margin-top:8px"><select class="inp" id="capEmp">${team.map(e=>`<option value="${e.code}">${esc(e.name)}</option>`).join('')}</select><input class="inp" id="capCode" placeholder="كود المنتج (sk-…)" style="width:140px" oninput="capLookup()"><span id="capName" class="small muted">اكتب الكود يطلع المنتج</span><input class="inp" id="capTarget" type="number" placeholder="التارجت (كيلو)" style="width:110px">${isOps()?'<input class="inp" id="capPts" type="number" placeholder="نقط الكابتن" style="width:110px">':''}<button class="btn pri sm" onclick="addCap()">+ كابتن</button></div>`:''}
  </div>`;
}
function capLookup(){
  const code=$('#capCode').value.trim().toLowerCase();const cat=catalog();const k=Object.keys(cat).find(x=>x.toLowerCase()===code);
  $('#capName').innerHTML=k?`<b style="color:var(--purple)">${esc(cat[k])}</b>`:(code?'<span style="color:var(--red)">مش موجود</span>':'اكتب الكود يطلع المنتج');
  if(k&&!$('#capTarget').value){const q=baseFor(monthOf(DATE))[k]?.qty;if(q)$('#capTarget').value=Math.round(q*S.settings.defaultMultiplier);}
}
function addCap(){
  const code=$('#capCode').value.trim();const cat=catalog();const k=Object.keys(cat).find(x=>x.toLowerCase()===code.toLowerCase());
  const ec=$('#capEmp').value;const e=emp(ec);if(!e||!inScope(e)){toast('اختار موظف من فريقك');return;}
  if(!k){toast('الكود مش موجود');return;}const t=+$('#capTarget').value;if(!(t>0)){toast('حط تارجت للكابتن');return;}
  const m=monthOf(DATE);const M=S.captains[m]||(S.captains[m]={});const L=M[ec]||(M[ec]=[]);
  const ex=L.find(c=>c.sku===k);const cp=isOps()?(+$('#capPts')?.value||null):(ex?.pts??null);
  if(ex){ex.target=t;ex.active=true;ex.pts=cp;}else L.push({sku:k,name:cat[k],target:t,pts:cp,active:true,by:USER.username});
  save();render();push('captain',{month:m,code:ec,sku:k},{name:cat[k],target:t,pts:cp,active:true});toast('🎗️ اتفعّل الكابتن لـ '+e.name);
}
function toggleCap(code,sku){const c=(S.captains[monthOf(DATE)]?.[code]||[]).find(x=>x.sku===sku);if(!c)return;c.active=c.active===false;save();render();push('captain',{month:monthOf(DATE),code,sku},{name:c.name,target:c.target,pts:c.pts??null,active:c.active});}
async function delCap(code,sku){if(!await askConfirm('حذف الكابتن؟'))return;const M=S.captains[monthOf(DATE)];M[code]=(M[code]||[]).filter(x=>x.sku!==sku);save();render();push('captain',{month:monthOf(DATE),code,sku},null);}
function targetDetail(m){
  const p=deptProgress(m,TG.branch,TG.dept,DATE);
  const head=`<div class="sec-title"><h3>${esc(TG.branch)} — ${esc(TG.dept)}</h3><div class="row">${isOps()?`<button class="btn sm" onclick="TG.mode='edit';render()">✏️ تعديل التارجت</button>`:''}<button class="btn sm" onclick="TG.dept='';render()">✕</button></div></div>`;
  let body;
  if(!p) body=`<div class="empty">التارجت الأساسي لسه متحددش للقسم ده</div>`;
  else if(p.type==='sales') body=`<div class="tbl-wrap" style="max-height:45vh"><table><thead><tr><th>الصنف</th><th>التارجت</th><th>المتباع</th><th>الإنجاز</th></tr></thead><tbody>
    ${p.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${fmt(i.target,1)}</td><td>${fmt(i.sold,1)}</td><td style="min-width:140px">${barHTML(i.pct,p.pace)}<span class="small">${fmt(i.pct)}%</span></td></tr>`).join('')}</tbody></table></div>`;
  else body=`${isMgr()&&deptInScope(TG.branch,TG.dept)?`<div class="row" style="margin-bottom:8px"><b class="small">تسجيل يوم ${esc(DATE)}:</b>${p.kpis.filter(k=>k.kind!=='mgr').map(k=>`<label class="small">${esc(k.name)} <input class="inp" type="number" style="width:70px" value="${S.kpiVals[DATE]?.[deptKey(TG.branch,TG.dept)]?.[k.id]??''}" onchange="setKpi('${k.id}',this.value)"></label>`).join('')}</div>`:''}
    <table><thead><tr><th>المؤشر</th><th>النوع</th><th>التارجت</th><th>المحقق</th><th>الإنجاز</th></tr></thead><tbody>
    ${p.kpis.map(k=>`<tr><td>${esc(k.name)}</td><td class="small">${KPI_KINDS[k.kind]}</td><td>${fmt(k.target,1)}${k.kind==='errors'?' حد أقصى':k.kind==='score'?' متوسط':k.kind==='mgr'?'%':''}</td><td>${k.val!=null?fmt(k.val,1)+(k.kind==='mgr'?'%':''):'—'} <span class="small muted">(${fmt(k.n)} يوم)</span></td><td style="min-width:140px">${barHTML(k.pct)}<span class="small">${fmt(k.pct)}%</span></td></tr>`).join('')}</tbody></table>`;
  return `<div class="card">${head}${body}</div>${p?.type!=='manual'?captainPanel(m):''}`;
}
function setKpi(id,v){const k=deptKey(TG.branch,TG.dept);const D=S.kpiVals[DATE]||(S.kpiVals[DATE]={});const b=D[k]||(D[k]={});if(v==='')delete b[id];else b[id]=+v;save();render();push('kpi',{day:DATE,dkey:k,branch:TG.branch},b);}
let DRAFT=null;
function baseFor(m){const pm=prevMonth(m);return Object.keys(S.baseSales[pm]?.[TG.branch]||{}).length?S.baseSales[pm][TG.branch]:salesAgg(pm,TG.branch);}
function targetEditor(m){
  const key=deptKey(TG.branch,TG.dept);
  if(!DRAFT||DRAFT._key!==key+m){const cur=S.targets[m]?.[key];DRAFT=cur?JSON.parse(JSON.stringify(cur)):{type:'sales',items:[],kpis:[]};DRAFT.items=DRAFT.items||[];DRAFT.kpis=DRAFT.kpis||[];DRAFT._key=key+m;DRAFT.mult=S.settings.defaultMultiplier;DRAFT.q='';}
  const head=`<div class="sec-title"><h3>✏️ تارجت ${esc(TG.branch)} — ${esc(TG.dept)} — ${monthName(m)}</h3><div class="row"><button class="btn pri sm" onclick="saveTarget()">💾 حفظ</button><button class="btn sm" onclick="DRAFT=null;TG.mode='view';render()">إلغاء</button></div></div>
    <div class="card" style="margin-bottom:10px;border-color:#cfc4ff;background:#faf8ff"><b>⭐ نقط القسم للشهر ده</b><div class="row" style="margin-top:6px">
      <label class="small">نقط التارجت لو اتقفل 100%<br><input class="inp" type="number" style="width:120px" value="${DRAFT.pts??''}" placeholder="مثلاً 100" onchange="DRAFT.pts=+this.value||null"></label></div>
      <div class="small muted" style="margin-top:4px">شرط العشرة الأوائل: القسم يحقق ${fmt(TGT_G())}% من التارجت (من «قواعد الشهر» في الإعدادات).</div></div>
    <div class="chips" style="margin-bottom:10px"><button class="chip ${DRAFT.type==='sales'?'on':''}" onclick="DRAFT.type='sales';render()">🛒 مبيعات (كميات)</button><button class="chip ${DRAFT.type==='manual'?'on':''}" onclick="DRAFT.type='manual';render()">🧹 تشغيلي</button></div>`;
  if(DRAFT.type==='manual') return `<div class="card">${head}
    <div class="row small" style="margin-bottom:8px">قوالب: ${Object.keys(PRESETS).map(p=>`<button class="btn sm" onclick="applyPreset('${p}')">${p}</button>`).join('')}</div>
    <table><thead><tr><th>المؤشر</th><th>النوع</th><th>التارجت</th><th>الوزن</th><th></th></tr></thead><tbody>
    ${DRAFT.kpis.map((k,i)=>`<tr><td><input class="inp" value="${esc(k.name)}" onchange="DRAFT.kpis[${i}].name=this.value"></td><td><select class="inp" onchange="DRAFT.kpis[${i}].kind=this.value;render()">${Object.entries(KPI_KINDS).map(([v,t])=>`<option value="${v}" ${k.kind===v?'selected':''}>${t}</option>`).join('')}</select></td><td><input class="inp" type="number" style="width:80px" value="${k.target}" onchange="DRAFT.kpis[${i}].target=+this.value"></td><td><input class="inp" type="number" style="width:55px" value="${k.weight}" onchange="DRAFT.kpis[${i}].weight=+this.value"></td><td><button class="btn sm red" onclick="DRAFT.kpis.splice(${i},1);render()">حذف</button></td></tr>`).join('')}
    </tbody></table><button class="btn sm" style="margin-top:8px" onclick="DRAFT.kpis.push({id:uid(),name:'',kind:'score',target:9,weight:1});render()">+ مؤشر</button></div>`;
  const base=baseFor(m);const chosen=new Set(DRAFT.items.map(i=>i.key));const q=norm(DRAFT.q);
  const list=Object.entries(base).map(([k,v])=>({key:k,name:v.name,qty:v.qty})).filter(x=>!q||norm(x.name).includes(q)||x.key.includes(q)).sort((a,b)=>b.qty-a.qty).slice(0,300);
  return `<div class="card">${head}
    <div class="lock" style="margin-bottom:8px">التارجت = مبيعات ${monthName(prevMonth(m))} × المُضاعِف، وتقدر تعدّل أي رقم.</div>
    <div class="grid g-2"><div><h3>أصناف القسم (${fmt(chosen.size)})</h3><div class="tbl-wrap" style="max-height:50vh"><table><thead><tr><th>الصنف</th><th>الشهر اللي فات</th><th>التارجت</th><th></th></tr></thead><tbody>
      ${DRAFT.items.map((it,i)=>`<tr><td class="small">${esc(it.name)}</td><td class="small">${fmt(base[it.key]?.qty,1)}</td><td><input class="inp" type="number" style="width:85px" value="${it.target}" onchange="DRAFT.items[${i}].target=+this.value"></td><td><button class="btn sm red" onclick="DRAFT.items.splice(${i},1);render()">✕</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty small">اختار أصناف</td></tr>'}</tbody></table></div></div>
      <div><h3>مبيعات ${monthName(prevMonth(m))}</h3><div class="row" style="margin-bottom:6px"><input class="inp" placeholder="بحث بالاسم أو الكود" value="${esc(DRAFT.q)}" onchange="DRAFT.q=this.value;render()"><label class="small">× <input class="inp" type="number" step="0.1" style="width:60px" value="${DRAFT.mult}" onchange="DRAFT.mult=+this.value"></label></div>
      ${list.length?`<div class="tbl-wrap" style="max-height:50vh"><table><thead><tr><th>الصنف</th><th>الكمية</th><th></th></tr></thead><tbody>${list.map(x=>`<tr><td class="small">${esc(x.name)}</td><td>${fmt(x.qty,1)}</td><td>${chosen.has(x.key)?'<span class="badge b-green">مضاف</span>':`<button class="btn sm" onclick="addItem('${esc(x.key)}')">+</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty small">ارفع مبيعات الشهر اللي فات الأول</div>'}</div></div></div>`;
}
function addItem(key){const b=baseFor(monthOf(DATE))[key];if(!b)return;DRAFT.items.push({key,name:b.name,target:Math.round(b.qty*(DRAFT.mult||1)*10)/10});render();}
function applyPreset(p){DRAFT.kpis=PRESETS[p].map(k=>({...k,id:uid()}));render();}
async function saveTarget(){
  const m=monthOf(DATE);const key=deptKey(TG.branch,TG.dept);
  const cfg=DRAFT.type==='sales'?{type:'sales',items:DRAFT.items.filter(i=>i.target>0)}:{type:'manual',kpis:DRAFT.kpis.filter(k=>k.name.trim())};
  if(DRAFT.pts>0)cfg.pts=DRAFT.pts;if(DRAFT.need>0)cfg.need=DRAFT.need;
  (S.targets[m]||(S.targets[m]={}))[key]=cfg;save();DRAFT=null;TG.mode='view';render();
  if(await push('target',{month:m,dkey:key},cfg)!==false)toast('💾 اتحفظ التارجت');
}
