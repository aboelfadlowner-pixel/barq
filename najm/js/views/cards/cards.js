// نجم أبو الفضل — تاب الكروت: كروت الشهر بحالتها، موافقة الأحمر، الإلغاء (من غير مسح)، واعتراضات الموظفين
// ---------- Cards (managers) ----------
const canDecideAppeal=a=>isOps()||a.cardBy===USER?.username;
function vCards(){
  const m=monthOf(DATE);const L=S.cards.filter(c=>c.date.startsWith(m)&&inScope(emp(c.code)||{})).sort((a,b)=>b.date.localeCompare(a.date));
  const pend=L.filter(c=>cardStatus(c)==='pending');const k=S.settings.cards;
  const mineApp=a=>inScope(emp(a.code)||{})||a.cardBy===USER.username;
  const openApp=(S.appeals||[]).filter(a=>a.status==='pending'&&mineApp(a));
  const doneApp=(S.appeals||[]).filter(a=>a.status!=='pending'&&mineApp(a)).slice(0,30);
  const row=c=>{const e=emp(c.code);const st=CARD_STATUS[cardStatus(c)];const live=['pending','approved'].includes(cardStatus(c));
    return `<tr style="${live?'':'opacity:.6'}"><td>${c.date}</td><td><div class="row" style="flex-wrap:nowrap">${ava(e,'sm')}<b>${esc(e?.name)}</b></div></td><td><i class="fcard ${c.color}"></i> ${CARD[c.color].t}</td><td class="small">${esc(c.reason)}</td><td class="small">${esc(mgrName(c.by))}</td><td><span class="badge ${st[1]}">${st[0]}</span></td>
    <td class="row" style="gap:4px">${cardStatus(c)==='pending'&&isOps()?`<button class="btn sm gold" onclick="approveCard('${c.id}',true)">اعتماد</button><button class="btn sm red" onclick="approveCard('${c.id}',false)">رفض</button>`:''}${live&&(isOps()||(c.by===USER.username&&cardStatus(c)==='pending'))?`<button class="btn sm" onclick="delCard('${c.id}')">إلغاء</button>`:''}</td></tr>`;};
  const appRow=a=>{const e=emp(a.code);return `<tr><td>${esc(a.cardDay||'')}</td><td><div class="row" style="flex-wrap:nowrap">${ava(e,'sm')}<b>${esc(e?.name)}</b></div></td><td><i class="fcard ${a.cardColor}"></i> ${esc(a.cardReason||'')}<div class="small muted">من ${esc(mgrName(a.cardBy))}</div></td><td class="small">«${esc(a.body)}»</td>
    <td>${a.status==='pending'?(canDecideAppeal(a)?`<div class="row" style="gap:4px"><button class="btn sm gold" onclick="decideAppeal('${a.id}',true)">قبول (يتلغي الكارت)</button><button class="btn sm red" onclick="decideAppeal('${a.id}',false)">رفض</button></div>`:'<span class="small muted">القرار للمدير اللي اداه أو التشغيل</span>')
      :`<span class="badge ${a.status==='accepted'?'b-green':'b-red'}">${a.status==='accepted'?'اتقبل':'اترفض'}</span> <span class="small muted">${esc(mgrName(a.decidedBy))}${a.note?' — '+esc(a.note):''}</span>`}</td></tr>`;};
  return `<div class="sec-title"><h2>🟨🟥🟩 الكروت — ${monthName(m)}</h2></div>
    <div class="grid g-3" style="margin-bottom:12px">${['yellow','red','green'].map(c=>`<div class="card"><h3><i class="fcard ${c}"></i> ${CARD[c].t} <span class="badge ${c==='green'?'b-green':'b-red'}">${k[c]>0?'+':''}${k[c]}</span></h3><div class="small muted">${CARD[c].d}${c==='red'?' · بموافقة مدير التشغيل · بيمنعه من رجل اليوم يومها':''}${c==='yellow'?` · كل ${k.yellowsToRed} أصفر في الشهر = أحمر (${k.red}) والصفر بتتلغي`:''}</div><div style="font-size:26px;font-weight:900;margin-top:6px">${fmt(L.filter(x=>x.color===c&&counted(x)).length)}</div></div>`).join('')}</div>
    <div class="lock" style="margin-bottom:12px">الكروت بتأثر على تقييم الموظف (الـ KPI) بس — مش على التارجت ولا الكابتن. مفيش كارت بيتمسح: الملغي والمرفوض بيفضلوا في سجل الموظف، والنقط بتبدأ من جديد كل شهر.</div>
    ${openApp.length?`<div class="card" style="margin-bottom:12px;border-color:#cfc4ff;background:#faf8ff"><h3>✋ اعتراضات مستنية قرار (${fmt(openApp.length)})</h3><div class="tbl-wrap"><table><thead><tr><th>يوم الكارت</th><th>الموظف</th><th>الكارت</th><th>الاعتراض</th><th></th></tr></thead><tbody>${openApp.map(appRow).join('')}</tbody></table></div></div>`:''}
    ${pend.length&&isOps()?`<div class="card" style="margin-bottom:12px;border-color:#f3c3be"><h3>⏳ كروت حمرا مستنية موافقتك (${fmt(pend.length)})</h3><div class="tbl-wrap"><table><tbody>${pend.map(row).join('')}</tbody></table></div></div>`:''}
    <div class="card"><h3>كل كروت الشهر</h3><div class="tbl-wrap"><table><thead><tr><th>اليوم</th><th>الموظف</th><th>الكارت</th><th>السبب</th><th>من</th><th>الحالة</th><th></th></tr></thead><tbody>${L.map(row).join('')||'<tr><td colspan="7" class="empty">مفيش كروت</td></tr>'}</tbody></table></div></div>
    ${doneApp.length?`<div class="card" style="margin-top:12px"><h3>📜 اعتراضات اتقرّر فيها</h3><div class="tbl-wrap"><table><tbody>${doneApp.map(appRow).join('')}</tbody></table></div></div>`:''}`;
}
async function approveCard(id,ok){const c=S.cards.find(x=>x.id===id);if(!c)return;c.status=ok?'approved':'rejected';c.approved=ok;c.decidedBy=USER.username;save();render();await push('card_approve',{id},{approved:ok});refresh(true);}
async function delCard(id){if(!await askConfirm('إلغاء الكارت؟ (هيفضل في سجل الموظف «اتلغى»)'))return;const c=S.cards.find(x=>x.id===id);if(!c)return;c.status='cancelled';c.approved=false;c.decidedBy=USER.username;save();render();await push('card',{id,code:c.code},null);refresh(true);}
async function decideAppeal(id,accept){
  const a=(S.appeals||[]).find(x=>x.id===id);if(!a)return;
  const note=await askText(accept?'قبول الاعتراض — الكارت هيتلغي. ملاحظة للموظف (اختياري):':'رفض الاعتراض — السبب للموظف:');if(note===null)return;
  if(!accept&&!note.trim()){toast('اكتب سبب الرفض');return;}
  a.status=accept?'accepted':'rejected';a.decidedBy=USER.username;a.note=note.trim();
  if(accept){const c=S.cards.find(x=>x.id===a.cardId);if(c){c.status='overturned';c.approved=false;}}
  save();render();await push('appeal_decide',{id},{accept,note:note.trim()});refresh(true);toast(accept?'✔ اتقبل الاعتراض واتلغى الكارت':'اترفض الاعتراض');
}
