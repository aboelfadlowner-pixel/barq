// نجم أبو الفضل — تاب «صفحتي»: بروفايل الموظف (بكوده ورقمه السري)، بروفايل المدير، ومدير التشغيل (مستني قرارك + كل المديرين)
function vMe(){
  if(USER)return mgrProfileHTML(USER,true);
  if(!isEmp())return empLoginForm('دخول','ادخل بكود البصمة ورقمك السري.');
  return empProfileHTML(emp(ME));
}

// ---------- بروفايل الموظف ----------
function todayStarsHTML(code){
  const s=score(DATE,code);
  if(s.total==null)return '<div class="small muted">لسه متقيّمتش النهارده.</div>';
  if(s.pub)return `<div class="kv"><span>المجموع</span><span>${starsHTML(s.total)} <b>${fmt(s.total,2)}</b></span></div>`;
  const row=(t,v,max)=>`<div class="kv"><span>${t}</span><b>${v==null?'<span class="muted">لسه</span>':fmt(v,2)+' / '+max}</b></div>`;
  return `${row('🖐️ البصمة',s.att,fmt(S.settings.att?.on??2))}${row('🧑‍💼 مديرك المباشر',s.mgr,1)}${row('👑 مدير التشغيل',s.ops,1)}${row('🧼 الهايجين',s.hy,1)}
    ${s.bonus?`<div class="kv"><span>⭐ تصرف مثالي (Bonus)</span><b style="color:var(--green)">+${fmt(s.bonus)}</b></div>`:''}
    <div class="kv" style="border-top:1px solid var(--line);padding-top:6px"><span><b>المجموع</b></span><span>${starsHTML(s.total)} <b>${fmt(s.total,2)}</b></span></div>`;
}
function empProfileHTML(e){
  const m=monthOf(DATE);const R=ranks();const ms=msOf(e);const t=ms.target;const cp=checkpointOf(DATE);
  const report=cp.day?reportHTML(progressOf(e,cp,goalAt(cp.date)),true):`<div class="card" style="text-align:center"><div style="font-size:40px">📅</div><div class="muted">أول تقرير للشهر ده هيطلع يوم ${fmt(cp.next)}.</div></div>`;
  return `<div style="max-width:880px;margin:0 auto">
    <div class="card" style="margin-bottom:12px"><div class="row" style="gap:16px;align-items:flex-start">${futCard(e,'sm')}
      <div style="flex:1;min-width:220px"><h2 style="margin:0">👋 أهلاً ${esc(e.name.split(' ')[0])}</h2>
        <div class="muted">${esc(e.name)} · كود ${esc(e.code)}</div>
        <div class="muted small">${esc(e.job||'')} · ${esc(e.dept)} · ${esc(e.branch)} · شيفت ${esc(e.shift)}</div>
        <div class="row" style="margin-top:8px;gap:6px">${R.branch[e.code]?`<span class="badge b-blue">#${fmt(R.branch[e.code])} في الفرع</span>`:''}${R.company[e.code]?`<span class="badge b-blue">#${fmt(R.company[e.code])} في المؤسسة</span>`:''}<span class="badge b-gold">🏆 ${fmt(ms.wins||0)} مرة رجل اليوم</span></div>
        <div class="row" style="margin-top:10px;gap:6px"><button class="btn sm pri" onclick="go('vote')">🗳️ صوّت لمديرك</button><button class="btn sm" onclick="go('target')">🎯 تارجت قسمي</button><button class="btn sm" onclick="meChangePin()">🔑 تغيير الرقم السري</button><button class="btn sm" onclick="meLogout()">خروج</button></div>
      </div></div></div>
    <div class="grid g-2" style="margin-bottom:12px">
      <div class="card"><h3>⭐ نجومك النهارده (${esc(DATE)})</h3>${todayStarsHTML(e.code)}</div>
      <div class="card"><h3>📅 ${monthName(m)}</h3>
        <div class="kv"><span>متوسط النجوم</span><span>${ms.avg!=null?`${starsHTML(ms.avg)} <b>${fmt(ms.avg,2)}</b>`:'—'}</span></div>
        <div class="kv"><span>🧑‍💼 الـ KPI</span><b>${kpiTxt(ms)} من ${fmt(ms.kpiMax||500)}</b></div>
        <div class="kv"><span>🎯 نقط التارجت</span><b>${t?.empPoints!=null?fmt(t.empPoints)+' نقطة':'—'}</b></div>
        <div class="kv"><span>الكروت</span><span>${cardsHTML(cardCount(e.code,m,DATE))||'<span class="muted">مفيش</span>'}</span></div>
        <div class="kv"><span>غياب / تأخير</span><b>${fmt(ms.abs||0)} / ${fmt(ms.late||0)}</b></div></div>
    </div>
    ${report}${myCardsHTML()}${myComplaintsHTML()}</div>`;
}

// ---------- بروفايل المدير ----------
function rateLeft(u){
  const f=RATE_FIELD[u.role];if(!f)return null;const D=peekDay(DATE);
  const L=u.role==='ops'?activeEmps():activeEmps().filter(e=>inScopeOf(u,e));
  const need=L.filter(e=>D.att[e.code]!=='abs'&&D.att[e.code]!=='off');
  const left=need.filter(e=>!rateDone(DATE,f,e.code)).length;
  return {left,total:need.length};
}
function mgrProfileHTML(u,self){
  const m=monthOf(DATE);const me=mgrEmp(u);const ops=u.role==='ops';
  const head=`<div class="card" style="margin-bottom:12px"><div class="row" style="gap:14px">${me?ava(me,'xl'):`<div class="ava xl">${esc((u.name||'?')[0])}</div>`}
    <div style="flex:1;min-width:200px"><h2 style="margin:0">${self?'👋 أهلاً ':''}${esc(u.name)}</h2><div class="muted">${ROLES[u.role]||''}${u.branch?' · '+esc(u.branch):''}${u.shift?' · شيفت '+esc(GROUP_NAME[shiftGroup(u.shift)]||u.shift):''}</div></div></div></div>`;
  let tasks='';
  if(self){const r=rateLeft(u);
    tasks=`<div class="card" style="margin-bottom:12px"><h3>✅ مهام النهارده (${esc(DATE)})</h3>
      ${r?`<div class="kv"><span>📝 التقييم</span><b>${r.left?`فاضل <span style="color:var(--red)">${fmt(r.left)}</span> من ${fmt(r.total)} موظف`:`<span style="color:var(--green)">✔ خلّصت (${fmt(r.total)})</span>`}</b></div>${r.left?'<button class="btn sm pri" onclick="go(\'rate\')">كمّل التقييم ←</button>':''}`:''}
    </div>${closeBarHTML()}`;}
  const pend=ops&&self?opsPendingHTML():'';
  let league='',team='',given='',mgrs='';
  if(!ops&&u.role!=='hygiene'){
    const sc=mgrScore(u,m,DATE),mm=mgrMonth(u,m,DATE);
    league=`<div class="card"><h3>🏟️ نقطك في دوري المديرين — ${monthName(m)}</h3>
      <div class="kv"><span>التقييم المجمّع</span><b>${fmt(sc.score)}/100</b></div>
      <div class="kv"><span>تقييم التشغيل ليك</span><b>${fmt(sc.opsPct)}%</b></div>
      <div class="kv"><span>مستوى فريقك</span><b>${fmt(sc.teamPct)}%</b></div>
      <div class="kv"><span>🗳️ أصوات الموظفين</span><b>${fmt(sc.votes)}</b></div>
      <div class="kv"><span>🏆 رجال يوم من فريقك</span><b>${fmt(mm.wins)}</b></div>
      <div class="kv"><span>💰 رصيدك</span><b>${fmt(balanceOf(u.username))} نقطة</b></div>
      <h3 style="margin:10px 0 4px">📜 الحركات (المكافآت وخصومات التأخير)</h3>${mgrHistoryHTML(u.username)}</div>`;
  }
  if(!ops){
    const L=activeEmps().filter(e=>inScopeOf(u,e)).map(e=>({e,s:score(DATE,e.code),ms:msOf(e)})).sort((a,b)=>(b.ms.kpiPts??-1)-(a.ms.kpiPts??-1));
    team=`<div class="card"><h3>👥 فريقك (${fmt(L.length)})</h3><div class="tbl-wrap" style="max-height:420px;overflow:auto"><table><thead><tr><th></th><th>الموظف</th><th>النهارده</th><th>الشهر</th></tr></thead><tbody>
      ${L.map(x=>`<tr style="cursor:pointer" onclick="openEmp('${x.e.code}')"><td>${ava(x.e,'sm')}</td><td><b>${esc(x.e.name)}</b><div class="small muted">${esc(x.e.dept)} · ${esc(x.e.shift)}</div></td><td>${x.s.total!=null?fmt(x.s.total,2):'<span class="muted">—</span>'}</td><td>${kpiTxt(x.ms)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">مفيش موظفين</td></tr>'}
      </tbody></table></div></div>`;
    const C=S.cards.filter(c=>c.by===u.username).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20);
    if(u.role!=='hygiene')given=`<div class="card"><h3>🟨🟥🟩 الكروت اللي اديتها</h3>${C.map(c=>{const st=CARD_STATUS[cardStatus(c)]||['',''];return `<div class="small" style="margin:4px 0"><i class="fcard ${c.color}"></i> <b>${esc(c.date)}</b> — ${esc(emp(c.code)?.name||c.code)}: ${esc(c.reason)} ${cardStatus(c)==='approved'?'':`<span class="badge ${st[1]}">${st[0]}</span>`}</div>`;}).join('')||'<div class="small muted">مفيش</div>'}</div>`;
  }
  if(ops&&self){
    const L=mgrRanks();
    mgrs=`<div class="card"><h3>🧑‍💼 كل المديرين — افتح بروفايل أي حد</h3><div class="tbl-wrap"><table><thead><tr><th>المدير</th><th>الفرع</th><th>التقييم</th><th>الرصيد</th></tr></thead><tbody>
      ${L.map(x=>`<tr style="cursor:pointer" onclick="openMgrProfile('${esc(x.u.username)}')"><td><b>${esc(x.u.name)}</b><div class="small muted">${ROLES[x.u.role]||''}</div></td><td class="small">${esc(x.u.branch||'')}</td><td>${fmt(x.score)}/100</td><td>${fmt(x.bal)}</td></tr>`).join('')}
      </tbody></table></div><div class="small muted" style="margin-top:6px">وبروفايل أي موظف من «🗂️ ملفات الموظفين» أو بالضغط على اسمه في أي مكان.</div></div>`;
  }
  return `<div style="max-width:980px;margin:0 auto">${head}${tasks}${pend}<div class="grid g-2">${league}${team}${given}${mgrs}</div>
    ${self?`<div class="row" style="margin-top:10px"><button class="btn sm" onclick="mgrChangePin()">🔑 تغيير الرقم السري</button><button class="btn sm" onclick="openLogin()">خروج</button></div>`:''}</div>`;
}
function openMgrProfile(un){const u=(S.mgrs||S.users||[]).find(x=>x.username===un);if(!u)return;openModal(`<button class="x" onclick="closeModal()">✕</button>${mgrProfileHTML(u,false)}`);}

