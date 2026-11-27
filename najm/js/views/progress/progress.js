// نجم أبو الفضل — تاب تقريري / تقارير التقدّم
function tgtDetailHTML(R){const t=R.tg?.t;if(!t)return `<div class="lock" style="margin-top:8px">🎯 لسه مفيش تارجت متحدد لقسمك — كلّم مديرك.</div>`;
  const rows=[];
  if(t.type==='sales'&&t.items){const T=t.total>0?t.total:t.items.reduce((a,i)=>a+(+i.target||0),0),Sd=t.items.reduce((a,i)=>a+(+i.sold||0),0);rows.push(`<tr><td>🛒 تارجت القسم</td><td>باع ${fmt(Sd,1)} من ${fmt(T,1)} (${fmt(t.pct)}%)</td><td>${t.pace!=null?`المفروض لحد النهارده ${fmt(t.pace)}%`:''}</td><td><b>${fmt(R.tg?.dPts)}</b> / ${fmt(t.deptMax)} نقطة</td></tr>`);}
  else if(t.kpis){for(const k of t.kpis)rows.push(`<tr><td>📋 ${esc(k.name)}</td><td>${k.val!=null?fmt(k.val,1):'—'}</td><td>${k.pct!=null?fmt(k.pct)+'%':'—'}</td><td></td></tr>`);rows.push(`<tr><td><b>📋 مؤشرات القسم</b></td><td>${fmt(t.pct)}%</td><td></td><td><b>${fmt(R.tg?.dPts)}</b> / ${fmt(t.deptMax)} نقطة</td></tr>`);}
  (t.caps||[]).forEach((c,i)=>rows.push(`<tr><td><span class="cap-c" style="width:16px;height:16px;font-size:10px">C</span> كابتن ${esc(c.name)}</td><td>باع ${fmt(c.sold,1)} من ${fmt(c.target,1)} (${fmt(c.pct)}%)</td><td>${c.target>c.sold?`فاضل ${fmt(c.target-c.sold,1)}`:'✔ قفل'}</td><td><b>${fmt(R.tg?.cPts?.[i])}</b> / ${fmt(c.max)} نقطة</td></tr>`));
  if(R.tg&&R.tg.pace<100)rows.push(`<tr><td colspan="4" class="small muted">النقط محسوبة «على المسار»: اللي اتباع لحد النهارده مقارنة باللي المفروض يتباع لحد النهارده.</td></tr>`);
  return `<h3 style="margin:10px 0 4px">🎯 التارجت بالتفصيل</h3><table><tbody>${rows.join('')}</tbody></table>`;}
function tgtTip(R){const t=R.tg?.t;if(!t)return 'لسه مفيش تارجت متحدد لقسمك.';const L=[];
  for(const c of t.caps||[])if(c.target>c.sold)L.push(`فاضل ${fmt(c.target-c.sold,1)} من ${esc(c.name)}`);
  if(t.type==='sales'&&t.items){const T=t.total>0?t.total:t.items.reduce((a,i)=>a+(+i.target||0),0),Sd=t.items.reduce((a,i)=>a+(+i.sold||0),0);if(T>Sd)L.push(`القسم فاضله ${fmt(T-Sd,1)} عشان يقفل الشهر — ركّز على البيع والعرض`);}
  else if(t.kpis){const w=t.kpis.filter(k=>k.pct!=null).sort((a,b)=>a.pct-b.pct)[0];if(w)L.push(`أضعف مؤشر في قسمك: ${esc(w.name)} (${fmt(w.pct)}%)`);}
  return L.join(' · ')||'كمّل على نفس المستوى.';}
