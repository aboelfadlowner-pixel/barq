// نجم أبو الفضل — الجلسة: مين داخل دلوقتي (موظف / مدير / تشغيل / هايجين)
// ---------- session ----------
let USER=null; // null = employee (no login)
// الموظف: كود البصمة + رقمه السري (الموبايل بيفتكرهم)
let ME=null,MEPIN=null,ME_HASPIN=false;   // MEPIN '' = دخل بكود البصمة بس
try{const v=JSON.parse(localStorage.getItem('najm-me')||'null');if(v&&v.code){ME=String(v.code);MEPIN=v.pin??'';ME_HASPIN=!!v.hasPin;}}catch(e){}
function meSave(){try{ME?localStorage.setItem('najm-me',JSON.stringify({code:ME,pin:MEPIN,hasPin:ME_HASPIN})):localStorage.removeItem('najm-me');}catch(e){}}
// فروع المدير: فاضية = كل الفروع. فرع واحد في branch، ولو أكتر من فرع (مثلاً الهايجين) كلهم في branches
const userBranches=u=>{const L=(u?.branches||[]).filter(Boolean);return L.length?L:(u?.branch?[u.branch]:[]);};
const inUserBranch=(u,b)=>{const L=userBranches(u);return !L.length||L.includes(b);};
// شيفتات المدير: شيفت واحد في shift، ولو أكتر من شيفت كلهم في shifts. المجموعات: Between مع الليل
const userShifts=u=>{const L=(u?.shifts||[]).filter(Boolean);return L.length?L:(u?.shift?[u.shift]:[]);};
const userGroups=u=>[...new Set(userShifts(u).map(s=>shiftGroup(s)))];
const isMgr=()=>!!USER, isOps=()=>USER?.role==='ops', isHy=()=>USER?.role==='hygiene', isCam=()=>USER?.role==='cameras', isHC=()=>USER?.role==='headcashier', isLimited=()=>isCam()||isHC();
// الموظف داخل بكوده ورقمه السري · الزائر = محدش داخل (بيشوف الترتيب ورجل اليوم والعامل المثالي بس)
const isEmp=()=>!USER&&!!ME&&MEPIN!=null&&!!emp(ME), isGuest=()=>!USER&&!isEmp();
