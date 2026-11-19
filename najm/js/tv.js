// نجم أبو الفضل — شاشة الفرع (TV) 1920×1080: المشاهد اللي بتلف لوحدها والاحتفال
// =========================================================
// شاشة الفرع — najm.html?tv=<اسم الفرع>  (تلفزيون الفرع: عرض بس، بيتقلب لوحده، بيتحدث كل دقيقة)
// =========================================================
// gold medal with the Abu El Fadl face (SVG, sharp at any size)
function medalSVG(id='m'){return `<svg viewBox="0 0 200 250" class="medal" aria-hidden="true">
<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c9"/><stop offset=".35" stop-color="#f6cf55"/><stop offset=".7" stop-color="#d9a520"/><stop offset="1" stop-color="#8a5a00"/></linearGradient>
<radialGradient id="${id}r" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".6" stop-color="#e2b232"/><stop offset="1" stop-color="#a87308"/></radialGradient></defs>
<path d="M58 0h34l20 90H78z" fill="#0f6b45"/><path d="M108 0h34l-20 90H88z" fill="#16915c"/><path d="M71 0h8l20 90h-8z M121 0h8l-20 90h-8z" fill="#f6cf55" opacity=".85"/>
<circle cx="100" cy="158" r="84" fill="url(#${id}g)"/><circle cx="100" cy="158" r="72" fill="url(#${id}r)" stroke="#8a5a00" stroke-width="2"/>
<circle cx="100" cy="158" r="64" fill="none" stroke="#fff3b0" stroke-width="1.5" stroke-dasharray="3 5" opacity=".8"/>
<image href="${LOGO_HEAD}" x="62" y="112" width="76" height="92"/>
</svg>`;}
// trophy cup (gold / silver / bronze) with the logo on its body
function cupSVG(tier,id){const G={gold:['#fff6c9','#f6cf55','#d9a520','#8a5a00'],silver:['#ffffff','#e3e8ec','#a9b2bb','#5d6770'],bronze:['#ffe1c4','#e7a26a','#b0662e','#5e2f0c']}[tier]||['#fff','#ddd','#999','#555'];
return `<svg viewBox="0 0 220 260" class="cup" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${G[3]}"/><stop offset=".25" stop-color="${G[1]}"/><stop offset=".5" stop-color="${G[0]}"/><stop offset=".75" stop-color="${G[1]}"/><stop offset="1" stop-color="${G[2]}"/></linearGradient></defs>
<path d="M52 30c-34 0-44 22-40 44 5 26 30 40 52 44" fill="none" stroke="url(#${id})" stroke-width="12" stroke-linecap="round"/>
<path d="M168 30c34 0 44 22 40 44-5 26-30 40-52 44" fill="none" stroke="url(#${id})" stroke-width="12" stroke-linecap="round"/>
<path d="M40 14h140c0 70-22 120-70 132C62 134 40 84 40 14z" fill="url(#${id})" stroke="${G[3]}" stroke-width="3"/>
<ellipse cx="110" cy="16" rx="70" ry="9" fill="${G[0]}" opacity=".8"/>
<image href="${LOGO_HEAD}" x="80" y="34" width="60" height="72" opacity=".9"/>
<path d="M98 146h24v40H98z" fill="url(#${id})"/><path d="M70 186h80l10 26H60z" fill="url(#${id})" stroke="${G[3]}" stroke-width="2"/>
<rect x="50" y="212" width="120" height="30" rx="6" fill="#0f6b45" stroke="${G[2]}" stroke-width="3"/>
<text x="110" y="234" text-anchor="middle" font-family="Cairo,Tahoma" font-weight="900" font-size="18" fill="${G[1]}">ABU ELFADL</text></svg>`;}
function tvPh(e,size,ring){const inner=e.photo?`<img class="tv-ph" src="${e.photo}" style="width:${size}px;height:${size}px" alt="">`:`<div class="tv-ph" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.42)}px">${esc((e.name||'?').trim()[0])}</div>`;return ring?`<div class="tv-ring">${inner}</div>`:inner;}
function tvStars(v){const p=Math.max(0,Math.min(5,v||0))/5*100;return `<span class="tv-stars"><span class="bg">★★★★★</span><span class="fg" style="width:${p}%">★★★★★</span></span>`;}

