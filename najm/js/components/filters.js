// نجم أبو الفضل — فلتر الفرع والشيفت والقسم والبحث
function filterBar(opts={}){
  const bs=opts.scoped&&USER?.branch?[USER.branch]:branches();
  return `<div class="row" style="margin-bottom:12px">
    <div class="chips">${(bs.length>1?['',...bs]:bs).map(b=>`<button class="chip ${F.branch===b?'on':''}" onclick="F.branch='${esc(b)}';F.dept='';render()">${b?esc(b):'الكل'}</button>`).join('')}</div>
    ${opts.shift!==false?`<select class="inp" onchange="F.shift=this.value;render()"><option value="">كل الشيفتات</option>${Object.values(SH).map(s=>`<option ${F.shift===s?'selected':''}>${s}</option>`).join('')}</select>`:''}
    <select class="inp" onchange="F.dept=this.value;render()"><option value="">كل الأقسام</option>${deptsOf(F.branch).map(d=>`<option ${F.dept===d?'selected':''}>${esc(d)}</option>`).join('')}</select>
    <input class="inp" id="qbox" placeholder="🔍 اسم أو كود" value="${esc(F.q)}" oninput="F.q=this.value;clearTimeout(window._qt);window._qt=setTimeout(()=>{render();const i=$('#qbox');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)">
  </div>`;
}
function filtered(scoped){
  const q=norm(F.q);
  return activeEmps().filter(e=>(!scoped||inScope(e))&&(!F.branch||e.branch===F.branch)&&(!F.shift||e.shift===F.shift)&&(!F.dept||e.dept===F.dept)&&(!q||norm(e.name).includes(q)||e.code===F.q.trim()));
}
