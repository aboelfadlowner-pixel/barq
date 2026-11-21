// نجم أبو الفضل — الـ KPI الشخصي للشهر وشرط العشرة الأوائل (KPI + نقط التارجت)
// ---------- month summary & ranks ----------
function monthSummary(e,month,upto){
  const days=monthDays(month,upto);let n=0,sum=0,wins=0,abs=0,late=0,worked=0,off=0;
  for(const d of days){const s=score(d,e.code);if(WORK_ST.includes(s.st))worked++;if(s.st==='off')off++;if(s.st==='abs')abs++;if(s.st==='late'||s.st==='vlate')late++;if(s.total!=null&&s.st!=='abs'){n++;sum+=s.total;}if(isWinner(d,e.code))wins++;}
  const avg=n?sum/n:null;const cards=cardCount(e.code,month,upto);const cp=cardPts(cards);
  const monthScore=avg!=null?Math.max(0,Math.round(avg/5*100+cp)):null;
  const left=daysInMonth(month)-days.length;   // أيام فاضلة في الشهر
  return {n,avg,wins,abs,late,worked,off,offMax:allowedOff(month),left,cards,cardPts:cp,monthScore,target:empTarget(e,month,upto)};
}
const KPI_G=()=>+RULES().goal||85, TGT_G=()=>+RULES().targetGoal||100;
// التأهل: الـ KPI + نقط التارجت + أقل أيام شغل (لو لسه في أيام فاضلة في الشهر، بيتحسب «لسه يقدر يلحق»)
// التأهل: الـ KPI + القسم حقق التارجت (100%) + مغابش خالص ومخدش غير إجازاته الأسبوعية (المرضي بيطلّعه)
function qualify(ms,tg){const k=ms.monthScore;const abs=ms.abs||0,off=ms.off||0,offMax=ms.offMax??allowedOff(monthOf(DATE));
  const kOk=k!=null&&k>=KPI_G(),tOk=tg?.dept!=null&&tg.dept>=TGT_G(),dOk=abs===0&&off<=offMax,dDone=(ms.left||0)===0;
  return {kOk,tOk,dOk,dDone,abs,off,offMax,ok:kOk&&tOk&&dOk};}
