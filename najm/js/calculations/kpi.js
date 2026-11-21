// نجم أبو الفضل — الـ KPI الشخصي للشهر وشرط العشرة الأوائل (KPI + نقط التارجت)
// ---------- month summary & ranks ----------
function monthSummary(e,month,upto){
  const days=monthDays(month,upto);let n=0,sum=0,wins=0,abs=0,late=0,worked=0;
  for(const d of days){const s=score(d,e.code);if(WORK_ST.includes(s.st))worked++;if(s.st==='abs')abs++;if(s.st==='late'||s.st==='vlate')late++;if(s.total!=null&&s.st!=='abs'){n++;sum+=s.total;}if(isWinner(d,e.code))wins++;}
  const avg=n?sum/n:null;const cards=cardCount(e.code,month,upto);const cp=cardPts(cards);
  const monthScore=avg!=null?Math.max(0,Math.round(avg/5*100+cp)):null;
  const left=daysInMonth(month)-days.length;   // أيام فاضلة في الشهر
  return {n,avg,wins,abs,late,worked,left,cards,cardPts:cp,monthScore,target:empTarget(e,month,upto)};
}
const KPI_G=()=>+RULES().goal||85, TGT_G=()=>+RULES().targetGoal||85;
// التأهل: الـ KPI + نقط التارجت + أقل أيام شغل (لو لسه في أيام فاضلة في الشهر، بيتحسب «لسه يقدر يلحق»)
function qualify(ms,tg){const k=ms.monthScore,t=tg?.v;const min=+RULES().minWorkDays||0;const w=ms.worked||0;
  const kOk=k!=null&&k>=KPI_G(),tOk=t!=null&&tg.need>0&&t>=tg.need,dOk=w+(ms.left||0)>=min,dDone=w>=min;
  return {kOk,tOk,dOk,dDone,worked:w,min,ok:kOk&&tOk&&dOk};}
