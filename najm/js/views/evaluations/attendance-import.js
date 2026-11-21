// نجم أبو الفضل — رفع شيت البصمة: معاينة قبل الاعتماد (المقبول والمرفوض وأكواد مش موجودة)،
// والموظفين اللي مش في الشيت بيظهروا للمراجعة اليدوي، ونفس الملف مبيترفعش مرتين
let ATT_IMP=null;
function importAttendance(){
  pickFile('.xlsx,.xls,.csv',async f=>{
    let rows;try{rows=await readSheet(f);}catch(e){toast('الملف مش مقروء');return;}
    if(isMonthSheet(rows))return importMonthSheet(f,rows);   // شيت الحضور الشهري
    const H=findHeader(rows,{code:/^(كود|الكود|code|رقم الموظف|id)/,att:/^(atte|حضور|الحاله|الحالة|status)/,time:/(وقت الحضور|check ?in|in time|الدخول)/});
    if(!H||H.idx.code<0){toast('مش لاقي عمود الكود');return;}
    const res={},bad=[],unknown=[],outScope=[];let dup=0;
    rows.slice(H.row+1).forEach((r,k)=>{
      const code=String(r[H.idx.code]||'').trim();if(!code)return;const line=H.row+2+k;const e=emp(code);
      if(!e){unknown.push(code);return;}
      if(!inScope(e)){outScope.push(code);return;}
      const a=H.idx.att>=0?norm(r[H.idx.att]):'';const tm=H.idx.time>=0?String(r[H.idx.time]||'').trim():'';
      let st=null;
      if(tm&&toMin(tm)!=null)st=attFromTime(e,tm);
      else if(a)st=/غياب|absent/.test(a)?'abs':/حضور|present/.test(a)?'on':/اجاز|off/.test(a)?'off':null;
      if(!st){bad.push({line,code,why:`مش واضح (${esc(tm||a||'فاضي')})`});return;}
      if(res[code])dup++;res[code]={st,time:tm&&toMin(tm)!=null?tm:null};
    });
    const missing=filtered(true).filter(e=>!res[e.code]&&!peekDay(DATE).att[e.code]);
    ATT_IMP={fname:f.name,hash:await fileHash(f),res,bad,unknown,outScope,dup,missing};
    const prev=sameFile('attendance',ATT_IMP.hash);
    const cnt=k=>Object.values(res).filter(x=>x.st===k).length;
    openModal(`<h2>📥 شيت البصمة — يوم ${esc(DATE)}</h2><div class="small muted" style="margin-bottom:8px">${esc(f.name)}</div>
      ${prev?`<div class="lock" style="border-color:var(--red);color:var(--red);margin-bottom:6px">⛔ ${importedMsg(prev)}</div>`:''}
      <div class="row" style="gap:6px;margin-bottom:6px"><span class="badge b-green">✔ مقبول ${fmt(Object.keys(res).length)}</span><span class="badge b-gray">في ميعاده ${fmt(cnt('on'))}</span><span class="badge b-gold">تأخير ${fmt(cnt('late')+cnt('vlate'))}</span><span class="badge b-red">غياب ${fmt(cnt('abs'))}</span><span class="badge b-gray">إجازة ${fmt(cnt('off'))}</span>
        ${bad.length?`<span class="badge b-red">✖ مرفوض ${fmt(bad.length)}</span>`:''}${unknown.length?`<span class="badge b-red">أكواد مش موجودة ${fmt(unknown.length)}</span>`:''}${outScope.length?`<span class="badge b-gray">برّه نطاقك ${fmt(outScope.length)}</span>`:''}${dup?`<span class="badge b-gold">مكرر ${fmt(dup)}</span>`:''}</div>
      ${bad.length?`<div class="small" style="max-height:110px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px;margin-bottom:6px">${bad.slice(0,30).map(b=>`سطر ${fmt(b.line)} · كود ${esc(b.code)}: ${b.why}`).join('<br>')}</div>`:''}
      ${unknown.length?`<div class="small muted" style="margin-bottom:6px">أكواد مش في قايمة الموظفين: ${esc(unknown.slice(0,20).join('، '))}${unknown.length>20?' …':''}</div>`:''}
      ${missing.length?`<div class="lock" style="margin-bottom:6px"><b>⚠️ ${fmt(missing.length)} موظف مش موجودين في الشيت — راجعهم بإيدك</b> (بعد الاعتماد هتلاقيهم في التقييم من غير بصمة):<br><span class="small">${missing.slice(0,25).map(e=>esc(e.name.split(' ').slice(0,2).join(' '))+' ('+esc(e.code)+')').join('، ')}${missing.length>25?' …':''}</span></div>`:''}
      <div class="row" style="margin-top:10px"><button class="btn pri" onclick="commitAttendance()">✔ اعتماد ${fmt(Object.keys(res).length)} بصمة</button><button class="btn" onclick="closeModal()">إلغاء</button></div>`);
  });
}
async function commitAttendance(){
  const I=ATT_IMP;if(!I)return;const codes=Object.keys(I.res);if(!codes.length){toast('مفيش بصمات مقبولة');return;}
  const claim=await claimImport({kind:'attendance',file:I.fname,hash:I.hash,branch:USER.branch||'',day:DATE,ok:codes.length,bad:I.bad.length+I.unknown.length,dup:I.dup,note:I.missing.length?`ناقص ${I.missing.length} موظف`:null});
  if(!claim)return;
  closeModal();const D=day(DATE);
  for(const c of codes){mark(D,c);D.att[c]=I.res[c].st;if(I.res[c].time)D.attTime[c]=I.res[c].time;}
  save();render();toast('⏳ بنحفظ البصمة…');
  let fail=0;
  for(let i=0;i<codes.length;i+=10){const R=await Promise.all(codes.slice(i,i+10).map(c=>push('att',{day:DATE,code:c},{st:D.att[c],time:D.attTime[c]||null})));fail+=R.filter(x=>x===false).length;}
  ATT_IMP=null;
  // مبنقولش «اتسجل» غير للي اتحفظ فعلاً
  toast(fail?`⚠️ اتحفظ ${fmt(codes.length-fail)} بس من ${fmt(codes.length)} — جرّب تاني`:`✔ اتسجل حضور ${fmt(codes.length)} موظف`);
}