// ---------- مدير التشغيل: مستني قرارك ----------
function opsPendingHTML(){
  const items=[];
  const red=S.cards.filter(c=>cardStatus(c)==='pending').length;if(red)items.push([`🟥 ${fmt(red)} كارت أحمر مستني موافقتك`,"go('cards')"]);
  const ap=(S.appeals||[]).filter(a=>a.status==='pending').length;if(ap)items.push([`✋ ${fmt(ap)} اعتراض مستني قرارك`,"go('cards')"]);
  const cq=(S.complaints||[]).filter(c=>(c.status||'proven')==='pending'||c.appealStatus==='pending').length;if(cq)items.push([`⚠️ ${fmt(cq)} شكوى عميل مستنية مراجعتك`,"go('cards')"]);
  const W=peekDay(DATE).winners||{};
  for(const b of branches())for(const g of SHIFT_GROUPS){if(!winnersFor(b,g))continue;if(!activeEmps().some(e=>e.branch===b&&shiftGroup(e.shift)===g))continue;
    if(!W[b+'|'+g])items.push([`🏆 رجل اليوم ${esc(b)} · ${GROUP_NAME[g]} مستني اعتمادك`,`F.branch='${esc(b)}';go('day')`]);}
  const late=[];for(const[d,G]of Object.entries(S.closes||{}))for(const[gk,c]of Object.entries(G))if(c&&!c.closed_by&&c.penalty>0&&d>=ymd(new Date(Date.now()-7*864e5)))late.push(`${d} — ${gk.replace('|',' · ')}`);
  if(late.length)items.push([`⏰ ${fmt(late.length)} يوم ماتسلّمش في الميعاد (اتخصم تلقائي): ${esc(late.slice(0,3).join('، '))}`,"go('rate')"]);
  return `<div class="card" style="margin-bottom:12px;border-color:var(--gold)"><h3>📥 مستني قرارك</h3>${items.length?items.map(([t,a])=>`<div class="kv"><span>${t}</span><button class="btn sm" onclick="${a}">افتح</button></div>`).join(''):'<div class="small muted">مفيش حاجة مستنياك 👏</div>'}</div>`;
}

