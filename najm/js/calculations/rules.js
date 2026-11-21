// نجم أبو الفضل — قواعد الشهر: مدير التشغيل بيحددها، وكل شهر بيتحسب بالقواعد اللي كانت شغالة فيه
// (تغيير القاعدة بيبدأ من الشهر الجاي — ولو اتطبق على الشهر الحالي لازم بسبب — والشهور اللي فاتت متتغيّرش)
//   ptsTiers   : شرايح نقط التارجت [نسبة التحقيق %، النقط] — أقل من أول شريحة = صفر، وبعد آخر شريحة = نقط آخر شريحة
//   ptsMode    : linear = بين شريحتين بالتناسب · step = سلّم (بياخد نقط الشريحة اللي وصلها بس)
//   minWorkDays: أقل أيام شغل فعلي في الشهر عشان يدخل العشرة الأوائل
//   goal       : حد الـ KPI للعشرة الأوائل · targetGoal: المطلوب الافتراضي % من نقط التارجت
const RULE_KEYS=['ptsTiers','ptsMode','minWorkDays','goal','targetGoal'];
const RULE_DEF={ptsTiers:[[50,50],[60,60],[70,70],[85,85],[100,100],[110,110],[120,120]],ptsMode:'linear',minWorkDays:20,goal:85,targetGoal:85};
const RULE_NAME={ptsTiers:'شرايح نقط التارجت',ptsMode:'طريقة الحساب بين الشرايح',minWorkDays:'أقل أيام شغل للتأهل',goal:'حد الـ KPI',targetGoal:'المطلوب الافتراضي من نقط التارجت %'};
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
