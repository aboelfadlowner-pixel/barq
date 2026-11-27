// نجم أبو الفضل — التقييم الفني: البنود من 0 لـ 2 ونجمة المدير المباشر
const q25=x=>Math.round(x*4)/4;
// 4 بنود (0 لـ 2) ← نجمة لأقرب ربع — التقييم الناقص لسه من غير نجمة (القديم اللي فيه 5 بيتحسب بأول 4)
function crit(arr){if(!arr||arr.length<4)return null;const a=arr.slice(0,4);if(a.some(v=>v==null))return null;return q25(a.reduce((x,y)=>x+y,0)/8);}
const isFresh=e=>(S.settings.freshDepts||[]).includes(e?.dept);
// direct manager star: half branch manager + half shift manager; in fresh-food departments a third each with the fresh-food manager
// تقييم المديرين كل 4 أيام (1، 5، 9، … 29): التقييم بيكمّل لوحده على الأيام اللي بعده لحد ما المدير يعدّله
// (نفس najm_carry_fill / najm_carry_forward في الداتابيز). البصمة والهايجين والبونص كل يوم.
const RATE_EVERY=4,CARRY_FIELDS=['br','sh','fr','ops'];
const shiftDay=(d,n)=>{const t=new Date(`${d}T12:00:00`);t.setDate(t.getDate()+n);return ymd(t);};
const cycleStart=d=>{const n=+d.slice(8);return d.slice(0,8)+pad(n-(n-1)%RATE_EVERY);};
const cycleEnd=d=>{const s=+cycleStart(d).slice(8);const last=new Date(+d.slice(0,4),+d.slice(5,7),0).getDate();return d.slice(0,8)+pad(Math.min(last,s+RATE_EVERY-1));};
const isRateDay=d=>cycleStart(d)===d;
// التقييم الساري في يوم: {arr, carried, from} — from = اليوم اللي اتقيّم فيه فعلاً (null لو قبل الفترة المحمّلة)
// show=false (للحساب): التقييم بيكمّل بس على يوم ليه سجل للموظف (بصمة أو أي تقييم) — زي الداتابيز بالظبط
const hasRow=(D,code)=>!!(D.att?.[code]||D.full?.[code]||D.pub?.[code]||D.bonus?.[code]||['br','sh','fr','ops','hy'].some(f=>D[f]?.[code]));
function rateOf(d,f,code,show){
  const D=peekDay(d);const own=D[f]?.[code];
  if(!CARRY_FIELDS.includes(f))return {arr:own||null,carried:false,from:own?d:null};
  if(!own&&!show&&!hasRow(D,code))return {arr:null,carried:false,from:null};
  if(own&&!D.carry?.[code]?.includes(f))return {arr:own,carried:false,from:d};
  for(let i=1;i<=40;i++){const p=shiftDay(d,-i);const P=S.days[p];if(!P)continue;const a=P[f]?.[code];if(!a)continue;
    if(!P.carry?.[code]?.includes(f))return {arr:own||a,carried:true,from:p};}
  return own?{arr:own,carried:true,from:null}:{arr:null,carried:false,from:null};
}
const rateArr=(d,f,code)=>rateOf(d,f,code).arr;
const rateDone=(d,f,code)=>{const a=f==='hy'?peekDay(d).hy?.[code]:rateOf(d,f,code,true).arr;return f==='hy'?hyScore(a)!=null:crit(a)!=null&&(!['br','sh'].includes(f)||a[4]!=null);};
// التقييم محتاج مراجعة في الدورة دي: ماشي على تقييم من دورة قبل كده (المدير يعدّله أو يدوس تأكيد — مش إجباري)
const rateStale=(d,f,code)=>{if(!CARRY_FIELDS.includes(f))return false;const r=rateOf(d,f,code,true);return !!r.arr&&r.carried&&(r.from==null||r.from<cycleStart(d));};
function mgrStar(d,code,e){
  const st=peekDay(d).att[code];if(st==='abs'||st==='off')return {mgr:null,mc:false,parts:{br:null,sh:null,fr:null}};   // يوم غياب أو راحة: مفيش نجوم مديرين
  const b=crit(rateArr(d,'br',code)),s=crit(rateArr(d,'sh',code)),f=crit(rateArr(d,'fr',code));
  let mgr,mc;
  if(isFresh(e)){mgr=b==null&&f==null?null:q25(((b||0)+(f||0))/2);mc=b!=null&&f!=null;}   // البقاله: مدير الفرع + مدير الفريش بس (مدير الشيفت مالوش دعوة)
  else{mgr=b==null&&s==null?null:q25(((b||0)+(s||0))/2);mc=b!=null&&s!=null;}
  return {mgr,mc,parts:{br:b,sh:s,fr:f}};
}
