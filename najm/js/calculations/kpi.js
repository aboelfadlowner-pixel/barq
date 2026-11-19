// نجم أبو الفضل — الـ KPI الشخصي للشهر وشرط العشرة الأوائل (KPI + نقط التارجت)
// ---------- month summary & ranks ----------
function monthSummary(e,month,upto){
  const days=monthDays(month,upto);let n=0,sum=0,wins=0,abs=0,late=0;
  for(const d of days){const s=score(d,e.code);if(s.st==='abs')abs++;if(s.st==='late'||s.st==='vlate')late++;if(s.total!=null&&s.st!=='abs'){n++;sum+=s.total;}if(isWinner(d,e.code))wins++;}
  const avg=n?sum/n:null;const cards=cardCount(e.code,month,upto);const cp=cardPts(cards);
  const monthScore=avg!=null?Math.max(0,Math.round(avg/5*100+cp)):null;
  return {n,avg,wins,abs,late,cards,cardPts:cp,monthScore,target:empTarget(e,month,upto)};
}
const KPI_G=()=>+S.settings.goal||85, TGT_G=()=>+S.settings.targetGoal||85;
function qualify(ms,tg){const k=ms.monthScore,t=tg?.v;const kOk=k!=null&&k>=KPI_G(),tOk=t!=null&&tg.need>0&&t>=tg.need;return {kOk,tOk,ok:kOk&&tOk};}
