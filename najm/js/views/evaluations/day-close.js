// نجم أبو الفضل — زرار «إغلاق اليوم» في تاب التقييم + سجل الإغلاق والخصومات
function closeBarHTML(){
  const G=myCloseGroups();if(!G.length)return '';
  const now=new Date();
  const rows=G.map(gk=>{const [b,g]=gk.split('|');const c=closeOf(DATE,gk);const dl=closeDeadline(DATE,gk);
    const dlTxt=dl.toLocaleString('ar-EG',{weekday:'short',hour:'2-digit',minute:'2-digit'});
    const name=`${USER.role==='shift'?'':esc(b)+' · '}شيفت ${GROUP_NAME[g]}`;
    if(c?.closed_by)return `<div class="row" style="justify-content:space-between;gap:8px"><span>✔ <b>${name}</b> اتقفل ${new Date(c.closed_at).toLocaleString('ar-EG',{hour:'2-digit',minute:'2-digit'})} بواسطة ${esc(mgrName(c.closed_by))}</span>${c.penalty>0?`<span class="badge b-red">متأخر ${fmt(c.late_minutes)} دقيقة · −${fmt(c.penalty)} نقطة</span>`:'<span class="badge b-green">في الميعاد</span>'}</div>`;
    const late=now>dl;
    return `<div class="row" style="justify-content:space-between;gap:8px"><span>🔓 <b>${name}</b> — آخر ميعاد للإغلاق ${dlTxt}${late?` <span class="badge b-red">متأخر${closeOn()&&c?.penalty>0?` · اتخصم −${fmt(c.penalty)}`:closeOn()?` · هيتخصم −${fmt(S.settings.lateClosePenalty)}`:''}</span>`:''}</span>
      <button class="btn sm ${late?'red':'gold'}" onclick="closeDay('${esc(gk)}')">🔒 إغلاق اليوم</button></div>`;}).join('');
  return `<div class="card" style="margin-bottom:10px;border-color:#cfc4ff;background:#faf8ff"><h3 style="margin:0 0 6px">🔒 إغلاق يوم ${esc(DATE)}</h3>${rows}
    <div class="small muted" style="margin-top:6px">بعد الإغلاق التقييم بيتقفل. التأخير عن آخر ميعاد بيتخصم من مدير الشيفت تلقائي (${closeOn()?`−${fmt(S.settings.lateClosePenalty)} نقطة`:'الخصم لسه مش شغال — مدير التشغيل بيحدد تاريخ البداية من الإعدادات'}).</div></div>`;
}
async function closeDay(gk){
  const L=filtered(true).filter(e=>groupKey(e)===gk);const D=peekDay(DATE);const field=RATE_FIELD[USER.role];
  const miss=L.filter(e=>D.att[e.code]!=='abs'&&D.att[e.code]!=='off'&&!((D[field][e.code]||[]).every(x=>x!=null)&&(D[field][e.code]||[]).length===5)).length;
  if(!await askConfirm(`إغلاق يوم ${DATE} — ${gk.replace('|',' · ')}؟${miss?` (فاضل ${miss} موظف ماكملتش تقييمهم)`:''} بعد الإغلاق مش هتقدر تعدّل.`))return;
  const now=new Date();const dl=closeDeadline(DATE,gk);const lateM=minsLate(now,dl);
  const pen=now>dl&&closeOn()&&DATE>=S.settings.closeStart?+S.settings.lateClosePenalty:0;
  if(!LIVE){const prev=closeOf(DATE,gk);const own=closeOwners(gk);const resp=own.length?own:[USER.username];
    (S.closes[DATE]||(S.closes[DATE]={}))[gk]={day:DATE,gkey:gk,deadline:dl.toISOString(),closed_by:USER.username,closed_at:now.toISOString(),late_minutes:prev?.late_minutes??lateM,penalty:prev?.penalty??pen,responsible:prev?.responsible??(pen?resp:null)};
    if(!prev&&pen)for(const u of resp){const id=`late|${DATE}|${gk}|${u}`;S.ledger=(S.ledger||[]).filter(l=>l.id!==id);S.ledger.push({id,username:u,month:monthOf(DATE),points:-pen,reason:`تأخير إغلاق يوم ${DATE} — ${gk.replace('|',' · ')}`});}
    save();}
  const ok=await push('day_close',{day:DATE,gkey:gk},{});if(ok===false)return;
  if(LIVE)await refresh(true);render();toast(pen?`🔒 اتقفل — متأخر ${lateM} دقيقة (−${pen} نقطة)`:'🔒 اتقفل اليوم');
}
// سجل خصومات وإغلاقات المدير (من رصيده)
function mgrHistoryHTML(un){
  const L=(S.ledger||[]).filter(l=>l.username===un).sort((a,b)=>String(b.created_at||b.id).localeCompare(String(a.created_at||a.id))).slice(0,30);
  if(!L.length)return '<div class="small muted">مفيش حركات</div>';
  return `<table><tbody>${L.map(l=>`<tr><td class="small">${esc(l.month)}</td><td class="small">${esc(l.reason||'')}</td><td><b style="color:${l.points<0?'var(--red)':'var(--green)'}">${l.points>0?'+':''}${fmt(l.points)}</b></td></tr>`).join('')}</tbody></table>`;
}
function openMgrHistory(un){openModal(`<button class="x" onclick="closeModal()">✕</button><h2>📜 سجل ${esc(mgrName(un))}</h2><div class="small muted" style="margin-bottom:8px">نقط الشهور، المكافآت، السوق، وخصومات التأخير في إغلاق اليوم.</div>${mgrHistoryHTML(un)}`);}
