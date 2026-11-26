// نجم أبو الفضل — البيانات: الحالة الافتراضية، التخزين على الجهاز (IndexedDB)، والكلام مع Supabase (قراءة / حفظ / رفع صور)
function defaultState(){
  const employees = SEED.split('\n').map(l=>{
    const [code,name,b,dept,job,s]=l.split('|');
    return {code:String(code),name:name.trim(),branch:BR[b],dept:dept.trim(),job:job.trim(),shift:SH[s],active:true,photo:'',video:''};
  });
  return {
    v:2,
    settings:{
      att:{on:2, late:1.2, vlate:0.4, xlate:0, abs:0},
      shiftStart:{Morning:'09:00', Between:'13:00', Night:'17:00'}, betweenTo:'16:00',   // Between فترة: أي بداية بين shiftStart.Between و betweenTo
      graceMin:10, lateMax:30, vlateMax:60, medalPts:100, camMissPct:2, cashierDept:'قسم الكاشير', cashierBands:CASHIER_BANDS_DEF.map(b=>({id:b.id,pts:b.pts})), finalists:4, winnersPerShift:2,
      capPct:120, complaintPenalty:50, bonusAt100:0, defaultMultiplier:2,
      freshDepts:['قسم البقاله'],
      cards:{yellow:-5, red:-20, green:10, yellowsToRed:3},
      // رجل اليوم لكل فرع وشيفت (Between مع الليل) + أقل نجوم للترشيح
      winnersBy:{'البيطاش الرئيسي':{Morning:2,Night:2},'عين شمس':{Morning:1,Night:1},'المصنع':{Morning:0,Night:0}},
      minStarsWinner:4,
      // إغلاق اليوم: آخر ميعاد = بداية الشيفت + closeAfterHours · الخصم بيبدأ من closeStart (التشغيل بيحدده)
      closeStart:'', closeAfterHours:10, lateClosePenalty:5,
      captainMult:3,
      goal:85, targetGoal:100, weeklyOff:1, checkpoints:[10,20],
      prizes:{gold:5000,silver:2000,bronze:1000,top10:500,daily:100,manager:1000},
      marketDays:5,
      mgrWeights:{ops:50,team:25,votes:25},
      mgrPoints:{rating:1,winner:20,gold:100,silver:60,bronze:40,top10:20,red:-10,bonus:50}
    },
    users:[{username:'ops',name:'مدير التشغيل',role:'ops',branch:'',shift:'',depts:[],pin:'0000',active:true}],
    branches:[{name:'البيطاش الرئيسي',kind:'branch'},{name:'عين شمس',kind:'branch'},{name:'المصنع',kind:'factory'}],
    employees,
    days:{}, targets:{}, captains:{}, sales:{}, baseSales:{}, kpiVals:{}, complaints:[], notes:[], cards:[],
    mgrCrit:{}, ledger:[], market:[], offers:[],
    appeals:[], closes:{}, history:[], empPins:{}, imports:[], moves:[], medals:[], tgtPenalties:{}, camMissing:{}, prayReviews:{}, penalties:[], alerts:[], cashierEvents:[], cashierPts:{}
  };
}

