// نجم أبو الفضل — الصور والألقاب
// الصورة / الفيديو / اللقب اللي لسه اترفعت: لو التحديث الدوري (كل دقيقة) خلّص بعد الرفع بالظبط كان بيرجّع الداتا القديمة والصورة بتختفي من الكارت
// ← بنفتكرها دقيقتين ونطبقها فوق اللي راجع من الداتابيز
const LOCAL_MEDIA={};
function noteMedia(code,field,val){(LOCAL_MEDIA[code]||(LOCAL_MEDIA[code]={}))[field]={v:val,at:Date.now()};}
function applyLocalMedia(emps){for(const [c,o] of Object.entries(LOCAL_MEDIA)){const e=emps.find(x=>x.code===c);if(!e)continue;
  for(const [f,x] of Object.entries(o)){if((e[f]||'')===x.v||Date.now()-x.at>120000)delete o[f];else e[f]=x.v;}}}
async function setTitle(code){const e=emp(code);const t=await askText(`لقب ${e.name} (سيبه فاضي يرجع للألقاب التلقائية)`);if(t===null)return;e.title=t.trim();noteMedia(code,'title',e.title);save();openEmp(code);render();push('media',{code},{title:t.trim()});}
// photos: portrait crop (3:4) — one at a time from the profile, or many at once named by employee code (e.g. 125.jpg)
function cropPortrait(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const W=600,H=800;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const sc=Math.max(W/img.width,H/img.height);const w=img.width*sc,h=img.height*sc;x.drawImage(img,(W-w)/2,(H-h)/2.6,w,h);c.toBlob(b=>res({blob:b,url:c.toDataURL('image/jpeg',.88)}),'image/jpeg',.88);};img.onerror=rej;img.src=r.result;};r.onerror=rej;r.readAsDataURL(file);});}
async function savePhoto(code,file){
  const {blob,url}=await cropPortrait(file);
  if(LIVE){const u=await uploadMedia(code,blob,'jpg');emp(code).photo=u;noteMedia(code,'photo',u);await push('media',{code},{photo:u});}
  else{emp(code).photo=url;save();}
}
function bulkPhotos(){
  const f=$('#filePick');f.value='';f.accept='image/*';f.multiple=true;
  f.onchange=async()=>{const files=[...f.files];f.multiple=false;let ok=0,miss=[];
    for(const file of files){const code=(file.name.match(/\d+/)||[])[0];const e=code&&emp(code);if(!e){miss.push(file.name);continue;}
      try{toast(`⏳ ${ok+1}/${files.length} — ${e.name}`);await savePhoto(code,file);ok++;}catch(err){miss.push(file.name);}}
    render();openModal(`<button class="x" onclick="closeModal()">✕</button><h2>📷 رفع الصور</h2><div>اترفع <b>${fmt(ok)}</b> صورة.</div>${miss.length?`<div class="lock" style="margin-top:8px">ماتربطوش بموظف (اسم الملف لازم يكون كود الموظف، زي 125.jpg):<br>${miss.map(esc).join('، ')}</div>`:''}`);};
  f.click();
}
