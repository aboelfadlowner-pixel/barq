// نجم أبو الفضل — تاب رجل اليوم
// ---------- Man of the day ----------
function vDay(){
  const D=peekDay(DATE);const bs=F.branch?[F.branch]:branches();const N=S.settings.finalists,W=S.settings.winnersPerShift;
  let html=`<div class="sec-title"><h2>🏆 رجل اليوم — ${esc(DATE)}</h2></div>
    <div class="chips" style="margin-bottom:12px">${['',...branches()].map(b=>`<button class="chip ${F.branch===b?'on':''}" onclick="F.branch='${esc(b)}';render()">${b?esc(b):'الكل'}</button>`).join('')}</div>`;
  for(const b of bs){
    let inner='';
    for(const sh of Object.values(SH)){
      const L=activeEmps().filter(e=>e.branch===b&&e.shift===sh);if(!L.length)continue;
      const ranked=rankGroup(DATE,L);const fin=ranked.slice(0,N);const k=`${b}|${sh}`;const conf=D.winners[k];
      inner+=`<div class="card"><div class="sec-title" style="margin:0 0 6px"><b>شيفت ${sh}</b>${conf?'<span class="badge b-gold">✔ اتعلن</span>':'<span class="badge b-gray">لسه</span>'}</div>
        ${conf?`<div class="podium" style="margin-bottom:8px">${conf.map(c=>{const e=emp(c);if(!e)return'';return `<div class="winner-box" style="cursor:pointer" onclick="openEmp('${c}')"><div class="crown">👑</div>${ava(e,'win xl').replace('class="ava','style="margin:0 auto" class="ava')}<div class="emp-name">${esc(e.name)}</div><div class="small muted">${esc(e.job)} · كود ${esc(e.code)}</div>${starsHTML(score(DATE,c).total,'lg')}<div class="badge b-green" style="margin-top:6px">🏆 رجل اليوم${cash()?' · '+fmt(prizes().daily)+' ج':''}</div></div>`;}).join('')}</div>`:''}
        <div class="small muted">التصفيات (أعلى ${N}):</div>
        ${fin.length?`<table><tbody>${fin.map((x,i)=>`<tr><td><span class="rank ${i===0?'r1':''}">${i+1}</span></td><td style="cursor:pointer" onclick="openEmp('${x.e.code}')"><b>${esc(x.e.name)}</b><div class="small muted">${esc(x.e.dept)}</div></td><td>${starsHTML(x.s.total)}<div class="small"><b>${fmt(x.s.total,2)}</b>${x.s.complete||!isMgr()?'':' <span class="badge b-gray">تقييم ناقص</span>'}</div></td>
          ${isOps()?`<td><input type="checkbox" class="wchk" data-k="${esc(k)}" value="${x.e.code}" ${(conf||fin.slice(0,W).map(y=>y.e.code)).includes(x.e.code)?'checked':''}></td>`:''}</tr>`).join('')}</tbody></table>
          ${isOps()?`<div class="row" style="margin-top:8px"><button class="btn gold sm" onclick="confirmWinners('${esc(k)}')">👑 اعتماد (حتى ${W})</button>${conf?`<button class="btn sm red" onclick="clearWinners('${esc(k)}')">إلغاء</button>`:''}</div>`:''}`
          :'<div class="empty small">مفيش تقييمات لسه</div>'}
      </div>`;
    }
    html+=`<h3 style="margin-top:14px">${esc(b)}</h3><div class="grid g-3">${inner}</div>`;
  }
  return html;
}
function confirmWinners(k){
  const codes=[...document.querySelectorAll('.wchk')].filter(c=>c.dataset.k===k&&c.checked).map(c=>c.value);
  if(!codes.length){toast('اختار موظف واحد على الأقل');return;}
  if(codes.length>S.settings.winnersPerShift){toast(`الحد الأقصى ${S.settings.winnersPerShift}`);return;}
  day(DATE).winners[k]=codes;save();render();push('winners',{day:DATE,gkey:k},codes);toast('🎉 اتعلن رجل اليوم');
}
async function clearWinners(k){if(!await askConfirm('إلغاء الإعلان؟'))return;delete day(DATE).winners[k];save();render();push('winners',{day:DATE,gkey:k},null);}
