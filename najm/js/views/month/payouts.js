// نجم أبو الفضل — صرف الجوايز (مدير التشغيل)
// ---------- صرف الجوايز (مدير التشغيل) ----------
function showPayouts(){
  if(!monthFinal(monthOf(DATE))){toast('الشهر لسه مؤقت — اعتمده الأول');return;}
  const L=duePrizes();const paid=new Map((S.payouts||[]).map(p=>[p.id,p]));const m=monthOf(DATE);
  const tot=L.reduce((a,x)=>a+x.amount,0),done=L.filter(x=>paid.has(x.id)).reduce((a,x)=>a+x.amount,0);
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>💵 صرف جوايز ${monthName(m)}</h2>
   <div class="row" style="margin-bottom:8px"><span class="badge b-gold">المستحق ${fmt(tot)} ج</span><span class="badge b-green">اتصرف ${fmt(done)} ج</span><span class="badge b-red">فاضل ${fmt(tot-done)} ج</span><button class="btn sm" onclick="exportPayouts()">📊 Excel للحسابات</button><button class="btn sm" onclick="openPayoutLog()">📜 سجل الصرف والتصحيحات</button></div>
   <div class="lock" style="margin-bottom:8px">كؤوس الشهر بتتصرف بعد إقفال الشهر (الترتيب قبلها مؤقت).</div>
   <div class="tbl-wrap" style="max-height:60vh"><table><thead><tr><th>الاسم</th><th>الفرع</th><th>الجايزة</th><th>المبلغ</th><th>اتصرف؟</th></tr></thead><tbody>
   ${L.map(x=>{const p=paid.get(x.id);return `<tr><td><b>${esc(x.name)}</b> <span class="small muted">${esc(x.code)}</span></td><td class="small">${esc(x.branch)}</td><td class="small">${esc(x.label)}</td><td><b>${fmt(x.amount)} ج</b></td><td>${p?`<span class="badge b-green">✔ ${new Date(p.paid_at).toLocaleDateString('ar-EG')}</span> <button class="btn sm" onclick="markPaid('${esc(x.id)}',false)">تراجع</button>`:`<button class="btn sm pri" onclick="markPaid('${esc(x.id)}',true)">اتصرف</button>`}</td></tr>`;}).join('')||'<tr><td colspan="5" class="empty">مفيش جوايز مستحقة لسه</td></tr>'}
   </tbody></table></div>`);
}
// الصرف بيتسجل بعد ما الداتابيز تأكد بس. إلغاء صرف (تصحيح مالي) لازم بسبب، وبيتسجل
async function markPaid(id,on){
  const x=duePrizes().find(y=>y.id===id);if(!x)return;S.payouts=S.payouts||[];
  let reason='';
  if(!on){reason=await askText(`إلغاء صرف ${x.label} لـ ${x.name} (${fmt(x.amount)} ج) — تصحيح مالي. اكتب السبب:`);if(reason===null)return;reason=reason.trim();if(!reason){toast('لازم تكتب السبب');return;}}
  if(LIVE){try{await sbRpc('najm_payout_save',{p_user:USER.username,p_pin:PIN,p_id:id,p_data:on?{month:monthOf(DATE),code:x.code,kind:x.kind,ref:x.ref,amount:x.amount}:{undo:true,reason}});}catch(e){toast('⚠️ ماتحفظش — '+errMsg(e.message));return;}}
  if(on)S.payouts.push({id,month:monthOf(DATE),code:x.code,kind:x.kind,ref:x.ref,amount:x.amount,paid_at:new Date().toISOString()});
  else{const old=S.payouts.find(p=>p.id===id);S.payouts=S.payouts.filter(p=>p.id!==id);if(!LIVE)(S.history||(S.history=[])).unshift({at:new Date().toISOString(),actor:USER.username,actor_name:USER.name,kind:'payout_undo',code:x.code,data:{old,reason}});}
  if(on&&!LIVE)(S.history||(S.history=[])).unshift({at:new Date().toISOString(),actor:USER.username,actor_name:USER.name,kind:'payout',code:x.code,data:{id,data:{amount:x.amount,kind:x.kind}}});
  save();showPayouts();toast(on?'✔ اتسجل الصرف':'↩️ اتلغى الصرف واتسجل السبب');
}
async function openPayoutLog(){
  let L;if(LIVE){try{L=await sbRpc('najm_payout_log',{p_user:USER.username,p_pin:PIN});}catch(e){toast('⚠️ '+errMsg(e.message));return;}}else L=(S.history||[]).filter(h=>h.kind==='payout'||h.kind==='payout_undo');
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>📜 سجل الصرف والتصحيحات</h2>${L.length?`<div class="tbl-wrap"><table><thead><tr><th>إمتى</th><th>مين</th><th>الموظف</th><th>العملية</th><th>المبلغ</th><th>السبب</th></tr></thead><tbody>
    ${L.map(h=>{const u=h.kind==='payout_undo';const amt=u?h.data?.old?.amount:h.data?.data?.amount;return `<tr><td class="small">${new Date(h.at).toLocaleString('ar-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td class="small">${esc(h.actor_name||h.actor)}</td><td class="small">${esc(emp(h.code)?.name||h.code||'')}</td><td>${u?'<span class="badge b-red">إلغاء صرف</span>':'<span class="badge b-green">صرف</span>'}</td><td><b>${amt!=null?fmt(amt)+' ج':'—'}</b></td><td class="small">${esc(h.data?.reason||'')}</td></tr>`;}).join('')}
    </tbody></table></div>`:'<div class="empty">مفيش عمليات لسه</div>'}<div class="row" style="margin-top:10px"><button class="btn" onclick="showPayouts()">رجوع</button></div>`);
}
function exportPayouts(){
  const paid=new Map((S.payouts||[]).map(p=>[p.id,p]));
  const rows=duePrizes().map(x=>({'الكود':x.code,'الاسم':x.name,'الفرع':x.branch,'الجايزة':x.label,'المبلغ':x.amount,'اتصرف':paid.has(x.id)?'✔':'','تاريخ الصرف':paid.get(x.id)?new Date(paid.get(x.id).paid_at).toLocaleDateString('ar-EG'):''}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'الجوايز');XLSX.writeFile(wb,`najm-prizes-${monthOf(DATE)}.xlsx`);
}
