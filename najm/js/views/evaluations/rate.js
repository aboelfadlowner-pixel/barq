// نجم أبو الفضل — تاب تقييم اليوم (المديرين والهايجين)
function vRate(){
  if(isCam())return vRateCams();
  if(isHC())return vRateHC();
  const list=filtered(true).filter(ratable);const D=peekDay(DATE);const field=isOps()?null:RATE_FIELD[USER.role];
  /* البصمة من الشيت — المديرين بيشوفوها بس، والتشغيل بيعدّل استثناء بسبب */const canAtt=isOps();const CL=critList(USER.role);const withPray=hasPrayItem();
  const off=e=>D.att[e.code]==='abs'||D.att[e.code]==='off';
  const left=field?list.filter(e=>!dayLocked(e)&&!off(e)&&!rateDone(DATE,field,e.code)):[];
  const stale=isHy()||!field?[]:list.filter(e=>!dayLocked(e)&&!off(e)&&rateStale(DATE,field,e.code));
  return `<div class="sec-title"><h2>${isOps()?'الموظفين':'تقييم'} يوم ${esc(DATE)} — ${ROLES[USER.role]}</h2>
    <div class="row">${canAtt?`<button class="btn" onclick="importAttendance()">📥 رفع شيت البصمة</button><button class="btn" onclick="openImports('attendance')">📂 الملفات المرفوعة</button>`:''}<button class="btn" onclick="showGuide()">📘 الدليل</button></div></div>
  ${isOps()?`<div class="card" style="margin-bottom:10px;border-color:var(--gold);background:#fffaf0"><b>🏅 وسام برق</b><div class="small muted">انت مبقتش بتقيّم الموظفين كل يوم — بتقيّم المديرين بس كل ${RATE_EVERY} أيام. لو شفت موظف أداؤه مميز في أي يوم، اديله «وسام برق» (+${fmt(medalPts())} نقطة لكل وسام، أي عدد في الشهر).</div></div>`:''}
  ${field&&left.length?`<div class="card" style="margin-bottom:10px;border-color:#f3c3be;background:var(--red-soft)"><b>⏰ فاضل ${fmt(left.length)} موظف ماكملتش تقييمهم النهارده:</b> <span class="small">${left.slice(0,12).map(e=>esc(e.name.split(' ').slice(0,2).join(' '))).join('، ')}${left.length>12?' …':''}</span></div>`:field&&list.length?'<div class="card" style="margin-bottom:10px;border-color:#bfe3d6;background:var(--green-soft)"><b>✔ خلّصت تقييم فريقك النهارده</b></div>':''}
  ${isHy()||!field?'':`<div class="card" style="margin-bottom:10px;border-color:#cfc4ff;background:#faf8ff"><b>${isRateDay(DATE)?'📋 النهارده يوم تقييم':'📋 دورة التقييم'}: ${esc(cycleStart(DATE).slice(8))} ← ${esc(cycleEnd(DATE).slice(8))}</b>
    <div class="small muted">التقييم${withPray?' والصلاة':''} كل ${RATE_EVERY} أيام وبيفضل مكمّل لوحده لحد ما تغيّره. البصمة والهايجين والكاميرات بيتغيروا كل يوم.</div>
    ${stale.length?`<div class="row" style="justify-content:space-between;margin-top:6px"><span class="small">🔁 ${fmt(stale.length)} موظف ماشيين على تقييم الدورة اللي فاتت — عدّل اللي اتغير، أو أكّد نفس التقييم</span><button class="btn sm gold" onclick="confirmRates()">✔ تأكيد الكل بنفس التقييم (${fmt(stale.length)})</button></div>`:''}</div>`}
  ${closeBarHTML()}
  ${!isOps()&&list.some(dayLocked)?'<div class="lock" style="margin-bottom:10px">🔒 تقييم اليوم ده مقفول (اتقفل اليوم، أو اتعلن رجل اليوم، أو اليوم عدّى أكتر من يوم) — أي تعديل عن طريق مدير التشغيل.</div>':''}
  <div class="lock" style="margin-bottom:10px">${STARS_TXT()}</div>
  ${filterBar({scoped:true})}
  <div class="grid g-emp">${list.map(e=>{
    const s=score(DATE,e.code);const R=field&&!isHy()?rateOf(DATE,field,e.code,true):null;const arr=(isHy()?D[field][e.code]:R?.arr)||[];const myC=cardsOf(e.code,DATE,DATE,true);
    const lk=dayLocked(e);const medal=medalOf(e.code,monthOf(DATE));
    return `<div class="card" id="rc-${e.code}" style="${lk&&!isOps()?'opacity:.6;pointer-events:none':''}">${lk?'<div class="small" style="color:var(--red);font-weight:800">🔒 مقفول</div>':''}
      <div class="emp-top" style="margin-bottom:6px">${ava(e)}<div><div class="emp-name">${esc(e.name)}${medal?' <span title="وسام برق">🏅</span>':''}</div><div class="small muted">${esc(e.job)} · ${esc(e.dept)} · ${esc(e.shift)}</div></div></div>
      ${canAtt?`<div class="seg att" style="margin-bottom:6px;width:100%;display:flex">${Object.entries(ATT).map(([k,v])=>`<button style="flex:1;padding:3px 2px;font-size:11px" data-v="${k}" class="${s.st===k?'on':''}" onclick="setAtt('${e.code}','${k}')">${v}</button>`).join('')}</div>`:`<div class="small" style="margin-bottom:4px">🖐️ البصمة: <b>${s.st?ATT[s.st]:'<span class="muted">لسه ماوصلتش من الشيت</span>'}</b></div>`}
      ${D.attTime?.[e.code]?`<div class="small muted">وقت البصمة: ${esc(D.attTime[e.code])}</div>`:''}${canAtt?'<div class="small muted" style="margin-bottom:4px">البصمة من الشيت أوتوماتيك — غيّرها بس في حالة استثنائية (بسبب)</div>':''}
      ${R?.carried&&R.arr?`<div class="row small" style="justify-content:space-between;color:var(--muted);margin:2px 0">🔁 مكمّل من تقييم ${R.from?`يوم ${esc(R.from.slice(8))}`:'قبل كده'}${rateStale(DATE,field,e.code)?`<button class="btn sm" onclick="confirmRate('${e.code}')">✔ تأكيد</button>`:''}</div>`:''}
      ${isHy()?hyRowsHTML(e,arr):field?CL.map((c,i)=>`<div class="crit"><span class="small">${c}</span><span class="seg">${[0,1,2].map(v=>`<button class="${arr[i]===v?'on':''}" onclick="setCrit('${e.code}',${i},${v})">${v}</button>`).join('')}</span></div>`).join('')
        +(withPray?`<div class="crit"><span class="small">🕌 الصلاة <span class="muted">(كل ${RATE_EVERY} أيام · ½ نجمة)</span></span><span class="seg">${[[2,'ملتزم'],[1,'بيقطع'],[0,'مبيصليش']].map(([v,t])=>`<button style="font-size:12px" class="${arr[4]===v?'on':''}" onclick="setCrit('${e.code}',4,${v})">${t}</button>`).join('')}</span></div>`:''):''}
      ${isOps()?camSummaryHTML(e,D)+cashSummaryHTML(e):''}
      <div class="row" style="justify-content:space-between;margin-top:6px"><span>${starsHTML(s.total)} <b>${fmt(s.total,2)}</b></span>
        ${isHy()?`<span class="small">🧼 الهايجين ${fmt(s.hy,2)}</span>`:`<span class="row" style="gap:4px">${isOps()?`<button class="btn sm ${medal?'gold':''}" onclick="giveMedal('${e.code}')">${medal?'🏅 وسام برق ×'+fmt(medal):'🏅 وسام برق'}</button>`:''}<button class="btn sm ${s.bonus?'gold':''}" onclick="toggleBonus('${e.code}')">${s.bonus?'⭐ ½ مثالي':'+ ½ مثالي'}</button></span>`}</div>
      <div class="small muted">بصمة ${fmt(s.att,2)} · فرع ${fmt(s.parts.br,2)} · شيفت ${fmt(s.parts.sh,2)}${s.fresh?` · فريش ${fmt(s.parts.fr,2)}`:''} · هايجين ${fmt(s.hy,2)} · صلاة ${fmt(s.pray,2)} · كاميرات ${fmt(s.cam,2)}</div>
      ${isHy()?'':`<div class="row" style="margin-top:6px;gap:6px">${['yellow','red','green'].map(c=>`<button class="cardbtn" onclick="giveCard('${e.code}','${c}')"><i class="fcard ${c}"></i>${CARD[c].t.split(' ')[1]}</button>`).join('')}
        ${myC.map(c=>`<span class="badge ${c.color==='red'?'b-red':c.color==='green'?'b-green':'b-gold'}" title="${esc(c.reason)}">${cardStatus(c)==='approved'?'':'⏳ '}<i class="fcard ${c.color}"></i></span>`).join('')}</div>`}
    </div>`;}).join('')||'<div class="empty">مفيش موظفين في نطاقك</div>'}</div>`;
}
const STARS_TXT=()=>`البصمة ${S.settings.att.on} نجمة · المدير المباشر نجمة (50% مدير الفرع + 50% مدير الشيفت${S.settings.freshDepts.length?` — وفي ${esc(S.settings.freshDepts.join('، '))}: ثلث لكل واحد مع مدير الفريش فود`:''}) · الهايجين نجمة · الصلاة عند المدير ½ (كل ${RATE_EVERY} أيام) · الكاميرات ½ (الصلاة ¼ + البريك ¼ كل يوم) · سلوك مثالي ½ فوق الـ 5 · 🏅 وسام برق +${fmt(medalPts())} نقطة.`;
// مدير الفرع / الشيفت: البند الخامس = الصلاة (2 ملتزم · 1 بيقطع · 0 مبيصليش) — بيكمّل كل 4 أيام زي باقي التقييم
const hasPrayItem=()=>['branch','shift'].includes(USER?.role);
const critLen=()=>isHy()?5:CRITERIA.length+(hasPrayItem()?1:0);

