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
  return `${row('🖐️ البصمة',s.att,fmt(S.settings.att?.on??2))}${row('🧑‍💼 مديرك المباشر',s.mgr,1)}${row('🧼 الهايجين',s.hy,1)}${row('🕌 الصلاة (المدير)',s.pray,'½')}${row('📹 الكاميرات (صلاة + بريك)',s.cam,'½')}
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
        <div class="row" style="margin-top:10px;gap:6px"><button class="btn sm pri" onclick="go('vote')">🗳️ صوّت لمديرك</button><button class="btn sm" onclick="go('target')">🎯 تارجت قسمي</button><button class="btn sm" onclick="openCareer('${e.code}')">📜 ملفي الكامل</button>${ME_HASPIN?`<button class="btn sm" onclick="meChangePin()">🔑 تغيير الرقم السري</button>`:''}<button class="btn sm" onclick="meLogout()">خروج</button></div>
      </div></div></div>
    <div class="grid g-2" style="margin-bottom:12px">
      <div class="card"><h3>⭐ نجومك النهارده (${esc(DATE)})</h3>${todayStarsHTML(e.code)}</div>
      <div class="card"><h3>📅 ${monthName(m)}</h3>
        <div class="kv"><span>متوسط النجوم</span><span>${ms.avg!=null?`${starsHTML(ms.avg)} <b>${fmt(ms.avg,2)}</b>`:'—'}</span></div>
        <div class="kv"><span>🧑‍💼 الـ KPI</span><b>${kpiTxt(ms)} من ${fmt(ms.kpiMax||500)}</b></div>${isCashierEmp(e)&&cashierPts(e.code,m)?`<div class="kv"><span>🧾 باندات الكاشير</span><b style="color:${cashierPts(e.code,m)>0?'var(--green)':'var(--red)'}">${cashierPts(e.code,m)>0?'+':''}${fmt(cashierPts(e.code,m))} نقطة</b></div>`:''}${ms.medal?`<div class="kv"><span>🏅 وسام برق</span><b style="color:var(--green)">+${fmt(ms.medal)} نقطة</b></div>`:''}
        <div class="kv"><span>🎯 نقط التارجت</span><b>${t?.empPoints!=null?fmt(t.empPoints)+' نقطة':'—'}</b></div>
        <div class="kv"><span>الكروت</span><span>${cardsHTML(cardCount(e.code,m,DATE))||'<span class="muted">مفيش</span>'}</span></div>
        <div class="kv"><span>غياب / تأخير</span><b>${fmt(ms.abs||0)} / ${fmt(ms.late||0)}</b></div></div>
    </div>
    ${report}${myCardsHTML()}${myComplaintsHTML()}</div>`;
}

