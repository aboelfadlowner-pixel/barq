// نجم أبو الفضل — رفع شيت البصمة
function importAttendance(){
  pickFile('.xlsx,.xls,.csv',async f=>{
    let rows;try{rows=await readSheet(f);}catch(e){toast('الملف مش مقروء');return;}
    const H=findHeader(rows,{code:/^(كود|الكود|code|رقم الموظف|id)/,att:/^(atte|حضور|الحاله|الحالة|status)/,time:/(وقت الحضور|check ?in|in time|الدخول)/});
    if(!H||H.idx.code<0){toast('مش لاقي عمود الكود');return;}
    const D=day(DATE);let n=0;const changed=[];
    for(const r of rows.slice(H.row+1)){
      const code=String(r[H.idx.code]||'').trim();const e=emp(code);if(!e||!inScope(e))continue;
      const a=H.idx.att>=0?norm(r[H.idx.att]):'';const tm=H.idx.time>=0?String(r[H.idx.time]||'').trim():'';
      let st=null;
      if(tm&&toMin(tm)!=null){st=attFromTime(e,tm);D.attTime[code]=tm;}
      else if(a){st=/غياب|absent/.test(a)?'abs':/حضور|present/.test(a)?'on':/اجاز|off/.test(a)?'off':null;}
      if(st){mark(D,code);D.att[code]=st;n++;changed.push(code);}
    }
    save();render();
    for(let i=0;i<changed.length;i+=10)await Promise.all(changed.slice(i,i+10).map(c=>push('att',{day:DATE,code:c},{st:D.att[c],time:D.attTime[c]||null})));
    toast(`اتسجل حضور ${n} موظف`);
  });
}
