// نجم أبو الفضل — نجوم اليوم: الأساسي من 5 (البصمة 2 + المدير المباشر 1 + التشغيل ½ + الهايجين 1 + الصلاة ½) + التصرف المثالي ½ Bonus منفصل فوقه
// (نفس قواعد najm_score في الداتابيز)
// ---------- scoring (same rules as the database function najm_score) ----------
function day(d){const D=S.days[d]||(S.days[d]={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},pray:{},bonus:{},winners:{},pub:{},full:{}});D.carry||(D.carry={});D.pray||(D.pray={});return D;}
function mark(D,code){(D.full||(D.full={}))[code]=1;}
const EMPTY_DAY={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},pray:{},bonus:{},winners:{},carry:{}};
function peekDay(d){return S.days[d]||EMPTY_DAY;}
function score(d,code){
  const D=peekDay(d);const st=D.att[code];const e=emp(code);
  const P=D.pub?.[code];
  // employees (no login) only get the day's total from the database, not the details
  if(P&&!D.full?.[code])return {st:P.att,att:attStar(P.att),mgr:null,ops:null,parts:{},fresh:isFresh(e),bonus:P.bonus?.5:0,base:P.total==null?null:P.total-(P.bonus?.5:0),total:P.total,complete:P.complete,pub:true};
  const att=attStar(st);                                   // البصمة
  const {mgr,mc,parts}=mgrStar(d,code,e);                  // المدير المباشر (مكمّل من آخر تقييم)
  const oc=st==='abs'||st==='off'?null:crit(rateArr(d,'ops',code));const o=oc==null?null:oc*OPS_W;   // مدير التشغيل: نص نجمة
  const pv=D.pray?.[code];const pr=st==='abs'||st==='off'||pv==null?null:pv*PRAY_STAR;   // الصلاة: نص نجمة كل يوم
  const h=hyStar(D,code);                                  // الهايجين
  const bonus=D.bonus[code]?.v||0;                         // التصرف المثالي
  const any=att!=null||mgr!=null||o!=null||h!=null||pr!=null||bonus>0;
  const base=any?Math.min(5,(att||0)+(mgr||0)+(o||0)+(h||0)+(pr||0)):null;   // الأساسي من 5
  const total=any?base+bonus:null;                                     // + ½ مثالي (Bonus)
  return {st,att,mgr,ops:o,hy:h,pray:pr,parts,fresh:isFresh(e),bonus,base,total,complete:att!=null&&mc&&o!=null&&pr!=null};
}