// ---------- شكاوى العملاء على الموظف + الاعتراض ----------
function myComplaints(){if(LIVE)return S.myComplaints||[];
  return (S.complaints||[]).filter(c=>c.code===ME&&((c.status||'proven')==='proven'||c.appealStatus)).map(c=>({id:c.id,day:c.date,note:c.note,status:c.status||'proven',appeal_status:c.appealStatus,appeal_body:c.appealBody,appeal_note:c.appealNote}));}
function myComplaintsHTML(){const L=myComplaints();if(!L.length)return '';
  return `<div class="card" style="margin-top:12px"><h3>⚠️ شكاوى العملاء</h3><div class="small muted" style="margin-bottom:6px">الشكوى المثبتة بتخصم ${fmt(S.settings.complaintPenalty)}% من نقط التارجت. لو شايف إنها مش في محلها، اعترض واكتب السبب.</div>
    ${L.map(c=>`<div class="small" style="margin:6px 0"><b>${esc(c.day)}</b> — ${esc(c.note)} ${c.status==='proven'?'<span class="badge b-red">مثبتة</span>':'<span class="badge b-gray">اتلغت</span>'}
      ${c.appeal_status?` <span class="badge ${c.appeal_status==='pending'?'b-gold':c.appeal_status==='accepted'?'b-green':'b-red'}">${c.appeal_status==='pending'?'✋ اعتراضك مستني قرار':c.appeal_status==='accepted'?'✔ اعتراضك اتقبل':'اعتراضك اترفض'}</span>${c.appeal_note?` <span class="muted">${esc(c.appeal_note)}</span>`:''}`:c.status==='proven'?` <button class="btn sm" onclick="empComplaintAppeal('${esc(c.id)}')">✋ اعتراض</button>`:''}</div>`).join('')}</div>`;}
