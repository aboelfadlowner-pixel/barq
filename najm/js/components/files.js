// نجم أبو الفضل — اختيار وقراءة ملفات الإكسيل والشيتات
// attendance import
function pickFile(accept,cb){const f=$('#filePick');f.value='';f.accept=accept;f.onchange=()=>f.files[0]&&cb(f.files[0]);f.click();}
function readSheet(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{try{const wb=XLSX.read(r.result,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];res(XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''}));}catch(e){rej(e)}};r.onerror=rej;r.readAsArrayBuffer(file);});}
function findHeader(rows,tests){
  for(let i=0;i<Math.min(rows.length,20);i++){const h=rows[i].map(norm);const idx={};for(const[k,re]of Object.entries(tests))idx[k]=h.findIndex(c=>re.test(c));if(Object.values(idx).filter(x=>x>=0).length>=2)return {row:i,idx};}
  return null;
}
