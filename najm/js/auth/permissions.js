// نجم أبو الفضل — الصلاحيات: مين يشوف ويقيّم مين، وقفل اليوم
function inScope(e){
  if(!USER) return false; if(USER.role==='ops') return true;
  if(USER.branch&&e.branch!==USER.branch) return false;
  if(USER.role==='shift'&&e.shift!==USER.shift) return false;
  if(USER.role==='fresh'&&!(USER.depts||[]).includes(e.dept)) return false;
  return true;
}
function deptInScope(branch,dept){
  if(!USER) return false; if(USER.role==='ops') return true;
  if(USER.branch&&branch!==USER.branch) return false;
  if(USER.role==='fresh'&&!(USER.depts||[]).includes(dept)) return false;
  return true;
}
// ---------- Rating (managers) ----------
const todayC=()=>ymd(new Date());
function dayLocked(e){if(isOps())return false;const t=todayC();const y=new Date();y.setDate(y.getDate()-1);
  return DATE>t||DATE<ymd(y)||!!(peekDay(DATE).winners||{})[e.branch+'|'+e.shift];}
