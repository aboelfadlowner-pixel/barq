// نجم أبو الفضل — تاب التصويت لأحسن مدير
// ---------- 🗳️ تصويت الموظفين لأحسن مدير ----------
function deviceId(){try{let d=localStorage.getItem('najm-device');if(!d){d=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36)+Math.random().toString(36).slice(2));localStorage.setItem('najm-device',d);}return d;}catch(e){return 'nostore-'+Math.random().toString(36).slice(2)+Date.now().toString(36);}}
let VOTER=null;
function vVote(){
  const m=monthOf(ymd(new Date()));let done=null;try{done=localStorage.getItem('najm-voted-'+m);}catch(e){}
  if(done)return `<div class="card" style="max-width:520px;margin:20px auto;text-align:center"><div style="font-size:56px">🗳️</div><h2>صوتك اتسجل لشهر ${monthName(m)}</h2><div class="muted">شكراً — التصويت مرة واحدة في الشهر من كل موبايل.</div></div>`;
  if(!ME||MEPIN==null||!emp(ME))return empLoginForm(`🗳️ صوّت لأحسن مدير — ${monthName(m)}`,`صوتك سري، وبيمثل ${MGR_W().votes}% من جايزة المدير المثالي. صوت واحد في الشهر لكل موظف ولكل موبايل. ادخل بكودك ورقمك السري الأول.`);
  VOTER=ME;
  const e=emp(VOTER);const L=managers().filter(u=>inUserBranch(u,e.branch)&&u.emp_code!==e.code);
  return `<div class="card" style="max-width:720px;margin:20px auto"><h2>🗳️ ${esc(e.name)} — مين أحسن مدير في ${esc(e.branch)} الشهر ده؟</h2><div class="muted" style="margin-bottom:10px">اختار واحد بس — مش هتقدر تغيّر بعد التأكيد.</div>
    <div class="grid g-3">${L.map(u=>{const me=mgrEmp(u);return `<button class="card" style="cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px" onclick="voteFor('${esc(u.username)}')">${me?ava(me,'xl'):`<div class="ava xl">${esc(u.name[0])}</div>`}<b>${esc(u.name)}</b><span class="small muted">${ROLES[u.role]}${u.shift?' · '+esc(u.shift):''}</span></button>`;}).join('')||'<div class="empty">مفيش مديرين في فرعك لسه</div>'}</div>
    <div class="row" style="margin-top:12px"><button class="btn sm" onclick="meLogout()">مش أنا — خروج</button></div></div>`;
}
async function voteFor(un){
  const u=managers().find(x=>x.username===un);if(!await askConfirm(`تأكيد صوتك لـ «${u.name}»؟`))return;
  const m=monthOf(ymd(new Date()));let r;
  if(LIVE){try{r=await sbRpc('najm_vote',{p_code:VOTER,p_pin:MEPIN,p_device:deviceId(),p_manager:un});}catch(e){toast('⚠️ '+e.message);return;}}
  else{S.votes=S.votes||[];const dev=deviceId();if(S.votes.some(v=>v.month===m&&v.voter===VOTER))r={ok:false,error:'voted'};else if(S.votes.some(v=>v.month===m&&v.device===dev))r={ok:false,error:'device_used'};else{S.votes.push({month:m,voter:VOTER,device:dev,manager:un});r={ok:true};save();}}
  if(!r?.ok){toast({voted:'الكود ده صوّت قبل كده الشهر ده',device_used:'الموبايل ده اتصوّت منه قبل كده الشهر ده',self:'مينفعش تصوّت لنفسك',code:'الكود مش موجود',manager:'المدير ده مش في فرعك',pin:'الرقم السري غلط — ادخل تاني'}[r?.error]||'ماتسجلش');return;}
  try{localStorage.setItem('najm-voted-'+m,'1');}catch(e){}
  VOTER=null;RANK_CACHE=null;if(LIVE)await refresh(true);render();toast('🗳️ صوتك اتسجل — شكراً');
}