// ---------- الكاميرات: كل يوم لكل موظف حاضر — الصلاة والبريك ----------
const CAM_NOTE='يجب مراعاة الدقة في التقييم، لأنه بيتراجع. إذا اتضح وجود تلاعب في النتائج، بيتخصم 50% من تارجت موظف الكاميرات. ولو فيه موظف حاضر ماتقيّمش، بيتخصم من نقاط تارجتك.';
const camPresent=e=>{const st=peekDay(DATE).att[e.code];return st!=='abs'&&st!=='off';};
function camRowsHTML(e,D){const pv=D.pray?.[e.code],bv=D.brk?.[e.code];
  return `<div class="crit"><span class="small">🕌 الصلاة <span class="muted">(كاميرات · ¼)</span></span><span class="seg">${[[1,'صلّى'],[0,'ماصلّاش']].map(([v,t])=>`<button class="${pv===v?'on':''}" onclick="setCam('pray','${e.code}',${v})">${t}</button>`).join('')}</span></div>
  <div class="crit"><span class="small">☕ البريك <span class="muted">(كاميرات · ¼)</span></span><span class="seg">${[[1,'التزم'],[0,'كسر البريك']].map(([v,t])=>`<button class="${bv===v?'on':''}" onclick="setCam('brk','${e.code}',${v})">${t}</button>`).join('')}</span></div>`;}
