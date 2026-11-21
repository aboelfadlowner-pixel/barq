// نجم أبو الفضل — ترتيب الشهر، الكؤوس، والجوايز المستحقة
let RANK_CACHE=null;
function ranks(){
  const key=DATE;
  if(RANK_CACHE&&RANK_CACHE.key===key)return RANK_CACHE;
  const m=monthOf(DATE);
  const rows=activeEmps().map(e=>{const ms=monthSummary(e,m,DATE);const tg=tgtOf(ms.target,m,DATE);return {e,ms,tg,q:qualify(ms,tg)};}).filter(x=>x.ms.n>0||x.ms.wins>0);
  const both=x=>(x.ms.kpiPts!=null?x.ms.kpiPts/(x.ms.kpiMax||500)*100:0)+(x.tg?.dept!=null?Math.min(100,x.tg.dept):0);   // نقط الـ KPI (الزيادة فوق الـ 500 بتعلّي) + نسبة تحقيق القسم
  rows.sort((a,b)=>(b.q.ok-a.q.ok)||b.ms.wins-a.ms.wins||both(b)-both(a)||(b.ms.target?.empPoints||0)-(a.ms.target?.empPoints||0));
  const company={},branch={},bc={};
  rows.forEach((x,i)=>{company[x.e.code]=i+1;bc[x.e.branch]=(bc[x.e.branch]||0)+1;branch[x.e.code]=bc[x.e.branch];});
  const sum={},ok={},tg={};rows.forEach(x=>{sum[x.e.code]=x.ms;ok[x.e.code]=x.q.ok;tg[x.e.code]=x.tg;});
  RANK_CACHE={key,rows,company,branch,bc,sum,ok,tg,total:rows.length,qualified:rows.filter(x=>x.q.ok)};return RANK_CACHE;
}
const prizeRank=code=>{const R=ranks();return R.ok[code]?R.company[code]:null;};
const msOf=e=>ranks().sum[e.code]||monthSummary(e,monthOf(DATE),DATE);
const PRIZE_DEF={gold:5000,silver:2000,bronze:1000,top10:500,daily:100};
const prizes=()=>Object.assign({},PRIZE_DEF,S.settings.prizes||{});
function cupOf(rank){if(!rank)return null;return rank===1?'gold':rank===2?'silver':rank===3?'bronze':rank<=10?'top10':null;}
const CUP_NAME={gold:'الكأس الدهبي',silver:'الكأس الفضي',bronze:'الكأس البرونزي',top10:'جايزة العشرة الأوائل'};
const money$=n=>`${fmt(n)} جنيه`;
const cash=()=>isOps(); // prize amounts are shown to the operations manager only
function duePrizes(){
  const m=monthOf(DATE);const P=prizes();const out=[];
  for(const d of monthDays(m,DATE))for(const[g,codes]of Object.entries(peekDay(d).winners||{}))for(const c of codes){const e=emp(c);if(e)out.push({id:`daily|${d}|${c}`,code:c,name:e.name,branch:e.branch,kind:'daily',ref:d,label:`رجل اليوم ${d.slice(5)} · ${g.split('|')[1]}`,amount:P.daily});}
  const R=ranks();R.qualified.slice(0,10).forEach((x,i)=>{const t=cupOf(i+1);out.push({id:`cup|${m}|${x.e.code}`,code:x.e.code,name:x.e.name,branch:x.e.branch,kind:'cup',ref:m,label:`${CUP_NAME[t]} (المركز ${i+1})`,amount:P[t]});});
  // فلوس الـ KPI لكل موظف (النقط لحد 500) — بتكمل آخر الشهر
  for(const x of R.rows)if(x.ms.kpiMoney>0)out.push({id:`kpi|${m}|${x.e.code}`,code:x.e.code,name:x.e.name,branch:x.e.branch,kind:'kpi',ref:m,label:`الـ KPI (${fmt(x.ms.kpiPts)} نقطة)`,amount:x.ms.kpiMoney});
  const mg=(S.ledger||[]).find(l=>l.id===`bonus|${m}|${l.username}`);if(mg&&P.manager)out.push({id:`manager|${m}|${mg.username}`,code:mg.username,name:mgrName(mg.username),branch:'مدير',kind:'manager',ref:m,label:'المدير المثالي',amount:P.manager});
  return out;
}
