// نجم أبو الفضل — نجوم اليوم: الأساسي من 5 (البصمة 2 + المدير المباشر 1 + التشغيل 1 + الهايجين 1) + التصرف المثالي ½ Bonus منفصل فوقه
// (نفس قواعد najm_score في الداتابيز)
// ---------- scoring (same rules as the database function najm_score) ----------
function day(d){const D=S.days[d]||(S.days[d]={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},bonus:{},winners:{},pub:{},full:{}});D.carry||(D.carry={});return D;}
function mark(D,code){(D.full||(D.full={}))[code]=1;}
const EMPTY_DAY={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},bonus:{},winners:{},carry:{}};
function peekDay(d){return S.days[d]||EMPTY_DAY;}
function score(d,code){
  const D=peekDay(d);const st=D.att[code];const e=emp(code);
  const P=D.pub?.[code];
  // employees (no login) only get the day's total from the database, not the details
  if(P&&!D.full?.[code])return {st:P.att,att:attStar(P.att),mgr:null,ops:null,parts:{},fresh:isFresh(e),bonus:P.bonus?.5:0,base:P.total==null?null:P.total-(P.bonus?.5:0),total:P.total,complete:P.complete,pub:true};
  const att=attStar(st);                                   // البصمة
  const {mgr,mc,parts}=mgrStar(d,code,e);                  // المدير المباشر (مكمّل من آخر تقييم)
  const o=st==='abs'||st==='off'?null:crit(rateArr(d,'ops',code));   // مدير التشغيل
  const h=hyStar(D,code);                                  // الهايجين
  const bonus=D.bonus[code]?.v||0;                         // التصرف المثالي
  const any=att!=null||mgr!=null||o!=null||h!=null||bonus>0;
  const base=any?Math.min(5,(att||0)+(mgr||0)+(o||0)+(h||0)):null;   // الأساسي من 5
  const total=any?base+bonus:null;                                     // + ½ مثالي (Bonus)
  return {st,att,mgr,ops:o,hy:h,parts,fresh:isFresh(e),bonus,base,total,complete:att!=null&&mc&&o!=null};
}
