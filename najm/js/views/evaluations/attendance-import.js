// نجم أبو الفضل — رفع شيت البصمة: معاينة قبل الاعتماد (المقبول والمرفوض وأكواد مش موجودة)،
// والموظفين اللي مش في الشيت بيظهروا للمراجعة اليدوي، ونفس الملف مبيترفعش مرتين
let ATT_IMP=null;
function importAttendance(){
  pickFile('.xlsx,.xls,.csv',async f=>{
    let rows;try{rows=await readSheet(f);}catch(e){toast('الملف مش مقروء');return;}
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