function reportHTML(R,forEmp){
  const [ic,tx,cls]=ST_TXT[R.st];const e=R.e;const gv=R.goal?.v;
  const top=R.parts.filter(p=>p.lost>0.5).sort((a,b)=>b.lost-a.lost);
  const keep=R.parts.filter(p=>p.lost<=0.5);
  return `<div class="card" style="border-width:2px;border-color:${R.st==='green'?'var(--green)':R.st==='red'?'#e7a59e':R.st==='near'?'var(--gold)':'var(--line)'}">
    <div class="row" style="gap:12px;margin-bottom:10px">${ava(e,'xl')}<div style="flex:1;min-width:180px"><h2 style="margin:0">${esc(e.name)}</h2><div class="muted small">${esc(e.job)} · ${esc(e.dept)} · ${esc(e.branch)}</div>
      <div style="margin-top:6px"><span class="badge ${cls}" style="font-size:15px">${ic} ${tx}</span></div></div>
      <div class="small muted">تقرير يوم ${fmt(R.cp.day)} ${monthName(R.cp.m)}</div></div>
    <div class="grid g-2" style="margin-bottom:8px">
      <div class="card" style="text-align:center;border-color:${R.q.kOk?'var(--green)':'#e7a59e'}"><div class="small muted">🧑‍💼 الـ KPI بتاعك</div><div style="font-size:32px;font-weight:900">${fmt(R.score)}<span class="small muted">%</span> ${R.q.kOk?'✔':'✖'}</div><div class="small">المطلوب ${fmt(KPI_G())}% · نقطك ${fmt(R.ms?.kpiPts)} من ${fmt(R.ms?.kpiMax||500)}</div>${R.score!=null?barHTML(R.score/KPI_G()*100,null,R.q.kOk?'':'bad'):''}</div>
      <div class="card" style="text-align:center;border-color:${R.q.tOk?'var(--green)':'#e7a59e'}"><div class="small muted">🎯 تارجت قسمك</div><div style="font-size:32px;font-weight:900">${R.tg?.dept!=null?fmt(R.tg.dept)+'%':'—'} ${R.q.tOk?'✔':'✖'}</div><div class="small">المطلوب القسم يحقق ${fmt(TGT_G())}%${R.tg?.v!=null?` · نقطك ${fmt(R.tg.v)}`:''}${R.tg&&R.tg.pace<100?' <span class="muted">(على المسار — مقارنة باللي المفروض لحد يوم '+fmt(R.cp.day)+')</span>':''}</div>${R.tg?.dept!=null?barHTML(R.tg.dept/TGT_G()*100,null,R.q.tOk?'':'bad'):''}</div>
    </div>
    <div class="small" style="margin-bottom:6px">⚖️ عشان تدخل العشرة الأوائل لازم <b>الاتنين مع بعض</b> + <b>ماتغيبش خالص</b> ومتاخدش غير إجازاتك الأسبوعية (${fmt(R.q.offMax)} يوم الشهر ده) — ${R.q.dOk?`<b style="color:var(--green)">لحد دلوقتي تمام ✔</b>`:`<b style="color:var(--red)">${R.q.abs?`غبت ${fmt(R.q.abs)} يوم`:`خدت ${fmt(R.q.off)} إجازة`} — مش مؤهل الشهر ده ✖</b>`}.</div>
    <div class="small muted" style="margin:6px 0 10px">${fmt(R.n)} يوم متقيّم · ${R.abs?`غياب ${fmt(R.abs)} يوم · `:''}${cardsHTML(R.cards)||'مفيش كروت'}${R.cardP?` (${R.cardP>0?'+':''}${fmt(R.cardP)} نقطة)`:''}</div>
    ${R.detail?`<h3 style="margin:8px 0">📊 ${R.st==='green'?'إنت كسبت نقطك منين':'النقط اللي ضاعت منك'}</h3>
      <table><tbody>${R.parts.map(p=>`<tr><td>${p.t}</td><td style="min-width:120px">${barHTML(100-p.lost/20*100,null,p.lost<=1?'':p.lost<=5?'warn':'bad')}</td><td><b style="color:${p.lost<=1?'var(--green)':'var(--red)'}">${p.lost<=0.5?'✔ كامل':'−'+fmt(p.lost,1)+' نقطة'}</b>${p.note?` <span class="small muted">${p.note}</span>`:''}${p.miss?` <span class="small muted">(${fmt(p.miss)} يوم لسه مااتقيّمش)</span>`:''}</td></tr>`).join('')}
      ${R.cardP?`<tr><td>🟨🟥🟩 الكروت</td><td></td><td><b style="color:${R.cardP<0?'var(--red)':'var(--green)'}">${R.cardP>0?'+':''}${fmt(R.cardP)} نقطة</b></td></tr>`:''}
      ${R.bonusDays?`<tr><td>⭐ مواقف مثالية</td><td></td><td><b style="color:var(--green)">${fmt(R.bonusDays)} مرة</b></td></tr>`:''}</tbody></table>
      <div class="grid g-2" style="margin-top:10px">
        ${R.techA.length?`<div class="lock"><b>🛠️ التقييم الفني</b><br>أقوى بند: <b>${esc(R.techA[R.techA.length-1].t)}</b> (${fmt(R.techA[R.techA.length-1].v,1)} من 2)<br>أضعف بند: <b style="color:var(--red)">${esc(R.techA[0].t)}</b> (${fmt(R.techA[0].v,1)} من 2)</div>`:''}
        ${R.hyA.length?`<div class="lock"><b>🧼 الهايجين</b><br>أقوى بند: <b>${esc(R.hyA[R.hyA.length-1].t)}</b> (${fmt(R.hyA[R.hyA.length-1].v,1)} من 2)<br>أضعف بند: <b style="color:var(--red)">${esc(R.hyA[0].t)}</b> (${fmt(R.hyA[0].v,1)} من 2)</div>`:''}
      </div>`:`<div class="lock">التفاصيل بتظهر للموظف نفسه (بكوده) وللمديرين.</div>`}
    ${tgtDetailHTML(R)}
    <div class="card" style="margin-top:10px;background:${R.st==='green'?'var(--green-soft)':'var(--red-soft)'};border:0">
      ${R.st==='green'?`<b>🏆 كمّل كده!</b> إنت في طريقك للعشرة الأوائل.${keep.length?` حافظ على: ${keep.map(p=>p.t.replace(/^\S+ /,'')).join('، ')}.`:''}${top.length?`<br>ولو عايز تضمن مكانك: ${top.slice(0,2).map(p=>TIPS[p.k].replace('${max}',fmt(S.settings.att.on))).join(' · ')}.`:''}`
      :R.st==='none'?'لسه بدري — التقرير بيتحسب من تقييماتك اليومية.'
      :`<b>${R.st==='near'?'⚡ قربت جداً!':'💪 لسه تقدر تلحق!'}</b> ${R.q.kOk&&!R.q.tOk?`الـ KPI بتاعك تمام ✔ — <b>اللي ناقصك التارجت</b>. ${tgtTip(R)}<br>`:''}${!R.q.kOk&&R.q.tOk?'التارجت تمام ✔ — <b>اللي ناقصك الـ KPI</b>. ':''}${!R.q.kOk&&top.length?`أكتر حاجة مأخّراك: <b>${top.slice(0,2).map(p=>p.t.replace(/^\S+ /,'')+` (−${fmt(p.lost,1)})`).join(' و ')}</b>.<br>${top.slice(0,2).map(p=>'• '+TIPS[p.k].replace('${max}',fmt(S.settings.att.on))).join('<br>')}`:''}
        ${!R.q.kOk&&!R.q.tOk?`<br>🎯 والتارجت كمان: ${tgtTip(R)}`:''}
        ${!R.q.kOk&&R.need!=null?`<br>🎯 عشان الـ KPI يوصل ${fmt(gv)} نقطة آخر الشهر محتاج متوسط <b>${R.need>5?'أكتر من 5':fmt(Math.max(0,R.need),2)}</b> نجمة في اليوم من النهارده${R.need>5?' — صعب بالنجوم بس، محتاج كمان كروت خضرا ومواقف مثالية':''}.`:''}`}
    </div>
    ${R.cp.next?`<div class="small muted" style="margin-top:8px">التقرير الجاي يوم ${fmt(R.cp.next)}.</div>`:''}
  </div>`;
}
function vProgress(){
  const cp=checkpointOf(DATE);
  if(!USER)return vMe();   // الموظف: تقريره في «صفحتي»
  if(!cp.day)return `<h2>📈 تقارير التقدّم</h2><div class="empty">أول تقرير للشهر ده يوم ${fmt(cp.next)}.</div>`;
  const goal=goalAt(cp.date);const list=filtered(true);
  const R=list.map(e=>progressOf(e,cp,goal)).filter(r=>r.st!=='none').sort((a,b)=>(b.score||0)-(a.score||0));
  const cnt=k=>R.filter(r=>r.st===k).length;
  return `<div class="sec-title"><h2>📈 تقارير التقدّم — يوم ${fmt(cp.day)} ${monthName(cp.m)}</h2><div class="small">الشرط: KPI <b>${fmt(KPI_G())}</b> أو أكتر، ونقط التارجت توصل المطلوب لقسمه — الاتنين مع بعض</div></div>
    <div class="row" style="margin-bottom:10px;gap:8px"><span class="badge b-green">🟢 مرشحين ${fmt(cnt('green'))}</span><span class="badge b-gold">🟡 قريبين ${fmt(cnt('near'))}</span><span class="badge b-red">🔴 متأخرين ${fmt(cnt('red'))}</span></div>
    ${filterBar({scoped:true})}
    <div class="card"><div class="tbl-wrap"><table><thead><tr><th>الموظف</th><th>الحالة</th><th>🧑‍💼 KPI</th><th>🎯 التارجت</th><th>أكتر حاجة مأخّراه</th><th>أضعف بند فني</th><th>أضعف بند هايجين</th></tr></thead><tbody>
    ${R.map(r=>{const w=r.parts.filter(p=>p.lost>0.5).sort((a,b)=>b.lost-a.lost)[0];return `<tr style="cursor:pointer" onclick="openReport('${r.e.code}')"><td><div class="row" style="flex-wrap:nowrap;gap:6px">${ava(r.e,'sm')}<div><b>${esc(r.e.name)}</b><div class="small muted">${esc(r.e.dept)} · ${esc(r.e.shift)}</div></div></div></td>
      <td><span class="badge ${ST_TXT[r.st][2]}">${ST_TXT[r.st][0]} ${ST_TXT[r.st][1].split(' ')[0]}</span></td><td><b style="color:${r.q.kOk?'var(--green)':'var(--red)'}">${fmt(r.score)} ${r.q.kOk?'✔':'✖'}</b></td><td><b style="color:${r.q.tOk?'var(--green)':'var(--red)'}">${r.tg?.v!=null?fmt(r.tg.v)+' / '+fmt(r.tg.need):'—'} ${r.q.tOk?'✔':'✖'}</b></td>
      <td class="small">${w?`${w.t} (−${fmt(w.lost,1)})`:'—'}</td><td class="small">${r.techA[0]?esc(r.techA[0].t):'—'}</td><td class="small">${r.hyA[0]?esc(r.hyA[0].t):'—'}</td></tr>`;}).join('')||'<tr><td colspan="7" class="empty">مفيش تقييمات لسه</td></tr>'}
    </tbody></table></div></div>`;
}
function openReport(code){const cp=checkpointOf(DATE);if(!cp.day)return;openModal(`<button class="x" onclick="closeModal()">✕</button>${reportHTML(progressOf(emp(code),cp,goalAt(cp.date)),false)}`);}
// ---------- كروتي + الاعتراض ----------
// LIVE: من najm_my_cards (كل الكروت طول فترة الشغل). التجربة: من الكروت المحمّلة
function myCards(){
  if(LIVE)return S.myCards||[];
  return (S.cards||[]).filter(c=>c.code===ME).sort((a,b)=>b.date.localeCompare(a.date)).map(c=>{const a=(S.appeals||[]).filter(x=>x.cardId===c.id).sort((x,y)=>String(y.at).localeCompare(String(x.at)))[0];
    return {id:c.id,day:c.date,color:c.color,reason:c.reason,status:cardStatus(c),by:mgrName(c.by),appeal:a?{status:a.status,body:a.body,note:a.note}:null};});
}
function myCardsHTML(){
  const L=myCards();const m=monthOf(DATE);const cur=L.filter(c=>String(c.day).startsWith(m));
  const appealTxt=a=>!a?'':a.status==='pending'?'<span class="badge b-gold">✋ اعتراضك مستني قرار</span>':a.status==='accepted'?`<span class="badge b-green">✔ اعتراضك اتقبل</span>${a.note?` <span class="small muted">${esc(a.note)}</span>`:''}`:`<span class="badge b-red">اعتراضك اترفض</span>${a.note?` <span class="small muted">${esc(a.note)}</span>`:''}`;
  const row=c=>{const st=CARD_STATUS[c.status]||['',''];const canAppeal=['approved','pending'].includes(c.status)&&!(c.appeal&&c.appeal.status==='pending');
    return `<tr style="${['approved','pending'].includes(c.status)?'':'opacity:.6'}"><td>${esc(c.day)}</td><td><i class="fcard ${c.color}"></i> ${CARD[c.color].t}</td><td class="small">${esc(c.reason)}<div class="muted">من ${esc(c.by||'')}</div></td><td><span class="badge ${st[1]}">${st[0]}</span> ${appealTxt(c.appeal)}</td><td>${canAppeal?`<button class="btn sm" onclick="empAppeal('${esc(c.id)}')">✋ اعتراض</button>`:''}</td></tr>`;};
  return `<div class="card" style="margin-top:12px"><h3>🟨🟥🟩 كروتي</h3><div class="small muted" style="margin-bottom:6px">الشهر ده: ${cardsHTML(cardCount(ME,m,DATE))||'مفيش كروت'} — النقط بتبدأ من جديد كل شهر، والكروت كلها بتفضل في سجلك. لو شايف إن كارت مش في محله، اعترض واكتب السبب.</div>
    ${L.length?`<div class="tbl-wrap"><table><thead><tr><th>اليوم</th><th>الكارت</th><th>السبب</th><th>الحالة</th><th></th></tr></thead><tbody>${L.map(row).join('')}</tbody></table></div>`:'<div class="small muted">مفيش كروت 👏</div>'}</div>`;
}
// ---------- أيام الغياب + الاعتراض (بيوصل لمدير التشغيل: القبول بيحوّل اليوم لإجازة) ----------
function myAttAppeals(){return LIVE?(S.myAttAppeals||[]):(S.attAppeals||[]).filter(a=>a.code===ME);}
function myAbsHTML(){
  const today=ymd(new Date()),from=ymd(new Date(Date.now()-35*864e5));
  const days=[];for(let d=DATE;d>=from&&days.length<40;d=ymd(new Date(new Date(d+'T00:00:00').getTime()-864e5)))if(d<=today&&peekDay(d).att?.[ME]==='abs')days.push(d);
  const ap=myAttAppeals();const of=d=>ap.filter(a=>String(a.day)===d).sort((x,y)=>(+y.id||0)-(+x.id||0))[0];
  const txt=a=>!a?'':a.status==='pending'?'<span class="badge b-gold">✋ مستني قرار</span>':a.status==='accepted'?`<span class="badge b-green">✔ اتقبل — اليوم بقى إجازة</span>`:`<span class="badge b-red">✖ اترفض</span>${a.note?` <span class="small muted">${esc(a.note)}</span>`:''}`;
  if(!days.length&&!ap.length)return '';
  return `<div class="card" style="margin-top:12px"><h3>🚫 أيام الغياب</h3><div class="small muted" style="margin-bottom:6px">لو غياب يوم مش مظبوط (مثلاً كان راحتك أو إجازة) اعترض وهيوصل لمدير التشغيل. لو اقتنع اليوم بيتحول إجازة ومبيقللش نجومك.</div>
    <div class="tbl-wrap"><table><tbody>${days.map(d=>{const a=of(d);return `<tr><td>${esc(d)}</td><td>${a?txt(a):'<span class="badge b-red">غياب</span>'}</td><td>${!a||a.status==='rejected'?`<button class="btn sm" onclick="empAttAppeal('${d}')">✋ اعتراض</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="3" class="small muted">مفيش أيام غياب 👏</td></tr>'}</tbody></table></div></div>`;
}
async function empAttAppeal(day){
  const t=await askText('اكتب سبب اعتراضك على غياب يوم '+day+' (هيوصل لمدير التشغيل):');if(t===null)return;const body=t.trim();
  if(body.length<3){toast('اكتب سبب الاعتراض');return;}
  if(LIVE){try{const r=await sbRpc('najm_emp_att_appeal',{p_code:ME,p_pin:MEPIN,p_day:day,p_body:body});if(r?.error){toast(/already open/.test(r.error)?'في اعتراض مفتوح على اليوم ده':'⚠️ '+r.error);return;}}catch(x){toast('⚠️ '+x.message);return;}await refresh(true);}
  else{S.attAppeals=S.attAppeals||[];S.attAppeals.unshift({id:uid(),code:ME,day,body,status:'pending',at:new Date().toISOString()});
    (S.history||(S.history=[])).unshift({at:new Date().toISOString(),actor:'emp:'+ME,actor_name:emp(ME)?.name,kind:'att_appeal',code:ME,day,data:{body}});save();}
  render();toast('✋ اعتراضك اتبعت');
}
async function empAppeal(cardId){
  if(!needPin())return;
  const t=await askText('اكتب اعتراضك على الكارت ده (هيوصل لمدير التشغيل):');if(t===null)return;const body=t.trim();
  if(body.length<3){toast('اكتب سبب الاعتراض');return;}
  if(LIVE){try{await sbRpc('najm_emp_appeal',{p_code:ME,p_pin:MEPIN,p_card:cardId,p_body:body});}catch(x){toast(/already open/.test(x.message)?'في اعتراض مفتوح على الكارت ده':'⚠️ '+x.message);return;}await refresh(true);}
  else{const c=S.cards.find(x=>x.id===cardId);S.appeals=S.appeals||[];S.appeals.unshift({id:uid(),cardId,code:ME,body,status:'pending',at:new Date().toISOString(),cardBy:c?.by,cardDay:c?.date,cardColor:c?.color,cardReason:c?.reason});
    (S.history||(S.history=[])).unshift({at:new Date().toISOString(),actor:'emp:'+ME,actor_name:emp(ME)?.name,kind:'appeal',code:ME,day:c?.date,data:{card:cardId,body}});save();}
  render();toast('✋ اعتراضك اتبعت');
}
