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
function myCloseGroups(){if(!USER||isHy()||USER.role==='fresh')return [];
  const bs=USER.role==='ops'?branches():[USER.branch].filter(Boolean);const out=[];
  for(const b of bs)for(const g of SHIFT_GROUPS){if(USER.role==='shift'&&shiftGroup(USER.shift)!==g)continue;if(activeEmps().some(e=>e.branch===b&&shiftGroup(e.shift)===g))out.push(`${b}|${g}`);}
  return out;}
const closeOn=()=>!!S.settings.closeStart;
const minsLate=(at,dl)=>Math.max(0,Math.round((at-dl)/60000));
