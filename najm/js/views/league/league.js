// نجم أبو الفضل — تاب المديرين والسوق
const MK_STATUS={open:['مستني اللاعب يحدد رغبته','b-gray'],listed:['🟢 مفتوح للعروض','b-green'],decided:['✋ اللاعب اختار — مستني اعتماد التشغيل','b-gold'],approved:['✔ اتنفذ الانتقال','b-blue'],closed:['اتقفل','b-gray']};

function vLeague(){
  const m=monthOf(DATE);const L=mgrRanks();const P=mgrPts();const pz=prizes();
  const prev=mgrOfMonth(prevMonth(m));
  const rateBox=isOps()?`<div class="card" style="margin-bottom:14px"><div class="sec-title" style="margin:0 0 6px"><h3>📝 تقييم المديرين — ${esc(DATE)}</h3><span class="small muted">كل بند من 0 لـ 2 · المجموع نقاط للمدير</span></div>
    <div class="grid g-emp">${managers().map(u=>{const a=S.mgrCrit?.[DATE]?.[u.username]||[];return `<div class="card"><b>${esc(u.name)}</b><div class="small muted" style="margin-bottom:6px">${ROLES[u.role]} · ${esc(u.branch||'كل الفروع')}${u.shift?' · '+esc(u.shift):''}</div>
      ${MGR_CRITERIA.map((c,i)=>`<div class="crit"><span class="small">${c}</span><span class="seg">${[0,1,2].map(v=>`<button class="${a[i]===v?'on':''}" onclick="setMgrCrit('${esc(u.username)}',${i},${v})">${v}</button>`).join('')}</span></div>`).join('')}
      <div class="row" style="justify-content:space-between;margin-top:4px"><span class="small">النهارده: <b>${fmt(mgrDayPts(DATE,u.username))}</b> / 10</span><button class="btn sm ${medalOf('m:'+u.username,m)?'gold':''}" onclick="giveMedal('m:${esc(u.username)}')">🏅 وسام برق${medalOf('m:'+u.username,m)?' ×'+fmt(medalOf('m:'+u.username,m)):''}</button></div></div>`;}).join('')||'<div class="empty">مفيش حسابات مديرين لسه — اعملها من الإعدادات</div>'}</div></div>`:'';
  return `<div class="sec-title"><h2>🏟️ دوري المديرين وسوق الانتقالات — ${monthName(m)}</h2>${isOps()?`<button class="btn gold" onclick="closeMonth()">🔒 إقفال ${monthName(m)} وفتح السوق</button>`:''}</div>
  <div class="lock" style="margin-bottom:12px"><b>المدير المثالي (من 100):</b> ${MGR_W().ops}% تقييم مدير التشغيل · ${MGR_W().team}% أداء موظفينه (متوسط تقييم الشهر لفريقه) · ${MGR_W().votes}% تصويت الموظفين. الجايزة: كاس + ${fmt(P.bonus)} نقطة${pz.manager&&cash()?` + ${fmt(pz.manager)} جنيه`:''}.<br><b>رصيد السوق:</b> نقاط بيكسبها من رجالة اليوم في فريقه (+${P.winner}) وكؤوس فريقه وتقييمه اليومي، وبيشتري بيها لاعبين من السوق بعد إقفال الشهر.</div>
  ${prev?`<div class="card honor" style="margin-bottom:12px"><b>👑 المدير المثالي لـ ${monthName(prevMonth(m))}: ${esc(mgrName(prev.username))}</b></div>`:''}
  ${rateBox}
  <div class="card" style="margin-bottom:14px"><h3>🏆 ترتيب المديرين (لحد النهارده)</h3><div class="tbl-wrap"><table><thead><tr><th>#</th><th>المدير</th><th>تقييم التشغيل (${MGR_W().ops}%)</th><th>أداء الفريق (${MGR_W().team}%)</th><th>تصويت الموظفين (${MGR_W().votes}%)</th><th>الإجمالي</th><th>نقاط السوق</th><th>الرصيد</th></tr></thead><tbody>
  ${L.map((x,i)=>{const e=mgrEmp(x.u);const vc=S.voteCounts?.[x.u.username];return `<tr style="${i===0?'background:var(--gold-soft)':''}"><td><span class="rank ${i===0?'r1':''}">${i+1}</span></td><td><div class="row" style="flex-wrap:nowrap;gap:8px">${e?ava(e,'sm'):''}<div><b>${esc(x.u.name)}</b> ${i===0?'👑':''}${x.medals?` <span title="وسام برق">🏅×${fmt(x.medals)}</span>`:''} ${isOps()||x.u.username===USER?.username?`<button class="btn sm" style="padding:0 6px" onclick="openMgrHistory('${esc(x.u.username)}')" title="السجل">📜</button>`:''}<div class="small muted">${ROLES[x.u.role]} · ${esc(x.u.branch||'كل الفروع')}${x.u.shift?' · '+esc(x.u.shift):''} · فريقه ${fmt(x.team)}</div></div></div></td><td>${fmt(x.opsPct)}%</td><td>${fmt(x.teamPct)}%</td><td>🗳️ ${fmt(x.votes)} <span class="small muted">(${fmt(x.votePct)}%)</span>${isOps()&&vc&&vc.votes>=5&&vc.ips<=1?' <span class="badge b-red" title="كل الأصوات من نفس الشبكة">راجع</span>':''}</td><td><b style="font-size:16px">${fmt(x.score)}</b>/100</td><td>${fmt(x.total)}</td><td><b style="color:var(--purple)">${fmt(x.bal)}</b></td></tr>`;}).join('')||'<tr><td colspan="8" class="empty">مفيش مديرين لسه</td></tr>'}
  </tbody></table></div></div>
  ${vMarket()}`;
}
function vMarket(){
  const list=(S.market||[]).filter(x=>x.status!=='closed');
  return `<div class="card"><div class="sec-title" style="margin:0 0 8px"><h3>🔁 سوق الانتقالات</h3><button class="btn sm" onclick="playerLogin()">🔑 أنا اللاعب — ادخل بالكود</button></div>
   <div class="small muted" style="margin-bottom:10px">العامل المثالي الأول في الشهر بياخد كود سري: يحدد الشيفت أو الفرع اللي عايزه، والمديرين يقدموا عروض بالنقاط، وهو يختار. مدير التشغيل يعتمد الانتقال.</div>
   ${list.map(mk=>{const e=emp(mk.code);if(!e)return'';const offers=(S.offers||[]).filter(o=>o.market_id===mk.id).sort((a,b)=>b.points-a.points);const st=MK_STATUS[mk.status]||['',''];
     const mine=USER&&!isOps()?offers.find(o=>o.username===USER.username):null;
     return `<div class="card" style="margin-bottom:10px;border-color:#cfc4ff"><div class="row" style="justify-content:space-between">
       <div class="row" style="flex-wrap:nowrap">${ava(e,'win')}<div><b style="font-size:17px">${esc(e.name)}</b> <span class="badge b-gray">كود ${esc(e.code)}</span><div class="small muted">العامل المثالي لـ ${monthName(mk.month)} · دلوقتي: ${esc(e.branch)} · ${esc(e.shift)}</div></div></div>
       <div style="text-align:left"><span class="badge ${st[1]}">${st[0]}</span>${mk.status==='listed'&&mk.created_at?`<div class="small muted">العروض لحد ${new Date(new Date(mk.created_at).getTime()+(S.settings.marketDays||5)*864e5).toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'})}</div>`:''}</div></div>
       ${mk.wish?`<div class="lock" style="margin-top:8px">🎯 رغبته: ${esc([mk.wish.branch,mk.wish.shift&&('شيفت '+mk.wish.shift)].filter(Boolean).join(' · ')||'مفتوح لأي عرض')}${mk.wish.note?` — «${esc(mk.wish.note)}»`:''}</div>`:''}
       <table style="margin-top:8px"><tbody>${offers.map(o=>`<tr style="${mk.chosen===o.id?'background:var(--green-soft)':''}"><td><b>${esc(mgrName(o.username))}</b><div class="small muted">${esc(o.branch||'')} · ${esc(o.shift||'')}</div></td><td><b style="color:var(--purple)">${fmt(o.points)} نقطة</b></td><td class="small">${esc(o.note||'')}</td><td>${mk.chosen===o.id?'<span class="badge b-green">✔ اختاره</span>':''}</td></tr>`).join('')||'<tr><td class="small muted">مفيش عروض لسه</td></tr>'}</tbody></table>
       ${mk.chosen==='stay'?'<div class="small" style="margin-top:6px">✋ اللاعب اختار يفضل مكانه</div>':''}
       ${mk.status==='listed'&&USER&&!isOps()?`<div class="row" style="margin-top:8px"><span class="small">رصيدك: <b>${fmt(balanceOf(USER.username))}</b> نقطة</span><input class="inp" id="of_${mk.id}" type="number" min="1" placeholder="نقاط العرض" value="${mine?mine.points:''}" style="width:120px"><input class="inp" id="on_${mk.id}" placeholder="رسالة للاعب (اختياري)" value="${esc(mine?.note||'')}"><button class="btn pri sm" onclick="makeOffer('${mk.id}')">${mine?'تعديل العرض':'قدّم عرض'}</button>${mine?`<button class="btn sm red" onclick="withdrawOffer('${mk.id}')">سحب</button>`:''}</div>`:''}
       ${isOps()&&mk.status==='decided'?`<div class="row" style="margin-top:8px"><button class="btn gold sm" onclick="approveMarket('${mk.id}',true)">✔ اعتماد الانتقال</button><button class="btn sm red" onclick="approveMarket('${mk.id}',false)">رجّعه للسوق</button></div>`:''}
       ${isOps()&&['approved','open','listed'].includes(mk.status)?`<div class="row" style="margin-top:6px"><button class="btn sm" onclick="closeMarket('${mk.id}')">قفل السوق ده</button></div>`:''}
     </div>`;}).join('')||'<div class="empty small">السوق بيفتح بعد إقفال الشهر</div>'}
  </div>`;
}
function setMgrCrit(un,i,v){const D=S.mgrCrit||(S.mgrCrit={});const d=D[DATE]||(D[DATE]={});const a=d[un]||(d[un]=[null,null,null,null,null]);a[i]=a[i]===v?null:v;
  const full=a.map(x=>x??0);if(S.mgrDaily?.[DATE])delete S.mgrDaily[DATE][un];save();render();pushM('mgr_rate',{day:DATE,username:un},a.every(x=>x==null)?null:full);}