// ---------- بروفايل المدير ----------
function rateLeft(u){
  const f=u.role==='ops'?null:RATE_FIELD[u.role];if(!f)return null;const D=peekDay(DATE);
  const L=(u.role==='ops'?activeEmps():activeEmps().filter(e=>inScopeOf(u,e))).filter(ratable);
  const need=L.filter(e=>D.att[e.code]!=='abs'&&D.att[e.code]!=='off');
  const left=need.filter(e=>!rateDone(DATE,f,e.code)).length;
  return {left,total:need.length};
}
function mgrProfileHTML(u,self){
  const m=monthOf(DATE);const me=mgrEmp(u);const ops=u.role==='ops';
  const head=`<div class="card" style="margin-bottom:12px"><div class="row" style="gap:14px">${me?ava(me,'xl'):`<div class="ava xl">${esc((u.name||'?')[0])}</div>`}
    <div style="flex:1;min-width:200px"><h2 style="margin:0">${self?'👋 أهلاً ':''}${esc(u.name)}</h2><div class="muted">${ROLES[u.role]||''}${userBranches(u).length?' · '+esc(userBranches(u).join('، ')):''}${u.shift?' · شيفت '+esc(GROUP_NAME[shiftGroup(u.shift)]||u.shift):''}</div></div></div></div>`;
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
  for(const a of (S.alerts||[]).filter(a=>!a.seen_at))items.push([alertTxt(a),`openAlert(${+a.id})`]);
  // التحديث الدوري نفسه واقف (مفيش تحديث من أكتر من 30 ساعة) — النجوم محفوظة زي ما هي وبتكمّل من آخر يوم لما يرجع يشتغل
  {const li=(S.imports||[]).filter(i=>i.kind==='attendance'&&String(i.file_hash||'').startsWith('drive-sync')).map(i=>i.at).sort().pop();
   if(LIVE&&li&&Date.now()-new Date(li)>30*36e5)items.push([`⏳ تحديث البصمة من الشيت واقف من ${fmt(Math.floor((Date.now()-new Date(li))/864e5))} يوم — النجوم محفوظة زي ما هي، وبتكمّل من آخر يوم أول ما يرجع`,"openImports('attendance')"]);}
  const pc=prayConflicts();if(pc.length)items.push([`🕌 ${fmt(pc.length)} تعارض في الصلاة بين الكاميرات والمدير — اعتمد رأي مين`,"openPrayConflicts()"]);
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
  if(!needPin())return;
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

// التصويت والاعتراض للموظف اللي مدير التشغيل اداله رقم سري بس (كود البصمة لوحده معروف لزمايله)
function needPin(){return true;}   // الاعتراض والتصويت بكود البصمة بس

// ---------- تعارض الصلاة: المدير (كل 4 أيام) × الكاميرات (كل يوم) ← مدير التشغيل بيعتمد ----------
// رأي الكاميرات في الدورة: صلّى كل الأيام = ملتزم · مصلاش خالص = مبيصليش · مرة ومرة = بيقطع (من يومين على الأقل)
// «بيقطع» عند المدير مش تعارض (المدير شايف أكتر من الكاميرات)
function prayConflicts(){const out=[];const m=monthOf(DATE);const T=DATE;
  for(const e of activeEmps()){for(let st=m+'-01';st<=T&&st.startsWith(m);st=shiftDay(cycleStart(st),RATE_EVERY)){
      const cs=cycleStart(st),ce=cycleEnd(st);const days=[];for(let d=cs;d<=ce&&d<=T;d=shiftDay(d,1))days.push(d);
      const P=days.map(d=>peekDay(d).pray?.[e.code]).filter(v=>v!=null);if(P.length<2)continue;
      const lv=prayLevelRaw(days[days.length-1],e.code);if(lv==null)continue;
      const ones=P.filter(v=>v===1).length;const cam=ones===P.length?2:ones===0?0:1;
      // تعارض: المدير قال «ملتزم» والكاميرات سجّلت يوم ماصلّاش · أو قال «مبيصليش» والكاميرات شافته بيصلي نص الأيام أو أكتر
      const zeros=P.length-ones;const clash=(lv===2&&zeros>0)||(lv===0&&ones>=Math.ceil(P.length/2));
      if(clash&&!(S.prayReviews||{})[e.code+'|'+cs])out.push({e,cycle:cs,end:ce,lv,cam,ones,n:P.length});}}
  return out;}
const prayLevelRaw=(d,code)=>{const sh=rateArr(d,'sh',code),br=rateArr(d,'br',code);return sh?.[4]??br?.[4]??null;};
function openPrayConflicts(){const L=prayConflicts();
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>🕌 تعارض الصلاة</h2><div class="small muted" style="margin-bottom:8px">المدير بيقيّم الصلاة كل ${RATE_EVERY} أيام، والكاميرات كل يوم. لما يختلفوا انت اللي بتعتمد — ورأي الكاميرات بيتحسب على الدورة كلها.</div>
  ${L.map(x=>`<div class="card" style="margin-bottom:8px"><b>${esc(x.e.name)}</b> <span class="small muted">· ${esc(x.e.branch)} · من ${esc(x.cycle.slice(8))} لـ ${esc(x.end.slice(8))}</span>
    <div class="small" style="margin:4px 0">المدير: <b>${PRAY_LVL[x.lv]}</b> · الكاميرات: <b>${PRAY_LVL[x.cam]}</b> (صلّى ${fmt(x.ones)} من ${fmt(x.n)} يوم)</div>
    <div class="row" style="gap:6px"><button class="btn sm pri" onclick="decidePray('${x.e.code}','${x.cycle}','cams',${x.cam})">📹 اعتمد رأي الكاميرات</button><button class="btn sm" onclick="decidePray('${x.e.code}','${x.cycle}','mgr',null)">🧑‍💼 اعتمد رأي المدير</button></div></div>`).join('')||'<div class="empty">مفيش تعارض 👏</div>'}`);}
async function decidePray(code,cycle,decision,level){(S.prayReviews||(S.prayReviews={}))[code+'|'+cycle]={decision,level};save();
  if(await push('pray_review',{code,cycle},{decision,level})!==false){toast('✔ اتعتمد');openPrayConflicts();render();}}

// ---------- تنبيهات شيت البصمة (من التحديث الدوري 7 و9 و11 بالليل و1 الفجر) ----------
function alertTxt(a){const d=a.data||{};
  if(a.kind==='sheet_changed')return `🚨 شيت البصمة اتغيّر في أيام فاتت (${fmt(d.count||0)} يوم) — في حاجة غلط، اتواصل مع الـ HR`;
  if(a.kind==='comeback')return `🔁 ${esc(d.name||a.code)} (${esc(a.code)}) رجع يبصم ${esc(a.day)} بعد ${fmt(d.gap)} يوم من غير بصمة${d.active===false?' — وهو موقوف في السيستم':''}`;
  if(a.kind==='emp_added')return `🆕 ${esc(d.name||a.code)} (${esc(a.code)}) اتضاف من الشيت — ${esc(d.dept||'')} · ${esc(d.branch||'')}`;
  if(a.kind==='sheet_stale')return `⏳ شيت البصمة واقف — آخر يوم فيه ${esc(d.last||'')} (من ${fmt(d.days||0)} يوم). النجوم محفوظة وبتكمّل أول ما يتحدّث`;
  if(a.kind==='stale')return `⏸️ ${esc(d.name||a.code)} (${esc(a.code)}) ${d.last?`وقف عن البصمة من ${fmt(d.days||5)} أيام (آخر بصمة ${esc(d.last)})`:'كوده موجود ومابصمش خالص'} وهو لسه نشط`;
  return esc(a.kind);}
function openAlert(id){const a=(S.alerts||[]).find(x=>+x.id===id);if(!a)return;const d=a.data||{};
  if(a.kind==='emp_added'){openModal(`<button class="x" onclick="closeModal()">✕</button><h2>🆕 موظف جديد اتضاف من الشيت</h2>
    <div class="kv"><span>الاسم</span><b>${esc(d.name||'')}</b></div><div class="kv"><span>الكود</span><b>${esc(a.code)}</b></div><div class="kv"><span>القسم</span><b>${esc(d.dept||'—')}</b></div><div class="kv"><span>الوظيفة</span><b>${esc(d.job||'—')}</b></div><div class="kv"><span>الفرع</span><b>${esc(d.branch||'')}</b></div><div class="kv"><span>الشيفت</span><b>${esc(d.shift||'')}</b></div>
    <div class="small muted" style="margin:8px 0">اتضاف لوحده لأنه ظهر في شيت البصمة وبصم في آخر أسبوع. تقدر تعدّل بياناته من «ملفات الموظفين».</div>
    <div class="row"><button class="btn pri" onclick="alertSeen(${id})">✔ تمام</button></div>`);return;}
  if(a.kind==='sheet_stale'){openModal(`<button class="x" onclick="closeModal()">✕</button><h2>⏳ شيت البصمة واقف</h2><div class="small">آخر يوم في الشيت <b>${esc(d.last||'')}</b> (من ${fmt(d.days||0)} يوم). مفيش حاجة بتتمسح ولا بيتحسب غياب: النجوم بتفضل زي آخر تحديث، وأول ما الـ HR يحدّث الشيت التحديث الجاي بيحسب الأيام الفاضلة كلها من آخر يوم. اتواصل مع الـ HR لو الشيت متأخر.</div>
    <div class="row" style="margin-top:10px"><button class="btn pri" onclick="alertSeen(${id})">✔ تمام — اتشاف</button></div>`);return;}
  if(a.kind==='stale'){openModal(`<button class="x" onclick="closeModal()">✕</button><h2>⏸️ موظف نشط من غير بصمة</h2><div class="small">${esc(d.name||a.code)} (${esc(a.code)}) ${d.last?`وقف عن البصمة من ${fmt(d.days||5)} أيام — آخر بصمة ${esc(d.last)}`:'كوده موجود ومابصمش خالص'}. اسأل الـ HR: ساب الشغل؟ إجازة طويلة؟ لو ساب ← وقّفه من «ملفات الموظفين» وهيختفي من التقييمات والترتيب.</div>
    <div class="row" style="margin-top:10px"><button class="btn pri" onclick="alertSeen(${id})">✔ تمام — اتشاف</button></div>`);return;}
  const rows=a.kind==='sheet_changed'?`<div class="tbl-wrap" style="max-height:300px;overflow:auto"><table><thead><tr><th>الكود</th><th>الموظف</th><th>اليوم</th><th>كان</th><th>بقى</th></tr></thead><tbody>${(d.rows||[]).map(r=>`<tr><td>${esc(r.code)}</td><td class="small">${esc(emp(r.code)?.name||'')}</td><td class="small">${esc(r.day)}</td><td>${ATT[r.old]||esc(r.old||'—')}</td><td>${ATT[r.new]||esc(r.new||'—')}</td></tr>`).join('')}</tbody></table></div>
    <div class="small muted" style="margin-top:6px">النتيجة دي اتغيّرت لأن الشيت نفسه اتعدّل بعد ما اتسجل. لو التعديل مش مظبوط، اتواصل مع الـ HR يرجّعوه — والتحديث الجاي هيسجل اللي في الشيت.</div>`
    :`<div class="small">مابصمش ${fmt(d.gap)} يوم، ورجع يبصم يوم ${esc(a.day)}.${d.active===false?' <b>وهو موقوف في السيستم</b> — لو رجع الشغل فعلاً شغّله من «ملفات الموظفين».':''} اتأكد من الـ HR إيه اللي حصل (إجازة طويلة؟ ساب ورجع؟).</div>`;
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>${a.kind==='sheet_changed'?'🚨 شيت البصمة اتغيّر':'🔁 موظف رجع يبصم'}</h2><div class="small muted" style="margin-bottom:8px">${esc(new Date(a.created_at||Date.now()).toLocaleString('ar-EG'))}</div>${rows}
    <div class="row" style="margin-top:10px"><button class="btn pri" onclick="alertSeen(${id})">✔ تمام — اتواصلت / اتشاف</button></div>`);}
