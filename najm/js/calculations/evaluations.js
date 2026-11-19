// نجم أبو الفضل — التقييم الفني: البنود من 0 لـ 2 ونجمة المدير المباشر
const q25=x=>Math.round(x*4)/4;
// 5 criteria, each 0..2 → one star (rounded to a quarter); incomplete rating = no star yet
function crit(arr){if(!arr||arr.length<5||arr.some(v=>v==null))return null;return q25(arr.reduce((a,b)=>a+b,0)/10);}
const isFresh=e=>(S.settings.freshDepts||[]).includes(e?.dept);
// direct manager star: half branch manager + half shift manager; in fresh-food departments a third each with the fresh-food manager
function mgrStar(D,code,e){
  const b=crit(D.br[code]),s=crit(D.sh[code]),f=crit(D.fr[code]);
  let mgr,mc;
  if(isFresh(e)){mgr=b==null&&s==null&&f==null?null:q25(((b||0)+(s||0)+(f||0))/3);mc=b!=null&&s!=null&&f!=null;}
  else{mgr=b==null&&s==null?null:q25(((b||0)+(s||0))/2);mc=b!=null&&s!=null;}
  return {mgr,mc,parts:{br:b,sh:s,fr:f}};
}
