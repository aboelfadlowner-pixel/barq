// نجم أبو الفضل — إغلاق اليوم: كل مدير بيقفل شيفته (Between مع الليل). آخر ميعاد = بداية الشيفت + closeAfterHours.
// التأخير بيتخصم من المسؤول تلقائي (najm_apply_late_closes في الداتابيز) — ده نفس الحساب للعرض والتجربة.
function closeDeadline(d,gk){
  const g=gk.split('|')[1];const st=(S.settings.shiftStart||{})[g]||(g==='Night'?'17:00':'09:00');
  const [h,mi]=st.split(':').map(Number);const t=new Date(`${d}T00:00:00`);t.setHours(h,mi+(+(S.settings.closeAfterHours??10))*60,0,0);return t;
}
// المسؤول عن إغلاق شيفت: مديرين الشيفت ده في الفرع، ولو مفيش ← مدير الفرع
function closeOwners(gk){const [b,g]=gk.split('|');const L=managers();
  const sh=L.filter(u=>u.role==='shift'&&u.branch===b&&shiftGroup(u.shift)===g).map(u=>u.username);
  return sh.length?sh:L.filter(u=>u.role==='branch'&&u.branch===b).map(u=>u.username);}
// الشيفتات اللي المدير الداخل مسؤول يقفلها
function myCloseGroups(){if(!USER||isHy()||isCam()||USER.role==='fresh')return [];
  const bs=USER.role==='ops'?branches():[USER.branch].filter(Boolean);const out=[];
  for(const b of bs)for(const g of SHIFT_GROUPS){if(USER.role==='shift'&&shiftGroup(USER.shift)!==g)continue;if(activeEmps().some(e=>e.branch===b&&shiftGroup(e.shift)===g))out.push(`${b}|${g}`);}
  return out;}
const closeOn=()=>!!S.settings.closeStart;
const minsLate=(at,dl)=>Math.max(0,Math.round((at-dl)/60000));

// مراحل اليوم لكل فرع وشيفت: 1 مفتوح ← 2 مراجعة (المدير سلّم يومه) ← 3 اعتماد رجل اليوم ← 4 مغلق (بعد الاعتماد على طول)
const STAGES=['مفتوح','مراجعة','اعتماد رجل اليوم','مغلق'];
function dayStage(d,gk){const W=peekDay(d).winners||{};const [b,g]=gk.split('|');
  if(W[gk]||(g==='Night'&&W[b+'|Between']))return 4;
  if(closeOf(d,gk)?.closed_by)return 2;
  return 1;}
// مدير التشغيل بيعدّل في يوم مغلق أو قديم ← لازم سبب (بيتسجّل مع القيمة القديمة والجديدة)
function opsClosed(e){if(!isOps())return false;const y=new Date();y.setDate(y.getDate()-1);return DATE<ymd(y)||dayStage(DATE,groupKey(e))===4;}
const OPS_REASON={};
async function opsReason(){if(OPS_REASON[DATE])return OPS_REASON[DATE];const r=await askText(`يوم ${DATE} مغلق — سبب التعديل؟ (بيتسجّل في السجل مع القيمة القديمة والجديدة)`);if(r===null||!r.trim()){if(r!==null)toast('لازم تكتب السبب');return null;}return OPS_REASON[DATE]=r.trim();}
async function editKey(code){const k={day:DATE,code};const e=emp(code);if(e&&opsClosed(e)){const r=await opsReason();if(!r)return null;k.reason=r;}return k;}