// مدير التشغيل بيشوف اللي الكاميرات سجلته بس (مش بيقيّم)
function camSummaryHTML(e,D){const pv=D.pray?.[e.code],bv=D.brk?.[e.code];if(pv==null&&bv==null)return '<div class="small muted">📹 الكاميرات: لسه ماتقيّمش</div>';
  return `<div class="small">📹 الكاميرات: الصلاة <b>${pv==null?'—':pv?'صلّى':'ماصلّاش'}</b> · البريك <b>${bv==null?'—':bv?'التزم':'كسر البريك'}</b></div>`;}
// مدير التشغيل بيشوف اللي هيد الكاشير سجله على الكاشير (باندات +/−) — اليوم وصافي الشهر
function cashSummaryHTML(e){if(!isCashierEmp(e))return '';const m=monthOf(DATE);const B=cashierBands();const evs=evOf(e.code,m);if(!evs.length)return '<div class="small muted">🧾 هيد الكاشير: مفيش أحداث الشهر ده</div>';
  const net=evs.reduce((a,x)=>a+x.pts,0);const td=evs.filter(x=>String(x.day)===DATE);const name=x=>B.find(b=>b.id===x.band)?.t||x.band;
  return `<div class="small">🧾 هيد الكاشير — النهارده: ${td.length?td.map(x=>`<b style="color:${x.pts>0?'var(--green)':'var(--red)'}">${x.pts>0?'＋':'−'}${fmt(Math.abs(x.pts))}</b> ${esc(name(x))}`).join(' · '):'<span class="muted">مفيش</span>'} · صافي الشهر <b style="color:${net>0?'var(--green)':net<0?'var(--red)':'inherit'}">${net>0?'+':''}${fmt(net)}</b>
    <details style="margin-top:2px"><summary class="muted" style="cursor:pointer">كل أحداث الشهر (${fmt(evs.length)})</summary>${evs.slice(0,40).map(x=>`<div class="row" style="justify-content:space-between;margin:2px 0"><span>${esc(String(x.day).slice(5))} · ${esc(name(x))}</span><span><b style="color:${x.pts>0?'var(--green)':'var(--red)'}">${x.pts>0?'+':''}${fmt(x.pts)}</b> <button class="btn sm" onclick="delCashierEvent('${esc(x.id)}')">🗑️</button></span></div>`).join('')}</details></div>`;}
