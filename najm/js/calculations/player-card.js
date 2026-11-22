// نجم أبو الفضل — أرقام كارت اللاعب: السيلز، الانضباط، السلوك، القدرة الخاصة، المثالية، الألقاب والأوسمة
// =========================================================
// كارت اللاعب (زي FIFA): السيلز · الانضباط · السلوك · القدرة الخاصة · المثالية → التقييم المجمّع
// =========================================================
const FUT_W={sales:.30,disc:.20,beh:.20,skill:.15,ideal:.15};
const clamp99=v=>Math.max(30,Math.min(99,Math.round(v)));
// raw inputs for the month: attendance counts, criteria averages (0..2), exemplary-behavior count
function cardRaw(code,month,upto){
  if(LIVE&&S.cardStats)return S.cardStats[code]||null;
  let on=0,late=0,vlate=0,abs=0,bonus=0;const sum=[0,0,0,0,0],cnt=[0,0,0,0,0];
  for(const d of monthDays(month,upto)){const D=peekDay(d);const st=D.att[code];if(st==='on')on++;else if(st==='late')late++;else if(st==='vlate'||st==='xlate')vlate++;else if(st==='abs')abs++;
    if(D.bonus[code])bonus++;for(const f of ['br','sh','fr','ops']){const a=D[f][code];if(a&&a.length===5&&a.every(x=>x!=null))a.forEach((x,i)=>{sum[i]+=x;cnt[i]++;});}}
  const c=sum.map((s,i)=>cnt[i]?s/cnt[i]:null);
  if(!on&&!late&&!vlate&&!abs&&c.every(x=>x==null))return null;
  return {on_n:on,late_n:late,vlate_n:vlate,abs_n:abs,c1:c[0],c2:c[1],c3:c[2],c4:c[3],c5:c[4],bonus_n:bonus};
}
function futStats(e){
  const m=monthOf(DATE);const R=cardRaw(e.code,m,DATE);const ms=msOf(e);const t=ms.target;const k=ms.cards||{y:0,r:0,g:0};
  const avg=(...v)=>{v=v.filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
  // السيلز: تارجت القسم + الكابتن الشخصي (للأقسام التشغيلية: النضافة وتقييم المدير)
  const pcts=[t?.pct,...(t?.caps||[]).map(c=>c.pct)].filter(x=>x!=null);
  const sales=pcts.length?clamp99(35+avg(...pcts)*0.6):null;
  // الانضباط: البصمة
  const days=R?(R.on_n+R.late_n+R.vlate_n+R.abs_n):0;
  const disc=days?clamp99(35+((R.on_n*100+R.late_n*60+R.vlate_n*30)/days)*0.64):null;
  // السلوك: تنفيذ التعليمات + الإيجابية − الكروت
  const b=R?avg(R.c1,R.c4):null;
  const beh=b!=null?clamp99(35+(b/2*100)*0.64-8*k.y-25*k.r):null;
  // القدرة الخاصة: تنفيذ التعليمات وسرعتها + التطور + السلوك المثالي
  const s=R?avg(R.c1,R.c3):null;
  const skill=s!=null?clamp99(35+(s/2*100)*0.64+3*(R.bonus_n||0)):null;
  // المثالية: الكروت الخضرا + السلوك المثالي + رجل اليوم
  const ideal=(R||k.g||ms.wins)?clamp99(55+9*k.g+6*(R?.bonus_n||0)+3*ms.wins-5*k.y-15*k.r):null;
  const st={sales,disc,beh,skill,ideal};
  let w=0,sum=0;for(const[kk,v]of Object.entries(st))if(v!=null){w+=FUT_W[kk];sum+=v*FUT_W[kk];}
  const ovr=w?clamp99(sum/w+Math.min(5,ms.wins)):null;
  return {...st,ovr,tier:ovr==null?'bronze':ovr>=85?'gold':ovr>=70?'silver':'bronze'};
}
const FUT_LBL=[['sales','السيلز'],['disc','الانضباط'],['beh','السلوك'],['skill','القدرة الخاصة'],['ideal','المثالية']];
const posOf=e=>(e.job||e.dept||'').replace(/^قسم /,'').split(' ').slice(0,2).join(' ');
// الحالة: «في الفورمة» = رجل اليوم في آخر 3 أيام أو متوسط آخر 5 أيام متقيّمة 4.5 نجمة وأكتر
function futForm(e){
  let w=false,vals=[];for(let i=0;i<10;i++){const d=new Date(DATE);d.setDate(d.getDate()-i);const k=ymd(d);if(i<3&&isWinner(k,e.code))w=true;const t=score(k,e.code).total;if(t!=null&&vals.length<5)vals.push(t);}
  const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
  return w||(vals.length>=3&&avg>=4.5);
}
// الأوسمة على الكارت
function futBadges(e){
  const ms=msOf(e),f=futStats(e),R=ranks(),cup=cupOf(prizeRank(e.code)),t=ms.target,k=ms.cards||{};const B=[];
  if(cup)B.push({i:cup==='gold'?'🥇':cup==='silver'?'🥈':cup==='bronze'?'🥉':'🎖️',t:CUP_NAME[cup]});
  if(ms.wins)B.push({i:'👑',n:ms.wins,t:'رجل اليوم'});
  if(k.g)B.push({i:'🟩',n:k.g,t:'كروت خضرا'});
  if((t?.caps||[]).some(c=>c.pct>=100))B.push({i:'🎗️',t:'كابتن حقق التارجت'});
  const R0=cardRaw(e.code,monthOf(DATE),DATE);if(R0&&(R0.on_n>=10)&&!R0.late_n&&!R0.vlate_n&&!R0.abs_n)B.push({i:'⏱️',t:'التزام كامل'});
  if((R0?.bonus_n||0)>=2)B.push({i:'⭐',n:R0.bonus_n,t:'مواقف مثالية'});
  return B;
}
// الألقاب: لقب يدوي من مدير التشغيل، وإلا أول لقب يستحقه بالترتيب
function futTitle(e){
  if(e.title)return e.title;
  const R=ranks(),ms=msOf(e),f=futStats(e),k=ms.cards||{};const r=R.company[e.code];
  if(r===1&&f.ovr>=95)return 'الأفضل في التاريخ';
  if(r===1)return 'أسطوري';
  if(ms.wins>=3||(futForm(e)&&ms.wins>=1))return 'لا يمكن إيقافه';
  const shiftMates=activeEmps().filter(x=>x.branch===e.branch&&x.shift===e.shift);
  if(ms.wins>=2&&shiftMates.every(x=>x.code===e.code||msOf(x).wins<ms.wins))return 'ملك الشيفت';
  if((ms.target?.caps||[]).some(c=>c.pct>=100))return 'الكابتن الدهبي';
  if(f.disc>=95)return 'المنضبط';
  if(k.g>=3)return 'صاحب الأخلاق';
  if(f.skill>=92)return 'الظاهرة';
  if(f.beh>=95)return 'القائد';
  if(f.ideal>=90)return 'قلب الفريق';
  return '';
}
function laurelSVG(){ // two laurel branches hugging the lower half of the halo (legend card)
  const leaf=(cx,cy,rot,big)=>`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${big?2.6:2.2}" ry="${big?6.2:5.4}" transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="url(#lg)" stroke="#8a5a00" stroke-width=".3"/>`;
  let out='';
  for(let i=0;i<8;i++){const deg=100+i*13;const t=deg*Math.PI/180;const r=46;
    const x=50+r*Math.cos(t),y=50+r*Math.sin(t);           // left branch (bottom → up the left side)
    out+=leaf(x,y,deg+90+28,i<3)+leaf(100-x,y,-(deg+90+28),i<3);
    const xi=50+(r-5.5)*Math.cos(t+.09),yi=50+(r-5.5)*Math.sin(t+.09);
    if(i<6)out+=leaf(xi,yi,deg+90-25,false)+leaf(100-xi,yi,-(deg+90-25),false);}
  return `<svg class="fc-laurel" viewBox="0 0 100 100"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#e2b232"/><stop offset="1" stop-color="#9a6a05"/></linearGradient></defs>
    <path d="M${(50+46*Math.cos(100*Math.PI/180)).toFixed(1)} ${(50+46*Math.sin(100*Math.PI/180)).toFixed(1)} A46 46 0 0 1 ${(50+46*Math.cos(191*Math.PI/180)).toFixed(1)} ${(50+46*Math.sin(191*Math.PI/180)).toFixed(1)} M${(50-46*Math.cos(100*Math.PI/180)).toFixed(1)} ${(50+46*Math.sin(100*Math.PI/180)).toFixed(1)} A46 46 0 0 0 ${(50-46*Math.cos(191*Math.PI/180)).toFixed(1)} ${(50+46*Math.sin(191*Math.PI/180)).toFixed(1)}" fill="none" stroke="#b8861c" stroke-width=".8"/>${out}</svg>`;
}
function futEdition(e,f){if(f.ovr==null)return f.tier;if(ranks().company[e.code]===1)return 'icon';if(futForm(e))return 'neon';return f.tier;}
