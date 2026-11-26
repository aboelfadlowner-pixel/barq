// نجم أبو الفضل — الدخول والخروج: الكل بكود البصمة + رقم سري (المدير بيدخل كمدير، الموظف كموظف)
// ---------- login / modal ----------
// شاشة دخول واحدة للكل: كود البصمة + الرقم السري. لو الكود مربوط بحساب مدير ← بيدخل كمدير بصلاحياته بس، غير كده ← موظف.
// (مدير التشغيل يقدر يكتب اسم الدخول بتاعه بدل الكود)
async function openLogin(){
  if(!USER&&isEmp()){if(await askConfirm('خروج من حسابك؟'))meLogout();return;}
  if(USER){if(await askConfirm('تسجيل خروج؟')){USER=null;PIN=null;try{sessionStorage.removeItem('najm-user')}catch(e){}if(LIVE)await refresh();render();}return;}
  openModal(`<button class="x" onclick="closeModal()">✕</button><div class="login"><h2>دخول</h2>${loginFields()}</div>`);
  setTimeout(()=>$('#l_id')?.focus(),50);
}
function loginFields(big){const fs=big?'font-size:20px;':'';
  return `<label>كود البصمة<br><input class="inp" id="l_id" inputmode="numeric" style="width:100%;${fs}" autocomplete="username"></label><br><br>
    <label>الرقم السري <span class="muted small">(للمديرين — والموظف لو مدير التشغيل اداله رقم)</span><br><input class="inp" id="l_pin" type="password" inputmode="numeric" style="width:100%;${fs}" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()"></label>
    <div class="row" style="margin-top:12px"><button class="btn pri" onclick="doLogin()">دخول</button></div>
    <div class="small muted" style="margin-top:10px">الموظف بيدخل بكود البصمة بس. 5 محاولات رقم سري غلط ← الحساب بيتقفل 15 دقيقة.</div>`;}
function empLoginForm(title,desc){
  return `<div class="card login" style="max-width:520px;margin:20px auto"><h2>${title}</h2><div class="muted" style="margin-bottom:10px">${desc}</div>${loginFields(true)}</div>`;
}
// local (demo / offline) PINs: {code:{pin,must}}
const localEmpPin=c=>S.empPins?.[c];
async function doLogin(){
  // لو المتصفح كتب «85 — الاسم» في خانة الكود، بناخد الكود بس
  const id=$('#l_id').value.split(/[—–-]/)[0].trim(),pin=$('#l_pin').value.trim();
  if(!id){toast('اكتب كود البصمة');return;}
  const bad='الكود أو الرقم السري غلط — بعد 5 محاولات غلط الحساب بيتقفل 15 دقيقة';
  let r;
  if(LIVE){try{r=await sbRpc('najm_login_any',{p_id:id,p_pin:pin});}catch(x){toast(/wrong code/.test(x.message)?bad:'⚠️ مش قادر أوصل لقاعدة البيانات');return;}}
  else{const u=S.users.find(x=>x.active!==false&&(x.username===id.toLowerCase()||(x.emp_code&&x.emp_code===id)));
    if(u)r=u.pin===pin?{kind:'mgr',...u}:null;
    else{const p=localEmpPin(id),e=emp(id);r=e&&e.active&&(!p||p.pin===pin)?{kind:'emp',code:id,must_change:!!p?.must,has_pin:!!p}:null;}}
  if(!r){toast(bad);return;}
  closeModal();
  if(r.kind==='mgr'){
    ME=null;MEPIN=null;meSave();PIN=pin;
    USER={username:r.username,name:r.name,role:r.role,branch:r.branch||'',branches:r.branches||[],shift:r.shift||'',depts:r.depts||[]};
    try{sessionStorage.setItem('najm-user',JSON.stringify({...USER,pin:LIVE?PIN:undefined}))}catch(e){}
    F.branch=userBranches(USER).length===1?userBranches(USER)[0]:'';VIEW='me';
    if(LIVE){toast('⏳ بنحمّل بيانات فريقك…');await refresh();await seedEmployeesIfEmpty();}
    render();toast('أهلاً '+r.name);return;
  }
  ME=String(r.code);MEPIN=pin;ME_HASPIN=!!r.has_pin;meSave();VIEW='me';
  if(LIVE){toast('⏳ بنجهّز صفحتك…');await refresh(true);}render();
  if(r.must_change)meChangePin(true);
}
function meLogout(){ME=null;MEPIN=null;ME_HASPIN=false;meSave();VOTER=null;VIEW='dash';render();}
async function meChangePin(first){
  const p=await askText(first?'أول مرة: اختار رقم سري جديد ليك (4 لـ 6 أرقام)':'الرقم السري الجديد (4 لـ 6 أرقام)');if(p===null)return;const np=p.trim();
  if(!/^\d{4,6}$/.test(np)){toast('الرقم السري لازم يكون من 4 لـ 6 أرقام');return meChangePin(first);}
  if(np===MEPIN){toast('اختار رقم مختلف عن القديم');return meChangePin(first);}
  if(LIVE){try{await sbRpc('najm_emp_set_pin',{p_code:ME,p_pin:MEPIN,p_new:np});}catch(x){toast('⚠️ '+x.message);return;}}
  else{S.empPins[ME]={pin:np,must:false};save();}
  MEPIN=np;meSave();toast('✔ اتغيّر الرقم السري');
}
