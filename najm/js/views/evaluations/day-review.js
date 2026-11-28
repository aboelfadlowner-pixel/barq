// نجم أبو الفضل — أيام محتاجة مراجعة: الأيام اللي الموظف كان فاضي فيها (من غير بصمة) وخارج جدول راحته
// مدير الفرع (وتشغيل) يقرر: راحة (بدّل راحته) · إجازة · غياب. القرار بيتثبّت، والسبب اختياري، ومدير التشغيل بيشوف مين قرر وإمتى
let REV={shift:'all'};
const REV_KIND={off:'راحة',leave:'إجازة',abs:'غياب'};
const dayRev=()=>S.dayReview||(S.dayReview={pending:[],done:[],plan:{}});
const canReview=()=>!!USER&&(isOps()||USER.role==='branch');
const reviewPending=()=>canReview()?dayRev().pending.filter(p=>emp(p.code)).length:0;
const revDay=d=>String(d).slice(0,10);
const revDow=d=>['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][new Date(revDay(d)+'T00:00:00').getDay()];
const revDM=d=>{const s=revDay(d);return `${+s.slice(8,10)}/${+s.slice(5,7)}`;};
function vReview(){
  const R=dayRev();const ops=isOps();
  const groups={};for(const p of R.pending){const e=emp(p.code);if(!e)continue;(groups[p.code]||(groups[p.code]={e,days:[]})).days.push(revDay(p.day));}
  const all=Object.values(groups).sort((a,b)=>b.days.length-a.days.length||a.e.name.localeCompare(b.e.name));
  const list=all.filter(g=>REV.shift==='all'||g.e.shift===REV.shift);
  const nDone=R.done.filter(d=>emp(d.code)).length;
  const pg=pageList('review'+REV.shift,list);
  const planOf=g=>(R.plan?.[g.e.code]||[]).filter(d=>revDay(d).slice(0,7)===g.days[0].slice(0,7)).map(d=>+revDay(d).slice(8,10));
  const card=g=>`<div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between;gap:10px"><div class="row" style="flex-wrap:nowrap;gap:10px">${ava(g.e,'sm')}<div><b>${esc(g.e.name)}</b><div class="small muted">كود ${esc(g.e.code)} · ${esc(g.e.job||'')} · ${esc(g.e.dept||'')} · ${esc(g.e.shift)}</div></div></div>
      <div class="small muted">راحته المكتوبة: ${planOf(g).map(d=>`<span class="badge b-gray">${d}</span>`).join(' ')||'—'}</div></div>
    ${g.days.map(d=>`<div style="border-top:1px dashed var(--line);margin-top:10px;padding-top:10px"><div class="row" style="justify-content:space-between;gap:8px"><div><b>${revDow(d)} ${revDM(d)}</b> <span class="badge b-red">متحسب غياب</span></div>
      <div class="row" style="gap:6px"><input class="inp" id="rv-${esc(g.e.code)}-${d}" placeholder="السبب (اختياري)" style="width:150px">
        <button class="btn sm" onclick="reviewDo('${esc(g.e.code)}','${d}','off')">راحة (بدّل راحته)</button><button class="btn sm" onclick="reviewDo('${esc(g.e.code)}','${d}','leave')">إجازة</button><button class="btn sm red" onclick="reviewDo('${esc(g.e.code)}','${d}','abs')">غياب</button></div></div></div>`).join('')}</div>`;
  const doneRow=d=>{const e=emp(d.code);if(!e)return '';return `<tr><td>${revDM(d.day)}</td><td><b>${esc(e.name)}</b></td><td><span class="badge ${d.kind==='abs'?'b-red':d.kind==='leave'?'b-gold':'b-green'}">${REV_KIND[d.kind]}</span></td><td class="small">${esc(mgrName(d.by))}</td><td class="small muted">${new Date(d.at).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'})}</td><td class="small">${esc(d.reason||'')}</td><td><button class="btn sm" onclick="reviewUndo('${esc(d.code)}','${revDay(d.day)}')">تراجع</button></td></tr>`;};
  return `<div class="sec-title"><h2>🗓️ أيام محتاجة مراجعة</h2><span class="badge b-gold">⏳ فاضل ${fmt(all.reduce((a,g)=>a+g.days.length,0))} يوم</span></div>
    <div class="lock" style="margin-bottom:10px">الأيام دي الموظف كان فاضي فيها (من غير بصمة) ومش من أيام راحته المكتوبة في الجدول، فاتحسبت <b>غياب</b> لحد ما تراجعها. لو مش غياب اختار <b>راحة</b> (بدّل راحته) أو <b>إجازة</b>، والقرار بيتثبّت ومش بيتغيّر بتحديث الشيت. السبب اختياري. بتتقفل لما الشهر يبقى نهائي.${ops?' <b>انت بتشوف كل الفروع، وقرارات المديرين بتظهر تحت.</b>':''}</div>
    <div class="chips" style="margin-bottom:12px">${[['all','الكل'],['Night','ليل'],['Morning','صبح'],['Between','Between']].map(([k,t])=>`<button class="chip ${REV.shift===k?'on':''}" onclick="REV.shift='${k}';render()">${t}</button>`).join('')}</div>
    ${list.length?pg.items.map(card).join('')+moreBtn(pg):'<div class="empty">مفيش أيام محتاجة مراجعة 👏</div>'}
    ${nDone?`<div class="card"><h3>📜 القرارات اللي اتاخدت ${ops?'(كل الفروع)':''}</h3><div class="tbl-wrap" style="max-height:50vh"><table><thead><tr><th>اليوم</th><th>الموظف</th><th>القرار</th><th>مين</th><th>إمتى</th><th>السبب</th><th></th></tr></thead><tbody>${R.done.slice(0,60).map(doneRow).join('')}</tbody></table></div></div>`:''}`;
}
async function reviewDo(code,day,kind){
  const reason=(document.getElementById(`rv-${code}-${day}`)?.value||'').trim();const R=dayRev();
  R.pending=R.pending.filter(p=>!(p.code===code&&revDay(p.day)===day));
  R.done=[{code,day,kind,reason,by:USER.username,at:new Date().toISOString()},...R.done.filter(d=>!(d.code===code&&revDay(d.day)===day))];
  applyReviewLocal(day,code,kind);save();render();
  if(await push('day_review',{day,code},{kind,reason})!==false){toast(`✔ اتسجل ${REV_KIND[kind]}`);if(LIVE)refresh(true);}
}
// نسخة التجربة: نفس أثر القرار على اليوم نفسه
function applyReviewLocal(d,code,kind){const D=(typeof day==='function')?day(d):null;if(D&&D.att)D.att[code]=kind==='abs'?'abs':'off';RANK_CACHE=null;}
async function reviewUndo(code,dayS){
  const R=dayRev();R.done=R.done.filter(d=>!(d.code===code&&revDay(d.day)===dayS));R.pending.push({code,day:dayS});
  const D=day(dayS);if(D&&D.att)D.att[code]='abs';RANK_CACHE=null;save();render();
  if(await push('day_review',{day:dayS,code},null)!==false){toast('↩️ رجع غياب (مستني قرار)');if(LIVE)refresh(true);}
}
