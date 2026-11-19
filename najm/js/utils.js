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
