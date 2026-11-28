// نجم أبو الفضل — أدوات عامة: التواريخ والأرقام والنصوص والبحث عن الموظف
// ---------- helpers ----------
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monthOf=d=>d.slice(0,7);
const daysInMonth=m=>new Date(+m.slice(0,4),+m.slice(5,7),0).getDate();
const monthDays=(m,upto)=>{const n=daysInMonth(m);const out=[];for(let i=1;i<=n;i++){const d=`${m}-${pad(i)}`;if(upto&&d>upto)break;out.push(d);}return out;};
const prevMonth=m=>{let y=+m.slice(0,4),mo=+m.slice(5,7)-1;if(mo<1){mo=12;y--;}return `${y}-${pad(mo)}`;};
const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const monthName=m=>`${MONTHS[+m.slice(5,7)-1]} ${m.slice(0,4)}`;
const norm=s=>String(s??'').replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim().toLowerCase();
const fmt=(n,d=0)=>n==null||isNaN(n)?'—':Number(n).toLocaleString('ar-EG',{maximumFractionDigits:d});
const uid=()=>Math.random().toString(36).slice(2,10);
const emp=code=>S.employees.find(e=>e.code===String(code));
const activeEmps=()=>S.employees.filter(e=>e.active);
const deptKey=(b,d)=>`${b}|${d}`;

// «عرض المزيد»: القوايم الطويلة بتتعرض 30 30 بدل ما الصفحة تطوّل. المفتاح فيه الفلتر عشان أي فلتر جديد يبدأ من الأول
const PAGE_N=30;let PAGES={};
const pageKey=n=>n+'|'+(typeof F!=='undefined'?JSON.stringify(F):'')+'|'+(typeof DATE!=='undefined'?DATE:'');
function pageList(n,list){const k=pageKey(n),c=PAGES[k]||PAGE_N;return {items:list.slice(0,c),left:Math.max(0,list.length-c),key:k};}
const moreBtn=(p,cols)=>p.left>0?(cols?`<tr><td colspan="${cols}" style="text-align:center">`:'<div style="text-align:center;margin:14px 0;grid-column:1/-1">')+`<button class="btn" onclick="showMore('${encodeURIComponent(p.key).replace(/'/g,'%27')}')">⬇️ عرض المزيد (${p.left} متبقي)</button>`+(cols?'</td></tr>':'</div>'):'';
function showMore(k){k=decodeURIComponent(k);const y=window.scrollY;PAGES[k]=(PAGES[k]||PAGE_N)+PAGE_N;render();window.scrollTo(0,y);}
