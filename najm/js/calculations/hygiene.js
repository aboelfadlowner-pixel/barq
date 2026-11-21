// نجم أبو الفضل — الهايجين (اللبس): 5 بنود جنب كل موظف. التيشرت إجباري (0 لـ 2)، والباقي 0 لـ 2 أو «مش مطلوب» (−1)
// ومسؤول الهايجين هو اللي بيختار. النجمة = مجموع البنود المطلوبة ÷ (2 × عددها) — نفس najm_hy في الداتابيز
function hyScore(a){if(!a||a.length<5||a.some(v=>v==null))return null;const v=a.filter(x=>x>=0);if(!v.length)return null;return q25(v.reduce((x,y)=>x+y,0)/(2*v.length));}
const hyStar=(D,code)=>hyScore(D.hy?.[code]);
// أول تقييم في اليوم: البنود اللي كانت «مش مطلوب» آخر مرة بتفضل «مش مطلوب» (يقدر يغيّرها)، والباقي فاضي
function hyBlank(e){
  const ds=Object.keys(S.days).filter(d=>d<DATE).sort().reverse();
  for(const d of ds){const a=S.days[d].hy?.[e.code];if(a&&a.length===5)return a.map((x,i)=>i>0&&x===HY_NA?HY_NA:null);}
  return [null,null,null,null,null];
}