// ---------- شيت الحضور الشهري (ملف الحضور بتاع الحسابات) ----------
// بناخد 4 أعمدة بس من كل موظف: الكود · معاد الورديه · س الدخول · نوع الاجازه — وأي عمود تاني (فلوس، KPI، جزاءات...) بيتجاهل
const isMonthSheet=rows=>rows.slice(0,80).some(r=>r.some(c=>norm(c)===norm('معاد الورديه')));
function sheetDate(v){const s=String(v).trim();let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  if(/^\d{5}(\.\d+)?$/.test(s)){const d=new Date(Math.round((+s-25569)*864e5));return ymd(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));}return null;}
// أسبوع الشغل بيبدأ السبت
const weekKey=d=>{const t=new Date(d+'T12:00:00');t.setDate(t.getDate()-((t.getDay()+1)%7));return ymd(t);};
function parseMonthSheet(rows){
  const N=x=>norm(String(x||''));const blocks=[];
  for(let i=0;i<rows.length;i++){if(N(rows[i][0])!==N('الكود'))continue;const code=String(rows[i][1]||'').trim();if(!code)continue;
    let h=-1;for(let k=i+1;k<Math.min(i+6,rows.length);k++)if(rows[k].some(c=>N(c)===N('معاد الورديه'))){h=k;break;}if(h<0)continue;
    const H=rows[h].map(N);const ix=n=>H.indexOf(N(n));const c={date:ix('التاريخ'),leave:ix('نوع الاجازه'),shift:ix('معاد الورديه'),in:ix('س الدخول')};
    if(c.date<0||c.shift<0||c.in<0)continue;
    const days=[];for(let k=h+1;k<rows.length&&k<h+40;k++){const day=sheetDate(rows[k][c.date]);if(!day)break;
      days.push({day,shift:String(rows[k][c.shift]||'').trim(),inT:String(rows[k][c.in]||'').trim(),leave:c.leave>=0?String(rows[k][c.leave]||'').trim():''});}
    blocks.push({code,days});i=h;}
  // آخر يوم فيه بصمات في الملف (الأيام اللي بعده لسه ماجتش)
  const today=todayC();let last='';for(const b of blocks)for(const d of b.days)if(toMin(d.inT)!=null&&d.day>last)last=d.day;if(last>today)last=today;
  const recs=[],unknown=[],noData=[],bad=[];let rest=0;const weeklyOff=+RULES().weeklyOff||1;
  for(const b of blocks){const e=emp(b.code);const D=b.days.filter(d=>d.day<=last);
    if(!D.some(d=>toMin(d.inT)!=null||d.leave)){noData.push(b.code);continue;}
    if(!e||!e.active){unknown.push(b.code);continue;}
    const used={};
    for(const d of D){
      if(d.leave){recs.push({code:b.code,day:d.day,st:'off',time:null,why:d.leave});continue;}
      if(toMin(d.inT)!=null){const st=attFromShift(d.shift,d.inT);if(!st){bad.push({code:b.code,day:d.day,why:`ميعاد الوردية مش واضح (${esc(d.shift||'فاضي')})`});continue;}recs.push({code:b.code,day:d.day,st,time:d.inT});continue;}
      if(d.inT&&toMin(d.inT)==null){bad.push({code:b.code,day:d.day,why:`وقت الدخول مش واضح (${esc(d.inT)})`});continue;}
      // من غير بصمة ولا إجازة: أول يوم في الأسبوع = راحة، والباقي غياب
      const w=weekKey(d.day);used[w]=(used[w]||0)+1;if(used[w]<=weeklyOff){rest++;recs.push({code:b.code,day:d.day,st:'off',time:null,why:'راحة'});}else recs.push({code:b.code,day:d.day,st:'abs',time:null});
    }}
  const from=recs.reduce((a,r)=>!a||r.day<a?r.day:a,''),to=last;
  return {recs,unknown,noData,bad,rest,from,to,emps:new Set(recs.map(r=>r.code)).size};
}
let MON_IMP=null;
async function importMonthSheet(f,rows){
  if(!isOps()){toast('شيت الحضور الشهري بيرفعه مدير التشغيل بس');return;}
  const P=parseMonthSheet(rows);MON_IMP={...P,fname:f.name,hash:await fileHash(f)};
  const prev=sameFile('attendance',MON_IMP.hash);const cnt=k=>P.recs.filter(r=>r.st===k).length;
  const missing=activeEmps().filter(e=>!P.recs.some(r=>r.code===e.code)).length;
  openModal(`<h2>📥 شيت الحضور الشهري</h2><div class="small muted" style="margin-bottom:8px">${esc(f.name)} · من ${esc(P.from||'—')} لـ ${esc(P.to||'—')}</div>
    ${prev?`<div class="lock" style="border-color:var(--red);color:var(--red);margin-bottom:6px">⛔ ${importedMsg(prev)}</div>`:''}
    <div class="lock" style="margin-bottom:8px">بناخد من الملف <b>4 حاجات بس</b>: الكود، وميعاد الوردية، ووقت الدخول، ونوع الإجازة — وأي حاجة تانية في الملف (فلوس، KPI، جزاءات) مش بتتقري. البصمة بتتحسب على ميعاد وردية كل موظف في اليوم ده.</div>
    <div class="row" style="gap:6px;margin-bottom:6px"><span class="badge b-green">✔ ${fmt(P.emps)} موظف · ${fmt(P.recs.length)} يوم</span><span class="badge b-gray">في ميعاده ${fmt(cnt('on'))}</span><span class="badge b-gold">تأخير ${fmt(cnt('late')+cnt('vlate'))}</span><span class="badge b-red">غياب ${fmt(cnt('abs'))}</span><span class="badge b-gray">إجازة / راحة ${fmt(cnt('off'))}</span>
      ${P.bad.length?`<span class="badge b-red">✖ مش مقروء ${fmt(P.bad.length)}</span>`:''}${P.unknown.length?`<span class="badge b-red">أكواد مش عندنا ${fmt(P.unknown.length)}</span>`:''}</div>
    <div class="small muted" style="margin-bottom:6px">الأيام اللي من غير بصمة ولا إجازة: أول يوم في كل أسبوع اتحسب <b>راحة</b> (${fmt(P.rest)} يوم)، والباقي <b>غياب</b>. أي يوم غلط تقدر تعدّله من «تقييم اليوم».</div>
    ${P.bad.length?`<div class="small" style="max-height:110px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px;margin-bottom:6px">${P.bad.slice(0,30).map(b=>`كود ${esc(b.code)} · ${esc(b.day)}: ${b.why}`).join('<br>')}</div>`:''}
    ${P.unknown.length?`<div class="small muted" style="margin-bottom:6px">أكواد في الملف ومش في قايمة الموظفين (ضيفهم الأول من «ملفات الموظفين»): ${esc(P.unknown.slice(0,40).join('، '))}${P.unknown.length>40?' …':''}</div>`:''}
    ${missing?`<div class="small muted" style="margin-bottom:6px">${fmt(missing)} موظف عندنا مش في الملف — راجعهم.</div>`:''}
    <div class="row" style="margin-top:10px"><button class="btn pri" onclick="commitMonthSheet()">✔ اعتماد ${fmt(P.recs.length)} يوم</button><button class="btn" onclick="closeModal()">إلغاء</button></div>`);
}
async function commitMonthSheet(){
  const I=MON_IMP;if(!I||!I.recs.length){toast('مفيش بيانات');return;}
  const claim=await claimImport({kind:'attendance',file:I.fname,hash:I.hash,day:I.to,ok:I.recs.length,bad:I.bad.length+I.unknown.length,dup:0,note:`شيت شهري ${I.from} → ${I.to} · ${I.emps} موظف`});
  if(!claim)return;closeModal();toast('⏳ بنحفظ الحضور…');
  const rows=I.recs.map(r=>({day:r.day,code:r.code,st:r.st,time:r.time}));let saved=0,fail=0;
  if(LIVE){for(let i=0;i<rows.length;i+=400){const r=await push('att_bulk',{reason:'شيت الحضور الشهري',file:I.fname},rows.slice(i,i+400));if(r===false)fail+=Math.min(400,rows.length-i);else saved+=+(r?.saved??0);}await refresh(true);}
  else{for(const r of rows){const D=day(r.day);mark(D,r.code);D.att[r.code]=r.st;if(r.time)D.attTime[r.code]=r.time;else delete D.attTime[r.code];}saved=rows.length;save();RANK_CACHE=null;}
  MON_IMP=null;render();
  toast(fail?`⚠️ اتحفظ ${fmt(saved)} بس — ${fmt(fail)} ماتحفظش، جرّب تاني`:`✔ اتسجل حضور ${fmt(saved)} يوم`);
}
