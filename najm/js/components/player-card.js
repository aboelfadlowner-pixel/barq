// نجم أبو الفضل — رسم كارت اللاعب (زي FIFA)
const FC_SHORT=[['sales','سيلز'],['disc','انضباط'],['beh','سلوك'],['skill','قدرة'],['ideal','مثالية']];
function futCard(e,cls=''){
  const f=futStats(e);const ed=futEdition(e,f);const title=futTitle(e);const B=futBadges(e).slice(0,4);
  const ph=e.photo?`<img src="${e.photo}" alt="">`:`<div class="fc-ini">${esc((e.name||'?').trim()[0])}</div>`;
  const brIcon=S.branches.find(b=>b.name===e.branch)?.kind==='factory'?'🏭':'🏪';
  return `<div class="fc ${ed} ${cls}">${ed==='neon'?'<div class="fc-flame">🔥 في الفورمة</div>':''}<div class="fc-frame"></div><div class="fc-body">
    <div class="fc-ovr"><b>${f.ovr??'—'}</b><span>${esc(posOf(e))}</span></div>
    <div class="fc-bdg">${B.map(x=>`<i title="${esc(x.t)}">${x.i}${x.n?`<sub>${x.n}</sub>`:''}</i>`).join('')}</div>
    <div class="fc-halo"></div><div class="fc-ph${e.photo?' has':''}">${ph}</div>${ed==='icon'?laurelSVG():''}
    <div class="fc-low">${title?`<div class="fc-title">${esc(title)}</div>`:''}
      <div class="fc-name">${esc(e.name.split(' ').slice(0,2).join(' '))}</div>
      <div class="fc-icons"><span>${brIcon} ${esc(e.branch.replace('الرئيسي','').trim())}</span><i></i><img src="${ed==='neon'?LOGO_WHITE:LOGO_HEAD}" alt=""><i></i><span>${esc(e.code)}</span></div>
      <div class="fc-stats">${FC_SHORT.map(([k,l])=>`<div><b>${f[k]??'—'}</b><span>${l}</span></div>`).join('')}</div>
    </div><div class="fc-gem"></div></div><div class="fc-wing l"></div><div class="fc-wing r"></div></div>`;
}