function vRateCams(){
  const D=peekDay(DATE);const list=filtered(true).filter(ratable).filter(camPresent);
  const left=list.filter(e=>!dayLocked(e)&&(D.pray?.[e.code]==null||D.brk?.[e.code]==null));
  return `<div class="sec-title"><h2>الكاميرات — يوم ${esc(DATE)}</h2><div class="row"><button class="btn" onclick="showGuide()">📘 الدليل</button></div></div>
  <div class="card" style="margin-bottom:10px;border-color:var(--red);background:var(--red-soft)"><b>⚠️ تنبيه</b><div class="small" style="margin-top:4px">${CAM_NOTE}</div></div>
  ${left.length?`<div class="card" style="margin-bottom:10px;border-color:#f3c3be"><b>⏰ فاضل ${fmt(left.length)} موظف حاضر ماتقيّمش النهارده:</b> <span class="small">${left.slice(0,15).map(e=>esc(e.name.split(' ').slice(0,2).join(' '))).join('، ')}${left.length>15?' …':''}</span></div>`:list.length?'<div class="card" style="margin-bottom:10px;border-color:#bfe3d6;background:var(--green-soft)"><b>✔ قيّمت كل الحاضرين النهارده</b></div>':''}
  <div class="lock" style="margin-bottom:10px">كل يوم لكل موظف حاضر: الصلاة (صلّى ¼ نجمة · ماصلّاش 0) والبريك (التزم ¼ نجمة · كسر البريك 0). اللي غايب أو في إجازة مبيظهرش هنا.</div>
  ${filterBar({scoped:true})}
  <div class="grid g-emp">${list.map(e=>{const lk=dayLocked(e);const st=D.att[e.code];
    return `<div class="card" style="${lk?'opacity:.6;pointer-events:none':''}">${lk?'<div class="small" style="color:var(--red);font-weight:800">🔒 مقفول</div>':''}
      <div class="emp-top" style="margin-bottom:6px">${ava(e)}<div><div class="emp-name">${esc(e.name)}</div><div class="small muted">${esc(e.job)} · ${esc(e.dept)} · ${esc(e.shift)}${st?` · ${ATT[st]}`:''}</div></div></div>
      ${camRowsHTML(e,D)}</div>`;}).join('')||'<div class="empty">مفيش موظفين حاضرين في نطاقك</div>'}</div>`;
}
async function setCam(kind,code,v){const k=await editKey(code);if(!k)return;const D=day(DATE);const bag=D[kind]||(D[kind]={});OLD_VAL=bag[code]??null;mark(D,code);
  const nv=bag[code]===v?null:v;if(nv==null)delete bag[code];else bag[code]=nv;save();render();push(kind,k,nv==null?null:{v:nv});}
