// نجم أبو الفضل — تاب تقييم اليوم (المديرين والهايجين)
function vRate(){
  const list=filtered(true);const D=peekDay(DATE);const field=RATE_FIELD[USER.role];
  const canAtt=USER.role!=='fresh'&&!isHy();const CL=critList(USER.role);
  const off=e=>D.att[e.code]==='abs'||D.att[e.code]==='off';
  const left=list.filter(e=>!dayLocked(e)&&!off(e)&&!rateDone(DATE,field,e.code));
  const stale=isHy()?[]:list.filter(e=>!dayLocked(e)&&!off(e)&&rateStale(DATE,field,e.code));
  return `<div class="sec-title"><h2>تقييم يوم ${esc(DATE)} — ${ROLES[USER.role]}</h2>
    <div class="row">${canAtt?`<button class="btn" onclick="importAttendance()">📥 رفع شيت البصمة</button><button class="btn" onclick="bulkAtt('on')">✔️ الباقي في ميعاده</button><button class="btn" onclick="openImports('attendance')">📂 الملفات المرفوعة</button>`:''}<button class="btn" onclick="showGuide()">📘 الدليل</button></div></div>
  ${left.length?`<div class="card" style="margin-bottom:10px;border-color:#f3c3be;background:var(--red-soft)"><b>⏰ فاضل ${fmt(left.length)} موظف ماكملتش تقييمهم النهارده:</b> <span class="small">${left.slice(0,12).map(e=>esc(e.name.split(' ').slice(0,2).join(' '))).join('، ')}${left.length>12?' …':''}</span></div>`:list.length?'<div class="card" style="margin-bottom:10px;border-color:#bfe3d6;background:var(--green-soft)"><b>✔ خلّصت تقييم فريقك النهارده</b></div>':''}
  ${isHy()?'':`<div class="card" style="margin-bottom:10px;border-color:#cfc4ff;background:#faf8ff"><b>${isRateDay(DATE)?'📋 النهارده يوم تقييم':'📋 دورة التقييم'}: ${esc(cycleStart(DATE).slice(8))} ← ${esc(cycleEnd(DATE).slice(8))}</b>
    <div class="small muted">التقييم بيتعمل كل ${RATE_EVERY} أيام وبيفضل مكمّل لوحده لحد ما تغيّره. البصمة والهايجين بيتغيروا كل يوم.</div>
    ${stale.length?`<div class="row" style="justify-content:space-between;margin-top:6px"><span class="small">🔁 ${fmt(stale.length)} موظف ماشيين على تقييم الدورة اللي فاتت — عدّل اللي اتغير، أو أكّد نفس التقييم</span><button class="btn sm gold" onclick="confirmRates()">✔ تأكيد الكل بنفس التقييم (${fmt(stale.length)})</button></div>`:''}</div>`}
  ${closeBarHTML()}
  ${!isOps()&&list.some(dayLocked)?'<div class="lock" style="margin-bottom:10px">🔒 تقييم اليوم ده مقفول (اتقفل اليوم، أو اتعلن رجل اليوم، أو اليوم عدّى أكتر من يوم) — أي تعديل عن طريق مدير التشغيل.</div>':''}
  <div class="lock" style="margin-bottom:10px">البصمة ${S.settings.att.on} نجمة · الهايجين نجمة · المدير المباشر نجمة (50% مدير الفرع + 50% مدير الشيفت${S.settings.freshDepts.length?` — وفي ${esc(S.settings.freshDepts.join('، '))}: ثلث لكل واحد مع مدير الفريش فود`:''}) · مدير التشغيل نجمة · سلوك مثالي ½. كل بند من 0 لـ 2 — وتقييم المديرين كل ${RATE_EVERY} أيام.</div>
  ${filterBar({scoped:true})}
  <div class="grid g-emp">${list.map(e=>{
    const s=score(DATE,e.code);const R=isHy()?null:rateOf(DATE,field,e.code,true);const arr=(isHy()?D[field][e.code]:R.arr)||[];const myC=cardsOf(e.code,DATE,DATE,true);
    const lk=dayLocked(e);
    return `<div class="card" id="rc-${e.code}" style="${lk?'opacity:.6;pointer-events:none':''}">${lk?'<div class="small" style="color:var(--red);font-weight:800">🔒 مقفول</div>':''}
      <div class="emp-top" style="margin-bottom:6px">${ava(e)}<div><div class="emp-name">${esc(e.name)}</div><div class="small muted">${esc(e.job)} · ${esc(e.dept)} · ${esc(e.shift)}</div></div></div>
      ${canAtt?`<div class="seg att" style="margin-bottom:6px;width:100%;display:flex">${Object.entries(ATT).map(([k,v])=>`<button style="flex:1;padding:3px 2px;font-size:11px" data-v="${k}" class="${s.st===k?'on':''}" onclick="setAtt('${e.code}','${k}')">${v}</button>`).join('')}</div>`:`<div class="small muted">البصمة: ${ATT[s.st]||'—'}</div>`}
      ${D.attTime?.[e.code]?`<div class="small muted">وقت البصمة: ${esc(D.attTime[e.code])}</div>`:''}
      ${R?.carried&&R.arr?`<div class="row small" style="justify-content:space-between;color:var(--muted);margin:2px 0">🔁 مكمّل من تقييم ${R.from?`يوم ${esc(R.from.slice(8))}`:'قبل كده'}${rateStale(DATE,field,e.code)?`<button class="btn sm" onclick="confirmRate('${e.code}')">✔ تأكيد</button>`:''}</div>`:''}
      ${isHy()?hyRowsHTML(e,arr):CL.map((c,i)=>`<div class="crit"><span class="small">${c}</span><span class="seg">${[0,1,2].map(v=>`<button class="${arr[i]===v?'on':''}" onclick="setCrit('${e.code}',${i},${v})">${v}</button>`).join('')}</span></div>`).join('')}
      <div class="row" style="justify-content:space-between;margin-top:6px"><span>${starsHTML(s.total)} <b>${fmt(s.total,2)}</b></span>
        ${isHy()?`<span class="small">🧼 الهايجين ${fmt(s.hy,2)}</span>`:`<button class="btn sm ${s.bonus?'gold':''}" onclick="toggleBonus('${e.code}')">${s.bonus?'⭐ ½ مثالي':'+ ½ مثالي'}</button>`}</div>
      <div class="small muted">بصمة ${fmt(s.att,2)} · فرع ${fmt(s.parts.br,2)} · شيفت ${fmt(s.parts.sh,2)}${s.fresh?` · فريش ${fmt(s.parts.fr,2)}`:''} · تشغيل ${fmt(s.ops,2)} · هايجين ${fmt(s.hy,2)}</div>
      ${isHy()?'':`<div class="row" style="margin-top:6px;gap:6px">${['yellow','red','green'].map(c=>`<button class="cardbtn" onclick="giveCard('${e.code}','${c}')"><i class="fcard ${c}"></i>${CARD[c].t.split(' ')[1]}</button>`).join('')}
        ${myC.map(c=>`<span class="badge ${c.color==='red'?'b-red':c.color==='green'?'b-green':'b-gold'}" title="${esc(c.reason)}">${cardStatus(c)==='approved'?'':'⏳ '}<i class="fcard ${c.color}"></i></span>`).join('')}</div>`}
    </div>`;}).join('')||'<div class="empty">مفيش موظفين في نطاقك</div>'}</div>`;
}
async function setAtt(code,v){const k=await editKey(code);if(!k)return;const D=day(DATE);OLD_VAL={st:D.att[code]??null,time:D.attTime?.[code]??null};mark(D,code);D.att[code]===v?delete D.att[code]:D.att[code]=v;save();render();push('att',k,D.att[code]?{st:D.att[code],time:D.attTime[code]||null}:null);}
async function bulkAtt(v){if(isOps()&&filtered(true).some(opsClosed)&&!await opsReason())return;const D=day(DATE);const L=filtered(true).filter(e=>!D.att[e.code]);L.forEach(e=>{mark(D,e.code);D.att[e.code]=v;});save();render();let fail=0;for(let i=0;i<L.length;i+=10){const R=await Promise.all(L.slice(i,i+10).map(e=>push('att',{day:DATE,code:e.code,...(opsClosed(e)?{reason:OPS_REASON[DATE]}:{})},{st:v})));fail+=R.filter(x=>x===false).length;}toast(fail?`⚠️ اتحفظ ${L.length-fail} بس من ${L.length}`:`اتسجل الحضور لـ ${L.length} موظف`);}
async function setCrit(code,i,v){const k=await editKey(code);if(!k)return;const D=day(DATE);mark(D,code);const f=RATE_FIELD[USER.role];const bag=D[f];
  // تقييم المديرين: التعديل بيبدأ من التقييم المكمّل (مش من الأول)، وبيكمّل هو كمان على الأيام اللي بعده
  const cur=isHy()?bag[code]:rateOf(DATE,f,code,true).arr;OLD_VAL=cur?[...cur]:null;if(isHy()&&i===0&&v===HY_NA)return;
  const a=cur?[...cur]:isHy()?hyBlank(emp(code)):[null,null,null,null,null];a[i]=a[i]===v?null:v;
  const empty=a.every(x=>x==null||x===HY_NA);dropCarry(D,code,f);if(empty)delete bag[code];else bag[code]=a;save();render();push('rate',k,empty?null:a);}
