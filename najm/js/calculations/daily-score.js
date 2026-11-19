// نجم أبو الفضل — نجوم اليوم من 5: البصمة + المدير المباشر + التشغيل + الهايجين + التصرف المثالي (نفس قواعد najm_score في الداتابيز)
// ---------- scoring (same rules as the database function najm_score) ----------
function day(d){return S.days[d]||(S.days[d]={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},bonus:{},winners:{},pub:{},full:{}});}
function mark(D,code){(D.full||(D.full={}))[code]=1;}
const EMPTY_DAY={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},bonus:{},winners:{}};
function peekDay(d){return S.days[d]||EMPTY_DAY;}
function score(d,code){
  const D=peekDay(d);const st=D.att[code];const e=emp(code);
  const P=D.pub?.[code];
  // employees (no login) only get the day's total from the database, not the details
  if(P&&!D.full?.[code])return {st:P.att,att:attStar(P.att),mgr:null,ops:null,parts:{},fresh:isFresh(e),bonus:P.bonus?.5:0,total:P.total,complete:P.complete,pub:true};
  const att=attStar(st);                                   // البصمة
  const {mgr,mc,parts}=mgrStar(D,code,e);                  // المدير المباشر
  const o=crit(D.ops[code]);                               // مدير التشغيل
  const h=hyStar(D,code);                                  // الهايجين
  const bonus=D.bonus[code]?.v||0;                         // التصرف المثالي
  const any=att!=null||mgr!=null||o!=null||h!=null||bonus>0;
  const total=any?Math.min(5,(att||0)+(mgr||0)+(o||0)+(h||0)+bonus):null;
  return {st,att,mgr,ops:o,hy:h,parts,fresh:isFresh(e),bonus,total,complete:att!=null&&mc&&o!=null};
}
