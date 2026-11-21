// نجم أبو الفضل — اختيار وقراءة ملفات الإكسيل والشيتات
// attendance import
function pickFile(accept,cb){const f=$('#filePick');f.value='';f.accept=accept;f.onchange=()=>f.files[0]&&cb(f.files[0]);f.click();}
function readSheet(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{try{const wb=XLSX.read(r.result,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];res(XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''}));}catch(e){rej(e)}};r.onerror=rej;r.readAsArrayBuffer(file);});}
function findHeader(rows,tests){
  for(let i=0;i<Math.min(rows.length,20);i++){const h=rows[i].map(norm);const idx={};for(const[k,re]of Object.entries(tests))idx[k]=h.findIndex(c=>re.test(c));if(Object.values(idx).filter(x=>x>=0).length>=2)return {row:i,idx};}
  return null;
}

// ---------- سجل الملفات المرفوعة + منع رفع نفس الملف مرتين ----------
async function fileHash(f){const b=await f.arrayBuffer();const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const sameFile=(kind,hash)=>(S.imports||[]).find(i=>i.kind===kind&&String(i.file_hash).split('#')[0]===hash);
function importedMsg(i){return `الملف ده اترفع قبل كده — ${esc(i.file_name||'')} بواسطة ${esc(mgrName(i.by_user))} يوم ${new Date(i.at).toLocaleString('ar-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`;}
// بيسجّل الرفع قبل حفظ البيانات (الداتابيز بترفض نفس الملف مرتين). بيرجّع false لو اترفض
async function logImport(info,force){
  const row={kind:info.kind,file_name:info.file,file_hash:force?info.hash+'#'+Date.now():info.hash,by_user:USER.username,at:new Date().toISOString(),branch:info.branch||null,day:info.day||null,month:info.month||null,rows_ok:info.ok||0,rows_bad:info.bad||0,rows_dup:info.dup||0,note:info.note||null};
  if(!LIVE){if(sameFile(info.kind,info.hash)&&!force)return false;(S.imports||(S.imports=[])).unshift(row);save();return true;}
  try{await sbRpc('najm_save',{p_user:USER.username,p_pin:PIN,p_kind:'import_log',p_key:force?{force:true}:{},p_data:info});(S.imports||(S.imports=[])).unshift(row);return true;}
  catch(e){if(/already imported/.test(e.message))return false;toast(errMsg(e.message));return null;}
}
// قبل الحفظ: لو الملف اترفع قبل كده ← يرفض (ومدير التشغيل بس يقدر يرفعه تاني بقصد)
async function claimImport(info){
  const prev=sameFile(info.kind,info.hash);
  if(!prev){const r=await logImport(info,false);if(r!==false)return r;}
  const p=prev||{file_name:info.file,by_user:'',at:new Date().toISOString()};
  if(!isOps()){toast('⛔ '+importedMsg(p).replace(/<[^>]+>/g,''));return false;}
  if(!await askConfirm(importedMsg(p)+'. ترفعه تاني بقصد؟ (البيانات القديمة هتتستبدل)'))return false;
  return !!(await logImport(info,true));
}
function importsHTML(kind){const L=(S.imports||[]).filter(i=>!kind||i.kind===kind).slice(0,40);const K={sales:'مبيعات يوم',base_sales:'مبيعات شهر',attendance:'بصمة'};
  return L.length?`<div class="tbl-wrap"><table><thead><tr><th>إمتى</th><th>النوع</th><th>الملف</th><th>مين</th><th>الفرع / اليوم</th><th>مقبول</th><th>مرفوض</th><th>مكرر</th></tr></thead><tbody>${L.map(i=>`<tr><td class="small">${new Date(i.at).toLocaleString('ar-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td class="small">${K[i.kind]||i.kind}${String(i.file_hash).includes('#')?' <span class="badge b-gold">اترفع تاني</span>':''}</td><td class="small" style="max-width:200px;word-break:break-all">${esc(i.file_name||'')}</td><td class="small">${esc(mgrName(i.by_user))}</td><td class="small">${esc(i.branch||'')} ${esc(i.day||i.month||'')}</td><td><b style="color:var(--green)">${fmt(i.rows_ok)}</b></td><td><b style="color:${i.rows_bad?'var(--red)':'inherit'}">${fmt(i.rows_bad)}</b></td><td>${fmt(i.rows_dup)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">مفيش ملفات اترفعت لسه</div>';}
function openImports(kind){openModal(`<button class="x" onclick="closeModal()">✕</button><h2>📂 الملفات المرفوعة</h2><div class="small muted" style="margin-bottom:8px">كل ملف: اسمه ومين رفعه وإمتى، وعدد السطور المقبولة والمرفوضة والمكررة. نفس الملف مبيترفعش مرتين.</div>${importsHTML(kind)}`);}
