// نجم أبو الفضل — تشغيل التطبيق: التابات والتنقل وعرض الشاشة وبداية التحميل
/* =========================================================
   نجم أبو الفضل — KPI / رجل اليوم / العامل المثالي / الكروت / الكابتن
   ========================================================= */
// =========================================================
// UI
// =========================================================
let VIEW='dash', DATE=ymd(new Date()), F={branch:'', shift:'', dept:'', q:''};
const TABS=[
  ['dash','🏪 لوحة الفروع',()=>true],
  ['rate','📝 تقييم اليوم',()=>isMgr()],
  ['day','🏆 رجل اليوم',()=>true],
  ['month','👑 العامل المثالي',()=>true],
  ['players','🃏 كروت اللاعبين',()=>true],
  ['progress',USER=>USER?'📈 تقارير التقدّم':'📈 تقريري',()=>!isHy()],
  ['vote','🗳️ صوّت لمديرك',()=>!isMgr()],
  ['league','🏟️ المديرين والسوق',()=>true],
  ['target','🎯 التارجت والكابتن',()=>true],
  ['cards','🟨 الكروت',()=>isMgr()&&!isHy()],
  ['emps','🗂️ ملفات الموظفين',()=>isMgr()&&!isHy()],
  ['settings','⚙️ الإعدادات',()=>isOps()],
  ['screens','📺 شاشة الفرع',()=>true],
];
function renderNav(){
  const pend=isOps()?S.cards.filter(c=>!c.approved).length:0;
  $('#nav').innerHTML=TABS.filter(t=>t[2]()).map(t=>`<button class="${VIEW===t[0]?'on':''}" onclick="go('${t[0]}')">${typeof t[1]==='function'?t[1](USER):t[1]}${t[0]==='cards'&&pend?`<span class="cnt">${fmt(pend)}</span>`:''}</button>`).join('');
  $('#roleBtn').innerHTML=USER?`🔐 ${esc(USER.name)} · ${ROLES[USER.role]} — خروج`:'👤 دخول المديرين';
}
function go(v){VIEW=v;render();window.scrollTo(0,0);}
function render(){
  if(TVB){tvUpdate();return;}
  if(!TABS.find(t=>t[0]===VIEW&&t[2]()))VIEW='dash';
  renderNav();
  $('#main').innerHTML={screens:()=>`<h2>📺 شاشة الفرع</h2><div class="card" style="max-width:520px"><div class="small muted" style="margin-bottom:8px">افتح رابط الفرع على التلفزيون وسيبه شغال — بيعرض رجل اليوم ودوري الأقسام والكابتن والكؤوس، وبيتحدث كل دقيقة.</div>${tvLinks()}</div>`,dash:vDash,league:vLeague,progress:vProgress,vote:vVote,players:vPlayers,rate:vRate,day:vDay,month:vMonth,target:vTarget,cards:vCards,emps:vEmps,settings:vSettings}[VIEW]();
}
const branches=()=>S.branches.map(b=>b.name);
const deptsOf=b=>[...new Set(activeEmps().filter(e=>!b||e.branch===b).map(e=>e.dept).filter(Boolean))].sort();
(async()=>{
  if(DEMO){demoSeed();}else await load();
  let saved=null;try{saved=JSON.parse(sessionStorage.getItem('najm-user')||'null');}catch(e){}
  const TVQ=new URLSearchParams(location.search).get('tv');
  if(TVQ!==null){saved=null;tvInit(TVQ);}
  const dp=$('#dayPick');dp.value=DATE;dp.onchange=()=>{if(dp.value){DATE=dp.value;RANK_CACHE=null;LIVE?refresh():render();}};
  render();
  if(DEMO){LIVE=false;const f=$('#demoFlag');f.innerHTML='🧪 نسخة تجريبية بأرقام وهمية — مفيش حاجة بتتحفظ · التشغيل <b>ops / 0000</b> · مدير البيطاش <b>haitham / 1111</b> · الهايجين <b>yasser / 7777</b> · مدير الصبح <b>mahmoud / 2222</b> · مدير الليل <b>islam / 3333</b> · كود اللاعب في السوق <b>123456</b>';render();if(TVB){TV_READY=true;}return;}
  try{
    if(saved?.pin){const u=await sbRpc('najm_login',{p_user:saved.username,p_pin:saved.pin});if(u){USER={username:u.username,name:u.name,role:u.role,branch:u.branch||'',shift:u.shift||'',depts:u.depts||[]};PIN=saved.pin;}}
    await pull();LIVE=true;
  }catch(e){LIVE=false;if(saved&&!saved.pin&&S.users.some(x=>x.username===saved.username))USER=saved;}
  liveFlag();render();
  if(TVB){TV_READY=true;tvCelebrateCheck();}
  setInterval(()=>{if(document.visibilityState==='visible')refresh(true);},60000);
})();
