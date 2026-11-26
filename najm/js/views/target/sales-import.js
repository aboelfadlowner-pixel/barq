// نجم أبو الفضل — رفع تقرير المبيعات من فودكس
// sales import
let IMP=null;
function importSales(monthly=false){
  pickFile('.xlsx,.xls,.csv',async f=>{
    let rows;try{rows=await readSheet(f);}catch(e){toast('الملف مش مقروء');return;}
    const H=findHeader(rows,{code:/^(كود|الكود|كود الصنف|كود تعريف المنتج|باركود|sku|code|barcode)/,name:/^(اسم الصنف|الصنف|اسم المنتج|المنتج|product|item|name)/,qty:/(صافي الكميه|الكميه|كميه|quantity|qty)/,branch:/^(الفرع|فرع|branch)/});
    if(!H){toast('مش لاقي عناوين الأعمدة');return;}
    const guess=userBranches(USER)[0]||branches().find(b=>norm(f.name).includes(norm(b)))||TG.branch||branches()[0];
    IMP={rows,H,fname:f.name,hash:await fileHash(f),branch:guess,monthly,month:prevMonth(monthOf(DATE)),date:DATE};
    const prev=sameFile(monthly?'base_sales':'sales',IMP.hash);
    const hdr=rows[H.row];
    const sel=(k,l)=>`<label class="small">${l}<br><select class="inp" onchange="IMP.H.idx.${k}=+this.value;previewImp()"><option value="-1">— مش موجود —</option>${hdr.map((h,i)=>`<option value="${i}" ${H.idx[k]===i?'selected':''}>${esc(h)||'عمود '+(i+1)}</option>`).join('')}</select></label>`;
    openModal(`<h2>${monthly?'📊 مبيعات شهر كامل':'📥 تقرير المبيعات اليومي'}</h2><div class="small muted">${esc(f.name)}</div>
      <div class="row" style="margin:10px 0">${monthly?`<label class="small">الشهر<br><input class="inp" type="month" value="${IMP.month}" onchange="IMP.month=this.value"></label>`:`<label class="small">اليوم<br><input class="inp" type="date" value="${IMP.date}" onchange="IMP.date=this.value"></label>`}
      <label class="small">الفرع<br><select class="inp" ${userBranches(USER).length===1?'disabled':''} onchange="IMP.branch=this.value">${branches().map(b=>`<option ${b===guess?'selected':''}>${esc(b)}</option>`).join('')}</select></label>
      ${sel('code','كود المنتج')}${sel('name','اسم المنتج')}${sel('qty','الكمية')}</div>
      ${prev?`<div class="lock" style="border-color:var(--red);color:var(--red);margin-bottom:6px">⛔ ${importedMsg(prev)}</div>`:''}<div class="lock">بناخد <b>الكمية بس</b>. راجع المعاينة تحت قبل التأكيد: السطور المرفوضة مش هتتحسب.</div><div id="impPrev" style="margin-top:8px"></div>
      <div class="row" style="margin-top:10px"><button class="btn pri" onclick="commitImp()">✔ تأكيد</button><button class="btn" onclick="closeModal()">إلغاء</button></div>`);
    previewImp();
  });
}
// قراءة الملف مع التحقق: كود أو اسم + كمية رقم. المرفوض بسببه، والمكرر (نفس الكود أكتر من سطر) بيتجمع
function parseImpFull(){
  const {rows,H}=IMP;const out={},bad=[],seen={};let dup=0,neg=0;
  rows.slice(H.row+1).forEach((r,k)=>{
    const code=H.idx.code>=0?String(r[H.idx.code]||'').trim():'';const name=H.idx.name>=0?String(r[H.idx.name]||'').trim():'';
    const raw=String(r[H.idx.qty]??'').trim();const qty=parseFloat(raw.replace(/,/g,''));
    if(!code&&!name&&!raw)return;                                          // سطر فاضي
    if(/اجمالي|إجمالي|total/i.test(name)||norm(name)==='محذوف')return;      // سطر إجمالي
    const line=H.row+2+k;
    if(!code&&!name){bad.push({line,why:'من غير كود ولا اسم'});return;}
    if(H.idx.qty<0||raw===''||isNaN(qty)){bad.push({line,why:`الكمية مش رقم (${esc(raw)||'فاضية'})`,name:name||code});return;}
    if(qty<0)neg++;
    const key=code||norm(name);if(seen[key])dup++;seen[key]=1;
    (out[key]||(out[key]={name:name||code,qty:0})).qty+=qty;
  });
  const known=new Set([...Object.keys(S.baseSales?.[prevMonth(monthOf(DATE))]?.[IMP.branch]||{}),...Object.values(S.targets?.[monthOf(DATE)]||{}).flatMap(t=>(t.items||[]).map(i=>i.key))]);
  const fresh=known.size?Object.keys(out).filter(k=>!known.has(k)).length:0;
  return {out,bad,dup,neg,fresh};
}
const parseImp=()=>parseImpFull().out;
function previewImp(){const el=$('#impPrev');if(!el)return;const P=parseImpFull();const L=Object.values(P.out);
  el.innerHTML=`<div class="row" style="gap:6px"><span class="badge b-green">✔ مقبول ${fmt(L.length)} صنف</span>${P.bad.length?`<span class="badge b-red">✖ مرفوض ${fmt(P.bad.length)} سطر</span>`:''}${P.dup?`<span class="badge b-gold">مكرر ${fmt(P.dup)} (اتجمع)</span>`:''}${P.neg?`<span class="badge b-gold">${fmt(P.neg)} كمية بالسالب (مرتجع)</span>`:''}${P.fresh?`<span class="badge b-blue">${fmt(P.fresh)} منتج جديد مش في التارجت</span>`:''}</div>
    <div class="small" style="margin-top:4px"><b>${esc(IMP.branch)}</b> · إجمالي الكميات ${fmt(L.reduce((a,x)=>a+x.qty,0),1)}</div>
    ${P.bad.length?`<div class="small" style="margin-top:6px;max-height:140px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px">${P.bad.slice(0,30).map(b=>`سطر ${fmt(b.line)}: ${b.why}${b.name?` — ${esc(b.name)}`:''}`).join('<br>')}${P.bad.length>30?'<br>…':''}</div>`:''}`;}
async function commitImp(){
  const P=parseImpFull();const o=P.out;if(!Object.keys(o).length){toast('مفيش بيانات');return;}
  const I=IMP;
  const claim=await claimImport({kind:I.monthly?'base_sales':'sales',file:I.fname,hash:I.hash,branch:I.branch,day:I.monthly?null:I.date,month:I.monthly?I.month:null,ok:Object.keys(o).length,bad:P.bad.length,dup:P.dup});
  if(!claim)return;
  if(I.monthly){(S.baseSales[I.month]||(S.baseSales[I.month]={}))[I.branch]=o;closeModal();toast('⏳ بنحفظ…');if(await push('base_sales',{month:I.month,branch:I.branch},o)===false)return;}
  else{const exists=LIVE?(S.salesDays?.[I.branch]||[]).includes(I.date):!!S.sales[I.date]?.[I.branch];if(exists&&!await askConfirm('فيه تقرير مرفوع لنفس اليوم. استبداله؟'))return;
    const D=S.sales[I.date]||(S.sales[I.date]={});D[I.branch]=o;closeModal();toast('⏳ بنحفظ…');if(await push('sales',{day:I.date,branch:I.branch},o)===false)return;}
  save();render();await refresh(true);toast('✔ اتسجل تقرير المبيعات');
}
