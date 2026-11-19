// نجم أبو الفضل — تاب رجل اليوم
// ---------- Man of the day ----------
function vDay(){
  const D=peekDay(DATE);const bs=F.branch?[F.branch]:branches();const N=S.settings.finalists;const min=+(S.settings.minStarsWinner??4);
  let html=`<div class="sec-title"><h2>🏆 رجل اليوم — ${esc(DATE)}</h2></div>
    <div class="chips" style="margin-bottom:12px">${['',...branches()].map(b=>`<button class="chip ${F.branch===b?'on':''}" onclick="F.branch='${esc(b)}';render()">${b?esc(b):'الكل'}</button>`).join('')}</div>
    <div class="lock" style="margin-bottom:12px">الاختيار بالنجوم والكروت مع بعض: لازم ${fmt(min)} نجوم أو أكتر، ومفيش كارت أصفر أو أحمر في اليوم ده. الترتيب = النجوم + الكارت الأخضر (نجمة زيادة). البين بيتحسب مع الليل.</div>`;
  for(const b of bs){
    let inner='';
    for(const g of SHIFT_GROUPS){
      const W=winnersFor(b,g);
      const L=activeEmps().filter(e=>e.branch===b&&shiftGroup(e.shift)===g);if(!L.length)continue;
      const k=`${b}|${g}`;
      if(!W){inner+=`<div class="card"><b>شيفت ${GROUP_NAME[g]}</b><div class="small muted" style="margin-top:6px">مفيش رجل يوم للشيفت ده (من الإعدادات)</div></div>`;continue;}
      const ranked=rankGroup(DATE,L);const fin=ranked.slice(0,Math.max(N,W));const conf=D.winners[k];
      inner+=`<div class="card"><div class="sec-title" style="margin:0 0 6px"><b>شيفت ${GROUP_NAME[g]} — ${fmt(W)} ${W>1?'رجالة':'راجل'} يوم</b>${conf?'<span class="badge b-gold">✔ اتعلن</span>':'<span class="badge b-gray">لسه</span>'}</div>
        ${conf?`<div class="podium" style="margin-bottom:8px">${conf.map(c=>{const e=emp(c);if(!e)return'';return `<div class="winner-box" style="cursor:pointer" onclick="openEmp('${c}')"><div class="crown">👑</div>${ava(e,'win xl').replace('class="ava','style="margin:0 auto" class="ava')}<div class="emp-name">${esc(e.name)}</div><div class="small muted">${esc(e.job)} · كود ${esc(e.code)}</div>${starsHTML(score(DATE,c).total,'lg')}<div class="badge b-green" style="margin-top:6px">🏆 رجل اليوم${cash()?' · '+fmt(prizes().daily)+' ج':''}</div></div>`;}).join('')}</div>`:''}
        <div class="small muted">المرشحين (${fmt(min)} نجوم وطالع ومن غير كروت صفرا أو حمرا):</div>
        ${fin.length?`<table><tbody>${fin.map((x,i)=>{const cp=dayCardPts(DATE,x.e.code);return `<tr><td><span class="rank ${i<W?'r1':''}">${i+1}</span></td><td style="cursor:pointer" onclick="openEmp('${x.e.code}')"><b>${esc(x.e.name)}</b><div class="small muted">${esc(x.e.dept)} · ${esc(x.e.shift)}</div></td><td>${starsHTML(x.s.total)}<div class="small"><b>${fmt(x.s.total,2)}</b>${cp>0?` <span class="badge b-green">🟩 +${fmt(cp)}</span>`:''}${x.s.complete||!isMgr()?'':' <span class="badge b-gray">تقييم ناقص</span>'}</div></td>
          ${isOps()?`<td><input type="checkbox" class="wchk" data-k="${esc(k)}" value="${x.e.code}" ${(conf||fin.slice(0,W).map(y=>y.e.code)).includes(x.e.code)?'checked':''}></td>`:''}</tr>`;}).join('')}</tbody></table>
          ${isOps()?`<div class="row" style="margin-top:8px"><button class="btn gold sm" onclick="confirmWinners('${esc(k)}')">👑 اعتماد (${fmt(W)})</button>${conf?`<button class="btn sm red" onclick="clearWinners('${esc(k)}')">إلغاء</button>`:''}</div>`:''}`
          :'<div class="empty small">مفيش مرشحين لسه</div>'}
      </div>`;
    }
    if(inner)html+=`<h3 style="margin-top:14px">${esc(b)}</h3><div class="grid g-3">${inner}</div>`;
  }
  return html;
}
function confirmWinners(k){
  const codes=[...document.querySelectorAll('.wchk')].filter(c=>c.dataset.k===k&&c.checked).map(c=>c.value);
  const [b,g]=k.split('|');const W=winnersFor(b,g);
  if(!codes.length){toast('اختار موظف واحد على الأقل');return;}
  if(codes.length>W){toast(`الحد الأقصى ${W}`);return;}
  day(DATE).winners[k]=codes;save();render();push('winners',{day:DATE,gkey:k},codes);toast('🎉 اتعلن رجل اليوم');
}
async function clearWinners(k){if(!await askConfirm('إلغاء الإعلان؟'))return;delete day(DATE).winners[k];save();render();push('winners',{day:DATE,gkey:k},null);}
