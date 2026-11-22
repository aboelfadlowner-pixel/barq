// نجم أبو الفضل — الـ KPI الشخصي للشهر وشرط العشرة الأوائل (KPI + نقط التارجت)
// ---------- month summary & ranks ----------
function monthSummary(e,month,upto){
  const days=monthDays(month,upto);let n=0,sum=0,wins=0,abs=0,late=0,worked=0,off=0;
  for(const d of days){const s=score(d,e.code);if(WORK_ST.includes(s.st))worked++;if(s.st==='off')off++;if(s.st==='abs')abs++;if(s.st==='late'||s.st==='vlate'||s.st==='xlate')late++;if(s.total!=null&&s.st!=='abs'){n++;sum+=s.total;}if(isWinner(d,e.code))wins++;}
  const avg=n?sum/n:null;const cards=cardCount(e.code,month,upto);const cp=cardPts(cards);
  // الـ KPI بالنقط: كل يوم بنجومه (5 نجوم = نقط يوم كامل ≈ 19.2) + ½ المثالي + الكروت (+10 / −5 / −20)
  // الفلوس = النقط لحد أقصى الشهر (500)، والزيادة بتعلّي الترتيب بس · النسبة % = النقط ÷ نقط الأيام اللي اتحسبت (الغياب بيتحسب صفر)
  const R=rulesFor(month),dm=dayPts(month),cap=+R.kpiPts||500;
  const kpiPts=avg!=null?Math.max(0,Math.round(sum/5*dm+cp)):null;
  const kpiMoney=kpiPts==null?null:Math.min(cap,kpiPts);
  const monthScore=kpiPts!=null&&(n+abs)>0?Math.round(kpiPts/(dm*(n+abs))*100):null;
  const left=daysInMonth(month)-days.length;   // أيام فاضلة في الشهر
  return {n,avg,wins,abs,late,worked,off,kpiPts,kpiMoney,kpiMax:cap,offMax:allowedOff(month),left,cards,cardPts:cp,monthScore,target:empTarget(e,month,upto)};
}
const KPI_G=()=>+RULES().goal||85, TGT_G=()=>+RULES().targetGoal||100;
// التأهل: الـ KPI + نقط التارجت + أقل أيام شغل (لو لسه في أيام فاضلة في الشهر، بيتحسب «لسه يقدر يلحق»)
// التأهل: الـ KPI + القسم حقق التارجت (100%) + مغابش خالص ومخدش غير إجازاته الأسبوعية (المرضي بيطلّعه)
function qualify(ms,tg){const k=ms.monthScore;const abs=ms.abs||0,off=ms.off||0,offMax=ms.offMax??allowedOff(monthOf(DATE));
  const kOk=k!=null&&k>=KPI_G(),tOk=tg?.dept!=null&&tg.dept>=TGT_G(),dOk=abs===0&&off<=offMax,dDone=(ms.left||0)===0;
  return {kOk,tOk,dOk,dDone,abs,off,offMax,ok:kOk&&tOk&&dOk};}
// عرض الـ KPI بالنقط (من غير فلوس — الفلوس للتشغيل بس)
const kpiTxt=ms=>ms?.kpiPts==null?'—':`${fmt(ms.kpiPts)} نقطة`;
