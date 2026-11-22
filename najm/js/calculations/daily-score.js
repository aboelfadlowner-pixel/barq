// نجم أبو الفضل — نجوم اليوم: الأساسي من 5 (البصمة 2 + المدير المباشر 1 + الهايجين 1 + صلاة المدير ½ + الكاميرات ½) + التصرف المثالي ½ Bonus منفصل فوقه
// (نفس قواعد najm_score في الداتابيز)
// ---------- scoring (same rules as the database function najm_score) ----------
function day(d){const D=S.days[d]||(S.days[d]={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},pray:{},brk:{},bonus:{},winners:{},pub:{},full:{}});D.carry||(D.carry={});D.pray||(D.pray={});D.brk||(D.brk={});return D;}
function mark(D,code){(D.full||(D.full={}))[code]=1;}
const EMPTY_DAY={att:{},attTime:{},br:{},sh:{},fr:{},ops:{},hy:{},pray:{},brk:{},bonus:{},winners:{},carry:{}};
function peekDay(d){return S.days[d]||EMPTY_DAY;}
function score(d,code){
  const D=peekDay(d);const st=D.att[code];const e=emp(code);
  const P=D.pub?.[code];
  // employees (no login) only get the day's total from the database, not the details
  if(P&&!D.full?.[code])return {st:P.att,att:attStar(P.att),mgr:null,ops:null,parts:{},fresh:isFresh(e),bonus:P.bonus?.5:0,base:P.total==null?null:P.total-(P.bonus?.5:0),total:P.total,complete:P.complete,pub:true};
  const att=attStar(st);                                   // البصمة
  const {mgr,mc,parts}=mgrStar(d,code,e);                  // المدير المباشر (مكمّل من آخر تقييم)
  const off=st==='abs'||st==='off';const o=null;   // مدير التشغيل مبقاش بيقيّم الموظفين (بيدي وسام برق)
  const lv=prayLevel(d,code);const pr=off||lv==null?null:lv*CAM_Q;   // صلاة المدير (كل 4 أيام): ملتزم ½ · بيقطع ¼ · مبيصليش 0
  const pv=D.pray?.[code],bv=D.brk?.[code];const cm=off||(pv==null&&bv==null)?null:(pv||0)*CAM_Q+(bv||0)*CAM_Q;   // الكاميرات: الصلاة ¼ + البريك ¼
  const h=hyStar(D,code);                                  // الهايجين
  const bonus=D.bonus[code]?.v||0;                         // التصرف المثالي
  const any=att!=null||mgr!=null||h!=null||pr!=null||cm!=null||bonus>0;
  const base=any?Math.min(5,(att||0)+(mgr||0)+(h||0)+(pr||0)+(cm||0)):null;   // الأساسي من 5
  const total=any?base+bonus:null;                                     // + ½ مثالي (Bonus)
  return {st,att,mgr,ops:o,hy:h,pray:pr,prayLvl:lv,cam:cm,pv,bv,parts,fresh:isFresh(e),bonus,base,total,complete:att!=null&&mc&&pr!=null&&pv!=null&&bv!=null};
}

// صلاة المدير في اليوم ده: قرار مدير التشغيل لو في تعارض اتراجع (رأي الكاميرات)، وإلا البند الخامس عند مدير الشيفت ثم الفرع
function prayLevel(d,code){const rv=(S.prayReviews||{})[code+'|'+cycleStart(d)];if(rv?.decision==='cams'&&rv.level!=null)return +rv.level;
  const sh=rateArr(d,'sh',code),br=rateArr(d,'br',code);return sh?.[4]??br?.[4]??null;}
