// نجم أبو الفضل — رفع شيت الإجازات الشهري (جدول الراحات): صف لكل موظف باسمه، وعمود لكل يوم في الشهر،
// والخانة اللي فيها رقم من 1 لـ 9 = يوم راحة (الباقي ميعاد الشيفت). المطابقة بالاسم، واللي مش متطابق بيتحدد كوده يدوي
let LEAVE_IMP=null;
// أيام الراحة في صف: عمود أول يوم من صف العناوين (1،2،3…) لو موجود، وإلا من العمود الخامس (الاسم · الفرع · الشيفت · الوظيفة)
function leaveDayCol(rows){
  for(const r of rows.slice(0,6)){const i=r.findIndex((c,k)=>String(c).trim()==='1'&&String(r[k+1]).trim()==='2'&&String(r[k+2]).trim()==='3');if(i>=0)return i;}
  return 4;
}
// صف العناوين: لو فيه عمود «كود الموظف» بنطابق بيه (الأدق)، وإلا بالاسم
function leaveHeader(rows){
  for(const r of rows.slice(0,8)){const h=r.map(c=>norm(c));const ci=h.findIndex(c=>/^(كود|الكود|كود الموظف|code)$/.test(c));
    if(ci>=0){const ni=h.findIndex(c=>/^(اسم الموظف|الاسم|name)$/.test(c));return {ci,ni:ni>=0?ni:0};}}
  return null;
}
function leaveMatch(name,pool){
  const n=norm(name);if(!n)return {cands:[]};
  const ex=pool.filter(e=>norm(e.name)===n);if(ex.length===1)return {e:ex[0],cands:ex};
  const w=n.split(' ').filter(Boolean);
  const part=pool.filter(e=>{const en=norm(e.name);return w.length>=2&&w.every(x=>en.includes(x));});
  if(part.length===1)return {e:part[0],cands:part};
  return {cands:part.length?part:pool.filter(e=>w.length&&norm(e.name).includes(w[0])).slice(0,8)};
}
function parseLeaveRows(rows,pool){
  const dc=leaveDayCol(rows),H=leaveHeader(rows),matched=[],unmatched=[];
  for(const r of rows){
    const name=String(r[H?H.ni:0]??'').trim(),code=H?String(r[H.ci]??'').trim():'';if(!name||norm(name)==='الاسم'||norm(name)==='اسم الموظف')continue;
    const days=[];r.slice(dc).forEach((c,i)=>{if(/^\s*[1-9]\s*$/.test(String(c)))days.push(i+1);});
    if(!days.length)continue;
    const byCode=code?pool.find(e=>String(e.code)===code):null;
    const m=byCode?{e:byCode}:code?{cands:[],badCode:code}:leaveMatch(name,pool);
    if(m.e)matched.push({name,code:m.e.code,en:m.e.name,days});else unmatched.push({name,days,cands:m.cands||[],badCode:m.badCode});
  }
  return {matched,unmatched};
}
function importLeavePlan(){
  pickFile('.xlsx,.xls,.csv',async f=>{
    let rows;try{rows=await readSheet(f);}catch(e){toast('الملف مش مقروء');return;}
    const {matched,unmatched}=parseLeaveRows(rows,activeEmps());
    LEAVE_IMP={fname:f.name,month:monthOf(DATE),matched,unmatched};
    const odd=matched.filter(x=>x.days.length!==4);
    openModal(`<button class="x" onclick="closeModal()">✕</button><h2>🗓️ شيت الإجازات (جدول الراحات)</h2><div class="small muted" style="margin-bottom:8px">${esc(f.name)}</div>
      <label class="small">الشهر: <input class="inp" type="month" id="leaveMonth" value="${LEAVE_IMP.month}" onchange="LEAVE_IMP.month=this.value"></label>
      <div class="row" style="gap:6px;margin:8px 0"><span class="badge b-green">✔ متطابق ${fmt(matched.length)}</span>${unmatched.length?`<span class="badge b-red">✖ مش متطابق ${fmt(unmatched.length)}</span>`:''}${odd.length?`<span class="badge b-gold">عدد الراحات مش 4: ${fmt(odd.length)}</span>`:''}</div>
      ${unmatched.length?`<div class="lock" style="margin-bottom:8px"><b>اكتب كود الموظف للأسماء دي (أو سيبها فاضية تتجاهل):</b>${unmatched.map((u,i)=>`<div class="row" style="gap:6px;margin-top:4px"><span class="small" style="min-width:160px">${esc(u.name)}${u.badCode?` (كود ${esc(u.badCode)} مش موجود)`:''} · ${fmt(u.days.length)} راحة</span><input class="inp" id="lvc${i}" placeholder="الكود" style="width:90px"><span class="small muted">${u.cands.slice(0,4).map(e=>esc(e.name)+' ('+esc(e.code)+')').join(' · ')}</span></div>`).join('')}</div>`:''}
      ${odd.length?`<div class="small muted" style="margin-bottom:8px">راجع: ${odd.slice(0,8).map(x=>esc(x.en)+' ('+x.days.length+')').join('، ')}${odd.length>8?' …':''}</div>`:''}
      <div class="row"><button class="btn pri" onclick="commitLeavePlan()">✔ اعتماد الجدول</button><button class="btn" onclick="closeModal()">إلغاء</button></div>`);
  });
}
async function commitLeavePlan(){
  const I=LEAVE_IMP;if(!I)return;const out=I.matched.map(x=>({code:x.code,days:x.days}));
  I.unmatched.forEach((u,i)=>{const c=($('#lvc'+i)?.value||'').trim();if(c&&emp(c))out.push({code:c,days:u.days});});
  if(!out.length){toast('مفيش حاجة تتحفظ');return;}
  closeModal();
  if(await push('leave_plan',{month:I.month},{rows:out})!==false)toast(`🗓️ اتحفظ جدول الراحات لـ ${fmt(out.length)} موظف — بيتطبق مع التحديث الجاي للبصمة`);
}
