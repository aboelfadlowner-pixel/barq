// نجم أبو الفضل — المدير المثالي: تقييم التشغيل + أداء الفريق + التصويت، ورصيد السوق
// =========================================================
// دوري المديرين + سوق الانتقالات
//   نقاط المدير = تقييم مدير التشغيل اليومي (لحد 10) + رجل اليوم من فريقه + كؤوس فريقه − الكروت الحمرا
//   الرصيد (المحفظة) = نقاط الشهور المقفولة + مكافأة المدير المثالي − اللي اتصرف في السوق
// =========================================================
const MGR_DEF={rating:1,winner:20,gold:100,silver:60,bronze:40,top10:20,red:-10,bonus:50};
const mgrPts=()=>Object.assign({},MGR_DEF,S.settings.mgrPoints||{});
function inScopeOf(u,e){if(!u||!e||u.role==='ops')return false;if(!inUserBranch(u,e.branch))return false;if(u.role==='shift'&&!userGroups(u).includes(shiftGroup(e.shift)))return false;if(u.role==='fresh'&&!freshDepts(u).includes(e.dept))return false;return true;}
function managers(){return (S.mgrs||S.users||[]).filter(u=>u.role!=='ops'&&u.role!=='hygiene'&&u.role!=='headcashier'&&u.active!==false);}
const mgrName=un=>(S.mgrs||S.users||[]).find(u=>u.username===un)?.name||un;
// تقييم المدير الساري في يوم: آخر تقييم لحد اليوم ده — مدير التشغيل بيقيّم المديرين كل 4 أيام (دورات ثابتة 1-4 / 5-8 …) والتقييم بيكمّل لحد ما يتغيّر
function mgrCritAt(d,un){let best=null,bd='';for(const [day,o] of Object.entries(S.mgrCrit||{})){if(day<=d&&o[un]&&(bd===''||day>bd)){bd=day;best=o[un];}}return best?{arr:best,from:bd}:null;}
const mgrRated=(d,un)=>S.mgrDaily?.[d]?.[un]!=null||!!mgrCritAt(d,un);
function mgrDayPts(d,un){if(S.mgrDaily?.[d]?.[un]!=null)return S.mgrDaily[d][un];const c=mgrCritAt(d,un);return c?c.arr.reduce((x,y)=>x+(y||0),0):0;}
function mgrMonth(u,month,upto){
  const P=mgrPts();const days=monthDays(month,upto);let rating=0,wins=0,reds=0,cups=0;
  for(const d of days){rating+=mgrDayPts(d,u.username);for(const codes of Object.values(peekDay(d).winners||{}))for(const c of codes)if(inScopeOf(u,emp(c)))wins++;}
  const R=ranks();const team=activeEmps().filter(e=>inScopeOf(u,e));
  for(const e of team){const t=cupOf(prizeRank(e.code));if(t)cups+=P[t];reds+=cardCount(e.code,month,upto).r||0;}
  const medals=medalOf('m:'+u.username,month);   // 🏅 وسام برق لكل وسام +100 نقطة (من الإعدادات)
  return {rating,wins,cups,reds,medals,team:team.length,total:Math.round(rating*P.rating+wins*P.winner+cups+reds*P.red+medals*medalPts())};
}
const balanceOf=un=>(S.ledger||[]).filter(l=>l.username===un).reduce((a,l)=>a+(+l.points||0),0);
const MGR_W=()=>Object.assign({ops:50,team:25,votes:25},S.settings.mgrWeights||{});
const votesOf=un=>(LIVE?S.voteCounts?.[un]?.votes:(S.votes||[]).filter(v=>v.month===monthOf(DATE)&&v.manager===un).length)||0;
function mgrScore(u,month,upto){
  const days=monthDays(month,upto);let s=0,n=0;for(const d of days){const has=mgrRated(d,u.username);if(has){s+=mgrDayPts(d,u.username);n++;}}
  const ops=n?s/n/10*100:0;
  const team=activeEmps().filter(e=>inScopeOf(u,e)).map(e=>msOf(e).monthScore).filter(v=>v!=null);const teamPct=team.length?team.reduce((a,b)=>a+b,0)/team.length:0;
  const maxV=Math.max(0,...managers().map(x=>votesOf(x.username)));const v=votesOf(u.username);const votePct=maxV?v/maxV*100:0;
  const W=MGR_W();return {opsPct:ops,teamPct,votes:v,votePct,score:Math.round((ops*W.ops+teamPct*W.team+votePct*W.votes)/(W.ops+W.team+W.votes))};
}
const mgrEmp=u=>{const c=u?.emp_code||(S.mgrs||S.users||[]).find(x=>x.username===u?.username)?.emp_code;return c?emp(c):null;};
function mgrRanks(){const m=monthOf(DATE);return managers().map(u=>({u,...mgrMonth(u,m,DATE),...mgrScore(u,m,DATE),bal:balanceOf(u.username)})).sort((a,b)=>b.score-a.score||b.opsPct-a.opsPct);}
const mgrOfMonth=m=>(S.ledger||[]).find(l=>l.id===`bonus|${m}|${l.username}`);
