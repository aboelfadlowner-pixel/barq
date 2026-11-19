// نجم أبو الفضل — الجلسة: مين داخل دلوقتي (موظف / مدير / تشغيل / هايجين)
// ---------- session ----------
let USER=null; // null = employee (no login)
const isMgr=()=>!!USER, isOps=()=>USER?.role==='ops', isHy=()=>USER?.role==='hygiene';