let TVB=null, TV_I=0, TV_TIMER=null, TV_SEEN=null, TV_SPOT=0, TV_READY=false;
const TV_SEC=15;
function tvInit(branch){
  TVB=branches().includes(branch)?branch:branches()[0];
  document.body.classList.add('tvmode');
  const d=document.createElement('div');d.id='tv';
  d.innerHTML=`<div class="tv-stage" id="tvStage"><div class="tv-beams"><i></i><i></i><i></i><i></i></div>
    <div class="tv-top"><img class="tv-logo" src="${LOGO_WHITE}" alt="أبو الفضل"><div class="tv-title"><b>دوري نجوم أبو الفضل</b><span id="tvBranch"></span></div>
      <div class="tv-kpis" id="tvKpis"></div><div class="tv-clock"><b id="tvTime">--:--</b><span id="tvDate"></span></div></div>
    <section class="tv-scene" id="tvScene"></section><div class="tv-dots" id="tvDots"></div>
    <footer class="tv-ticker"><div class="lbl">⚡ أخبار الدوري</div><div style="flex:1;height:100%;overflow:hidden;position:relative"><div class="tv-run" id="tvRun"></div></div></footer></div>`;
  document.body.appendChild(d);
  const fit=()=>{const s=Math.min(innerWidth/1920,innerHeight/1080);$('#tvStage').style.transform=`scale(${s})`;};
  addEventListener('resize',fit);fit();
  const tick=()=>{const n=new Date();$('#tvTime').textContent=n.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});$('#tvDate').textContent=n.toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'});};
  tick();setInterval(tick,1000);
  setInterval(()=>{const today=ymd(new Date());if(DATE!==today){DATE=today;RANK_CACHE=null;LIVE?refresh(true):tvUpdate();}},60000);
}
// the most recent day (today or up to 3 days back) whose man of the day was announced for this branch
function tvWinnerDay(){for(let i=0;i<4;i++){const d=new Date(DATE);d.setDate(d.getDate()-i);const k=ymd(d);const W=Object.entries(peekDay(k).winners||{}).filter(([g])=>g.startsWith(TVB+'|'));if(W.length)return {day:k,list:W.flatMap(([g,codes])=>codes.map(c=>({e:emp(c),sh:g.split('|')[1]}))).filter(x=>x.e)};}return null;}
function tvScenes(){
  const L=[sceneDay];
  const m=monthOf(DATE);
  if(deptsOf(TVB).some(d=>deptProgress(m,TVB,d,DATE)?.pct!=null))L.push(sceneLeague);
  if(captainsIn(m,DATE,e=>e.branch===TVB).length)L.push(sceneCaptain);
  if(ranks().rows.length)L.push(sceneCups,scenePlayer);
  if(managers().length)L.push(sceneManagers);
  if((S.market||[]).some(x=>['listed','decided','approved'].includes(x.status)))L.push(sceneMarket);
  return L;
}
function tvUpdate(){
  if(!TVB)return;
  $('#tvBranch').textContent=`${TVB} · ${monthName(monthOf(DATE))}`;
  // KPIs
  const L=activeEmps().filter(e=>e.branch===TVB);const D=peekDay(DATE);
  const pres=L.filter(e=>{const st=D.att[e.code];return st&&st!=='abs'&&st!=='off';}).length;
  const sc=L.map(e=>score(DATE,e.code).total).filter(v=>v!=null);const avg=sc.length?sc.reduce((a,b)=>a+b,0)/sc.length:null;
  const m=monthOf(DATE);const tg=deptsOf(TVB).map(d=>deptProgress(m,TVB,d,DATE)).filter(x=>x&&x.pct!=null);const tp=tg.length?tg.reduce((a,x)=>a+x.pct,0)/tg.length:null;
  const greens=L.reduce((a,e)=>a+(cardCount(e.code,m,DATE).g||0),0);
  $('#tvKpis').innerHTML=`<div class="tv-kpi"><b>${fmt(pres)}<small style="font-size:24px;color:var(--muted)"> / ${fmt(L.length)}</small></b><span>حضور النهارده</span></div>
    <div class="tv-kpi gold"><b>${avg!=null?fmt(avg,1)+' ★':'—'}</b><span>متوسط نجوم الفرع</span></div>
    <div class="tv-kpi"><b>${tp!=null?fmt(tp)+'%':'—'}</b><span>متوسط تارجت الأقسام</span></div>
    <div class="tv-kpi green"><b>🟩 ${fmt(greens)}</b><span>كروت خضرا الشهر</span></div>`;
  tvTicker();tvCelebrateCheck();
  if(!TV_TIMER){tvShow(0);TV_TIMER=setInterval(()=>tvShow(TV_I+1),TV_SEC*1000);} else tvShow(TV_I,true);
}
function tvShow(i,stay){
  const sc=tvScenes();TV_I=((i%sc.length)+sc.length)%sc.length;
  const el=$('#tvScene');el.innerHTML=sc[TV_I]();
  if(!stay){el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter');if(sc[TV_I]===scenePlayer)TV_SPOT++;}
  $('#tvDots').innerHTML=sc.map((_,k)=>`<i class="${k===TV_I?'on':''}"></i>`).join('');
}
function awardCard(x,size='',dayLabel){const e=x.e;const s=score(x.day||DATE,e.code);return `<div class="tv-award ${size}">${medalSVG('md'+e.code+size)}
  <div class="tv-crown">👑</div><div style="display:flex;justify-content:center">${tvPh(e,size==='xs'?150:size==='sm'?180:230,true)}</div>
  <div class="nm">${esc(e.name)}</div>
  <div class="meta">${esc(e.dept)} · كود <b style="color:#fff">${esc(e.code)}</b>${x.sh?` · شيفت ${esc(x.sh)}`:''}</div>
  ${s.total!=null?`<div style="margin-top:6px">${tvStars(s.total)}</div>`:''}
  <div class="prize">🏆 رجل اليوم</div>${dayLabel?`<div class="meta">${dayLabel}</div>`:''}</div>`;}
function sceneDay(){
  const W=tvWinnerDay();
  const dayName=W?(W.day===DATE?'النهارده':new Date(W.day).toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'})):'';
  let left;
  if(W){const n=W.list.length;const size=n===1?'':n===2?'sm':'xs';left=`<div class="tv-glass tv-winners">${W.list.map(x=>awardCard({...x,day:W.day},size)).join('')}</div>`;}
  else left=`<div class="tv-glass tv-winners"><div class="tv-empty">${medalSVG('mx').replace('class="medal"','style="width:220px"')}<div>رجل اليوم بيتعلن بعد تقييم المديرين</div></div></div>`;
  const R=rankGroup(DATE,activeEmps().filter(e=>e.branch===TVB)).slice(0,5);
  return `<div class="tv-h">🏆 رجل اليوم <small>${W?'— '+dayName:''}</small></div>
  <div class="tv-day" style="height:calc(100% - 78px)">${left}
    <div class="tv-glass tv-rank"><div class="tv-h" style="font-size:32px;margin:0 0 6px">⭐ ترتيب النهارده في الفرع</div>
    ${R.length?R.map((x,i)=>`<div class="tv-row"><div class="pos ${i<3?'p'+(i+1):''}">${i+1}</div>${tvPh(x.e,64)}<div class="who"><b>${esc(x.e.name)}<span class="tv-code">${esc(x.e.code)}</span></b><span>${esc(x.e.dept)} · ${esc(x.e.shift)}</span></div><div style="text-align:center">${tvStars(x.s.total)}<div class="sc">${fmt(x.s.total,2)}</div></div></div>`).join(''):'<div class="tv-empty" style="font-size:28px">التقييمات بتتسجل آخر الشيفت</div>'}
    </div></div>`;
}
function sceneLeague(){
  const m=monthOf(DATE);const pace=monthDays(m,DATE).length/daysInMonth(m)*100;
  const L=deptsOf(TVB).map(d=>({d,p:deptProgress(m,TVB,d,DATE),caps:captainsIn(m,DATE,e=>e.branch===TVB&&e.dept===d).length})).filter(x=>x.p&&x.p.pct!=null).sort((a,b)=>b.p.pct-a.p.pct).slice(0,13);
  const max=Math.max(110,...L.map(x=>x.p.pct));const h=v=>Math.max(4,v/max*100);
  return `<div class="tv-h">📊 دوري الأقسام <small>— نسبة تحقيق التارجت لحد النهارده</small></div>
  <div class="tv-glass tv-league" style="height:calc(100% - 78px);padding-bottom:84px">
   <div class="tv-bars"><div class="tv-pace" style="bottom:${h(pace)}%"><span>المفروض لحد النهارده ${fmt(pace)}%</span></div>
   ${L.map(x=>{const c=x.p.pct>=pace?'ok':x.p.pct>=pace*.8?'mid':'low';return `<div class="tv-bar"><div class="v">${fmt(x.p.pct)}%</div><div class="col ${c}" style="height:${h(x.p.pct)}%">${x.caps?'<div class="tv-capb">C</div>':''}</div><div class="lb">${esc(x.d.replace(/^قسم /,''))}<div style="font-size:18px;color:var(--muted)">${x.p.type==='sales'?'مبيعات':'تشغيلي'}</div></div></div>`;}).join('')}
   </div></div>`;
}
function sceneCaptain(){
  const m=monthOf(DATE);const caps=captainsIn(m,DATE,e=>e.branch===TVB);
  const g={};for(const c of caps)(g[c.sku]||(g[c.sku]={...c,people:[]})).people.push(emp(c.code));
  const L=Object.values(g).sort((a,b)=>(b.pct||0)-(a.pct||0)).slice(0,6);
  return `<div class="tv-h">🎗️ شارة الكابتن <small>— المنتجات اللي مركزين عليها الشهر ده (النقاط × ${S.settings.captainMult})</small></div>
  <div class="tv-caps">${L.map(c=>{const p=Math.min(100,c.pct||0);return `<div class="tv-capcard"><div class="t">${esc(c.name)}</div>
    <div class="ring" style="background:conic-gradient(#ffd54a ${p*3.6}deg,rgba(255,255,255,.18) 0)"><div style="width:118px;height:118px;border-radius:50%;background:#4a35b8;display:flex;align-items:center;justify-content:center">${fmt(c.pct)}%</div></div>
    <div style="text-align:center;font-size:22px;font-weight:800;opacity:.9">${fmt(c.sold,1)} من ${fmt(c.target,1)} كيلو</div>
    <div class="ppl" style="margin-top:10px">${c.people.filter(Boolean).map(e=>tvPh(e,62)).join('')}</div>
    <div class="names">${c.people.filter(Boolean).map(e=>esc(e.name.split(' ').slice(0,2).join(' '))).join(' · ')}</div>
    <div class="pts">⭐ ${fmt(c.points)} نقطة لكل كابتن</div></div>`;}).join('')}</div>`;
}
function sceneCups(){
  const R=ranks();const top=R.qualified.slice(0,10);const P=prizes();
  const pod=[top[1],top[0],top[2]].map((x,i)=>{if(!x)return '<div class="tv-pod"></div>';const r=[2,1,3][i];const tier=['silver','gold','bronze'][i];
    return `<div class="tv-pod p${r}">${cupSVG(tier,'cg'+r)}${tvPh(x.e,r===1?130:104,r===1)}<div class="nm">${esc(x.e.name)}</div>
      <div class="meta">كود ${esc(x.e.code)} · ${esc(x.e.branch)}</div><div class="amt">${{gold:'🥇 الكأس الدهبي',silver:'🥈 الكأس الفضي',bronze:'🥉 الكأس البرونزي'}[tier]}</div>
      <div class="step">${r}</div></div>`;}).join('');
  return `<div class="tv-h">🏆 كؤوس ${monthName(monthOf(DATE))} <small>— الترتيب لحد النهارده على مستوى أبو الفضل</small></div>
  <div class="tv-cups" style="height:calc(100% - 78px)"><div class="tv-glass tv-podium">${pod}</div>
   <div class="tv-glass tv-top10"><div class="tv-h" style="font-size:30px;margin:0 0 6px">🎖️ من المركز 4 لـ 10 — وسام العشرة الأوائل</div>
   ${top.slice(3,10).map((x,i)=>`<div class="tv-row ${x.e.branch===TVB?'tv-mine':''}"><div class="pos">${i+4}</div>${tvPh(x.e,56)}<div class="who"><b>${esc(x.e.name)}<span class="tv-code">${esc(x.e.code)}</span></b><span>${esc(x.e.branch)} · 🏆 ${fmt(x.ms.wins)} · ${fmt(x.ms.monthScore)}/100</span></div><div class="tv-amt">🎖️</div></div>`).join('')||'<div class="tv-empty" style="font-size:26px">لسه بدري</div>'}
   </div></div>`;
}
function scenePlayer(){
  const R=ranks();const pool=R.rows.filter(x=>x.e.branch===TVB).slice(0,10);const L=pool.length?pool:R.rows.slice(0,10);if(!L.length)return sceneDay();
  const x=L[TV_SPOT%L.length];const e=x.e,ms=x.ms,t=ms.target;const rank=R.company[e.code];const tier=cupOf(prizeRank(e.code));
  const cap=t?.caps?.[0];
  return `<div class="tv-player"><div style="display:flex;justify-content:center">${futCard(e,'xl')}</div>
   <div><div class="tv-h" style="font-size:48px">⭐ نجم من نجوم ${esc(TVB)}</div>
    <div class="tv-facts">
     <div class="tv-glass tv-fact"><b style="color:var(--g2)">${tvStars(ms.avg)}</b><span>متوسط نجوم الشهر ${fmt(ms.avg,2)}</span></div>
     <div class="tv-glass tv-fact"><b>🏆 ${fmt(ms.wins)}</b><span>مرة رجل اليوم الشهر ده</span></div>
     <div class="tv-glass tv-fact"><b>#${fmt(R.branch[e.code])}</b><span>ترتيبه في الفرع</span></div>
     <div class="tv-glass tv-fact"><b>${tier?CUP_NAME[tier].replace('جايزة ',''):'—'}</b><span>${tier?'لو الترتيب فضل كده هياخدها 🏆':'قرّب على العشرة الأوائل'}</span></div>
     ${cap?`<div class="tv-glass tv-fact" style="grid-column:1/-1;background:linear-gradient(150deg,#3b2a9b,#5b3fd1)"><b>C ${esc(cap.name)} · ${fmt(cap.pct)}%</b><span>كابتن المنتج — ${fmt(cap.points)} نقطة</span></div>`:''}
    </div></div></div>`;
}
function tvTicker(){
  const m=monthOf(DATE);const items=[];const W=tvWinnerDay();
  if(W)W.list.forEach(x=>items.push(`👑 ${x.e.name} رجل اليوم — شيفت ${x.sh} 👏`));
  const top=ranks().rows[0];if(top)items.push(`🥇 متصدر ${monthName(m)}: ${top.e.name} (${top.e.branch}) — في طريقه للكأس الدهبي 🏆`);
  activeEmps().filter(e=>e.branch===TVB).map(e=>({e,g:cardCount(e.code,m,DATE).g||0})).filter(x=>x.g).sort((a,b)=>b.g-a.g).slice(0,5).forEach(x=>items.push(`🟩 ${x.e.name}: ${fmt(x.g)} كارت أخضر الشهر ده`));
  captainsIn(m,DATE,e=>e.branch===TVB).sort((a,b)=>(b.pct||0)-(a.pct||0)).slice(0,4).forEach(c=>items.push(`🎗️ ${c.name} وصل ${fmt(c.pct)}% من تارجت الكابتن`));
  const best=deptsOf(TVB).map(d=>({d,p:deptProgress(m,TVB,d,DATE)})).filter(x=>x.p?.pct!=null).sort((a,b)=>b.p.pct-a.p.pct)[0];
  if(best)items.push(`📊 ${best.d} متصدر دوري الأقسام بـ ${fmt(best.p.pct)}%`);
  if(!items.length)items.push('⭐ دوري نجوم أبو الفضل — كل يوم فرصة تبقى رجل اليوم');
  const run=$('#tvRun');const html=items.map(t=>`<span>${esc(t)}</span>`).join('<span style="color:var(--g2)">◆</span>');
  if(run.dataset.h!==html){run.dataset.h=html;run.innerHTML=html+'<span style="color:var(--g2)">◆</span>'+html+'<span style="color:var(--g2)">◆</span>';run.style.setProperty('--dur',Math.max(40,items.length*12)+'s');}
}
// celebration when a new man of the day appears on this screen
function tvCelebrateCheck(){
  const W=tvWinnerDay();const keys=W?W.list.map(x=>W.day+'|'+x.e.code):[];
  if(!TV_READY)return;
  if(TV_SEEN===null){TV_SEEN=new Set(keys);return;}
  const fresh=W?W.list.filter(x=>!TV_SEEN.has(W.day+'|'+x.e.code)):[];keys.forEach(k=>TV_SEEN.add(k));
  if(fresh.length)tvCelebrate(fresh.map(x=>({...x,day:W.day})));
}
function tvCelebrate(list){
  const st=$('#tvStage');const ov=document.createElement('div');ov.className='tv-celebrate';
  ov.innerHTML=`<canvas width="1920" height="1080"></canvas><div class="hd">🎉 مبروك لرجل اليوم 🎉</div><div style="display:flex;gap:120px">${list.slice(0,2).map(x=>awardCard(x,list.length>1?'sm':'')).join('')}</div>`;
  st.appendChild(ov);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduce){const c=ov.querySelector('canvas').getContext('2d');const cols=['#f6cf55','#fff3b0','#16915c','#5fe0a1','#ffffff','#d9a520'];
    const P=Array.from({length:260},()=>({x:Math.random()*1920,y:-Math.random()*1080,w:8+Math.random()*10,h:12+Math.random()*14,vy:3+Math.random()*5,vx:-2+Math.random()*4,r:Math.random()*6,vr:-.15+Math.random()*.3,c:cols[Math.random()*cols.length|0]}));
    let t0=performance.now();const draw=t=>{if(!ov.isConnected)return;c.clearRect(0,0,1920,1080);for(const p of P){p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;if(p.y>1100)p.y=-20;c.save();c.translate(p.x,p.y);c.rotate(p.r);c.fillStyle=p.c;c.fillRect(-p.w/2,-p.h/2,p.w,p.h);c.restore();}if(t-t0<11000)requestAnimationFrame(draw);};requestAnimationFrame(draw);}
  setTimeout(()=>ov.remove(),12000);
}
function tvLinks(){return branches().map(b=>`<div class="kv"><span>📺 ${esc(b)}</span><a class="btn sm" target="_blank" rel="noopener" href="?tv=${encodeURIComponent(b)}${DEMO?'&demo=1':''}">فتح الشاشة</a></div>`).join('');}
// TV scenes
function sceneManagers(){
  const L=mgrRanks().slice(0,6);const m=monthOf(DATE);const pz=prizes();const P=mgrPts();
  const top=L[0];
  return `<div class="tv-h">🎖️ دوري المديرين <small>— ${monthName(m)} لحد النهارده</small></div>
  <div class="tv-cups" style="height:calc(100% - 78px)">
   <div class="tv-glass" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px">
    ${top?`${mgrEmp(top.u)?tvPh(mgrEmp(top.u),170,true):cupSVG('gold','cgm').replace('class="cup"','class="cup" style="width:200px"')}<div style="font-size:26px;color:var(--muted);font-weight:800">المدير المثالي — لحد النهارده · ${fmt(top.score)}/100</div><div class="tv-award" style="width:560px"><div class="nm">${esc(top.u.name)}</div><div class="meta">${ROLES[top.u.role]} · ${esc(top.u.branch||'كل الفروع')}${top.u.shift?' · شيفت '+esc(top.u.shift):''}</div>
      <div class="prize">🏆 كاس + ${fmt(P.bonus)} نقطة</div></div>`:'<div class="tv-empty">لسه مفيش مديرين</div>'}
   </div>
   <div class="tv-glass tv-top10"><div class="tv-h" style="font-size:30px;margin:0 0 6px">⚔️ الترتيب</div>
    ${L.map((x,i)=>`<div class="tv-row ${x.u.branch===TVB?'tv-mine':''}"><div class="pos ${i<3?'p'+(i+1):''}">${i+1}</div>${mgrEmp(x.u)?tvPh(mgrEmp(x.u),56):''}<div class="who"><b>${esc(x.u.name)}</b><span>${ROLES[x.u.role]}${x.u.shift?' · '+esc(x.u.shift):''} · 🗳️ ${fmt(x.votes)} صوت · 👑 ${fmt(x.wins)}</span></div><div class="tv-amt" style="color:var(--g2)">${fmt(x.score)}/100</div></div>`).join('')}
   </div></div>`;
}
function sceneMarket(){
  const mk=(S.market||[]).find(x=>['listed','decided','approved'].includes(x.status));const e=mk&&emp(mk.code);if(!e)return sceneDay();
  const offers=(S.offers||[]).filter(o=>o.market_id===mk.id).sort((a,b)=>b.points-a.points);
  const chosen=offers.find(o=>o.id===mk.chosen);
  return `<div class="tv-h">🔁 سوق الانتقالات <small>— العامل المثالي لـ ${monthName(mk.month)}</small></div>
  <div class="tv-player" style="height:calc(100% - 78px)"><div style="display:flex;flex-direction:column;align-items:center;gap:10px"><div class="tv-award" style="width:auto;padding:6px 26px"><div class="nm" style="margin:0;font-size:28px">👑 العامل المثالي #1 — ${monthName(mk.month)}</div></div>${futCard(e,'lg')}</div>
   <div>${mk.status==='approved'?`<div class="tv-h" style="font-size:52px;color:var(--g2)">✍️ ${chosen?`انضم لشيفت ${esc(chosen.shift||'')} — ${esc(mgrName(chosen.username))}`:'قرر يفضل مكانه'}</div>`
     :`<div class="tv-h" style="font-size:44px">${mk.wish?`🎯 عايز: ${esc([mk.wish.branch,mk.wish.shift&&('شيفت '+mk.wish.shift)].filter(Boolean).join(' · ')||'أي عرض')}`:'🎯 بيحدد رغبته'}</div>`}
    <div class="tv-glass tv-top10" style="margin-top:10px">${offers.slice(0,5).map((o,i)=>`<div class="tv-row"><div class="pos ${i===0?'p1':''}">${i+1}</div><div class="who"><b>${esc(mgrName(o.username))}</b><span>${esc(o.branch||'')} · ${esc(o.shift||'')}${o.note?' — «'+esc(o.note)+'»':''}</span></div><div class="tv-amt" style="color:#b9a6ff">${fmt(o.points)} نقطة</div></div>`).join('')||'<div class="tv-empty" style="font-size:28px">مستني عروض المديرين…</div>'}</div></div></div>`;
}
