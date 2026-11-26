// نجم أبو الفضل — الصور والألقاب
// الصورة / الفيديو / اللقب اللي لسه اترفعت: لو التحديث الدوري (كل دقيقة) خلّص بعد الرفع بالظبط كان بيرجّع الداتا القديمة والصورة بتختفي من الكارت
// ← بنفتكرها دقيقتين ونطبقها فوق اللي راجع من الداتابيز
const LOCAL_MEDIA={};
function noteMedia(code,field,val){(LOCAL_MEDIA[code]||(LOCAL_MEDIA[code]={}))[field]={v:val,at:Date.now()};}
function applyLocalMedia(emps){for(const [c,o] of Object.entries(LOCAL_MEDIA)){const e=emps.find(x=>x.code===c);if(!e)continue;
  for(const [f,x] of Object.entries(o)){if((e[f]||'')===x.v||Date.now()-x.at>120000)delete o[f];else e[f]=x.v;}}}
async function setTitle(code){const e=emp(code);const t=await askText(`لقب ${e.name} (سيبه فاضي يرجع للألقاب التلقائية)`);if(t===null)return;e.title=t.trim();noteMedia(code,'title',e.title);save();openEmp(code);render();push('media',{code},{title:t.trim()});}
// photos: portrait crop (3:4) — one at a time from the profile, or many at once named by employee code (e.g. 125.jpg)
// الصورة بتترفع كاملة من غير قص (أكبر ضلع 1280) — مدير التشغيل بيظبط مكانها وتكبيرها جوه الكارت بالضغط عليها
function cropPortrait(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const M=1280,sc=Math.min(1,M/Math.max(img.width,img.height));const W=Math.round(img.width*sc),H=Math.round(img.height*sc);const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.drawImage(img,0,0,W,H);c.toBlob(b=>res({blob:b,url:c.toDataURL('image/jpeg',.9)}),'image/jpeg',.9);};img.onerror=rej;img.src=r.result;};r.onerror=rej;r.readAsDataURL(file);});}
async function savePhoto(code,file){
  const {blob,url}=await cropPortrait(file);
  if(LIVE){const u=await uploadMedia(code,blob,'jpg');emp(code).photo=u;emp(code).photoPos='';noteMedia(code,'photo',u);noteMedia(code,'photoPos','');await push('media',{code},{photo:u,photo_pos:''});}
  else{emp(code).photo=url;emp(code).photoPos='';save();}
}
function bulkPhotos(){
  const f=$('#filePick');f.value='';f.accept='image/*';f.multiple=true;
  f.onchange=async()=>{const files=[...f.files];f.multiple=false;let ok=0,miss=[];
    for(const file of files){const code=(file.name.match(/\d+/)||[])[0];const e=code&&emp(code);if(!e){miss.push(file.name);continue;}
      try{toast(`⏳ ${ok+1}/${files.length} — ${e.name}`);await savePhoto(code,file);ok++;}catch(err){miss.push(file.name);}}
    render();openModal(`<button class="x" onclick="closeModal()">✕</button><h2>📷 رفع الصور</h2><div>اترفع <b>${fmt(ok)}</b> صورة.</div>${miss.length?`<div class="lock" style="margin-top:8px">ماتربطوش بموظف (اسم الملف لازم يكون كود الموظف، زي 125.jpg):<br>${miss.map(esc).join('، ')}</div>`:''}`);};
  f.click();
}

// شيل صورة أو فيديو الموظف (مدير التشغيل) — الكارت بيرجع للحرف الأول، والملف القديم بيفضل في التخزين من غير ما يظهر
async function removeMedia(code,kind){const e=emp(code);if(!e||!isOps())return;
  if(!await askConfirm(kind==='photo'?`تشيل صورة ${e.name}؟`:`تشيل فيديو ${e.name}؟`))return;
  e[kind]='';noteMedia(code,kind,'');if(kind==='photo'){e.photoPos='';noteMedia(code,'photoPos','');}
  save();closeModal();render();
  const r=await push('media',{code},kind==='photo'?{photo:'',photo_pos:''}:{video:''});
  if(r!==false)toast(kind==='photo'?'🗑️ اتشالت الصورة':'🗑️ اتشال الفيديو');}
