// نجم أبو الفضل — الكروت: الأخضر +10 · الأصفر −5 · الأحمر −20 · كل 3 صفر في الشهر = أحمر (والصفر التلاتة نقطهم بتتلغي)
// الكروت بتأثر على الـ KPI بس (مش التارجت ولا الكابتن). الحساب الرسمي في الداتابيز (najm_card_points) — ده نفس القاعدة للعرض والتجربة.
// حالة الكارت: pending = أحمر مستني التشغيل · approved = محسوب · rejected / cancelled / overturned = مش محسوب (بس بيفضل في السجل)
const cardStatus=c=>c.status||(c.approved?'approved':'pending');
const counted=c=>cardStatus(c)==='approved';
const CARD_STATUS={pending:['⏳ مستني التشغيل','b-gray'],approved:['محسوب','b-green'],rejected:['مرفوض','b-red'],cancelled:['اتلغى','b-gray'],overturned:['اتلغى بعد اعتراض','b-blue']};
function cardsOf(code,from,to,all){return S.cards.filter(c=>c.code===code&&c.date>=from&&c.date<=to&&(all||counted(c)));}
function cardCount(code,month,upto){if(LIVE&&S.cardCounts)return S.cardCounts[code]||{y:0,r:0,g:0};const L=cardsOf(code,month+'-01',upto||month+'-31');return {y:L.filter(c=>c.color==='yellow').length,r:L.filter(c=>c.color==='red').length,g:L.filter(c=>c.color==='green').length};}
function cardPts(c){
  if(c.pts!=null)return c.pts;                       // computed by the database
  const k=S.settings.cards;const n=Math.max(1,k.yellowsToRed||3);
  const extraRed=Math.floor(c.y/n);const y=c.y%n;
  return (c.r+extraRed)*k.red+y*k.yellow+c.g*k.green;
}
// كروت يوم واحد (لرجل اليوم): من الداتابيز (أعداد بس) أو من الكروت المحمّلة
function dayCards(d,code){
  const p=S.dayCards?.[d]?.[code];if(p)return p;
  const L=(S.cards||[]).filter(c=>c.code===code&&c.date===d&&counted(c));
  return {y:L.filter(c=>c.color==='yellow').length,r:L.filter(c=>c.color==='red').length,g:L.filter(c=>c.color==='green').length};
}
const badCardOn=(d,code)=>{const c=dayCards(d,code);return c.y>0||c.r>0;};
const redOn=(d,code)=>dayCards(d,code).r>0;
function dayCardPts(d,code){const k=S.settings.cards;const c=dayCards(d,code);return c.g*k.green+c.y*k.yellow+c.r*k.red;}
