// نجم أبو الفضل — تاب الكروت
// ---------- Cards (managers) ----------
function vCards(){
  const m=monthOf(DATE);const L=S.cards.filter(c=>c.date.startsWith(m)&&inScope(emp(c.code)||{})).sort((a,b)=>b.date.localeCompare(a.date));
  const pend=L.filter(c=>!c.approved);const k=S.settings.cards;
  const row=c=>{const e=emp(c.code);return `<tr><td>${c.date}</td><td><div class="row" style="flex-wrap:nowrap">${ava(e,'sm')}<b>${esc(e?.name)}</b></div></td><td><i class="fcard ${c.color}"></i> ${CARD[c.color].t}</td><td class="small">${esc(c.reason)}</td><td class="small">${esc(c.by)}</td><td>${c.approved?'<span class="badge b-green">محسوب</span>':'<span class="badge b-gray">⏳ مستني التشغيل</span>'}</td>
    <td class="row" style="gap:4px">${!c.approved&&isOps()?`<button class="btn sm gold" onclick="approveCard('${c.id}',true)">اعتماد</button><button class="btn sm red" onclick="approveCard('${c.id}',false)">رفض</button>`:''}${isOps()||(c.by===USER.username&&!c.approved)?`<button class="btn sm" onclick="delCard('${c.id}')">حذف</button>`:''}</td></tr>`;};
  return `<div class="sec-title"><h2>🟨🟥🟩 الكروت — ${monthName(m)}</h2></div>
    <div class="grid g-3" style="margin-bottom:12px">${['yellow','red','green'].map(c=>`<div class="card"><h3><i class="fcard ${c}"></i> ${CARD[c].t} <span class="badge ${c==='green'?'b-green':'b-red'}">${k[c]>0?'+':''}${k[c]}</span></h3><div class="small muted">${CARD[c].d}${c==='red'?' · بموافقة مدير التشغيل · بيمنعه من رجل اليوم يومها':''}${c==='yellow'?` · كل ${k.yellowsToRed} أصفر = أحمر`:''}</div><div style="font-size:26px;font-weight:900;margin-top:6px">${fmt(L.filter(x=>x.color===c&&x.approved).length)}</div></div>`).join('')}</div>
    ${pend.length&&isOps()?`<div class="card" style="margin-bottom:12px;border-color:#f3c3be"><h3>⏳ كروت حمرا مستنية موافقتك (${fmt(pend.length)})</h3><div class="tbl-wrap"><table><tbody>${pend.map(row).join('')}</tbody></table></div></div>`:''}
    <div class="card"><h3>كل كروت الشهر</h3><div class="tbl-wrap"><table><thead><tr><th>اليوم</th><th>الموظف</th><th>الكارت</th><th>السبب</th><th>من</th><th>الحالة</th><th></th></tr></thead><tbody>${L.map(row).join('')||'<tr><td colspan="7" class="empty">مفيش كروت</td></tr>'}</tbody></table></div></div>`;
}
async function approveCard(id,ok){const i=S.cards.findIndex(c=>c.id===id);if(i<0)return;if(ok){S.cards[i].approved=true;}else S.cards.splice(i,1);save();render();await push('card_approve',{id},{approved:ok});refresh(true);}
async function delCard(id){if(!await askConfirm('حذف الكارت؟'))return;const c=S.cards.find(x=>x.id===id);S.cards=S.cards.filter(c=>c.id!==id);save();render();if(c){await push('card',{id,code:c.code},null);refresh(true);}}