// وسام برق — مدير التشغيل بيديه لأي موظف أو مدير، أي عدد في الشهر (+100 نقطة لكل وسام)
async function giveMedal(code){const isM=code.startsWith('m:');const nm=isM?mgrName(code.slice(2)):emp(code).name;const m=monthOf(DATE);const n=medalOf(code,m);
  // وسام برق: أي عدد في الشهر لأي موظف أو مدير (+نقط الوسام من الإعدادات لكل وسام)
  if(n){if(!await askConfirm(`${nm} واخد ${fmt(n)} وسام الشهر ده — تديله وسام تاني؟`)){
      if(!await askConfirm(`تشيل آخر وسام من ${nm}؟`))return;
      const i=S.medals.map(x=>x.code===code&&(x.month||monthOf(x.day))===m).lastIndexOf(true);if(i>=0)S.medals.splice(i,1);
      save();render();if(await push('medal',{code,day:DATE},null)!==false)toast('اتشال آخر وسام');return;}}
  const note=await askText(`🏅 وسام برق لـ ${nm} (+${medalPts()} نقطة) — إيه اللي عمله؟ (اختياري)`);if(note===null)return;
  (S.medals||(S.medals=[])).push({code,month:m,day:DATE,note:note.trim()});save();render();
  if(await push('medal',{code,day:DATE},{note:note.trim()})!==false)toast(`🏅 ${nm.split(' ')[0]} خد وسام برق`);}

// تعديل البصمة: التشغيل بس، وكل تعديل بسبب (جهاز البصمة عطلان، مأمورية، …) — بيتسجل في السجل بالقيمة القديمة والجديدة
async function setAtt(code,v){if(!isOps())return;const D=day(DATE);if(D.att[code]===v)return;
  const r=await askText(`تغيير البصمة لـ «${ATT[v]}» — السبب؟ (مثلاً: جهاز البصمة عطلان، مأمورية)`);if(r===null)return;if(!r.trim()){toast('لازم تكتب السبب');return;}
  OLD_VAL={st:D.att[code]??null,time:D.attTime?.[code]??null};mark(D,code);D.att[code]=v;save();render();
  if(await push('att',{day:DATE,code,reason:r.trim()},{st:v,time:D.attTime[code]||null})!==false)toast('✔ اتغيّرت البصمة واتسجل السبب');}
async function setCrit(code,i,v){const k=await editKey(code);if(!k)return;const D=day(DATE);mark(D,code);const f=RATE_FIELD[USER.role];const bag=D[f];
  // تقييم المديرين: التعديل بيبدأ من التقييم المكمّل (مش من الأول)، وبيكمّل هو كمان على الأيام اللي بعده
  const cur=isHy()?bag[code]:rateOf(DATE,f,code,true).arr;OLD_VAL=cur?[...cur]:null;if(isHy()&&i===0&&v===HY_NA)return;
  const N=critLen();const a=cur?[...cur].slice(0,N):isHy()?hyBlank(emp(code)):Array(N).fill(null);while(a.length<N)a.push(null);a[i]=a[i]===v?null:v;
  const empty=a.every(x=>x==null||x===HY_NA);dropCarry(D,code,f);if(empty)delete bag[code];else bag[code]=a;save();render();push('rate',k,empty?null:a);}
function dropCarry(D,code,f){const c=D.carry?.[code];if(c){const n=c.filter(x=>x!==f);if(n.length)D.carry[code]=n;else delete D.carry[code];}}
// نفس التقييم للدورة الجديدة (مش إجباري — من غيره التقييم القديم بيفضل مكمّل)
async function confirmRate(code){const k=await editKey(code);if(!k)return;const f=RATE_FIELD[USER.role];const a=rateOf(DATE,f,code,true).arr;if(!a)return;const D=day(DATE);mark(D,code);OLD_VAL=[...a];
  const a4=a.slice(0,critLen());D[f][code]=[...a4];dropCarry(D,code,f);save();render();if(await push('rate',k,a4)!==false)toast('✔ اتأكد التقييم');}
