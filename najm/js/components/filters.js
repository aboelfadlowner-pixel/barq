// نجم أبو الفضل — فلتر الفرع والشيفت والقسم والبحث
// الشيفت والقسم أزرار واضحة وجنب كل واحد عدد موظفينه (عشان المقيّم يلاقي اللي محتاجه بسرعة)
const SH_NAME={Morning:'الصبح',Night:'الليل',Between:'Between'};
function filterBar(opts={}){
  const bs=opts.scoped&&USER?.branch?[USER.branch]:branches();
  const q=norm(F.q);
  const base=activeEmps().filter(e=>(!opts.scoped||inScope(e))&&(!F.branch||e.branch===F.branch)&&(!q||norm(e.name).includes(q)||e.code===F.q.trim()));
  const shifts=Object.values(SH).filter(s=>base.some(e=>e.shift===s));
  const byShift=base.filter(e=>!F.shift||e.shift===F.shift);
  const depts=[...new Set(byShift.map(e=>e.dept).filter(Boolean))].sort();
  if(F.dept&&!depts.includes(F.dept))F.dept='';
  const n=(L,f)=>L.filter(f).length;
  const chip=(on,label,cnt,click)=>`<button class="chip ${on?'on':''}" onclick="${click}">${label} <span class="cnt-sm">${fmt(cnt)}</span></button>`;
  return `<div style="margin-bottom:12px">
    <div class="row" style="margin-bottom:8px">
      <div class="chips">${(bs.length>1?['',...bs]:bs).map(b=>`<button class="chip ${F.branch===b?'on':''}" onclick="F.branch='${esc(b)}';F.dept='';render()">${b?esc(b):'الكل'}</button>`).join('')}</div>
      <input class="inp" id="qbox" placeholder="🔍 اسم أو كود" value="${esc(F.q)}" oninput="F.q=this.value;clearTimeout(window._qt);window._qt=setTimeout(()=>{render();const i=$('#qbox');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)">
    </div>
    ${opts.shift!==false&&shifts.length>1?`<div class="filter-row"><span class="filter-lbl">الشيفت</span><div class="chips">${chip(!F.shift,'الكل',base.length,"F.shift='';render()")}${shifts.map(s=>chip(F.shift===s,SH_NAME[s]||s,n(base,e=>e.shift===s),`F.shift='${s}';render()`)).join('')}</div></div>`:''}
    ${depts.length>1?`<div class="filter-row"><span class="filter-lbl">القسم</span><div class="chips scroll">${chip(!F.dept,'الكل',byShift.length,"F.dept='';render()")}${depts.map(d=>chip(F.dept===d,esc(d),n(byShift,e=>e.dept===d),`F.dept='${esc(d)}';render()`)).join('')}</div></div>`:''}
  </div>`;
}
function filtered(scoped){
  const q=norm(F.q);
  return activeEmps().filter(e=>(!scoped||inScope(e))&&(!F.branch||e.branch===F.branch)&&(!F.shift||e.shift===F.shift)&&(!F.dept||e.dept===F.dept)&&(!q||norm(e.name).includes(q)||e.code===F.q.trim()));
}