function dropCarry(D,code,f){const c=D.carry?.[code];if(c){const n=c.filter(x=>x!==f);if(n.length)D.carry[code]=n;else delete D.carry[code];}}
// نفس التقييم للدورة الجديدة (مش إجباري — من غيره التقييم القديم بيفضل مكمّل)
async function confirmRate(code){const k=await editKey(code);if(!k)return;const f=RATE_FIELD[USER.role];const a=rateOf(DATE,f,code,true).arr;if(!a)return;const D=day(DATE);mark(D,code);OLD_VAL=[...a];
  D[f][code]=[...a];dropCarry(D,code,f);save();render();if(await push('rate',k,a)!==false)toast('✔ اتأكد التقييم');}
async function confirmRates(){const f=RATE_FIELD[USER.role];const L=filtered(true).filter(e=>!dayLocked(e)&&peekDay(DATE).att[e.code]!=='abs'&&peekDay(DATE).att[e.code]!=='off'&&rateStale(DATE,f,e.code));if(!L.length)return;
  if(!await askConfirm(`تأكيد نفس التقييم لـ ${L.length} موظف في الدورة دي؟ (أي حد اتغير عدّله الأول)`))return;
  if(isOps()&&L.some(opsClosed)&&!await opsReason())return;
  const D=day(DATE);const items=L.map(e=>({e,a:[...rateOf(DATE,f,e.code,true).arr]}));for(const {e,a} of items){mark(D,e.code);D[f][e.code]=a;dropCarry(D,e.code,f);}save();render();
  let fail=0;for(let i=0;i<items.length;i+=10){const R=await Promise.all(items.slice(i,i+10).map(({e,a})=>push('rate',{day:DATE,code:e.code,...(opsClosed(e)?{reason:OPS_REASON[DATE]}:{})},a)));fail+=R.filter(x=>x===false).length;}
  toast(fail?`⚠️ اتأكد ${items.length-fail} بس من ${items.length}`:`✔ اتأكد التقييم لـ ${items.length} موظف`);}
// الهايجين: الخمس بنود جنب كل موظف — التيشرت إجباري، والباقي فيه «مش مطلوب»
function hyRowsHTML(e,arr){if(!arr||!arr.length)arr=hyBlank(e);   // «مش مطلوب» من آخر مرة بيظهر من الأول
  return HY_CRITERIA.map((c,i)=>`<div class="crit"><span class="small">${c}${i===0?' <span class="muted">(إجباري)</span>':''}</span><span class="seg">${[0,1,2].map(v=>`<button class="${arr[i]===v?'on':''}" onclick="setCrit('${e.code}',${i},${v})">${v}</button>`).join('')}${i===0?'':`<button style="font-size:11px" class="${arr[i]===HY_NA?'on':''}" onclick="setCrit('${e.code}',${i},${HY_NA})">مش مطلوب</button>`}</span></div>`).join('');}
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
