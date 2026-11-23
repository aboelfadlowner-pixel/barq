// نجم أبو الفضل — الجلسة: مين داخل دلوقتي (موظف / مدير / تشغيل / هايجين)
// ---------- session ----------
let USER=null; // null = employee (no login)
// الموظف: كود البصمة + رقمه السري (الموبايل بيفتكرهم)
let ME=null,MEPIN=null,ME_HASPIN=false;   // MEPIN '' = دخل بكود البصمة بس
try{const v=JSON.parse(localStorage.getItem('najm-me')||'null');if(v&&v.code){ME=String(v.code);MEPIN=v.pin??'';ME_HASPIN=!!v.hasPin;}}catch(e){}
function meSave(){try{ME?localStorage.setItem('najm-me',JSON.stringify({code:ME,pin:MEPIN,hasPin:ME_HASPIN})):localStorage.removeItem('najm-me');}catch(e){}}
const isMgr=()=>!!USER, isOps=()=>USER?.role==='ops', isHy=()=>USER?.role==='hygiene', isCam=()=>USER?.role==='cameras', isHC=()=>USER?.role==='headcashier', isLimited=()=>isCam()||isHC();
// الموظف داخل بكوده ورقمه السري · الزائر = محدش داخل (بيشوف الترتيب ورجل اليوم والعامل المثالي بس)
const isEmp=()=>!USER&&!!ME&&MEPIN!=null&&!!emp(ME), isGuest=()=>!USER&&!isEmp();
