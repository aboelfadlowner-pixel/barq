// نجم أبو الفضل — قواعد الشهر: مدير التشغيل بيحددها، وكل شهر بيتحسب بالقواعد اللي كانت شغالة فيه
// (تغيير القاعدة بيبدأ من الشهر الجاي — ولو اتطبق على الشهر الحالي لازم بسبب — والشهور اللي فاتت متتغيّرش)
//   ptsTiers   : شرايح نقط التارجت [نسبة التحقيق %، النقط] — أقل من أول شريحة = صفر، وبعد آخر شريحة = نقط آخر شريحة
//   ptsMode    : linear = بين شريحتين بالتناسب · step = سلّم (بياخد نقط الشريحة اللي وصلها بس)
//   weeklyOff  : أيام الإجازة الأسبوعية — المؤهل للعشرة الأوائل مايغيبش خالص ومياخدش غير إجازاته الأسبوعية (المرضي بيطلّعه)
//   goal       : حد الـ KPI للعشرة الأوائل · targetGoal: القسم لازم يحقق كام % من التارجت عشان الموظف يتأهل
const RULE_KEYS=['ptsTiers','ptsMode','weeklyOff','goal','targetGoal'];
// الشرايح المعتمدة: أقل من 85% = صفر · من 85% = 50% من نقط وفلوس التارجت · 100% فأكتر = 100% (سلّم)
const RULE_DEF={ptsTiers:[[85,50],[100,100]],ptsMode:'step',weeklyOff:1,goal:85,targetGoal:100};
const RULE_NAME={ptsTiers:'شرايح نقط التارجت',ptsMode:'طريقة الحساب بين الشرايح',weeklyOff:'الإجازة الأسبوعية',goal:'حد الـ KPI',targetGoal:'القسم يحقق % من التارجت'};
function rulesFor(m){
  const V=(S.settings.ruleVersions||[]).filter(v=>v.from<=m).sort((a,b)=>a.from.localeCompare(b.from)).pop();
  const cur=Object.fromEntries(RULE_KEYS.map(k=>[k,S.settings[k]]).filter(([,v])=>v!=null));
  return {...RULE_DEF,...(V?V.rules:cur)};
}
const RULES=()=>rulesFor(monthOf(DATE));
// نقط التارجت من نسبة التحقيق
function tierPts(p,r=RULES()){
  if(p==null)return null;const T=[...(r.ptsTiers||RULE_DEF.ptsTiers)].map(x=>[+x[0],+x[1]]).sort((a,b)=>a[0]-b[0]);
  if(!T.length||p<T[0][0])return 0;
  for(let i=T.length-1;i>=0;i--)if(p>=T[i][0]){
    if(i===T.length-1||r.ptsMode==='step')return Math.round(T[i][1]);
    const [a,pa]=T[i],[b,pb]=T[i+1];return Math.round(pa+(p-a)*(pb-pa)/(b-a));
  }
  return 0;
}
// أيام الشغل الفعلي (في ميعاده / تأخير) — الإجازة والغياب مش بيتحسبوا
const WORK_ST=['on','late','vlate'];
// الإجازات المسموحة في الشهر للمؤهل = الإجازة الأسبوعية × عدد الأسابيع (لأعلى)
const allowedOff=(m,r=RULES())=>(+r.weeklyOff||0)*Math.ceil(daysInMonth(m)/7);