async function empComplaintAppeal(id){
  const t=await askText('اكتب اعتراضك على الشكوى دي (هيوصل لمدير التشغيل):');if(t===null)return;const body=t.trim();if(body.length<3){toast('اكتب سبب الاعتراض');return;}
  if(LIVE){try{await sbRpc('najm_emp_complaint_appeal',{p_code:ME,p_pin:MEPIN,p_id:id,p_body:body});}catch(x){toast('⚠️ '+x.message);return;}await refresh(true);}
  else{const c=S.complaints.find(x=>x.id===id);if(!c)return;Object.assign(c,{appealBody:body,appealStatus:'pending'});save();}
  render();toast('✋ اعتراضك اتبعت');
}

// المدير بيغيّر رقمه السري بنفسه (اختياري)
async function mgrChangePin(){
  const np=await askText('الرقم السري الجديد (من 4 لـ 6 أرقام):');if(np===null)return;const v=np.trim();
  if(!/^\d{4,6}$/.test(v)){toast('الرقم السري لازم يكون من 4 لـ 6 أرقام');return;}
  if(v===PIN||(!LIVE&&S.users.find(u=>u.username===USER.username)?.pin===v)){toast('اختار رقم مختلف عن القديم');return;}
  if(LIVE){try{await sbRpc('najm_my_pin',{p_user:USER.username,p_pin:PIN,p_new:v});}catch(x){toast('⚠️ '+(/4-6/.test(x.message)?'الرقم السري لازم يكون من 4 لـ 6 أرقام':'ماتغيّرش — جرّب تاني'));return;}
    PIN=v;try{sessionStorage.setItem('najm-user',JSON.stringify({...USER,pin:PIN}))}catch(e){}}
  else{const u=S.users.find(x=>x.username===USER.username);if(u){u.pin=v;save();}}
  toast('✔ اتغيّر الرقم السري');}
