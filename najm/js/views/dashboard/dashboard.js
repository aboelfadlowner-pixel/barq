// نجم أبو الفضل — تاب لوحة الفروع
// ---------- captain ribbon ----------
function ribbonHTML(bs){
  const m=monthOf(DATE);const caps=captainsIn(m,DATE,e=>bs.includes(e.branch));
  if(!caps.length) return '';
  const g={};for(const c of caps){const k=c.branch+'|'+c.sku;(g[k]||(g[k]={...c,people:[]})).people.push(c);}
  return `<div class="ribbon"><h3>🎗️ شارة الكابتن — مركزين الشهر ده على:</h3><div class="cap-items">${Object.values(g).map(c=>`
    <div class="cap"><div class="row" style="gap:6px;flex-wrap:nowrap"><span class="cap-c">C</span><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</b></div>
    <div class="small" style="opacity:.9;margin:2px 0 6px">${esc(c.branch)} · ${c.people.map(p=>esc(emp(p.code)?.name.split(' ')[0])).join('، ')}</div>
    ${barHTML(c.pct)}<div class="row small" style="justify-content:space-between;margin-top:4px"><span>${fmt(c.sold,1)} / ${fmt(c.target,1)} (${fmt(c.pct)}%)</span><b>⭐ ${fmt(c.points)} نقطة لكل كابتن</b></div></div>`).join('')}</div></div>`;
}

// ---------- Dashboard ----------
function empCard(e){
  const R=ranks();const s=score(DATE,e.code);const ms=msOf(e);const t=ms.target;const winToday=isWinner(DATE,e.code);
  const rb=R.branch[e.code];
  return `<div class="card emp" onclick="openEmp('${e.code}')">
    <div class="emp-top">${ava(e,winToday?'win':'')}
      <div style="min-width:0"><div class="emp-name">${esc(e.name)} ${winToday?'🏆':''}${e.video?' <span title="فيديو">🎬</span>':''}</div>
      <div class="small muted">${esc(e.job||'—')} · ${esc(e.dept||'')}</div>
      <div class="small muted">${esc(e.shift||'')}</div></div></div>
    <div class="kv"><span>النهارده</span>${s.total!=null?`<span>${starsHTML(s.total)} <b>${fmt(s.total,2)}</b></span>`:'<span>لم يُقيَّم</span>'}</div>
    <div class="kv"><span>تقييم الشهر</span><span>${ms.avg!=null?`${starsHTML(ms.avg)} <b>${kpiTxt(ms)}</b>`:'—'}</span></div>
    <div class="kv"><span>التارجت</span><b>${t&&t.pct!=null?fmt(t.pct)+'%':'—'}${t?.empPoints!=null?' · '+fmt(t.empPoints)+' نقطة':''}</b></div>
    ${t&&t.pct!=null?barHTML(t.pct,t.pace):''}
    <div class="row small" style="gap:6px">${(f=>f.ovr!=null?`<span class="ovr-pill ${futEdition(e,f)}" title="التقييم المجمّع">${f.ovr}</span>`:'')(futStats(e))}${rb?`<span class="badge b-blue">#${fmt(rb)} في الفرع</span>`:''}${ms.wins?`<span class="badge b-gold">🏆 ${fmt(ms.wins)}</span>`:''}${t?.capPts?`<span class="badge b-purple">C +${fmt(t.capPts)}</span>`:''}${cardsHTML(ms.cards)}</div>
  </div>`;
}
function honorBoard(bs){
  const D=peekDay(DATE);const R=ranks();
  const win=[];for(const[k,codes]of Object.entries(D.winners||{})){if(!bs.some(b=>k.startsWith(b+'|')))continue;codes.forEach(c=>{const e=emp(c);if(e)win.push({e,sh:k.split('|')[1]});});}
  const top=R.rows.filter(x=>bs.includes(x.e.branch)).slice(0,3);
  return `<div class="card honor" style="margin-bottom:14px"><div class="grid g-2">
    <div><h3>🏆 رجال النهارده</h3>${win.length?`<div class="podium" style="justify-content:flex-start">${win.map(x=>`<div class="winner-box" style="cursor:pointer;padding:10px" onclick="openEmp('${x.e.code}')"><div class="crown" style="font-size:20px">👑</div>${ava(x.e,'win').replace('class="ava','style="margin:0 auto" class="ava')}<div class="emp-name small">${esc(x.e.name)}</div><div class="small muted">${esc(x.e.branch)} · ${esc(x.sh)}</div>${starsHTML(score(DATE,x.e.code).total)}</div>`).join('')}</div>`:'<div class="small muted">لم يُعلن بعد</div>'}</div>
    <div><h3>👑 متصدرين ${monthName(monthOf(DATE))}</h3>${top.map((x,i)=>`<div class="row" style="margin:6px 0;cursor:pointer;flex-wrap:nowrap" onclick="openEmp('${x.e.code}')"><span style="font-size:20px">${['🥇','🥈','🥉'][i]}</span>${ava(x.e,'sm')}<div style="flex:1;min-width:0"><b>${esc(x.e.name)}</b><div class="small muted">${esc(x.e.branch)} · 🏆 ${fmt(x.ms.wins)} · ${kpiTxt(x.ms)}</div></div>${cardsHTML(x.ms.cards)}</div>`).join('')||'<div class="small muted">مفيش تقييمات لسه</div>'}</div>
  </div></div>`;
}
function vDash(){
  const m=monthOf(DATE);const list=filtered(false);const bs=F.branch?[F.branch]:branches();
  const top=bs.map(b=>{
    const L=activeEmps().filter(e=>e.branch===b);
    const pres=L.filter(e=>{const st=peekDay(DATE).att[e.code];return st&&st!=='abs'&&st!=='off';}).length;
    const tg=[...new Set(L.map(e=>e.dept))].map(d=>deptProgress(m,b,d,DATE)).filter(x=>x&&x.pct!=null);
    const tpct=tg.length?tg.reduce((a,x)=>a+x.pct,0)/tg.length:null;
    const isF=S.branches.find(x=>x.name===b)?.kind==='factory';
    return `<div class="card"><h3>${isF?'🏭':'🏪'} ${esc(b)}</h3>
      <div class="kv"><span>الموظفين</span><b>${fmt(L.length)}</b></div>
      <div class="kv"><span>حضور النهارده</span><b>${fmt(pres)}</b></div>
      <div class="kv"><span>متوسط تارجت الأقسام</span><b>${tpct!=null?fmt(tpct)+'%':'—'}</b></div>${tpct!=null?barHTML(tpct,monthDays(m,DATE).length/daysInMonth(m)*100):''}
    </div>`;
  }).join('');
  return `<div class="sec-title"><h2>لوحة الفروع والمصنع — ${esc(DATE)}</h2></div>
    ${ribbonHTML(bs)}${honorBoard(bs)}
    <div class="grid g-3" style="margin-bottom:16px">${top}</div>
    ${filterBar()}
    <div class="small muted" style="margin-bottom:8px">${fmt(list.length)} موظف</div>
    <div class="grid g-emp">${list.map(empCard).join('')||'<div class="empty">مفيش موظفين بالفلتر ده</div>'}</div>`;
}
