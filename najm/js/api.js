// نجم أبو الفضل — البيانات: الحالة الافتراضية، التخزين على الجهاز (IndexedDB)، والكلام مع Supabase (قراءة / حفظ / رفع صور)
function defaultState(){
  const employees = SEED.split('\n').map(l=>{
    const [code,name,b,dept,job,s]=l.split('|');
    return {code:String(code),name:name.trim(),branch:BR[b],dept:dept.trim(),job:job.trim(),shift:SH[s],active:true,photo:'',video:''};
  });
  return {
    v:2,
    settings:{
      att:{on:2, late:1.2, vlate:0.4, abs:0},
      shiftStart:{Morning:'09:00', Between:'13:00', Night:'17:00'},
      graceMin:10, lateMax:30, finalists:4, winnersPerShift:2,
      capPct:120, complaintPenalty:50, bonusAt100:0, defaultMultiplier:2,
      freshDepts:['قسم البقاله'],
      cards:{yellow:-5, red:-20, green:5, yellowsToRed:2},
      captainMult:3,
      goal:85, targetGoal:85, checkpoints:[10,20],
      prizes:{gold:5000,silver:2000,bronze:1000,top10:500,daily:100,manager:1000},
      marketDays:5,
      mgrWeights:{ops:50,team:25,votes:25},
      mgrPoints:{rating:1,winner:20,gold:100,silver:60,bronze:40,top10:20,red:-10,bonus:50}
    },
    users:[{username:'ops',name:'مدير التشغيل',role:'ops',branch:'',shift:'',depts:[],pin:'0000',active:true}],
    branches:[{name:'البيطاش الرئيسي',kind:'branch'},{name:'عين شمس',kind:'branch'},{name:'المصنع',kind:'factory'}],
    employees,
    days:{}, targets:{}, captains:{}, sales:{}, baseSales:{}, kpiVals:{}, complaints:[], notes:[], cards:[],
    mgrCrit:{}, ledger:[], market:[], offers:[]
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
async function sbRpc(fn,args,qs=''){const r=await fetch(`${SB_URL}/rest/v1/rpc/${fn}${qs}`,{method:'POST',headers:SBH,body:JSON.stringify(args)});const t=await r.text();if(!r.ok){let m=t;try{m=JSON.parse(t).message||t}catch(e){}throw new Error(m);}return t?JSON.parse(t):null;}
async function sbRpcAll(fn,args,order){let out=[],off=0;while(true){const d=await sbRpc(fn,args,`?order=${order}&limit=1000&offset=${off}`);out=out.concat(d||[]);if(!d||d.length<1000)break;off+=1000;}return out;}
async function sbAll(table,q){let out=[],off=0;while(true){const d=await sbGet(`${table}?${q}&limit=1000&offset=${off}`);out=out.concat(d);if(d.length<1000)break;off+=1000;}return out;}
const errMsg=m=>/wrong username|login required/.test(m)?'اسم الدخول أو الرقم السري غلط — أو الحساب اتقفل 15 دقيقة بعد 5 محاولات غلط':/day locked/.test(m)?'🔒 اليوم ده اتقفل (اتعلن رجل اليوم أو عدّى أكتر من يوم) — التعديل عن طريق مدير التشغيل':/deadline passed/.test(m)?'⏰ ميعاد العروض في السوق خلص':/outside your scope|other branch/.test(m)?'الموظف ده مش في نطاقك':/operations manager only/.test(m)?'دي صلاحية مدير التشغيل بس':/attendance is entered/.test(m)?'البصمة بيسجلها مدير الفرع أو الشيفت':'⚠️ ماتحفظش: '+m;
async function push(kind,key,data){
  if(!LIVE) return true;
  try{const r=await sbRpc('najm_save',{p_user:USER.username,p_pin:PIN,p_kind:kind,p_key:key,p_data:data===undefined?null:data});return r??true;}
  catch(e){toast(errMsg(e.message));setTimeout(()=>refresh(),400);return false;}
}
let UPTOK=null;
async function uploadMedia(code,blob,ext){
  if(!UPTOK||UPTOK.exp<Date.now())UPTOK={t:await sbRpc('najm_upload_token',{p_user:USER.username,p_pin:PIN}),exp:Date.now()+25*60000};
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
    sbGet(`najm_winners?day=gte.${from}&day=lte.${to}&select=day,gkey,codes`),
    sbRpcAll('najm_public_scores',{p_from:from,p_to:to},'day,code'),
    sbRpc('najm_public_cards',{p_from:from,p_to:DATE<to?DATE:to}),
    sbRpcAll('najm_card_stats',{p_from:from,p_to:DATE<to?DATE:to},'code'),
  ]);
  const [mgrs,mgrPtsRows,ledger,market,offers,mgrFull,votes]=await Promise.all([
    sbRpc('najm_public_users',{}),sbRpc('najm_mgr_points',{p_from:from,p_to:to}),sbAll('najm_mgr_ledger','select=*&order=created_at'),
    sbRpc('najm_market_list',{}),sbAll('najm_offers','select=*'),
    USER?sbRpc('najm_mgr_ratings_full',{p_user:USER.username,p_pin:PIN,p_from:from,p_to:to}):Promise.resolve([]),
    sbRpc('najm_vote_counts',{p_month:m})]);
  let full=[],files=null;
  if(USER){[full,files]=await Promise.all([sbRpcAll('najm_full_scores',{p_user:USER.username,p_pin:PIN,p_from:from,p_to:to},'day,code'),sbRpc('najm_files',{p_user:USER.username,p_pin:PIN})]);}
  const N=defaultState();
  N.settings=Object.assign(N.settings,st?.[0]?.data||{});
  if(files?.private?.bonusAt100!=null)N.settings.bonusAt100=files.private.bonusAt100;
  N.employees=emps.map(e=>({code:e.code,name:e.name,branch:e.branch,dept:e.dept||'',job:e.job||'',shift:e.shift||'Morning',active:e.active!==false,photo:e.photo||'',video:e.video||'',title:e.title||''}));
  N.targets={[m]:Object.fromEntries(tg.map(r=>[r.dkey,r.cfg]))};
  N.captains={[m]:{}};for(const c of caps)(N.captains[m][c.code]||(N.captains[m][c.code]=[])).push({sku:c.sku,name:c.name,target:+c.target,pts:c.pts==null?null:+c.pts,active:c.active,by:c.by_user});
  N.salesSum={month:m,upto:DATE,data:salesSum||{}};N.salesDays={};for(const r of salesDays)(N.salesDays[r.branch]||(N.salesDays[r.branch]=[])).push(r.day);
  N.baseSales={[pm]:Object.fromEntries(base.map(r=>[r.branch,r.items]))};
  for(const r of kpi)(N.kpiVals[r.day]||(N.kpiVals[r.day]={}))[r.dkey]=r.vals;
  const D=d=>N.days[d]||(N.days[d]={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},bonus:{},winners:{},pub:{},full:{}});
  for(const w of win)D(w.day).winners[w.gkey]=w.codes;
  for(const r of pub){const x=D(r.day);x.pub[r.code]={att:r.att,total:r.total==null?null:+r.total,complete:r.complete,bonus:r.has_bonus};if(r.att)x.att[r.code]=r.att;}
  for(const r of full){const x=D(r.day);x.full[r.code]=1;if(r.att)x.att[r.code]=r.att;else delete x.att[r.code];if(r.att_time)x.attTime[r.code]=r.att_time;
    for(const f of ['br','sh','fr','ops','hy'])if(r[f])x[f][r.code]=r[f];if(r.bonus)x.bonus[r.code]={v:+r.bonus,note:r.bonus_note||''};}
  if(!USER&&ME){const mine=await sbRpc('najm_my_ratings',{p_code:ME,p_from:from,p_to:to}).catch(()=>[]);
    for(const r of mine||[]){const x=D(r.day);x.full[ME]=1;if(r.att)x.att[ME]=r.att;for(const f of ['br','sh','fr','ops','hy'])if(r[f])x[f][ME]=r[f];if(r.bonus)x.bonus[ME]={v:+r.bonus,note:''};}}
  N.cardStats={};for(const r of cstats||[])N.cardStats[r.code]=Object.fromEntries(Object.entries(r).map(([k,v])=>[k,k==='code'?v:v==null?null:+v]));
  N.cardCounts={};for(const c of cardsPub||[])N.cardCounts[c.code]={y:c.yellow,r:c.red,g:c.green};
  if(files){
    N.cards=(files.cards||[]).map(c=>({id:c.id,date:c.day,code:c.code,color:c.color,reason:c.reason,by:c.by_user,approved:c.approved}));
    N.complaints=(files.complaints||[]).map(c=>({id:c.id,date:c.day,code:c.code,note:c.note}));
    N.notes=(files.notes||[]).map(n=>({id:n.id,date:n.day,code:n.code,text:n.body,by:n.by_user}));
    if(files.users)N.users=files.users.map(u=>({...u,branch:u.branch||'',shift:u.shift||'',depts:u.depts||[],emp_code:(mgrs||[]).find(x=>x.username===u.username)?.emp_code||''}));
  } else N.users=[];
  N.mgrs=(mgrs||[]).map(u=>({...u,branch:u.branch||'',shift:u.shift||'',depts:u.depts||[],emp_code:u.emp_code||'',active:true}));
  N.voteCounts={};for(const v of votes||[])N.voteCounts[v.username]={votes:v.votes,ips:v.ips};
  N.mgrDaily={};for(const r of mgrPtsRows||[])(N.mgrDaily[r.day]||(N.mgrDaily[r.day]={}))[r.username]=r.pts;
  N.mgrCrit={};for(const r of mgrFull||[])(N.mgrCrit[r.day]||(N.mgrCrit[r.day]={}))[r.username]=r.crit;
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
