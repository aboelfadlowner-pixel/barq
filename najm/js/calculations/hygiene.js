// نجم أبو الفضل — الهايجين (اللبس): التيشرت إجباري على الكل، والإيبرون والكاسكيت والأفرهيد والجلافز حسب القسم.
// كل بند مطلوب من 0 لـ 2، والبند اللي مش مطلوب بيتسجل −1 ومبيدخلش في الحساب.
// النجمة = مجموع البنود المطلوبة ÷ (2 × عددها) — نفس najm_hy في الداتابيز
function hyItems(e){const L=S.settings.hyItems?.[e?.dept];return [...new Set([0,...(Array.isArray(L)?L:[])])].filter(i=>i>=0&&i<5).sort();}
function hyScore(a){if(!a||a.length<5||a.some(v=>v==null))return null;const v=a.filter(x=>x>=0);if(!v.length)return null;return q25(v.reduce((x,y)=>x+y,0)/(2*v.length));}
const hyStar=(D,code)=>hyScore(D.hy?.[code]);
// شكل التقييم الفاضي: البنود المطلوبة null، والباقي −1
const hyBlank=e=>{const req=hyItems(e);return [0,1,2,3,4].map(i=>req.includes(i)?null:HY_NA);};
