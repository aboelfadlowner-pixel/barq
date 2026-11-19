// نجم أبو الفضل — الكروت: الأصفر والأحمر والأخضر ونقطها
// cards
function cardsOf(code,from,to,all){return S.cards.filter(c=>c.code===code&&c.date>=from&&c.date<=to&&(all||c.approved));}
function cardCount(code,month,upto){if(LIVE&&S.cardCounts)return S.cardCounts[code]||{y:0,r:0,g:0};const L=cardsOf(code,month+'-01',upto||month+'-31');return {y:L.filter(c=>c.color==='yellow').length,r:L.filter(c=>c.color==='red').length,g:L.filter(c=>c.color==='green').length};}
function cardPts(c){const k=S.settings.cards;const extraRed=Math.floor(c.y/(k.yellowsToRed||2));const y=c.y%(k.yellowsToRed||2);return (c.r+extraRed)*k.red+y*k.yellow+c.g*k.green;}
const redOn=(d,code)=>(S.cards||[]).some(c=>c.code===code&&c.date===d&&c.color==='red'&&c.approved);
