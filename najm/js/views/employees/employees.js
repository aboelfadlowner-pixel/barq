// نجم أبو الفضل — تاب ملفات الموظفين وملف الموظف
// ---------- Employee files (managers) ----------
function vEmps(){
  const list=filtered(true);
  return `<div class="sec-title"><h2>🗂️ ملفات الموظفين</h2>${isOps()?`<div class="row"><button class="btn" onclick="editEmp()">+ موظف</button><button class="btn" onclick="importEmps()">📥 تحديث من شيت الموظفين</button><button class="btn gold" onclick="bulkPhotos()">📷 رفع صور بالجملة</button></div>`:''}</div>
    ${isOps()?'<div class="lock" style="margin-bottom:10px">رفع الصور بالجملة: اختار كل الصور مرة واحدة، وكل صورة اسمها كود الموظف (زي 125.jpg) — بتتقص طولي زي كارت اللاعب وتترفع لوحدها.</div>':''}
    ${filterBar({scoped:true})}
    <div class="tbl-wrap"><table><thead><tr><th></th><th>الكود</th><th>الاسم</th><th>الفرع</th><th>القسم</th><th>الوظيفة</th><th>الشيفت</th><th>الشهر</th></tr></thead><tbody>
    ${list.map(e=>{const ms=msOf(e);return `<tr style="cursor:pointer" onclick="openEmp('${e.code}')"><td>${ava(e,'sm')}</td><td>${esc(e.code)}</td><td><b>${esc(e.name)}</b> ${e.video?'🎬':''}</td><td class="small">${esc(e.branch)}</td><td class="small">${esc(e.dept)}</td><td class="small">${esc(e.job)}</td><td class="small">${esc(e.shift)}</td><td class="small">${ms.monthScore!=null?fmt(ms.monthScore)+'/100':'—'} ${cardsHTML(ms.cards)}</td></tr>`;}).join('')}
    </tbody></table></div>`;
}
function openEmp(code){
  const e=emp(code);if(!e)return;const m=monthOf(DATE);const R=ranks();const ms=msOf(e);const t=ms.target;
  const mgr=isMgr()&&inScope(e);
  const days=monthDays(m);const off=(new Date(days[0]).getDay()+1)%7;
  const cal=Array(off).fill('<div style="border:0"></div>').concat(days.map(d=>{const s=score(d,code);const w=isWinner(d,code);const cs=S.cards.filter(c=>c.code===code&&c.date===d&&c.approved);return `<div class="${w?'w':''}"><div class="muted">${+d.slice(8)}</div>${s.st==='abs'?'<span style="color:var(--red)">غ</span>':s.total!=null?`<b>${fmt(s.total,2)}</b>`:''}${w?'🏆':''}${cs.map(c=>`<i class="fcard ${c.color}" style="width:8px;height:11px"></i>`).join('')}</div>`;})).join('');
  let crit='';
  if(mgr){
    const rows=['br','sh','fr','ops'].filter(f=>f!=='fr'||isFresh(e)).map(f=>{const sums=[0,0,0,0,0],cnt=[0,0,0,0,0];for(const d of days){const a=peekDay(d)[f][code];if(a)a.forEach((v,i)=>{if(v!=null){sums[i]+=v;cnt[i]++;}});}return {f,sums,cnt};});
    const nm={br:'مدير الفرع',sh:'مدير الشيفت',fr:'الفريش فود',ops:'التشغيل'};
    crit=`<div class="card"><h3>تفاصيل البنود (للمديرين فقط)</h3><table><thead><tr><th>البند</th>${rows.map(r=>`<th>${nm[r.f]}</th>`).join('')}</tr></thead><tbody>${CRITERIA.map((c,i)=>`<tr><td class="small">${c}</td>${rows.map(r=>`<td>${r.cnt[i]?fmt(r.sums[i]/r.cnt[i],1):'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  const media=`${e.video?`<video src="${e.video}" controls playsinline style="width:100%;max-height:320px;margin-bottom:12px"></video>`:''}`;
  const caps=t?.caps||[];
  openModal(`<button class="x" onclick="closeModal()">✕</button>
   <div class="row" style="gap:16px;margin-bottom:14px">
     ${futCard(e,'sm')}
     <div style="flex:1;min-width:200px"><h2 style="margin:0">${esc(e.name)}</h2>
       <div class="muted">${esc(e.job)} · ${esc(e.dept)} · ${esc(e.branch)} · شيفت ${esc(e.shift)}</div>
       <div class="row" style="margin-top:6px;gap:6px">${R.company[code]?`<span class="badge b-blue">#${fmt(R.branch[code])} في الفرع</span><span class="badge b-blue">#${fmt(R.company[code])} في المؤسسة من ${fmt(R.total)}</span>`:''}<span class="badge b-gold">🏆 ${fmt(ms.wins)} مرة رجل اليوم</span>${(t=>t?`<span class="badge b-gold">${CUP_NAME[t]}${cash()?` · ${fmt(prizes()[t])} ج`:''}</span>`:'')(cupOf(prizeRank(code)))}${cardsHTML(ms.cards)}</div></div>
     ${isOps()?`<div class="row" style="gap:6px;align-self:flex-start"><button class="btn sm" onclick="setPhoto('${code}')">📷 صورة</button><button class="btn sm" onclick="setVideo('${code}')">🎬 فيديو</button><button class="btn sm" onclick="setTitle('${code}')">🏷️ لقب</button><button class="btn sm" onclick="editEmp('${code}')">✏️</button></div>`:''}
   </div>
   ${media}
   <div class="grid g-2" style="margin-bottom:12px">
     <div class="card"><h3>${monthName(m)}</h3>
       <div class="kv"><span>متوسط النجوم</span><span>${starsHTML(ms.avg)} <b>${fmt(ms.avg,2)}</b></span></div>
       <div class="kv"><span>تقييم الشهر (بعد الكروت)</span><b>${fmt(ms.monthScore)}/100 ${ms.cardPts?`<span class="small" style="color:${ms.cardPts<0?'var(--red)':'var(--green)'}">(${ms.cardPts>0?'+':''}${fmt(ms.cardPts)})</span>`:''}</b></div>
       <div class="kv"><span>غياب / تأخير</span><b>${fmt(ms.abs)} / ${fmt(ms.late)}</b></div>
       <div class="kv"><span>تارجت القسم</span><b>${t?.pct!=null?fmt(t.pct)+'% · '+fmt(t.basePoints)+' نقطة':'—'}</b></div>${t?.pct!=null?barHTML(t.pct,t.pace):''}
       ${caps.map(c=>`<div class="kv"><span><span class="cap-c" style="width:16px;height:16px;font-size:10px">C</span> ${esc(c.name)}</span><b style="color:var(--purple)">${fmt(c.pct)}% · ${fmt(c.points)} ن</b></div>`).join('')}
       <div class="kv"><span>إجمالي النقاط</span><b>${t?.empPoints!=null?fmt(t.empPoints)+' نقطة':'—'}${t?.complaints?` <span class="badge b-red">−${S.settings.complaintPenalty}% شكوى</span>`:''}</b></div>
       ${isOps()&&t?.empPoints!=null&&S.settings.bonusAt100?`<div class="kv"><span>المكافأة (التشغيل فقط)</span><b>${fmt(money(t.empPoints))} ج</b></div>`:''}
     </div>${crit||`<div class="card"><h3>النجوم يوم بيوم</h3><div class="cal">${['سبت','أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة'].map(d=>`<div style="border:0;min-height:0" class="muted">${d}</div>`).join('')}${cal}</div></div>`}
   </div>
   ${mgr?`<div class="card" style="margin-bottom:12px"><h3>النجوم يوم بيوم</h3><div class="cal">${['سبت','أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة'].map(d=>`<div style="border:0;min-height:0" class="muted">${d}</div>`).join('')}${cal}</div></div>
   <div class="grid g-2">
     <div class="card"><h3>🟨🟥🟩 الكروت</h3>${S.cards.filter(c=>c.code===code).sort((a,b)=>b.date.localeCompare(a.date)).map(c=>`<div class="small" style="margin:4px 0"><i class="fcard ${c.color}"></i> <b>${c.date}</b> — ${esc(c.reason)} ${c.approved?'':'<span class="badge b-gray">⏳</span>'}</div>`).join('')||'<div class="small muted">مفيش</div>'}</div>
     <div class="card"><h3>⭐ مواقف مثالية</h3>${days.map(d=>({d,b:peekDay(d).bonus[code]})).filter(x=>x.b).map(x=>`<div class="small" style="margin:4px 0"><b>${x.d}</b> — ${esc(x.b.note)}</div>`).join('')||'<div class="small muted">مفيش</div>'}</div>
     <div class="card"><h3>⚠️ شكاوى العملاء</h3>${S.complaints.filter(c=>c.code===code).map(c=>`<div class="small row" style="justify-content:space-between;margin:4px 0"><span><b>${c.date}</b> — ${esc(c.note)}</span>${isOps()?`<button class="btn sm red" onclick="delComplaint('${c.id}','${code}')">حذف</button>`:''}</div>`).join('')||'<div class="small muted">مفيش</div>'}${isOps()?`<button class="btn sm red" style="margin-top:6px" onclick="addComplaint('${code}')">+ شكوى</button>`:''}</div>
     <div class="card"><h3>📝 ملاحظات الإدارة</h3>${S.notes.filter(n=>n.code===code).map(n=>`<div class="small" style="margin:4px 0"><b>${n.date}</b> (${esc(n.by)}) — ${esc(n.text)}</div>`).join('')||'<div class="small muted">مفيش</div>'}<button class="btn sm" style="margin-top:6px" onclick="addNote('${code}')">+ ملاحظة</button></div>
   </div>`:''}`);
}
async function addComplaint(code){const n=await askText('تفاصيل الشكوى:');if(n===null)return;const id=uid(),note=n.trim()||'شكوى ضغط في البيع';S.complaints.push({id,date:DATE,code,note});save();openEmp(code);render();push('complaint',{id},{date:DATE,code,note});}
async function delComplaint(id,code){if(!await askConfirm('حذف؟'))return;S.complaints=S.complaints.filter(c=>c.id!==id);save();openEmp(code);render();push('complaint',{id},null);}
async function addNote(code){const n=await askText('الملاحظة:');if(!n||!n.trim())return;const id=uid();S.notes.push({id,date:DATE,code,text:n.trim(),by:USER.username});save();openEmp(code);push('note',{id,code},{date:DATE,text:n.trim()});}
function setPhoto(code){pickFile('image/*',async f=>{try{toast('⏳ بنرفع الصورة…');await savePhoto(code,f);openEmp(code);render();toast('📷 اترفعت الصورة');}catch(e){toast('⚠️ الصورة ماترفعتش');}});}
function setVideo(code){pickFile('video/*',f=>{if(f.size>30*1024*1024){toast('الفيديو أكبر من 30 ميجا');return;}if(LIVE){(async()=>{try{toast('⏳ بنرفع الفيديو…');const ext=(f.name.split('.').pop()||'mp4').toLowerCase();const url=await uploadMedia(code,f,ext);emp(code).video=url;await push('media',{code},{video:url});openEmp(code);render();toast('🎬 اترفع الفيديو');}catch(e){toast('⚠️ الفيديو ماترفعش');}})();return;}const r=new FileReader();r.onload=()=>{emp(code).video=r.result;save();openEmp(code);render();toast('🎬 اترفع الفيديو');};r.readAsDataURL(f);});}
function editEmp(code){
  const e=code?emp(code):{code:'',name:'',branch:branches()[0],dept:'',job:'',shift:'Morning',active:true};
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>${code?'تعديل موظف':'موظف جديد'}</h2>
   <div class="grid g-2">
    <label>الكود<br><input class="inp" id="f_code" value="${esc(e.code)}" ${code?'disabled':''}></label>
    <label>الاسم<br><input class="inp" id="f_name" value="${esc(e.name)}"></label>
    <label>الفرع<br><select class="inp" id="f_branch">${branches().map(b=>`<option ${b===e.branch?'selected':''}>${esc(b)}</option>`).join('')}</select></label>
    <label>القسم<br><input class="inp" id="f_dept" list="dl_dept" value="${esc(e.dept)}"><datalist id="dl_dept">${deptsOf('').map(d=>`<option>${esc(d)}</option>`).join('')}</datalist></label>
    <label>الوظيفة<br><input class="inp" id="f_job" value="${esc(e.job)}"></label>
    <label>الشيفت<br><select class="inp" id="f_shift">${Object.values(SH).map(s=>`<option ${s===e.shift?'selected':''}>${s}</option>`).join('')}</select></label>
    <label><input type="checkbox" id="f_active" ${e.active?'checked':''}> على راس العمل</label>
   </div><div class="row" style="margin-top:12px"><button class="btn pri" onclick="saveEmp('${esc(code||'')}')">💾 حفظ</button></div>`);
}
function saveEmp(code){
  const v=id=>$('#'+id).value.trim();const c=code||v('f_code');if(!c||!v('f_name')){toast('الكود والاسم مطلوبين');return;}
  if(!code&&emp(c)){toast('الكود موجود');return;}
  const e=code?emp(code):{code:c,photo:'',video:''};
  Object.assign(e,{name:v('f_name'),branch:v('f_branch'),dept:v('f_dept'),job:v('f_job'),shift:v('f_shift'),active:$('#f_active').checked});
  if(!code)S.employees.push(e);save();closeModal();render();push('employee',{code:e.code},{name:e.name,branch:e.branch,dept:e.dept,job:e.job,shift:e.shift,active:e.active});
}
function importEmps(){
  pickFile('.xlsx,.xls,.csv',async f=>{
    let rows;try{rows=await readSheet(f);}catch(e){toast('الملف مش مقروء');return;}
    const H=findHeader(rows,{code:/^(كود|الكود)$/,name:/اسم الموظف/,shift:/الشيفت/,branch:/^الفرع/,status:/حاله الموظف|حالة الموظف/,dept:/^القسم/,job:/الوظيف/});
    if(!H||H.idx.code<0||H.idx.name<0){toast('لازم «كود» و«اسم الموظف»');return;}
    let add=0,upd=0;const touched=[];
    for(const r of rows.slice(H.row+1)){
      const code=String(r[H.idx.code]||'').trim(),name=String(r[H.idx.name]||'').trim();if(!code||!name||name==='#N/A')continue;
      const g=k=>H.idx[k]>=0?String(r[H.idx[k]]||'').trim():'';const active=H.idx.status>=0?/راس العمل/.test(g('status')):true;
      const sh=g('shift');const br=branches().find(b=>norm(b)===norm(g('branch')))||g('branch');let e=emp(code);
      if(e){Object.assign(e,{name,branch:br||e.branch,dept:g('dept')||e.dept,job:g('job')||e.job,shift:Object.values(SH).includes(sh)?sh:e.shift,active});upd++;touched.push(e);}
      else if(active){const ne={code,name,branch:br,dept:g('dept'),job:g('job'),shift:Object.values(SH).includes(sh)?sh:'Morning',active,photo:'',video:''};S.employees.push(ne);add++;touched.push(ne);}
    }
    save();render();for(let i=0;i<touched.length;i+=10)await Promise.all(touched.slice(i,i+10).map(e=>push('employee',{code:e.code},{name:e.name,branch:e.branch,dept:e.dept,job:e.job,shift:e.shift,active:e.active})));toast(`جديد ${add} · اتحدّث ${upd}`);
  });
}