async function alertSeen(id){const a=(S.alerts||[]).find(x=>+x.id===id);if(a){a.seen_at=new Date().toISOString();a.seen_by=USER.username;}save();closeModal();render();push('alert_seen',{id},{});}

// ---------- الملف الكامل: تاريخ الموظف طول فترة شغله (نجوم · KPI · كروت · إنجازات) — من غير أي فلوس ----------
// الموظف بيشوف ملفه هو بس (بكوده)، ومدير التشغيل بيشوف أي موظف. النقط بتبدأ من جديد كل شهر والملف بيحتفظ بكل شهر.
async function loadCareer(code){
  if(LIVE){const r=USER?await sbRpc('najm_emp_history',{p_user:USER.username,p_pin:PIN,p_code:code}):await sbRpc('najm_my_history',{p_code:ME,p_pin:MEPIN});if(r?.error)throw new Error(r.error);return r;}
  const e=emp(code);const ms=[...new Set(Object.keys(S.days).map(d=>d.slice(0,7)))].sort().reverse();
  return {emp:{code,name:e.name,branch:e.branch,dept:e.dept,job:e.job,shift:e.shift,active:e.active!==false},
    months:ms.map(m=>{const s=monthSummary(e,m);return {month:m,n:s.n,avg:s.avg!=null?+s.avg.toFixed(2):null,worked:s.worked,off:s.off,abs:s.abs,late:s.late,yellow:s.cards.y||0,red:s.cards.r||0,green:s.cards.g||0,card_pts:s.cardPts,medal:medalOf(code,m)>0,medals_n:medalOf(code,m),wins:s.wins,cashier:isCashierEmp(e)?cashierPts(code,m):null,complaints:0,kpi_pts:s.kpiPts,month_score:s.monthScore};}),
    cards:(S.cards||[]).filter(c=>c.code===code&&c.approved!==false).map(c=>({id:c.id,day:c.date,color:c.color,reason:c.reason,by:emp(c.by)?.name||c.by})),
    wins:Object.keys(S.days).filter(d=>isWinner(d,code)).sort().reverse(),medals:(S.medals||[]).filter(x=>x.code===code).map(x=>x.month||monthOf(x.day)),moves:[]};
}
async function openCareer(code){
  let h;try{h=await loadCareer(code);}catch(x){toast('⚠️ '+errMsg(x.message));return;}
  if(!h){toast('الموظف مش موجود');return;}
  const M=h.months||[];const tot=k=>M.reduce((a,x)=>a+(+x[k]||0),0);const col={yellow:'🟨',red:'🟥',green:'🟩'};
  const sc=v=>v==null?'—':v;
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>📜 الملف الكامل — ${esc(h.emp.name)}</h2>
    <div class="muted small">كود ${esc(h.emp.code)} · ${esc(h.emp.job||'')} · ${esc(h.emp.dept||'')} · ${esc(h.emp.branch||'')}${h.emp.active===false?' · <b>موقوف</b>':''}</div>
    <div class="row" style="gap:6px;margin:8px 0;flex-wrap:wrap"><span class="badge b-gold">🏆 ${fmt((h.wins||[]).length)} مرة رجل اليوم</span><span class="badge b-gold">🏅 ${fmt((h.medals||[]).length)} وسام برق</span>
      <span class="badge b-gold">🟩 ${fmt(tot('green'))}</span><span class="badge b-gold">🟨 ${fmt(tot('yellow'))}</span><span class="badge b-red">🟥 ${fmt(tot('red'))}</span></div>
    <h3 style="margin:10px 0 4px">📅 كل شهر</h3>
    <div class="tbl-wrap" style="max-height:300px;overflow:auto"><table><thead><tr><th>الشهر</th><th>متوسط النجوم</th><th>KPI (نقطة)</th><th>%</th><th>شغل</th><th>غياب</th><th>تأخير</th><th>كروت</th><th>🏆</th><th>🏅</th>${M.some(x=>x.cashier!=null)?'<th>باندات</th>':''}</tr></thead><tbody>
      ${M.map(x=>`<tr><td>${esc(monthName(x.month))}</td><td>${x.avg!=null?`${starsHTML(x.avg)} <b>${fmt(x.avg,2)}</b>`:'—'}</td><td><b>${x.kpi_pts!=null?fmt(x.kpi_pts):'—'}</b></td><td>${x.month_score!=null?fmt(x.month_score)+'%':'—'}</td><td>${fmt(x.worked)}</td><td>${fmt(x.abs)}</td><td>${fmt(x.late)}</td><td>${x.green?`🟩${x.green} `:''}${x.yellow?`🟨${x.yellow} `:''}${x.red?`🟥${x.red}`:''}${x.green||x.yellow||x.red?'':'—'}</td><td>${x.wins||'—'}</td><td>${x.medals_n?'🏅'+(x.medals_n>1?'×'+x.medals_n:''):x.medal?'🏅':'—'}</td>${M.some(y=>y.cashier!=null)?`<td>${x.cashier!=null?(x.cashier>0?'+':'')+fmt(x.cashier):'—'}</td>`:''}</tr>`).join('')||'<tr><td colspan="11" class="muted">مفيش أشهر لسه</td></tr>'}</tbody></table></div>
    <div class="small muted" style="margin-top:4px">النقط بتبدأ من جديد كل شهر — ده سجل كل شهر على حدة. نقط التارجت للأشهر القديمة مش محفوظة (بتتحسب من تارجت القسم وقتها).</div>
    <h3 style="margin:10px 0 4px">🃏 الكروت (${fmt((h.cards||[]).length)})</h3>
    ${(h.cards||[]).slice(0,60).map(c=>`<div class="small" style="margin:2px 0">${col[c.color]||''} ${esc(String(c.day).slice(0,10))} — ${esc(c.reason||'')} <span class="muted">(${esc(c.by||'')})</span></div>`).join('')||'<div class="muted small">مفيش كروت</div>'}
    ${(h.wins||[]).length?`<h3 style="margin:10px 0 4px">🏆 أيام رجل اليوم</h3><div class="small">${h.wins.slice(0,40).map(d=>esc(String(d).slice(5,10))).join(' · ')}</div>`:''}
    ${(h.moves||[]).length?`<h3 style="margin:10px 0 4px">🔀 النقل</h3>${h.moves.map(m=>`<div class="small">${esc(String(m.day))}: ${esc(m.from_branch||'')} / ${esc(m.from_dept||'')} ← ${esc(m.to_branch||'')} / ${esc(m.to_dept||'')}</div>`).join('')}`:''}`);
}
