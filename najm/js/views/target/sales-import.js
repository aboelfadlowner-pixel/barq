// نجم أبو الفضل — رفع تقرير المبيعات من فودكس
// sales import
let IMP=null;
function importSales(monthly=false){
  pickFile('.xlsx,.xls,.csv',async f=>{
    let rows;try{rows=await readSheet(f);}catch(e){toast('الملف مش مقروء');return;}
    const H=findHeader(rows,{code:/^(كود|الكود|كود الصنف|كود تعريف المنتج|باركود|sku|code|barcode)/,name:/^(اسم الصنف|الصنف|اسم المنتج|المنتج|product|item|name)/,qty:/(صافي الكميه|الكميه|كميه|quantity|qty)/,branch:/^(الفرع|فرع|branch)/});
    if(!H){toast('مش لاقي عناوين الأعمدة');return;}
    const guess=USER?.branch||branches().find(b=>norm(f.name).includes(norm(b)))||TG.branch||branches()[0];
    IMP={rows,H,fname:f.name,branch:guess,monthly,month:prevMonth(monthOf(DATE)),date:DATE};
    const hdr=rows[H.row];
    const sel=(k,l)=>`<label class="small">${l}<br><select class="inp" onchange="IMP.H.idx.${k}=+this.value;previewImp()"><option value="-1">— مش موجود —</option>${hdr.map((h,i)=>`<option value="${i}" ${H.idx[k]===i?'selected':''}>${esc(h)||'عمود '+(i+1)}</option>`).join('')}</select></label>`;
    openModal(`<h2>${monthly?'📊 مبيعات شهر كامل':'📥 تقرير المبيعات اليومي'}</h2><div class="small muted">${esc(f.name)}</div>
      <div class="row" style="margin:10px 0">${monthly?`<label class="small">الشهر<br><input class="inp" type="month" value="${IMP.month}" onchange="IMP.month=this.value"></label>`:`<label class="small">اليوم<br><input class="inp" type="date" value="${IMP.date}" onchange="IMP.date=this.value"></label>`}
      <label class="small">الفرع<br><select class="inp" ${USER?.branch?'disabled':''} onchange="IMP.branch=this.value">${branches().map(b=>`<option ${b===guess?'selected':''}>${esc(b)}</option>`).join('')}</select></label>
      ${sel('code','كود المنتج')}${sel('name','اسم المنتج')}${sel('qty','الكمية')}</div>
      <div class="lock">بناخد <b>الكمية بس</b>.</div><div id="impPrev" style="margin-top:8px"></div>
      <div class="row" style="margin-top:10px"><button class="btn pri" onclick="commitImp()">✔ تأكيد</button><button class="btn" onclick="closeModal()">إلغاء</button></div>`);
  });
}
function parseImp(){
  const {rows,H}=IMP;const out={};
  for(const r of rows.slice(H.row+1)){
    const code=H.idx.code>=0?String(r[H.idx.code]||'').trim():'';const name=H.idx.name>=0?String(r[H.idx.name]||'').trim():'';
    const qty=parseFloat(String(r[H.idx.qty]??'').replace(/,/g,''));
    if((!code&&!name)||isNaN(qty)||/اجمالي|إجمالي|total/i.test(name)||norm(name)==='محذوف')continue;
    const key=code||norm(name);(out[key]||(out[key]={name:name||code,qty:0})).qty+=qty;
  }
  return out;
}
function previewImp(){const el=$('#impPrev');if(!el)return;const o=parseImp();const L=Object.values(o);el.innerHTML=`<div class="small"><b>${esc(IMP.branch)}</b>: ${fmt(L.length)} صنف · إجمالي كميات ${fmt(L.reduce((a,x)=>a+x.qty,0),1)}</div>`;}
async function commitImp(){
  const o=parseImp();if(!Object.keys(o).length){toast('مفيش بيانات');return;}
  const I=IMP;
  if(I.monthly){(S.baseSales[I.month]||(S.baseSales[I.month]={}))[I.branch]=o;closeModal();toast('⏳ بنحفظ…');if(await push('base_sales',{month:I.month,branch:I.branch},o)===false)return;}
  else{const exists=LIVE?(S.salesDays?.[I.branch]||[]).includes(I.date):!!S.sales[I.date]?.[I.branch];if(exists&&!await askConfirm('فيه تقرير مرفوع لنفس اليوم. استبداله؟'))return;
    const D=S.sales[I.date]||(S.sales[I.date]={});D[I.branch]=o;closeModal();toast('⏳ بنحفظ…');if(await push('sales',{day:I.date,branch:I.branch},o)===false)return;}
  save();render();await refresh(true);toast('✔ اتسجل تقرير المبيعات');
}
