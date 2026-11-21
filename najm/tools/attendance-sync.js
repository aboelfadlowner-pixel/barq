// نجم أبو الفضل — بيبعت ناتج attendance-sheet.js (4 حاجات بس لكل يوم) للداتابيز: najm_att_sync
// الاستخدام:  node attendance-sync.js <rows.json> "<اسم الملف>"
// المفتاح السري بيتحط تلقائي من إعدادات البيئة (مش موجود في الكود ولا في المتصفح) — هنا بنبعت قيمة وهمية بس
const fs = require('fs');
const [, , rowsFile, fileName] = process.argv;
if (!rowsFile) { console.error('usage: node attendance-sync.js <rows.json> "<file name>"'); process.exit(2); }
const URL = 'https://ojvbydnvywbsgyhqftap.supabase.co/rest/v1/rpc/najm_att_sync';
(async () => {
  const p_rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8'));
  const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: 'injected-by-proxy' },
    body: JSON.stringify({ p_rows, p_file: fileName || 'حضور' }) });
  const t = await r.text();
  if (!r.ok) { console.error('FAILED', r.status, t.slice(0, 400)); process.exit(1); }
  console.log(t);
})();
