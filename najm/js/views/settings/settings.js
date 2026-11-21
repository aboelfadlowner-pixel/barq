// نجم أبو الفضل — تاب الإعدادات (مدير التشغيل)
// ---------- Settings (ops) ----------
function vSettings(){
  const s=S.settings;
  const num=(path,label,step=1)=>`<label class="small">${label}<br><input class="inp" type="number" step="${step}" style="width:110px" value="${path.split('.').reduce((o,k)=>o[k],s)}" onchange="setS('${path}',+this.value)"></label>`;
  const txt=(path,label,type='text')=>`<label class="small">${label}<br><input class="inp" type="${type}" value="${esc(path.split('.').reduce((o,k)=>o[k],s))}" onchange="setS('${path}',this.value)"></label>`;
  return `<div class="sec-title"><h2>⚙️ الإعدادات</h2><div class="row"><button class="btn" onclick="openImports()">📂 الملفات المرفوعة</button><button class="btn" onclick="openSettingsLog()">📜 سجل التغييرات</button></div></div>
  <div class="card" style="margin-bottom:12px"><div class="sec-title"><h3>🔐 حسابات المديرين</h3><button class="btn pri sm" onclick="editUser()">+ حساب</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>اسم الدخول</th><th>الاسم</th><th>الدور</th><th>الفرع</th><th>الشيفت</th><th>الأقسام</th><th></th></tr></thead><tbody>
    ${S.users.map(u=>`<tr style="${u.active===false?'opacity:.5':''}"><td><b>${esc(u.username)}</b></td><td><div class="row" style="flex-wrap:nowrap;gap:6px">${u.emp_code&&emp(u.emp_code)?ava(emp(u.emp_code),'sm'):''}${esc(u.name)}</div></td><td>${ROLES[u.role]}</td><td class="small">${esc(u.branch||'الكل')}</td><td class="small">${esc(u.shift||'—')}</td><td class="small">${esc((u.depts||[]).join('، ')||'—')}</td><td><button class="btn sm" onclick="editUser('${esc(u.username)}')">✏️</button></td></tr>`).join('')}
    </tbody></table></div><div class="small muted" style="margin-top:6px">الموظفين بيدخلوا من غير حساب ويشوفوا النجوم والترتيب والتارجت بس.</div></div>
  <div class="grid g-2">
   <div class="card"><h3>⏰ نجوم البصمة</h3><div class="row">${num('att.on','في ميعاده',.25)}${num('att.late','تأخير بسيط',.25)}${num('att.vlate','تأخير كبير',.25)}${num('att.abs','غياب',.25)}</div>
     <div class="row" style="margin-top:8px">${txt('shiftStart.Morning','بداية Morning','time')}${txt('shiftStart.Between','بداية Between','time')}${txt('shiftStart.Night','بداية Night','time')}</div>
     <div class="row" style="margin-top:8px">${num('graceMin','سماح (دقيقة)')}${num('lateMax','تأخير بسيط لحد')}</div></div>
   <div class="card"><h3>🟨🟥🟩 الكروت</h3><div class="row">${num('cards.yellow','أصفر')}${num('cards.red','أحمر')}${num('cards.green','أخضر')}${num('cards.yellowsToRed','كام أصفر في الشهر = أحمر')}</div><div class="small muted" style="margin-top:6px">الحساب الرسمي في الداتابيز بنفس القيم دي. الكروت بتأثر على الـ KPI بس.</div></div>
   <div class="card"><h3>🏆 رجل اليوم</h3><div class="row">${num('finalists','عدد المرشحين اللي بيظهروا')}${num('minStarsWinner','أقل نجوم للترشيح',.25)}</div>
     <div class="small" style="margin:8px 0 4px"><b>عدد رجال اليوم لكل فرع</b> (Between بيتحسب مع الليل):</div>
     ${branches().map(b=>`<div class="row" style="gap:6px;margin-bottom:4px"><span class="small" style="min-width:110px">${esc(b)}</span>${SHIFT_GROUPS.map(g=>`<label class="small">${GROUP_NAME[g]} <input class="inp" type="number" min="0" style="width:60px" value="${winnersFor(b,g)}" onchange="setWinnersBy('${esc(b)}','${g}',+this.value)"></label>`).join('')}</div>`).join('')}
     <label class="small" style="display:block;margin-top:8px">أقسام الفريش فود (مفصولة بفاصلة)<br><input class="inp" style="width:100%" value="${esc(s.freshDepts.join('، '))}" onchange="setS('freshDepts',this.value.split(/[،,]/).map(x=>x.trim()).filter(Boolean))"></label></div>
   <div class="card"><h3>🔒 إغلاق اليوم</h3><div class="row"><label class="small">الخصم بيبدأ من يوم<br><input class="inp" type="date" value="${esc(s.closeStart||'')}" onchange="setS('closeStart',this.value)"></label>${num('closeAfterHours','آخر ميعاد = بداية الشيفت + ساعات')}${num('lateClosePenalty','خصم التأخير (نقطة)')}</div>
     <div class="small muted" style="margin-top:6px">كل مدير شيفت بيقفل شيفته (Between مع الليل). لو اتأخر عن الميعاد، الخصم بيتسجل في رصيده تلقائي من غير موافقتك. لو التاريخ فاضي، الخصم مش شغال.</div></div>
   <div class="card"><h3>🔑 الرقم السري للموظفين</h3><div class="small muted" style="margin-bottom:6px">الموظف بيدخل «تقريري» والتصويت والاعتراض بكود البصمة + رقم سري. أول مرة بيدخل بالرقم اللي هنا وبيغيّره بنفسه.</div>
     <div class="small" style="margin-bottom:6px">عندهم رقم: <b>${fmt(Object.keys(S.empPins||{}).length)}</b> من ${fmt(activeEmps().length)} موظف</div>
     <div class="row"><button class="btn pri sm" onclick="genEmpPins(false)">🔑 أرقام للي ملهمش + Excel</button><button class="btn sm red" onclick="genEmpPins(true)">أرقام جديدة للكل</button></div></div>
   ${rulesCardHTML()}
   <div class="card"><h3>📈 تقرير الـ10 أيام</h3><div class="row"><label class="small">أيام التقرير<br><input class="inp" style="width:110px" value="${esc((s.checkpoints||[10,20]).join('، '))}" onchange="setS('checkpoints',this.value.split(/[،,\s]+/).map(Number).filter(x=>x>0&&x<31))"></label></div><div class="small muted" style="margin-top:6px">آخر يوم في الشهر بيطلع فيه تقرير دايماً.</div></div>
   <div class="card"><h3>🎯 التارجت والكابتن</h3><div class="row">${num('defaultMultiplier','المُضاعِف',.1)}${num('capPct','أقصى نسبة %')}${num('complaintPenalty','خصم الشكوى %')}${num('captainMult','مضاعف الكابتن ×')}</div></div>
   <div class="card"><h3>🏆 الجوايز (بتظهر للكل)</h3><div class="row">${num('prizes.gold','الكأس الدهبي (ج)')}${num('prizes.silver','الكأس الفضي (ج)')}${num('prizes.bronze','الكأس البرونزي (ج)')}${num('prizes.top10','من 4 لـ 10 (ج)')}${num('prizes.daily','رجل اليوم (ج)')}</div></div>
   <div class="card"><h3>🎖️ نقاط المديرين</h3><div class="row">${num('mgrPoints.rating','لكل نقطة تقييم يومي',.5)}${num('mgrPoints.winner','رجل يوم من فريقه')}${num('mgrPoints.gold','كاس دهبي في فريقه')}${num('mgrPoints.silver','كاس فضي')}${num('mgrPoints.bronze','كاس برونزي')}${num('mgrPoints.top10','من 4 لـ 10')}${num('mgrPoints.red','كارت أحمر في فريقه')}${num('mgrPoints.bonus','مكافأة المدير المثالي (نقاط)')}${num('prizes.manager','المدير المثالي (جنيه)')}${num('marketDays','أيام فتح السوق للعروض')}${num('mgrWeights.ops','وزن تقييم التشغيل %')}${num('mgrWeights.team','وزن أداء الفريق %')}${num('mgrWeights.votes','وزن تصويت الموظفين %')}</div></div>
   <div class="card"><h3>📺 شاشات الفروع</h3><div class="small muted" style="margin-bottom:6px">افتح الرابط على تلفزيون الفرع وسيبه — بيتقلب ويتحدث لوحده.</div>${tvLinks()}</div>
   <div class="card"><h3>💰 مكافأة التارجت (مخفية)</h3>${num('bonusAt100','المكافأة عند 100 نقطة (ج)')}</div>
   <div class="card"><h3>💾 البيانات</h3><div class="row"><button class="btn pri" onclick="exportJSON()">⬇️ نسخة احتياطية</button>${LIVE?'':'<button class="btn" onclick="importJSON()">⬆️ استرجاع</button>'}<button class="btn" onclick="exportXLSX()">📊 Excel للشهر</button>${LIVE?'':'<button class="btn gold" onclick="loadDemo()">🧪 بيانات تجريبية</button>'}</div><div class="small muted" style="margin-top:6px;${LIVE?'display:none':''}">البيانات التجريبية بتملا الشهر بأرقام وهمية وحسابات مديرين تجريبية (haitham/1111 · mahmoud/2222 · islam/3333 · firas/5555).</div></div>
  </div>`;
}
// ---------- قواعد الشهر (rules.js): مدير التشغيل بيحددها، والتغيير بيبدأ من الشهر الجاي ----------
let RD=null;   // مسودة القواعد اللي بتتعدّل
const nextMonthOf=m=>{const [y,mo]=m.split('-').map(Number);return mo===12?`${y+1}-01`:`${y}-${String(mo+1).padStart(2,'0')}`;};
function rulesCardHTML(){
  const cm=monthOf(ymd(new Date())),nm=nextMonthOf(cm);const cur=rulesFor(cm),nxt=rulesFor(nm);
  if(!RD)RD=JSON.parse(JSON.stringify(nxt));
  const tiers=(R)=>R.ptsTiers.map(t=>`<span style="white-space:nowrap">${fmt(t[0])}٪ = ${fmt(t[1])} نقطة</span>`).join(' · ');
  const diff=JSON.stringify(cur)!==JSON.stringify(nxt);
  return `<div class="card" style="grid-column:1/-1;border-color:var(--gold)"><h3>📐 قواعد الشهر (التأهل ونقط التارجت)</h3>
    <div class="small" style="margin-bottom:8px">شغالة في ${monthName(cm)}: حد الـ KPI <b>${fmt(cur.goal)}</b> · المطلوب من التارجت <b>${fmt(cur.targetGoal)}%</b> · أقل أيام شغل <b>${fmt(cur.minWorkDays)}</b> <br>الشرايح (${cur.ptsMode==='step'?'سلّم':'بالتناسب'}): ${tiers(cur)}</div>
    ${diff?`<div class="small" style="margin-bottom:8px;color:var(--purple)">من ${monthName(nm)}: حد الـ KPI <b>${fmt(nxt.goal)}</b> · التارجت <b>${fmt(nxt.targetGoal)}%</b> · أيام <b>${fmt(nxt.minWorkDays)}</b> · ${tiers(nxt)} (${nxt.ptsMode==='step'?'سلّم':'بالتناسب'})</div>`:''}
    <div class="row" style="gap:10px;align-items:flex-end">
      <label class="small">حد الـ KPI<br><input class="inp" type="number" style="width:90px" value="${RD.goal}" onchange="RD.goal=+this.value"></label>
      <label class="small">المطلوب من التارجت %<br><input class="inp" type="number" style="width:90px" value="${RD.targetGoal}" onchange="RD.targetGoal=+this.value"></label>
      <label class="small">أقل أيام شغل للتأهل<br><input class="inp" type="number" style="width:90px" value="${RD.minWorkDays}" onchange="RD.minWorkDays=+this.value"></label>
      <label class="small">بين الشرايح<br><select class="inp" onchange="RD.ptsMode=this.value"><option value="linear" ${RD.ptsMode!=='step'?'selected':''}>بالتناسب (93% ← 93)</option><option value="step" ${RD.ptsMode==='step'?'selected':''}>سلّم (93% ← نقط 85%)</option></select></label>
    </div>
    <div class="small" style="margin:10px 0 4px"><b>شرايح نقط التارجت</b> — أقل من أول شريحة = صفر، وأكتر من آخر شريحة = نقط آخر شريحة:</div>
    <div class="row" style="gap:6px">${RD.ptsTiers.map((t,i)=>`<span class="row" style="gap:2px;border:1px solid var(--line);border-radius:8px;padding:3px 6px;flex-wrap:nowrap"><input class="inp" type="number" style="width:62px" value="${t[0]}" onchange="RD.ptsTiers[${i}][0]=+this.value">%←<input class="inp" type="number" style="width:62px" value="${t[1]}" onchange="RD.ptsTiers[${i}][1]=+this.value"><button class="btn sm" onclick="RD.ptsTiers.splice(${i},1);render()">✕</button></span>`).join('')}<button class="btn sm" onclick="RD.ptsTiers.push([0,0]);render()">+ شريحة</button></div>
    <div class="row" style="margin-top:10px;gap:6px"><button class="btn pri sm" onclick="saveRules(false)">💾 حفظ — يبدأ من ${monthName(nm)}</button><button class="btn sm red" onclick="saveRules(true)">طبّق على ${monthName(cm)} (بسبب)</button><button class="btn sm" onclick="RD=null;render()">رجّع</button></div>
    <div class="small muted" style="margin-top:6px">كل شهر بيتحسب بالقواعد اللي كانت شغالة فيه — التغيير مبيغيّرش نتايج الشهور اللي فاتت ولا الجوايز اللي اتصرفت.</div></div>`;
}
async function saveRules(now){
  const cm=monthOf(ymd(new Date())),from=now?cm:nextMonthOf(cm);
  const T=RD.ptsTiers.map(t=>[+t[0],+t[1]]).filter(t=>t[0]>0).sort((a,b)=>a[0]-b[0]);
  if(!T.length||!(RD.minWorkDays>=0)||!(RD.goal>0)){toast('راجع الأرقام');return;}
  let reason='';
  if(now){reason=await askText(`تطبيق القواعد الجديدة على ${monthName(cm)} هيغيّر ترتيب ونقط الشهر ده. اكتب السبب:`);if(reason===null)return;reason=reason.trim();if(!reason){toast('لازم تكتب السبب');return;}}
  else if(!await askConfirm(`حفظ القواعد الجديدة؟ هتبدأ من ${monthName(from)}، و${monthName(cm)} هيفضل بالقواعد الحالية.`))return;
  const V=[...(S.settings.ruleVersions||[])];
  if(!V.length)V.push({from:'0000-00',rules:rulesFor(cm)});   // القواعد القديمة للشهور اللي فاتت
  const rules={...RD,ptsTiers:T};
  const i=V.findIndex(v=>v.from===from);const ver={from,rules,by:USER.username,at:new Date().toISOString(),...(reason?{reason}:{})};
  if(i>=0)V[i]=ver;else V.push(ver);V.sort((a,b)=>a.from.localeCompare(b.from));
  RD=null;setS('ruleVersions',V,reason||`قواعد جديدة من ${from}`);render();
}
function setS(path,v,reason){OLD_VAL=JSON.parse(JSON.stringify(path==='bonusAt100'?{bonusAt100:S.settings.bonusAt100}:S.settings));const ks=path.split('.');let o=S.settings;while(ks.length>1)o=o[ks.shift()];o[ks[0]]=v;save();RANK_CACHE=null;const p=path==='bonusAt100'?push('private',{},{bonusAt100:v}):(({bonusAt100,...pub})=>push('settings',reason?{reason,path}:{path},pub))(S.settings);p.then(r=>{if(r!==false)toast('اتحفظ');});}
function editUser(name){
  const u=name?S.users.find(x=>x.username===name):{username:'',name:'',role:'shift',branch:branches()[0],shift:'Morning',depts:[],active:true};
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>${name?'تعديل حساب':'حساب جديد'}</h2>
   <div class="grid g-2">
    <label style="grid-column:1/-1">المدير نفسه (من الموظفين)<br><input class="inp" id="u_emp" list="dl_emps" style="width:100%" placeholder="اكتب الاسم أو الكود" value="${u.emp_code&&emp(u.emp_code)?esc(u.emp_code+' — '+emp(u.emp_code).name):''}" onchange="userFromEmp()"><datalist id="dl_emps">${activeEmps().map(e=>`<option value="${esc(e.code+' — '+e.name)}">${esc(e.job+' · '+e.branch)}</option>`).join('')}</datalist></label>
    <label>اسم الدخول (اختياري — المدير بيدخل بكود البصمة بتاعه)<br><input class="inp" id="u_user" value="${esc(u.username)}" ${name?'disabled':''} placeholder="لو فاضي = كود البصمة"></label>
    <label>الاسم<br><input class="inp" id="u_name" value="${esc(u.name)}"></label>
    <label>الدور<br><select class="inp" id="u_role">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>الفرع<br><select class="inp" id="u_branch"><option value="">كل الفروع</option>${branches().map(b=>`<option ${b===u.branch?'selected':''}>${esc(b)}</option>`).join('')}</select></label>
    <label>الشيفت (لمدير الشيفت)<br><select class="inp" id="u_shift"><option value="">—</option>${Object.values(SH).map(s=>`<option ${s===u.shift?'selected':''}>${s}</option>`).join('')}</select></label>
    <label>الأقسام (لمدير الفريش)<br><input class="inp" id="u_depts" value="${esc((u.depts||[]).join('، '))}" placeholder="قسم البقاله"></label>
    <label>الرقم السري ${name?'(سيبه فاضي لو مش هتغيّره)':''}<br><input class="inp" id="u_pin" type="password" inputmode="numeric"></label>
    <label><input type="checkbox" id="u_active" ${u.active!==false?'checked':''}> الحساب شغّال</label>
   </div><div class="row" style="margin-top:12px"><button class="btn pri" onclick="saveUser('${esc(name||'')}')">💾 حفظ</button>${name&&name!==USER.username?`<button class="btn red" onclick="delUser('${esc(name)}')">حذف</button>`:''}</div>`);
}
function userFromEmp(){const c=($('#u_emp').value.split('—')[0]||'').trim();const e=emp(c);if(!e)return;
  if(!$('#u_name').value)$('#u_name').value=e.name;$('#u_name').value=e.name;$('#u_branch').value=e.branch;if(Object.values(SH).includes(e.shift))$('#u_shift').value=e.shift;}
async function saveUser(name){
  const g=id=>$('#'+id).value.trim();const ec0=(g('u_emp').split('—')[0]||'').trim();const un=(name||g('u_user')||(emp(ec0)?ec0:'')).toLowerCase();
  if(!un||!g('u_name')){toast('اختار المدير من الموظفين (كود البصمة) واكتب الاسم');return;}
  if(emp(ec0)&&S.users.some(x=>x.emp_code===ec0&&x.username!==un)){toast('الكود ده مربوط بحساب مدير تاني');return;}
  let u=S.users.find(x=>x.username===un);
  if(!name&&u){toast('اسم الدخول موجود');return;}
  if(!u&&!g('u_pin')){toast('حط رقم سري');return;}
  if(!u){u={username:un};S.users.push(u);}
  const ec=(g('u_emp').split('—')[0]||'').trim();
  Object.assign(u,{name:g('u_name'),role:g('u_role'),branch:g('u_branch'),shift:g('u_shift'),depts:g('u_depts').split(/[،,]/).map(x=>x.trim()).filter(Boolean),active:$('#u_active').checked,emp_code:emp(ec)?ec:''});
  if(g('u_pin'))u.pin=g('u_pin');
  save();closeModal();render();
  if(await push('user',{username:un},{name:u.name,role:u.role,branch:u.branch,shift:u.shift,depts:u.depts,active:u.active,pin:g('u_pin')||''})!==false){await pushM('user_emp',{username:un},{emp_code:u.emp_code||''});toast('💾 اتحفظ الحساب');refresh(true);}
}
async function delUser(n){if(!await askConfirm('حذف الحساب؟'))return;S.users=S.users.filter(u=>u.username!==n);save();closeModal();render();push('user',{username:n},null);}
async function loadDemo(){
  if(!await askConfirm('هيتملى الشهر الحالي ببيانات تجريبية على الجهاز ده بس. تكمل؟'))return;
  const u=USER;demoSeed();USER=u;save();render();toast('🧪 اتحمّلت البيانات التجريبية');
}
function exportJSON(){const b=new Blob([JSON.stringify(S)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`najm-backup-${DATE}.json`;a.click();}
function importJSON(){pickFile('.json',f=>{const r=new FileReader();r.onload=async()=>{try{const d=JSON.parse(r.result);if(!d.employees)throw 0;if(!await askConfirm('هيستبدل كل البيانات. متأكد؟'))return;S=d;normalize();save();render();}catch(e){toast('ملف غير صالح')}};r.readAsText(f);});}
function exportXLSX(){
  const m=monthOf(DATE);
  const sum=activeEmps().map(e=>{const ms=monthSummary(e,m,DATE);return {'الكود':e.code,'الاسم':e.name,'الفرع':e.branch,'القسم':e.dept,'الوظيفة':e.job,'الشيفت':e.shift,'أيام':ms.n,'متوسط النجوم':ms.avg!=null?+ms.avg.toFixed(2):'','تقييم الشهر':ms.monthScore??'','رجل اليوم':ms.wins,'أصفر':ms.cards.y,'أحمر':ms.cards.r,'أخضر':ms.cards.g,'غياب':ms.abs,'تأخير':ms.late,'تارجت %':ms.target?.pct!=null?Math.round(ms.target.pct):'','نقاط الكابتن':ms.target?.capPts||0,'إجمالي النقاط':ms.target?.empPoints??'','مكافأة':ms.target?.empPoints!=null?money(ms.target.empPoints):''};});
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sum),'ملخص الشهر');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(S.cards.filter(c=>c.date.startsWith(m)).map(c=>({'اليوم':c.date,'الكود':c.code,'الاسم':emp(c.code)?.name,'الكارت':CARD[c.color].t,'السبب':c.reason,'من':c.by,'محسوب':c.approved?'✔':'⏳'}))),'الكروت');
  XLSX.writeFile(wb,`najm-${m}.xlsx`);
}

function setWinnersBy(b,g,v){const w=S.settings.winnersBy||(S.settings.winnersBy={});w[b]={...(w[b]||{}),[g]:Math.max(0,v|0)};setS('winnersBy',w);}
// أرقام سرية للموظفين: بتظهر مرة واحدة بس (في ملف Excel للطباعة والتوزيع) — الداتابيز بتحفظها مشفّرة
async function genEmpPins(all){
  if(all&&!await askConfirm('أرقام سرية جديدة لكل الموظفين؟ الأرقام القديمة هتبطل، وكل موظف هيحتاج رقمه الجديد.'))return;
  let map;
  if(LIVE){try{map=await sbRpc('najm_save',{p_user:USER.username,p_pin:PIN,p_kind:'emp_pins_generate',p_key:{},p_data:{all}});}catch(e){toast(errMsg(e.message));return;}}
  else{map={};for(const e of activeEmps())if(all||!S.empPins[e.code]){const p=String(Math.floor(Math.random()*10000)).padStart(4,'0');S.empPins[e.code]={pin:p,must:true};map[e.code]=p;}save();logLocal('emp_pins_generate',{},null);}
  const rows=Object.entries(map||{}).map(([c,p])=>{const e=emp(c);return {'الكود':c,'الاسم':e?.name||'','الفرع':e?.branch||'','القسم':e?.dept||'','الرقم السري':p};});
  if(!rows.length){toast('كل الموظفين عندهم أرقام');return;}
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'أرقام الموظفين');XLSX.writeFile(wb,`najm-pins-${ymd(new Date())}.xlsx`);
  if(LIVE)await refresh(true);render();toast(`🔑 ${rows.length} رقم سري — اتنزّلوا في ملف Excel. وزّعهم واحفظ الملف في مكان آمن.`);
}

// ---------- سجل تغيير الإعدادات: القديم والجديد ومين غيّر وإمتى والسبب ----------
const SET_NAME={att:'نجوم البصمة',cards:'نقط الكروت',ruleVersions:'قواعد الشهر',winnersBy:'عدد رجال اليوم',minStarsWinner:'أقل نجوم للترشيح',finalists:'عدد المرشحين',
  closeStart:'بداية خصم التأخير',lateClosePenalty:'خصم التأخير',closeAfterHours:'ميعاد التسليم (ساعات)',shiftStart:'بداية الشيفتات',graceMin:'سماح البصمة',lateMax:'التأخير البسيط',
  prizes:'الجوايز',mgrPoints:'نقاط المديرين',mgrWeights:'أوزان المدير المثالي',captainMult:'مضاعف الكابتن',capPct:'أقصى نسبة',defaultMultiplier:'المُضاعِف',complaintPenalty:'خصم الشكوى',
  checkpoints:'أيام التقرير',freshDepts:'أقسام الفريش',bonusAt100:'مكافأة التارجت',goal:'حد الـ KPI',targetGoal:'المطلوب من التارجت',marketDays:'مدة السوق'};
const short=v=>{const t=v===undefined?'—':typeof v==='object'?JSON.stringify(v):String(v);return t.length>140?t.slice(0,140)+'…':t;};
function settingsDiff(o,n){o=o||{};n=n||{};return [...new Set([...Object.keys(o),...Object.keys(n)])].filter(k=>JSON.stringify(o[k])!==JSON.stringify(n[k])).map(k=>({k,name:SET_NAME[k]||k,o:o[k],n:n[k]}));}
async function openSettingsLog(){
  let L;
  if(LIVE){try{L=await sbRpc('najm_settings_log',{p_user:USER.username,p_pin:PIN});}catch(e){toast('⚠️ '+errMsg(e.message));return;}}
  else L=(S.history||[]).filter(h=>h.kind==='settings'||h.kind==='private');
  const rows=(L||[]).map(h=>({h,d:settingsDiff(h.data?.old,h.data?.data)})).filter(x=>x.d.length);
  openModal(`<button class="x" onclick="closeModal()">✕</button><h2>📜 سجل تغيير الإعدادات</h2><div class="small muted" style="margin-bottom:8px">كل تغيير بالقيمة القديمة والجديدة، ومين غيّره، وإمتى، والسبب.</div>
    ${rows.length?`<div class="tbl-wrap"><table><thead><tr><th>إمتى</th><th>مين</th><th>إيه اللي اتغيّر</th><th>كان</th><th>بقى</th><th>السبب</th></tr></thead><tbody>
    ${rows.map(({h,d})=>d.map((x,i)=>`<tr>${i?'<td></td><td></td>':`<td class="small" rowspan="1">${new Date(h.at).toLocaleString('ar-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td class="small">${esc(h.actor_name||h.actor)}</td>`}<td class="small"><b>${esc(x.name)}</b></td><td class="small" style="color:var(--red);max-width:220px;word-break:break-all">${esc(short(x.o))}</td><td class="small" style="color:var(--green);max-width:220px;word-break:break-all">${esc(short(x.n))}</td><td class="small">${i?'':esc(h.data?.key?.reason||'')}</td></tr>`).join('')).join('')}
    </tbody></table></div>`:'<div class="empty">مفيش تغييرات متسجلة لسه</div>'}`);
}
