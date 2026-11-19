// نجم أبو الفضل — الدخول والخروج للمديرين
// ---------- login / modal ----------
async function openLogin(){
  if(USER){if(await askConfirm('تسجيل خروج؟')){USER=null;PIN=null;try{sessionStorage.removeItem('najm-user')}catch(e){}if(LIVE)await refresh();render();}return;}
  openModal(`<button class="x" onclick="closeModal()">✕</button><div class="login"><h2>🔐 دخول المديرين</h2>
    <label>اسم الدخول<br><input class="inp" id="l_user" style="width:100%" autocomplete="username"></label><br><br>
    <label>الرقم السري<br><input class="inp" id="l_pin" type="password" inputmode="numeric" style="width:100%" onkeydown="if(event.key==='Enter')doLogin()"></label>
    <div class="row" style="margin-top:12px"><button class="btn pri" onclick="doLogin()">دخول</button></div>
    <div class="small muted" style="margin-top:10px">الموظفين مش محتاجين دخول.</div></div>`);
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