async function confirmRates(){const f=RATE_FIELD[USER.role];const L=filtered(true).filter(ratable).filter(e=>!dayLocked(e)&&peekDay(DATE).att[e.code]!=='abs'&&peekDay(DATE).att[e.code]!=='off'&&rateStale(DATE,f,e.code));if(!L.length)return;
  if(!await askConfirm(`تأكيد نفس التقييم لـ ${L.length} موظف في الدورة دي؟ (أي حد اتغير عدّله الأول)`))return;
  if(isOps()&&L.some(opsClosed)&&!await opsReason())return;
  const D=day(DATE);const items=L.map(e=>({e,a:[...rateOf(DATE,f,e.code,true).arr].slice(0,critLen())}));for(const {e,a} of items){mark(D,e.code);D[f][e.code]=a;dropCarry(D,e.code,f);}save();render();
  let fail=0;for(let i=0;i<items.length;i+=10){const R=await Promise.all(items.slice(i,i+10).map(({e,a})=>push('rate',{day:DATE,code:e.code,...(opsClosed(e)?{reason:OPS_REASON[DATE]}:{})},a)));fail+=R.filter(x=>x===false).length;}
  toast(fail?`⚠️ اتأكد ${items.length-fail} بس من ${items.length}`:`✔ اتأكد التقييم لـ ${items.length} موظف`);}
// الهايجين: الخمس بنود جنب كل موظف — التيشرت إجباري، والباقي فيه «مش مطلوب»
function hyRowsHTML(e,arr){if(!arr||!arr.length)arr=hyBlank(e);   // «مش مطلوب» من آخر مرة بيظهر من الأول
  return HY_CRITERIA.map((c,i)=>`<div class="crit"><span class="small">${c}${i===0?' <span class="muted">(إجباري)</span>':''}</span><span class="seg">${[0,1,2].map(v=>`<button class="${arr[i]===v?'on':''}" onclick="setCrit('${e.code}',${i},${v})">${v}</button>`).join('')}${i===0?'':`<button style="font-size:11px" class="${arr[i]===HY_NA?'on':''}" onclick="setCrit('${e.code}',${i},${HY_NA})">مش مطلوب</button>`}</span></div>`).join('')+hyWarnHTML(arr);}
// تقييم الهايجين ناقص بند ← النجمة مبتتحسبش ومبتظهرش للموظف لحد ما كل الـ 5 بنود يتحددوا (0 لـ 2 أو «مش مطلوب»)
function hyWarnHTML(arr){const a=arr||[];if(!a.some(v=>v!=null)||hyScore(a)!=null)return '';const miss=HY_CRITERIA.map((c,i)=>a[i]==null?c:null).filter(Boolean);
  return `<div class="small" style="color:var(--red);font-weight:700;margin-top:4px">⚠️ التقييم ناقص (${esc(miss.join('، '))}) — النجمة مش هتظهر للموظف لحد ما تكمّل كل البنود</div>`;}
async function toggleBonus(code){
  const k=await editKey(code);if(!k)return;
  const D=day(DATE);OLD_VAL={v:D.bonus[code]?.v??null,note:D.bonus[code]?.note??null};
  mark(D,code);if(D.bonus[code]){if(await askConfirm('شيل نص النجمة؟')){delete D.bonus[code];save();render();push('bonus',k,null);}return;}
  const note=await askText('إيه الفعل المثالي اللي عمله؟ (نص نجمة Bonus فوق الـ 5)');if(note===null)return;if(!note.trim()){toast('لازم تكتب السبب');return;}
  D.bonus[code]={v:.5,note:note.trim(),by:USER.username,at:new Date().toISOString()};save();render();push('bonus',k,{v:.5,note:note.trim()});
}
async function giveCard(code,color){
  const r=await askText(`${CARD[color].t} — السبب؟ (${CARD[color].d})`);if(r===null)return;if(!r.trim()){toast('لازم تكتب السبب');return;}
  const approved=color!=='red'||isOps();
  const id=uid();S.cards.push({id,date:DATE,code,color,reason:r.trim(),by:USER.username,approved,status:approved?'approved':'pending'});
  if(LIVE&&approved){const c=S.cardCounts[code]||(S.cardCounts[code]={y:0,r:0,g:0});c[color[0]]++;delete c.pts;const dc=(S.dayCards[DATE]||(S.dayCards[DATE]={}))[code]||(S.dayCards[DATE][code]={y:0,r:0,g:0});dc[color[0]]++;}save();render();
  if(await push('card',{id,code},{date:DATE,color,reason:r.trim()})===false)return;
  toast(approved?'اتسجل الكارت':'🟥 الكارت الأحمر مستني موافقة مدير التشغيل');
}