// ---------- storage (IndexedDB, until Supabase is live) ----------
let S=null; const DBN='najm-kpi-v2', ST='kv';
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open(DBN,1);r.onupgradeneeded=()=>r.result.createObjectStore(ST);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function load(){
  try{const db=await idb();S=await new Promise(res=>{const t=db.transaction(ST).objectStore(ST).get('state');t.onsuccess=()=>res(t.result);t.onerror=()=>res(null);});}catch(e){S=null}
  normalize();
}
function normalize(){
  if(!S) S=defaultState();
  const d=defaultState();
  S.settings=Object.assign(d.settings,S.settings||{});
  for(const k of Object.keys(d)) if(S[k]===undefined) S[k]=d[k];
}
let saveT=null;
function save(){RANK_CACHE=null;SALES_CACHE={};if(LIVE||DEMO)return;clearTimeout(saveT);saveT=setTimeout(async()=>{try{const db=await idb();db.transaction(ST,'readwrite').objectStore(ST).put(S,'state');}catch(e){toast('⚠️ تعذّر الحفظ')}},250);}
// =========================================================
// Live data (Supabase — same project as the other barq tools). Falls back to this device only when offline.
// Writes go through najm_save(user, PIN, …): the database checks the role and the manager's scope.
// =========================================================
let LIVE=false, PIN=null, LAST_PULL=null, PULLING=false;
async function sbGet(path){const r=await fetch(`${SB_URL}/rest/v1/${path}`,{headers:SBH});if(!r.ok)throw new Error(await r.text());return r.json();}
async function sbRpc(fn,args,qs=''){const r=await fetch(`${SB_URL}/rest/v1/rpc/${fn}${qs}`,{method:'POST',headers:SBH,body:JSON.stringify(args)});const t=await r.text();if(!r.ok){let m=t;try{m=JSON.parse(t).message||t}catch(e){}throw new Error(m);}
  const v=t?JSON.parse(t):null;
  // a wrong PIN comes back as {error:'najm: …'} (not an HTTP error) so the database keeps counting failed attempts
  if(v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.error==='string'&&v.error.startsWith('najm:'))throw new Error(v.error);
  return v;}
async function sbRpcAll(fn,args,order){let out=[],off=0;while(true){const d=await sbRpc(fn,args,`?order=${order}&limit=1000&offset=${off}`);out=out.concat(d||[]);if(!d||d.length<1000)break;off+=1000;}return out;}
async function sbAll(table,q){let out=[],off=0;while(true){const d=await sbGet(`${table}?${q}&limit=1000&offset=${off}`);out=out.concat(d);if(d.length<1000)break;off+=1000;}return out;}
const errMsg=m=>/wrong username|login required/.test(m)?'اسم الدخول أو الرقم السري غلط — أو الحساب اتقفل 15 دقيقة بعد 5 محاولات غلط':/day locked/.test(m)?'🔒 اليوم ده اتقفل (اتعلن رجل اليوم أو عدّى أكتر من يوم) — التعديل عن طريق مدير التشغيل':/deadline passed/.test(m)?'⏰ ميعاد العروض في السوق خلص':/outside your scope|other branch/.test(m)?'الموظف ده مش في نطاقك':/operations manager only/.test(m)?'دي صلاحية مدير التشغيل بس':/attendance comes from/.test(m)?'البصمة بتيجي من الشيت — التعديل لمدير التشغيل بس':/reason required/.test(m)?'لازم تكتب السبب':'⚠️ ماتحفظش: '+m;
// الحفظ: مفيش «اتحفظ» غير بعد ما الداتابيز تأكد. لو النت فاصل بيقول «ماتحفظش» ويرجّع الشاشة للي في الداتابيز،
// ولو في حاجة لسه بتتحفظ والصفحة بتتقفل ← تحذير
let PENDING=0;
window.addEventListener('beforeunload',e=>{if(PENDING>0){e.preventDefault();e.returnValue='';}});
async function push(kind,key,data){
  if(!LIVE){logLocal(kind,key,data);return true;}
  if(navigator.onLine===false){toast('⚠️ مفيش إنترنت — ماتحفظش. جرّب تاني لما النت يرجع');setTimeout(()=>refresh(),400);return false;}
  PENDING++;
  try{const r=await sbRpc('najm_save',{p_user:USER.username,p_pin:PIN,p_kind:kind,p_key:key,p_data:data===undefined?null:data});return r??true;}
  catch(e){toast(/Failed to fetch|NetworkError|network/i.test(e.message)?'⚠️ النت فصل — ماتحفظش. جرّب تاني':errMsg(e.message));setTimeout(()=>refresh(),400);return false;}
  finally{PENDING--;}
}
// نسخة التجربة / من غير إنترنت: نفس السجل اللي الداتابيز بتكتبه (من غير أرقام سرية)
let OLD_VAL;   // القيمة قبل التعديل (للسجل في نسخة التجربة)
function logLocal(kind,key,data){if(!USER||!S)return;
  const code=key?.code||(kind==='appeal_decide'?(S.appeals||[]).find(a=>a.id===key?.id)?.code:kind==='card_approve'?(S.cards||[]).find(c=>c.id===key?.id)?.code:null)||null;
  (S.history||(S.history=[])).unshift({at:new Date().toISOString(),actor:USER.username,actor_name:USER.name,kind,code,day:key?.day||null,data:{key,data:kind==='user'||kind==='emp_pin'?null:data,...(OLD_VAL!==undefined?{old:OLD_VAL}:{})}});OLD_VAL=undefined;if(S.history.length>2000)S.history.length=2000;}
