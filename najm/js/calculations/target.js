// نجم أبو الفضل — التارجت: مبيعات القسم، الكابتن، والنقط اللي بيحددها مدير التشغيل
// ---------- targets ----------
let SALES_CACHE={};
function salesAgg(month,branch,upto){
  if(LIVE&&S.salesSum){return S.salesSum.month===month?(S.salesSum.data[branch]||{}):{};}
  const ck=month+'|'+branch+'|'+(upto||'');if(SALES_CACHE[ck])return SALES_CACHE[ck];
  const out=SALES_CACHE[ck]={};
  for(const d of monthDays(month,upto)){const b=S.sales[d]?.[branch];if(!b)continue;for(const[k,v]of Object.entries(b)){(out[k]||(out[k]={name:v.name,qty:0})).qty+=v.qty;}}
  return out;
}
// نقط التارجت من نسبة التحقيق — بالشرايح اللي مدير التشغيل حددها للشهر ده (rules.js)
const pts=p=>tierPts(p);
// كمية صنف اتباعت الشهر اللي فات في فرع (من مبيعات الشهر الماضي المرفوعة) — أساس تارجت القسم والكابتن
function lastMonthQty(month,branch,sku){const pm=prevMonth(month);const b=S.baseSales[pm]?.[branch];const src=b&&Object.keys(b).length?b:salesAgg(pm,branch);return +(src?.[sku]?.qty)||0;}
// نسبة النقط اللي الموظف بياخدها من نقط التارجت/الكابتن حسب الإنجاز
const tgtRatio=p=>p==null?null:(pts(p)||0)/100;
const tgtCfg=(month,branch,dept)=>S.targets[month]?.[deptKey(branch,dept)]||null;
function deptProgress(month,branch,dept,upto,empCode){
  const cfg=S.targets[month]?.[deptKey(branch,dept)];
  if(!cfg) return null;
  const cap=S.settings.capPct;
  if(cfg.type==='sales'){
    const agg=salesAgg(month,branch,upto);
    if(+cfg.total>0){   // تارجت كلي واحد للقسم: مجموع المتباع من كل أصناف القسم ÷ التارجت الكلي
      const its=(cfg.items||[]).map(it=>({...it,sold:agg[it.key]?.qty||0,last:lastMonthQty(month,branch,it.key)}));
      const sold=its.reduce((a,i)=>a+i.sold,0),last=its.reduce((a,i)=>a+i.last,0),pct=Math.min(cap,sold/+cfg.total*100);
      return {type:'sales',items:its,total:+cfg.total,sold,last,pct,points:pts(pct),pace:upto?(monthDays(month,upto).length/daysInMonth(month)*100):null};
    }
    const items=(cfg.items||[]).map(it=>{const sold=agg[it.key]?.qty||0;const p=it.target>0?Math.min(cap,sold/it.target*100):null;return {...it,sold,pct:p};});
    const T=items.reduce((a,i)=>a+(+i.target||0),0), Sd=items.reduce((a,i)=>a+Math.min(i.sold,(+i.target||0)*cap/100),0);
    const pct=T>0?Sd/T*100:null; // department total (kilos/units) vs total target
    return {type:'sales',items,pct,points:pts(pct),pace:upto?(monthDays(month,upto).length/daysInMonth(month)*100):null};
  }
  const days=monthDays(month,upto);const key=deptKey(branch,dept);
  const kpis=(cfg.kpis||[]).map(k=>{
    if(k.kind==='mgr'){ // average direct-manager star (0..1) from the daily ratings — per employee, or the department average
      const codes=empCode?[empCode]:activeEmps().filter(e=>e.branch===branch&&e.dept===dept).map(e=>e.code);
      const vs=[];for(const d of days)for(const c of codes){const m=score(d,c).mgr;if(m!=null)vs.push(m);}
      const val=vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null;
      return {...k,val:val==null?null:val*100,pct:val==null||!(k.target>0)?null:Math.min(cap,val*100/k.target*100),n:vs.length};
    }
    const vals=days.map(d=>S.kpiVals[d]?.[key]?.[k.id]).filter(v=>v!=null&&v!=='');
    let pct=null,val=null;
    if(vals.length){
      if(k.kind==='score'){val=vals.reduce((a,b)=>a+ +b,0)/vals.length;pct=k.target>0?Math.min(cap,val/k.target*100):null;}
      else if(k.kind==='count'){val=vals.reduce((a,b)=>a+ +b,0);pct=k.target>0?Math.min(cap,val/k.target*100):null;}
      else {val=vals.reduce((a,b)=>a+ +b,0);const t=+k.target||0;pct=val<=t?100:Math.max(0,100*(1-(val-t)/Math.max(t,1)));}
    }
    return {...k,val,pct,n:vals.length};
  });
  const v=kpis.filter(k=>k.pct!=null);const w=v.reduce((a,k)=>a+(+k.weight||1),0);
  const pct=v.length?v.reduce((a,k)=>a+k.pct*(+k.weight||1),0)/w:null;
  return {type:'manual',kpis,pct,points:pts(pct),pace:null};
}
// captain = personal extra target: each salesperson / chef gets one or more products; measured by the kilos the branch sold of it (Foodics sheet)
function captainsOfEmp(e,month,upto,onlyActive=true){
  const L=S.captains[month]?.[e.code]||[];if(!L.length)return [];
  const agg=salesAgg(month,e.branch,upto);const cap=S.settings.capPct;
  return L.filter(c=>!onlyActive||c.active!==false).map(c=>{const sold=agg[c.sku]?.qty||0;
    // الإنجاز بيتحسب من الزيادة فوق مبيعات الشهر الماضي: (المتباع − الأساس) ÷ (التارجت − الأساس)
    const base=lastMonthQty(month,e.branch,c.sku);const span=c.target-base;
    const pct=!(c.target>0)?null:span>0?Math.min(cap,Math.max(0,sold-base)/span*100):Math.min(cap,sold/c.target*100);
    const p=pts(pct);const man=+c.pts>0;
    return {...c,code:e.code,branch:e.branch,dept:e.dept,sold,base,extra:Math.max(0,sold-base),need:span>0?span:c.target,pct,max:man?+c.pts:100,points:p==null?null:man?Math.round(+c.pts*tgtRatio(pct)):p};});
}
function captainsIn(month,upto,pred){const out=[];for(const e of activeEmps())if(pred(e))out.push(...captainsOfEmp(e,month,upto));return out;}
// شكاوى العملاء المثبتة بس هي اللي بتخصم (اللي لسه بتتراجع أو اتلغت مش بتتحسب)
const complaintProven=c=>(c.status||'proven')==='proven';
function complaintsOf(code,month){if(LIVE&&S.complaintCounts&&month===monthOf(DATE))return S.complaintCounts[code]||0;return S.complaints.filter(c=>c.code===code&&c.date.startsWith(month)&&complaintProven(c)).length;}
// الموظف اللي اتنقل في نص الشهر: كل قسم بعدد الأيام اللي قضاها فيه
function deptSegments(e,month,upto){
  const days=monthDays(month,upto);const M=(S.moves||[]).filter(m=>m.code===e.code&&String(m.day).startsWith(month)&&m.day<=(upto||'9999')).sort((a,b)=>String(a.day).localeCompare(String(b.day)));
  if(!M.length||!days.length)return [{branch:e.branch,dept:e.dept,w:1}];
  const seg=[];let cur={branch:M[0].fromBranch,dept:M[0].fromDept},from=days[0];
  for(const m of M){const n=days.filter(d=>d>=from&&d<m.day).length;if(n)seg.push({...cur,n});cur={branch:m.toBranch,dept:m.toDept};from=m.day;}
  const n=days.filter(d=>d>=from).length;if(n)seg.push({...cur,n});
  const tot=seg.reduce((a,s)=>a+s.n,0)||1;const out={};
  for(const s of seg){const k=s.branch+'|'+s.dept;(out[k]||(out[k]={branch:s.branch,dept:s.dept,w:0})).w+=s.n/tot;}
  return Object.values(out);
}
function deptPart(month,branch,dept,upto,code){
  const dp=deptProgress(month,branch,dept,upto,code);const cfg=tgtCfg(month,branch,dept);const manD=+cfg?.pts>0;
  const base=dp?.pct==null?(dp?.points??null):manD?Math.round(+cfg.pts*tgtRatio(dp.pct)):dp.points;
  return {dp,cfg,manD,base,deptMax:dp?(manD?+cfg.pts:100):0};
}
function empTarget(e,month,upto){
  const segs=deptSegments(e,month,upto);
  const P=segs.map(s=>({...deptPart(month,s.branch,s.dept,upto,e.code),w:s.w}));
  const last=P[P.length-1];
  const caps=captainsOfEmp(e,month,upto);
  const capPts=caps.reduce((a,c)=>a+(c.points||0),0);
  if(!P.some(p=>p.dp)&&!caps.length) return null;
  let dp=last.dp,base=last.base,deptMax=last.deptMax,cfgNeed=+last.cfg?.need>0?+last.cfg.need:null;
  if(P.length>1){   // متقسم على الأقسام بالأيام
    const H=P.filter(p=>p.dp);const W=H.reduce((a,p)=>a+p.w,0)||1;const pc=H.filter(p=>p.dp.pct!=null);
    dp=H.length?{...(last.dp||H[H.length-1].dp),pct:pc.length?pc.reduce((a,p)=>a+p.dp.pct*p.w,0)/pc.reduce((a,p)=>a+p.w,0):null}:null;
    base=H.some(p=>p.base!=null)?Math.round(H.reduce((a,p)=>a+(p.base||0)*p.w,0)/W):null;
    deptMax=Math.round(H.reduce((a,p)=>a+p.deptMax*p.w,0)/W);
    cfgNeed=P.every(p=>+p.cfg?.need>0)?Math.round(P.reduce((a,p)=>a+(+p.cfg.need)*p.w,0)):null;
  }
  const maxPts=deptMax+caps.reduce((a,c)=>a+(c.max||0),0);
  const need=cfgNeed!=null?cfgNeed:Math.round(maxPts*TGT_G()/100);
  const cc=complaintsOf(e.code,month);
  const raw=(base||0)+capPts;
  const has=base!=null||caps.length>0;
  const pp=tgtPenaltyPct(e.code,month);   // خصم (تلاعب / تقييم كاميرات ناقص)
  const bandPts=isCashierEmp(e)&&(base||0)>0?cashierPts(e.code,month):0;   // باندات هيد الكاشير بتزيد وتنقص بس من 85% (لما النقط الأساسية أكبر من صفر)
  const empPoints=has?Math.max(0,Math.round((cc?raw*(1-S.settings.complaintPenalty/100):raw)*(1-pp/100)+bandPts)):null;
  return {...(dp||{pct:null,pace:null}),basePoints:base,caps,capPts,empPoints,complaints:cc,penaltyPct:pp,bandPts,deptMax,maxPts,need,manual:last.manD,split:P.length>1?segs:null};
}
const money=p=>p==null?null:Math.round(p/100*(+S.settings.bonusAt100||0));
// المسار التاني: التارجت (القسم + الكابتن) — نسبة "على المسار" (مبيعات نص الشهر بتتقارن باللي المفروض لحد النهارده)
function tgtOf(t,month,upto){
  if(!t)return null;const cap=S.settings.capPct||120;
  const pace=upto&&upto<monthOf(upto)+'-'+pad(daysInMonth(month))?monthDays(month,upto).length/daysInMonth(month)*100:100;
  const adj=p=>p==null?null:Math.min(cap,pace>0?p/pace*100:p);
  const dept=t.type==='sales'?adj(t.pct):t.pct==null?null:Math.min(cap,t.pct);
  const dPts=dept==null?null:Math.round((t.deptMax||100)*tgtRatio(dept));
  const cPts=(t.caps||[]).map(c=>{const a=adj(c.pct);return a==null?null:Math.round((c.max||0)*tgtRatio(a));}); // same order as t.caps
  const any=dPts!=null||cPts.some(v=>v!=null);
  let v=any?(dPts||0)+cPts.reduce((a,b)=>a+(b||0),0):null;
  if(v!=null&&t.complaints)v=Math.round(v*(1-S.settings.complaintPenalty/100));
  if(v!=null&&t.penaltyPct)v=Math.round(v*(1-t.penaltyPct/100));
  if(v!=null&&t.bandPts&&(dPts||0)>0)v=Math.max(0,v+t.bandPts);   // باندات هيد الكاشير
  return {v,need:t.need,max:t.maxPts,dept,dPts,cPts,pace,type:t.type,t};
}