async function closeMonth(){
  const m=monthOf(DATE);const last=`${m}-${pad(daysInMonth(m))}`;
  if(DATE<last&&!await askConfirm(`إنت واقف على ${DATE} مش آخر يوم في ${monthName(m)}. الأفضل تختار ${last} من التاريخ فوق قبل الإقفال. تكمّل برضه؟`))return;
  const L=mgrRanks();const top=ranks().rows[0];
  if(!top){toast('مفيش ترتيب للشهر ده');return;}
  if(!await askConfirm(`إقفال ${monthName(m)}: هيتسجل لكل مدير نقاط السوق في رصيده، و«${L[0]?.u.name||'—'}» المدير المثالي (${L[0]?.score??0}/100 · +${mgrPts().bonus} نقطة)، ويتفتح السوق لـ «${top.e.name}». تأكيد؟`))return;
  const P=mgrPts();S.ledger=S.ledger||[];
  const add=(id,un,pts,reason)=>{S.ledger=S.ledger.filter(l=>l.id!==id);S.ledger.push({id,username:un,month:m,points:pts,reason});return pushM('ledger',{id},{username:un,month:m,points:pts,reason});};
  for(const x of L)await add(`close|${m}|${x.u.username}`,x.u.username,x.total,`نقاط ${monthName(m)}`);
  if(L[0])await add(`bonus|${m}|${L[0].u.username}`,L[0].u.username,P.bonus,`المدير المثالي — ${monthName(m)}`);
  let secret;
  if(LIVE){const r=await pushM('market_open',{id:m},{month:m,code:top.e.code});if(!r)return;secret=r.secret;}
  else{secret=String(Math.floor(Math.random()*1e6)).padStart(6,'0');S.market=(S.market||[]).filter(x=>x.id!==m);S.market.unshift({id:m,month:m,code:top.e.code,status:'open',wish:null,chosen:null,secret});}
  save();await refresh(true);render();
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>🔑 الكود السري لـ ${esc(top.e.name)}</h2><div style="font-size:54px;font-weight:900;letter-spacing:10px;text-align:center;margin:18px 0;direction:ltr">${secret}</div>
    <div class="lock">اكتبه واديه للاعب بنفسك — مش هيظهر تاني. بيه يدخل «سوق الانتقالات» ويحدد رغبته ويختار العرض.</div>`);
}
let PLAYER=null; // {id, secret}
async function playerLogin(){
  const mk=(S.market||[]).find(x=>['open','listed'].includes(x.status));if(!mk){toast('مفيش سوق مفتوح دلوقتي');return;}
  const s=await askText('اكتب الكود السري اللي خدته من مدير التشغيل');if(!s)return;
  let ok;if(LIVE){try{ok=(await sbRpc('najm_market_player',{p_id:mk.id,p_secret:s.trim(),p_action:'view',p_data:null}))?.ok;}catch(e){toast(/locked/.test(e.message)?'الكود اتقفل من كتر المحاولات — كلم مدير التشغيل':'⚠️ '+e.message);return;}}
  else ok=mk.secret===s.trim();
  if(!ok){toast('الكود غلط');return;}
  PLAYER={id:mk.id,secret:s.trim()};playerPanel();
}
function playerPanel(){
  const mk=(S.market||[]).find(x=>x.id===PLAYER?.id);if(!mk)return;const e=emp(mk.code);const offers=(S.offers||[]).filter(o=>o.market_id===mk.id).sort((a,b)=>b.points-a.points);
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>🔁 أهلاً ${esc(e?.name)} — سوق الانتقالات</h2>
   ${['open','listed'].includes(mk.status)?`<h3>1) رغبتك للشهر الجاي</h3><div class="row">
     <label class="small">الفرع<br><select class="inp" id="pw_b"><option value="">أي فرع</option>${branches().map(b=>`<option ${mk.wish?.branch===b?'selected':''}>${esc(b)}</option>`).join('')}</select></label>
     <label class="small">الشيفت<br><select class="inp" id="pw_s"><option value="">أي شيفت</option>${Object.values(SH).map(s=>`<option ${mk.wish?.shift===s?'selected':''}>${s}</option>`).join('')}</select></label>
     <label class="small" style="flex:1">كلمة للمديرين<br><input class="inp" id="pw_n" style="width:100%" value="${esc(mk.wish?.note||'')}"></label>
     <button class="btn pri" onclick="playerWish()">${mk.status==='listed'?'تحديث الرغبة':'اعرض نفسي في السوق'}</button></div>`:''}
   ${mk.status==='listed'?`<h3 style="margin-top:14px">2) العروض (${fmt(offers.length)})</h3>${offers.map(o=>`<div class="row" style="justify-content:space-between;border-bottom:1px dashed var(--line);padding:6px 0"><div><b>${esc(mgrName(o.username))}</b> · ${esc(o.branch||'')} · ${esc(o.shift||'')}<div class="small muted">${esc(o.note||'')}</div></div><div class="row"><b style="color:var(--purple)">${fmt(o.points)} نقطة</b><button class="btn gold sm" onclick="playerChoose('${esc(o.id)}')">أختار العرض ده</button></div></div>`).join('')||'<div class="small muted">لسه مفيش عروض — ارجع بعدين</div>'}
     <button class="btn sm" style="margin-top:10px" onclick="playerChoose('stay')">أفضل مكاني</button>`:''}
   ${mk.status==='decided'?'<div class="lock">اختيارك اتسجل — مستني اعتماد مدير التشغيل.</div>':''}`);
}
async function playerAct(action,data){
  const mk=(S.market||[]).find(x=>x.id===PLAYER.id);
  if(LIVE){try{const r=await sbRpc('najm_market_player',{p_id:PLAYER.id,p_secret:PLAYER.secret,p_action:action,p_data:data});if(!r?.ok){toast('الكود غلط');return false;}}catch(e){toast('⚠️ '+e.message);return false;}}
  else{if(action==='wish'){mk.wish=data;mk.status='listed';}else{mk.chosen=data.offer;mk.status='decided';}save();}
  await refresh(true);render();return true;
}
async function playerWish(){if(await playerAct('wish',{branch:$('#pw_b').value||null,shift:$('#pw_s').value||null,note:$('#pw_n').value.trim()||null})){toast('✔ اتعرضت في السوق');playerPanel();}}
async function playerChoose(id){if(!await askConfirm(id==='stay'?'متأكد إنك عايز تفضل مكانك؟':'متأكد من اختيار العرض ده؟'))return;if(await playerAct('choose',{offer:id})){toast('✔ اتسجل اختيارك');closeModal();}}
async function makeOffer(mid){
  const pts=+$('#of_'+mid).value;const note=$('#on_'+mid).value.trim();
  if(!(pts>0)){toast('اكتب عدد النقاط');return;}if(pts>balanceOf(USER.username)){toast('النقاط أكبر من رصيدك');return;}
  const id=mid+'|'+USER.username;S.offers=(S.offers||[]).filter(o=>o.id!==id);S.offers.push({id,market_id:mid,username:USER.username,points:pts,branch:USER.branch,shift:USER.shift,note});save();render();
  if(await pushM('offer',{market_id:mid},{points:pts,note,branch:USER.branch||null,shift:USER.shift||null})!==false){toast('✔ اتقدم العرض');refresh(true);}
}
async function withdrawOffer(mid){if(!await askConfirm('سحب العرض؟'))return;S.offers=(S.offers||[]).filter(o=>o.id!==mid+'|'+USER.username);save();render();await pushM('offer',{market_id:mid},null);refresh(true);}
async function approveMarket(id,ok){
  const mk=(S.market||[]).find(x=>x.id===id);if(!mk)return;
  if(!await askConfirm(ok?'اعتماد الانتقال؟ هيتخصم النقاط من المدير ويتغيّر شيفت/فرع اللاعب.':'ترجيعه للسوق؟'))return;
  if(LIVE){if(await pushM('market_approve',{id},{approve:ok})===false)return;}
  else{if(ok){if(mk.chosen!=='stay'){const o=S.offers.find(x=>x.id===mk.chosen);S.ledger.push({id:'transfer|'+id,username:o.username,month:mk.month,points:-o.points,reason:'ضم '+mk.code});const e=emp(mk.code);if(o.branch)e.branch=o.branch;if(o.shift)e.shift=o.shift;}mk.status='approved';}else{mk.status='listed';mk.chosen=null;}save();}
  await refresh(true);render();toast(ok?'✔ اتنفذ الانتقال':'رجع للسوق');
}
async function closeMarket(id){if(!await askConfirm('قفل السوق ده؟'))return;const mk=(S.market||[]).find(x=>x.id===id);if(mk)mk.status='closed';save();await pushM('market_close',{id},{});await refresh(true);render();}
