// نجم أبو الفضل — رجل اليوم: البيطاش 4 (2 صبح + 2 ليل) · عين شمس 2 (1 + 1) · البين بيتحسب مع الليل
// المرشح لازم يبقى كويس في الاتنين: نجوم اليوم من minStarsWinner (4) وطالع، ومفيش كارت أصفر أو أحمر يومها.
// الترتيب = النجوم + نقط كروت اليوم ÷ 10 (الكارت الأخضر +10 = نجمة زيادة). مفيش سبب مكتوب — الأساس النجوم والكروت.
const SHIFT_GROUPS=['Morning','Night'];
const GROUP_NAME={Morning:'الصبح',Night:'الليل + البين'};
const shiftGroup=sh=>sh==='Night'||sh==='Between'?'Night':'Morning';
const groupKey=e=>`${e.branch}|${shiftGroup(e.shift)}`;
function winnersFor(branch,group){const w=S.settings.winnersBy?.[branch];return w&&w[group]!=null?+w[group]:+(S.settings.winnersPerShift||0);}
const dayValue=(d,x)=>x.s.total+dayCardPts(d,x.e.code)/10;
function rankGroup(d,list){
  const min=+(S.settings.minStarsWinner??4);
  return list.map(e=>({e,s:score(d,e.code)}))
    .filter(x=>x.s.total!=null&&x.s.st!=='abs'&&x.s.st!=='off'&&x.s.total>=min&&!badCardOn(d,x.e.code))
    .sort((a,b)=>dayValue(d,b)-dayValue(d,a)||b.s.total-a.s.total||(b.s.att||0)-(a.s.att||0)||(b.s.ops||0)-(a.s.ops||0)||(b.s.mgr||0)-(a.s.mgr||0));
}
function isWinner(d,code){return Object.values(peekDay(d).winners||{}).some(a=>a.includes(code));}