// ---------- هيد الكاشير: أحداث كل كاشير في فرعه (باندات +/−) بتتجمع على نقط التارجت ----------
function evOf(code,month){return (S.cashierEvents||[]).filter(x=>x.code===code&&String(x.day).startsWith(month));}
function vRateHC(){const m=monthOf(DATE);const B=cashierBands();const list=filtered(true).filter(ratable);const todayEv=x=>String(x.day)===DATE;
  const tgtOn=e=>{const t=empTarget(e,m,DATE);return t?.basePoints>0;};
  return `<div class="sec-title"><h2>الكاشيرات — ${esc(DATE)}</h2><div class="row"><button class="btn" onclick="showGuide()">📘 الدليل</button></div></div>
  <div class="lock" style="margin-bottom:10px">سجّل لكل كاشير الحاجات اللي بتحصل — كل دوسة بتزوّد أو بتنقّص من نقط تارجته، <b>من أول ما يحقق 85% من التارجت</b>. تقدر تمسح حدث اتسجل بالغلط (لحد يومين).</div>
  <div class="grid g-emp">${list.map(e=>{const evs=evOf(e.code,m);const net=evs.reduce((a,x)=>a+x.pts,0);const tdy=evs.filter(todayEv);const on=tgtOn(e);
    return `<div class="card"><div class="emp-top" style="margin-bottom:6px">${ava(e)}<div style="flex:1"><div class="emp-name">${esc(e.name)}</div><div class="small muted">${esc(e.job)} · ${esc(e.shift)}</div></div>
      <div style="text-align:center"><div class="small muted">صافي الشهر</div><b style="font-size:18px;color:${net>0?'var(--green)':net<0?'var(--red)':'inherit'}">${net>0?'+':''}${fmt(net)}</b></div></div>
      ${on?'':'<div class="small muted" style="margin-bottom:4px">⏳ لسه ماوصلش 85% من التارجت — النقط بتتسجل وبتتحسب أول ما يوصل</div>'}
      <div class="row" style="gap:5px;flex-wrap:wrap">${B.map(b=>{const n=tdy.filter(x=>x.band===b.id).length;return `<button class="btn sm" style="border-color:${b.pts>0?'var(--green)':'var(--red)'};color:${b.pts>0?'var(--green)':'var(--red)'}" onclick="addCashierEvent('${e.code}','${b.id}')">${b.pts>0?'＋':'−'}${fmt(Math.abs(b.pts))} ${esc(b.t)}${n?` <b>×${n}</b>`:''}</button>`;}).join('')}</div>
      ${evs.length?`<details style="margin-top:6px"><summary class="small muted" style="cursor:pointer">آخر الأحداث (${fmt(evs.length)})</summary>${evs.slice(0,12).map(x=>`<div class="small row" style="justify-content:space-between;margin:2px 0"><span>${esc(String(x.day).slice(5))} · ${esc(B.find(b=>b.id===x.band)?.t||x.band)}</span><span><b style="color:${x.pts>0?'var(--green)':'var(--red)'}">${x.pts>0?'+':''}${fmt(x.pts)}</b> <button class="btn sm" onclick="delCashierEvent('${esc(x.id)}')">🗑️</button></span></div>`).join('')}</details>`:''}</div>`;}).join('')||'<div class="empty">مفيش كاشيرات في نطاقك</div>'}</div>`;}
async function addCashierEvent(code,band){const b=cashierBands().find(x=>x.id===band);if(!b)return;const id=uid();
  (S.cashierEvents||(S.cashierEvents=[])).unshift({id,day:DATE,code,band,pts:b.pts,note:'',by:USER.username});
  if(LIVE){S.cashierPts[code]=(S.cashierPts[code]||0)+b.pts;}save();render();
  if(await push('cashier_event',{id},{code,band,day:DATE})!==false)toast(`${b.pts>0?'＋':'−'}${fmt(Math.abs(b.pts))} ${b.t} — ${emp(code).name.split(' ')[0]}`);}
async function delCashierEvent(id){const x=(S.cashierEvents||[]).find(v=>v.id===id);if(!x)return;if(!await askConfirm('مسح الحدث ده؟'))return;
  S.cashierEvents=S.cashierEvents.filter(v=>v.id!==id);if(LIVE)S.cashierPts[x.code]=(S.cashierPts[x.code]||0)-x.pts;save();render();
  if(await push('cashier_event',{id},null)!==false)toast('اتمسح');}
