// نجم أبو الفضل — الدخول والخروج: المديرين (يوزر + رقم سري) والموظفين (كود البصمة + رقم سري)
// ---------- login / modal ----------
async function openLogin(){
  if(USER){if(await askConfirm('تسجيل خروج؟')){USER=null;PIN=null;try{sessionStorage.removeItem('najm-user')}catch(e){}if(LIVE)await refresh();render();}return;}
  openModal(`<button class="x" onclick="closeModal()">✕</button><div class="login"><h2>🔐 دخول المديرين</h2>
    <label>اسم الدخول<br><input class="inp" id="l_user" style="width:100%" autocomplete="username"></label><br><br>
    <label>الرقم السري<br><input class="inp" id="l_pin" type="password" inputmode="numeric" style="width:100%" onkeydown="if(event.key==='Enter')doLogin()"></label>
    <div class="row" style="margin-top:12px"><button class="btn pri" onclick="doLogin()">دخول</button></div>
    <div class="small muted" style="margin-top:10px">الموظفين بيدخلوا من «📈 تقريري» بكود البصمة ورقمهم السري.</div></div>`);
  setTimeout(()=>$('#l_user')?.focus(),50);
}
async function doLogin(){
  const un=$('#l_user').value.trim().toLowerCase(),pin=$('#l_pin').value;
  let u;
  if(LIVE){try{u=await sbRpc('najm_login',{p_user:un,p_pin:pin});}catch(e){toast('⚠️ مش قادر أوصل لقاعدة البيانات');return;}PIN=pin;}
  else u=S.users.find(x=>x.username===un&&x.pin===pin&&x.active!==false);
  if(!u){PIN=null;toast('اسم الدخول أو الرقم السري غلط — بعد 5 محاولات غلط الحساب بيتقفل 15 دقيقة');return;}
  USER={username:u.username,name:u.name,role:u.role,branch:u.branch||'',shift:u.shift||'',depts:u.depts||[]};
  try{sessionStorage.setItem('najm-user',JSON.stringify({...USER,pin:LIVE?PIN:undefined}))}catch(e){}
  F.branch=USER.branch||'';closeModal();VIEW=USER.role==='ops'?'dash':'rate';
  if(LIVE){toast('⏳ بنحمّل بيانات فريقك…');await refresh();await seedEmployeesIfEmpty();}
  render();toast('أهلاً '+u.name);
}

// ---------- دخول الموظف: كود البصمة + الرقم السري ----------
function empLoginForm(title,desc){
  return `<div class="card" style="max-width:520px;margin:20px auto"><h2>${title}</h2><div class="muted" style="margin-bottom:10px">${desc}</div>
    <label>كود البصمة<br><input class="inp" id="me_code" inputmode="numeric" style="width:100%;font-size:20px" autocomplete="username"></label><br><br>
    <label>الرقم السري<br><input class="inp" id="me_pin" type="password" inputmode="numeric" style="width:100%;font-size:20px" autocomplete="current-password" onkeydown="if(event.key==='Enter')meLogin()"></label>
    <div class="row" style="margin-top:12px"><button class="btn pri" onclick="meLogin()">دخول</button></div>
    <div class="small muted" style="margin-top:8px">الرقم السري بتاخده من مدير التشغيل أول مرة، وبتغيّره بنفسك. الموبايل هيفتكرك. 5 محاولات غلط ← الحساب بيتقفل 15 دقيقة.</div></div>`;
}
// local (demo / offline) PINs: {code:{pin,must}}
const localEmpPin=c=>S.empPins?.[c];
async function meLogin(){
  const c=$('#me_code').value.trim(),pin=$('#me_pin').value.trim();const e=emp(c);
  if(!c||!pin){toast('اكتب الكود والرقم السري');return;}
  let must=false;
  if(LIVE){let r;try{r=await sbRpc('najm_emp_login',{p_code:c,p_pin:pin});}catch(x){toast(/wrong code/.test(x.message)?'الكود أو الرقم السري غلط — أو الحساب اتقفل 15 دقيقة بعد 5 محاولات غلط':'⚠️ مش قادر أوصل لقاعدة البيانات');return;}must=!!r.must_change;}
  else{const p=localEmpPin(c);if(!e||!e.active||!p||p.pin!==pin){toast('الكود أو الرقم السري غلط');return;}must=!!p.must;}
  ME=c;MEPIN=pin;meSave();
  if(LIVE){toast('⏳ بنجهّز صفحتك…');await refresh(true);}render();
  if(must)meChangePin(true);
}
function meLogout(){ME=null;MEPIN=null;meSave();VOTER=null;render();}
async function meChangePin(first){
  const p=await askText(first?'أول مرة: اختار رقم سري جديد ليك (4 لـ 6 أرقام)':'الرقم السري الجديد (4 لـ 6 أرقام)');if(p===null)return;const np=p.trim();
  if(!/^\d{4,6}$/.test(np)){toast('الرقم السري لازم يكون من 4 لـ 6 أرقام');return meChangePin(first);}
  if(np===MEPIN){toast('اختار رقم مختلف عن القديم');return meChangePin(first);}
  if(LIVE){try{await sbRpc('najm_emp_set_pin',{p_code:ME,p_pin:MEPIN,p_new:np});}catch(x){toast('⚠️ '+x.message);return;}}
  else{S.empPins[ME]={pin:np,must:false};save();}
  MEPIN=np;meSave();toast('✔ اتغيّر الرقم السري');
}
