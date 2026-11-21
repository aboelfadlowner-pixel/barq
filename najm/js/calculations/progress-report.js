// نجم أبو الفضل — تقرير الـ10 أيام: حالة الموظف واللي مأخّره
// =========================================================
// تقرير التقدّم كل 10 أيام: الموظف ماشي ناحية العشرة الأوائل ولا متأخر — ومين اللي مأخّره (البصمة، التقييم الفني، الهايجين، الكروت)
// =========================================================
const CHECKS=()=>(S.settings.checkpoints||[10,20]).filter(n=>n>0).sort((a,b)=>a-b);
function checkpointOf(date){ // latest report day (10, 20, end of month) on or before date
  const m=monthOf(date),dd=+date.slice(8,10),last=daysInMonth(m);
  const L=[...CHECKS().filter(n=>n<last),last].filter(n=>n<=dd);
  if(!L.length)return {m,day:null,next:CHECKS()[0]||last};
  const d=L[L.length-1];return {m,day:d,date:`${m}-${pad(d)}`,next:[...CHECKS(),last].find(n=>n>dd)||null,last};
}
function goalAt(){return {v:KPI_G(),t:TGT_G(),auto:false};}
function progressOf(e,cp,goal){
  const m=cp.m,upto=cp.date;const ms=monthSummary(e,m,upto);const max=S.settings.att.on||2;
  let n=0,sumT=0,att=0,attLate=0,mgr=0,mgrMiss=0,ops=0,opsMiss=0,hy=0,hyMiss=0,bon=0;const tech=[0,0,0,0,0],techN=[0,0,0,0,0],hyc=[0,0,0,0,0],hyN=[0,0,0,0,0];let detail=false;
  for(const d of monthDays(m,upto)){const s=score(d,e.code);if(s.total==null||s.st==='abs')continue;n++;sumT+=s.total;
    att+=s.att??0;if(s.st==='late'||s.st==='vlate')attLate++;
    if(s.pub){continue;}detail=true;
    if(s.mgr==null)mgrMiss++;mgr+=s.mgr||0;if(s.ops==null)opsMiss++;ops+=s.ops||0;if(s.hy==null)hyMiss++;hy+=s.hy||0;bon+=s.bonus||0;
    const D=peekDay(d);for(const f of ['br','sh','fr','ops']){const a=D[f]?.[e.code];if(a&&a.length===5)a.forEach((v,i)=>{if(v!=null){tech[i]+=v;techN[i]++;}});}
    const h=D.hy?.[e.code];if(h&&h.length===5)h.forEach((v,i)=>{if(v!=null&&v>=0){hyc[i]+=v;hyN[i]++;}});}
  const P=x=>Math.round(x*20*10)/10; // one star = 20 points out of 100
  const parts=detail&&n?[
    {k:'att',t:'⏰ البصمة',lost:P((max*n-att)/n),miss:0,note:attLate?`${fmt(attLate)} يوم تأخير`:''},
    {k:'mgr',t:'🧑‍💼 تقييم المدير المباشر',lost:P((n-mgr)/n),miss:mgrMiss},
    {k:'ops',t:'🏢 تقييم التشغيل',lost:P((n-ops)/n),miss:opsMiss},
    {k:'hy',t:'🧼 الهايجين',lost:P((n-hy)/n),miss:hyMiss},
  ]:[];
  const avgArr=(s,c,L)=>s.map((v,i)=>c[i]?{t:L[i],v:v/c[i]}:null).filter(Boolean).sort((a,b)=>a.v-b.v);
  const techA=avgArr(tech,techN,CRITERIA),hyA=avgArr(hyc,hyN,HY_CRITERIA);
  const cardP=ms.cardPts||0;
  const gv=goal?.v;const score100=ms.monthScore;
  let need=null;const last=daysInMonth(m);
  if(gv!=null&&n&&cp.day<last){const r=Math.max(1,Math.round(n/cp.day*(last-cp.day)));const g=(gv-cardP)/20;need=(g*(n+r)-sumT)/r;}
  const tg=tgtOf(ms.target,m,LIVE&&upto<DATE?DATE:upto);const q=qualify(ms,tg);const tv=tg?.v; // live sales are month-to-date, so compare them with today's pace
  const st=score100==null?'none':q.ok?'green':(score100>=gv-5&&tv!=null&&tv>=TGT_G()-5)?'near':'red';
  return {e,cp,goal,ms,n,score:score100,st,tg,q,parts,techA,hyA,cardP,cards:ms.cards,bonusDays:bon/0.5,need,abs:ms.abs,detail};
}
const ST_TXT={green:['🟢','مرشح للعشرة الأوائل','b-green'],near:['🟡','قريب من العشرة الأوائل','b-gold'],red:['🔴','متأخر عن العشرة الأوائل','b-red'],none:['⚪','لسه مفيش تقييمات كفاية','b-gray']};
const TIPS={att:'تعالى في ميعادك كل يوم — البصمة لوحدها ${max} نجمة يومياً',mgr:'ركّز في البنود اللي مديرك بيقيّمها، واسأله إيه اللي ناقصك',ops:'مدير التشغيل بيقيّمك على نفس البنود — الالتزام قدامه بيفرق',hy:'اهتم بالنضافة الشخصية واليونيفورم ونضافة قسمك كل يوم'};