let UPTOK=null;
async function uploadMedia(code,blob,ext){
  if(!UPTOK||UPTOK.exp<Date.now()){const t=await sbRpc('najm_upload_token',{p_user:USER.username,p_pin:PIN});if(!t)throw new Error('najm: wrong username or PIN');UPTOK={t,exp:Date.now()+25*60000};}
  const path=`${UPTOK.t}/${code}/${Date.now()}.${ext}`;
  const r=await fetch(`${SB_URL}/storage/v1/object/najm-media/${path}`,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':blob.type||'application/octet-stream'},body:blob});
  if(!r.ok)throw new Error(await r.text());
  return `${SB_URL}/storage/v1/object/public/najm-media/${path}`;
}
async function pull(){
  const m=monthOf(DATE),pm=prevMonth(m),from=m+'-01',to=m+'-'+pad(daysInMonth(m));
  const [st,emps,tg,caps,salesSum,salesDays,base,kpi,win,pub,cardsPub,cstats]=await Promise.all([
    sbGet('najm_settings?id=eq.1&select=data'),
    sbAll('najm_employees','select=*&order=code'),
    sbGet(`najm_targets?month=eq.${m}&select=dkey,cfg`),
    sbGet(`najm_captains?month=eq.${m}&select=*`),
    sbRpc('najm_sales_sum',{p_from:from,p_to:DATE<to?DATE:to}),
    sbAll('najm_sales',`day=gte.${from}&day=lte.${to}&select=day,branch`),
    sbGet(`najm_base_sales?month=eq.${pm}&select=branch,items`),
    sbAll('najm_kpi_vals',`day=gte.${from}&day=lte.${to}&select=day,dkey,vals`),
    sbGet(`najm_winners?day=gte.${from}&day=lte.${to}&select=day,gkey,codes,candidates,approved_by,approved_at`),
    sbRpcAll('najm_public_scores',{p_from:from,p_to:to},'day,code'),
    sbRpc('najm_card_points',{p_from:from,p_to:DATE<to?DATE:to}),
    sbRpcAll('najm_card_stats',{p_from:from,p_to:DATE<to?DATE:to},'code'),
  ]);
  const [dayCards,closes,complCnt,moves]=await Promise.all([sbRpc('najm_public_day_cards',{p_from:from,p_to:to}),sbRpc('najm_closes_list',{p_from:from,p_to:to}),sbRpc('najm_public_complaints',{p_from:from,p_to:to}),sbRpc('najm_public_moves',{p_from:from,p_to:to})]);
  const [medals,pens,camMiss,prayRv]=await Promise.all([sbRpc('najm_public_medals',{p_month:m}).catch(()=>[]),sbRpc('najm_public_penalties',{p_month:m}).catch(()=>[]),sbRpc('najm_cam_missing',{p_month:m}).catch(()=>[]),sbRpc('najm_public_pray_reviews',{p_month:m}).catch(()=>[])]);
  const cashPts=await sbRpc('najm_public_cashier_pts',{p_month:m}).catch(()=>[]);
  const [mgrs,mgrPtsRows,ledger,market,offers,mgrFull,votes]=await Promise.all([
    sbRpc('najm_public_users',{}),sbRpc('najm_mgr_points',{p_from:from,p_to:to}),sbAll('najm_mgr_ledger','select=*&order=created_at'),
    sbRpc('najm_market_list',{}),sbAll('najm_offers','select=*'),
    USER?sbRpc('najm_mgr_ratings_full',{p_user:USER.username,p_pin:PIN,p_from:from,p_to:to}):Promise.resolve([]),
    sbRpc('najm_vote_counts',{p_month:m})]);
  let full=[],files=null;
  if(USER){[full,files]=await Promise.all([sbRpcAll('najm_full_scores',{p_user:USER.username,p_pin:PIN,p_from:from,p_to:to},'day,code'),sbRpc('najm_files',{p_user:USER.username,p_pin:PIN})]);}
  const N=defaultState();
  N.settings=Object.assign(N.settings,st?.[0]?.data||{});
  N.settings.att={...defaultState().settings.att,...(st?.[0]?.data?.att||{})};   // نجوم أي حالة جديدة (زي فوق الحد) بتاخد الافتراضي لحد ما تتحدد
  if(files?.private?.bonusAt100!=null)N.settings.bonusAt100=files.private.bonusAt100;
  N.employees=emps.map(e=>({code:e.code,name:e.name,branch:e.branch,dept:e.dept||'',job:e.job||'',shift:e.shift||'Morning',active:e.active!==false,photo:e.photo||'',video:e.video||'',title:e.title||'',photoPos:e.photo_pos||''}));
  if(typeof applyLocalMedia==='function')applyLocalMedia(N.employees);   // صورة لسه اترفعت متضيعش لو التحديث خلّص قبل ما الداتابيز تتحدّث
  N.targets={[m]:Object.fromEntries(tg.map(r=>[r.dkey,r.cfg]))};
  N.captains={[m]:{}};for(const c of caps)(N.captains[m][c.code]||(N.captains[m][c.code]=[])).push({sku:c.sku,name:c.name,target:+c.target,pts:c.pts==null?null:+c.pts,active:c.active,by:c.by_user});
  N.salesSum={month:m,upto:DATE,data:salesSum||{}};N.salesDays={};for(const r of salesDays)(N.salesDays[r.branch]||(N.salesDays[r.branch]=[])).push(r.day);
  N.baseSales={[pm]:Object.fromEntries(base.map(r=>[r.branch,r.items]))};
  for(const r of kpi)(N.kpiVals[r.day]||(N.kpiVals[r.day]={}))[r.dkey]=r.vals;
  const D=d=>N.days[d]||(N.days[d]={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},pray:{},brk:{},bonus:{},winners:{},pub:{},full:{},carry:{}});
  N.winnersMeta={};for(const w of win){D(w.day).winners[w.gkey]=w.codes;(N.winnersMeta[w.day]||(N.winnersMeta[w.day]={}))[w.gkey]={candidates:w.candidates,approved_by:w.approved_by,approved_at:w.approved_at};}
  for(const r of pub){const x=D(r.day);x.pub[r.code]={att:r.att,total:r.total==null?null:+r.total,complete:r.complete,bonus:r.has_bonus};if(r.att)x.att[r.code]=r.att;}
  for(const r of full){const x=D(r.day);x.full[r.code]=1;if(r.att)x.att[r.code]=r.att;else delete x.att[r.code];if(r.att_time)x.attTime[r.code]=r.att_time;
    for(const f of ['br','sh','fr','ops','hy'])if(r[f])x[f][r.code]=r[f];if(r.bonus)x.bonus[r.code]={v:+r.bonus,note:r.bonus_note||''};
    const cf=r.score?.carry;if(cf?.length)(x.carry||(x.carry={}))[r.code]=cf;if(r.score?.pray!=null)x.pray[r.code]=+r.score.pray;if(r.score?.brk!=null)x.brk[r.code]=+r.score.brk;}
  // الموظف الداخل بكوده + رقمه السري: تفاصيل تقييمه هو بس، وكروته كلها
  if(!USER&&ME&&MEPIN!=null){const [mine,myc,mycp]=await Promise.all([sbRpc('najm_my_ratings3',{p_code:ME,p_pin:MEPIN,p_from:from,p_to:to}).catch(()=>[]),sbRpc('najm_my_cards',{p_code:ME,p_pin:MEPIN}).catch(()=>null),sbRpc('najm_my_complaints',{p_code:ME,p_pin:MEPIN}).catch(()=>null)]);
    N.myComplaints=mycp?.complaints||null;
    for(const r of mine||[]){const x=D(r.day);x.full[ME]=1;if(r.att)x.att[ME]=r.att;for(const f of ['br','sh','fr','ops','hy'])if(r[f])x[f][ME]=r[f];if(r.pray!=null)x.pray[ME]=+r.pray;if(r.brk!=null)x.brk[ME]=+r.brk;if(r.carry?.length)x.carry[ME]=r.carry;if(r.bonus)x.bonus[ME]={v:+r.bonus,note:''};}
    N.myCards=myc?.cards||null;}
  N.moves=(moves||[]).map(m=>({code:m.code,day:m.day,fromBranch:m.from_branch,fromDept:m.from_dept,toBranch:m.to_branch,toDept:m.to_dept}));
  N.complaintCounts=Object.fromEntries((complCnt||[]).map(r=>[r.code,r.n]));
  N.cashierPts=Object.fromEntries((cashPts||[]).map(r=>[r.code,+r.pts]));   // نقط الكاشير (باندات هيد الكاشير)
  N.cashierEvents=(USER&&(USER.role==='headcashier'||USER.role==='ops'))?(((await sbRpc('najm_cashier_events_list',{p_user:USER.username,p_pin:PIN,p_month:m}).catch(()=>[]))||[]).map(r=>({id:r.id,day:r.day,code:r.code,band:r.band,pts:+r.pts,note:r.note||'',by:r.by_user}))):[];
  N.medals=(medals||[]).map(r=>({code:r.code,month:m,day:r.day}));                       // وسام برق
  N.tgtPenalties=Object.fromEntries((pens||[]).map(r=>[r.code,+r.pct]));                 // خصومات التارجت (%)
  N.camMissing=Object.fromEntries((camMiss||[]).map(r=>[r.code,r.missed]));              // الكاميرات: حاضر ماتقيّمش
  N.prayReviews=Object.fromEntries((prayRv||[]).map(r=>[r.code+'|'+r.cycle,{decision:r.decision,level:r.level}]));   // الشكاوى المثبتة (عدد بس) — للترتيب عند الكل
  N.dayCards={};for(const r of dayCards||[])(N.dayCards[r.day]||(N.dayCards[r.day]={}))[r.code]={y:r.yellow,r:r.red,g:r.green};
  N.closes={};for(const c of closes||[])(N.closes[c.day]||(N.closes[c.day]={}))[c.gkey]={...c,penalty:+c.penalty};
  N.cardStats={};for(const r of cstats||[])N.cardStats[r.code]=Object.fromEntries(Object.entries(r).map(([k,v])=>[k,k==='code'?v:v==null?null:+v]));
  N.cardCounts={};for(const c of cardsPub||[])N.cardCounts[c.code]={y:c.yellow,r:c.red,g:c.green,pts:+c.points};
  if(files){
    N.cards=(files.cards||[]).map(c=>({id:c.id,date:c.day,code:c.code,color:c.color,reason:c.reason,by:c.by_user,approved:c.approved,status:c.status,decidedBy:c.decided_by}));
    N.appeals=(files.appeals||[]).map(a=>({id:a.id,cardId:a.card_id,code:a.code,body:a.body,status:a.status,at:a.created_at,decidedBy:a.decided_by,note:a.decision_note,cardBy:a.card_by,cardDay:a.card_day,cardColor:a.card_color,cardReason:a.card_reason}));
    N.empPins=files.pins||{};
    N.imports=files.imports||[];
    N.complaints=(files.complaints||[]).map(c=>({id:c.id,date:c.day,code:c.code,note:c.note,by:c.by_user,status:c.status,decidedBy:c.decided_by,decisionNote:c.decision_note,appealBody:c.appeal_body,appealStatus:c.appeal_status,appealNote:c.appeal_note}));
    N.notes=(files.notes||[]).map(n=>({id:n.id,date:n.day,code:n.code,text:n.body,by:n.by_user}));
    if(files.users)N.users=files.users.map(u=>({...u,branch:u.branch||'',branches:u.branches||[],shift:u.shift||'',depts:u.depts||[],emp_code:(mgrs||[]).find(x=>x.username===u.username)?.emp_code||''}));
  } else N.users=[];
  N.mgrs=(mgrs||[]).map(u=>({...u,branch:u.branch||'',branches:u.branches||[],shift:u.shift||'',depts:u.depts||[],emp_code:u.emp_code||'',active:true}));
  N.voteCounts={};for(const v of votes||[])N.voteCounts[v.username]={votes:v.votes,ips:v.ips};
  N.mgrDaily={};for(const r of mgrPtsRows||[])(N.mgrDaily[r.day]||(N.mgrDaily[r.day]={}))[r.username]=r.pts;
  N.mgrCrit={};for(const r of mgrFull||[])(N.mgrCrit[r.day]||(N.mgrCrit[r.day]={}))[r.username]=r.crit;
  N.alerts=USER?.role==='ops'?((await sbRpc('najm_alerts_list',{p_user:USER.username,p_pin:PIN}).catch(()=>[]))||[]):[];   // تنبيهات شيت البصمة
  N.payouts=USER?.role==='ops'?((await sbRpc('najm_payouts_list',{p_user:USER.username,p_pin:PIN,p_month:m}).catch(()=>[]))||[]):[];
  N.ledger=(ledger||[]).map(l=>({...l,points:+l.points}));N.market=market||[];N.offers=(offers||[]).map(o=>({...o,points:+o.points}));
  S=N;RANK_CACHE=null;SALES_CACHE={};LAST_PULL=new Date();
}
async function refresh(silent){
  if(!LIVE||PULLING)return;PULLING=true;
  try{await pull();liveFlag();if(!$('#modalBg').classList.contains('open')&&!$('#askBg').classList.contains('open')&&!(VIEW==='target'&&TG.mode==='edit'))render();}
  catch(e){if(!silent)toast('⚠️ مش قادر أوصل لقاعدة البيانات');liveFlag(true);}
  finally{PULLING=false;}
}
function liveFlag(err){const f=$('#demoFlag');if(!f)return;
  if(!LIVE){f.textContent='مش متصل بقاعدة البيانات — البيانات على الجهاز ده بس';f.style.display='';return;}
  f.style.background=err?'#fde8e6':'#e3f3ee';f.style.color=err?'#a3271e':'#0f5c4c';f.style.borderColor=err?'#f3c3be':'#bfe3d6';
  f.textContent=err?'⚠️ الاتصال بقاعدة البيانات اتقطع — بنحاول تاني':`● متصل · آخر تحديث ${LAST_PULL.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}`;}
async function seedEmployeesIfEmpty(){
  if(!LIVE||!isOps()||S.employees.length)return;
  const L=defaultState().employees;toast(`بنحمّل ${L.length} موظف لأول مرة…`);
  for(let i=0;i<L.length;i+=10)await Promise.all(L.slice(i,i+10).map(e=>push('employee',{code:e.code},{name:e.name,branch:e.branch,dept:e.dept,job:e.job,shift:e.shift,active:true})));
  await refresh();toast('✔ اتحمّل الموظفين');
}
async function pushM(kind,key,data){
  if(!LIVE)return true;
  try{const r=await sbRpc('najm_market_save',{p_user:USER.username,p_pin:PIN,p_kind:kind,p_key:key,p_data:data===undefined?null:data});return r??true;}
  catch(e){const m=e.message;toast(/not enough points/.test(m)?'⚠️ النقاط مش كفاية — '+m.replace(/.*balance/,'رصيدك'):/not taking offers/.test(m)?'السوق مش مفتوح للعروض دلوقتي':errMsg(m));setTimeout(()=>refresh(),400);return false;}
}
