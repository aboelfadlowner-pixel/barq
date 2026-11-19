// نجم أبو الفضل — الجلسة: مين داخل دلوقتي (موظف / مدير / تشغيل / هايجين)
// ---------- session ----------
let USER=null; // null = employee (no login)
// الموظف: كود البصمة + رقمه السري (الموبايل بيفتكرهم)
let ME=null,MEPIN=null;try{const v=JSON.parse(localStorage.getItem('najm-me')||'null');if(v&&v.code){ME=String(v.code);MEPIN=v.pin||null;}}catch(e){}
function meSave(){try{ME?localStorage.setItem('najm-me',JSON.stringify({code:ME,pin:MEPIN})):localStorage.removeItem('najm-me');}catch(e){}}
const isMgr=()=>!!USER, isOps=()=>USER?.role==='ops', isHy=()=>USER?.role==='hygiene';
