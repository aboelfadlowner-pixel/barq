// نجم أبو الفضل — الصلاحيات: مين يشوف ويقيّم مين، وقفل اليوم
// مدير الفريش: أقسامه من حسابه، ولو فاضية ← أقسام الفريش فود من الإعدادات (البقاله)
const freshDepts=u=>(u?.depts&&u.depts.length)?u.depts:(S.settings.freshDepts||[]);
// اللي ليه حساب مدير مبيتقيّمش (المدير بيقيّم موظفين) — بيفضل في رجل اليوم والعامل المثالي
// اللي ليه حساب مبيتقيّمش من حد (المدير بيقيّم موظفين، ومدير التشغيل بيقيّم المديرين والكاميرات) — ومفيش حد بيقيّم اللي بنفس صلاحيته
// الاستثناء: الهايجين بيقيّم اللبس لكل الموظفين حتى اللي ليهم حسابات مديرين (إلا مسؤول هايجين زيه)
// الاستثناء: هيد الكاشير بيقيّمه مديره (فرع / شيفت / هايجين / كاميرات) كموظف، وهيد الكاشير مبيقيّمش هيد كاشير زيه
const isMgrEmp=code=>(S.mgrs||S.users||[]).some(u=>u.active!==false&&u.emp_code&&String(u.emp_code)===String(code)&&!(u.role==='headcashier'&&USER?.role!=='headcashier')&&!(USER?.role==='hygiene'&&u.role!=='hygiene'));
const ratable=e=>!isMgrEmp(e.code);
function inScope(e){
  if(!USER) return false; if(USER.role==='ops') return true;
  if(!inUserBranch(USER,e.branch)) return false;
  if(USER.role==='shift'&&!userGroups(USER).includes(shiftGroup(e.shift))) return false;   // Between مع الليل
  if(USER.role==='headcashier'&&e.dept!==(S.settings.cashierDept||'قسم الكاشير')) return false;   // هيد الكاشير: كاشيرات فرعه
  if(USER.role==='fresh'&&!freshDepts(USER).includes(e.dept)) return false;
  return true;
}
function deptInScope(branch,dept){
  if(!USER) return false; if(USER.role==='ops') return true;
  if(!inUserBranch(USER,branch)) return false;
  if(USER.role==='fresh'&&!freshDepts(USER).includes(dept)) return false;
  return true;
}
// ---------- Rating (managers) ----------
const todayC=()=>ymd(new Date());
// اليوم بيتقفل للمديرين: لو عدّى أكتر من يوم، أو اتعلن رجل اليوم، أو المدير قفل اليوم (Between مع الليل)
const closeOf=(d,gk)=>S.closes?.[d]?.[gk]||null;
function dayLocked(e){if(isOps())return false;const t=todayC();const y=new Date();y.setDate(y.getDate()-1);const W=peekDay(DATE).winners||{};const gk=groupKey(e);
  return DATE>t||DATE<ymd(y)||!!W[e.branch+'|'+e.shift]||!!W[gk]||!!closeOf(DATE,gk)?.closed_by;}
