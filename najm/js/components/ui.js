// نجم أبو الفضل — رسايل التنبيه، نوافذ التأكيد، والنافذة المنبثقة
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',2200);}
// in-page dialogs (the published page can't use the browser's confirm/prompt)
function askDialog(msg,withInput){return new Promise(res=>{
  const bg=$('#askBg');
  $('#ask').innerHTML=`<h3 style="margin-bottom:10px">${esc(msg)}</h3>${withInput?'<textarea class="inp" id="askIn" rows="3" style="width:100%"></textarea>':''}<div class="row" style="margin-top:12px"><button class="btn pri" id="askOk">${withInput?'حفظ':'تأكيد'}</button><button class="btn" id="askNo">إلغاء</button></div>`;
  bg.classList.add('open');const done=v=>{bg.classList.remove('open');res(v);};
  $('#askOk').onclick=()=>done(withInput?$('#askIn').value:true);$('#askNo').onclick=()=>done(withInput?null:false);
  if(withInput)setTimeout(()=>$('#askIn')?.focus(),30);
});}
const askConfirm=m=>askDialog(m,false), askText=m=>askDialog(m,true);
function openModal(h){$('#modal').innerHTML=h;$('#modalBg').classList.add('open');if(IMP&&$('#impPrev'))previewImp();}
function closeModal(){$('#modalBg').classList.remove('open');IMP=null;}
