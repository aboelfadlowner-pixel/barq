// نجم أبو الفضل — قراءة شيت الحضور الشهري (ملف الحسابات) للتحديث اليومي من الـ Drive
// بياخد من كل موظف 4 حاجات بس لكل يوم: الكود · التاريخ · معاد الورديه · س الدخول · نوع الاجازه
// وأي عمود تاني (الراتب، بدل الـ KPI، الجزاءات، السلف، الإضافي...) مبيتقريش خالص.
// الاستخدام:  node attendance-sheet.js <file.xlsx> <out.json>   (محتاج: npm i --no-save xlsx@0.18.5)
const XLSX = require('xlsx');
const fs = require('fs');
const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) { console.error('usage: node attendance-sheet.js <file.xlsx> <out.json>'); process.exit(2); }

const norm = s => String(s ?? '').trim().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const pad = n => String(n).padStart(2, '0');
function sheetDate(v) {
  const s = String(v ?? '').trim(); let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  return null;
}
const wb = XLSX.readFile(inFile);
const out = []; let blocks = 0;
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
  for (let i = 0; i < rows.length; i++) {
    if (norm(rows[i][0]) !== norm('الكود')) continue;
    const code = String(rows[i][1] ?? '').trim(); if (!code) continue;
    let h = -1; for (let k = i + 1; k < Math.min(i + 6, rows.length); k++) if (rows[k].some(c => norm(c) === norm('معاد الورديه'))) { h = k; break; }
    if (h < 0) continue;
    const H = rows[h].map(norm); const ix = n => H.indexOf(norm(n));
    const c = { date: ix('التاريخ'), leave: ix('نوع الاجازه'), shift: ix('معاد الورديه'), in: ix('س الدخول') };
    if (c.date < 0 || c.shift < 0 || c.in < 0) continue;
    blocks++;
    for (let k = h + 1; k < rows.length && k < h + 40; k++) {
      const day = sheetDate(rows[k][c.date]); if (!day) break;
      out.push({ code, day, shift: String(rows[k][c.shift] ?? '').trim(), in: String(rows[k][c.in] ?? '').trim(), leave: c.leave >= 0 ? String(rows[k][c.leave] ?? '').trim() : '' });
    }
    i = h;
  }
}
fs.writeFileSync(outFile, JSON.stringify(out));
const withIn = new Set(out.filter(r => /\d{1,2}:\d{2}/.test(r.in)).map(r => r.code)).size;
console.log(JSON.stringify({ blocks, rows: out.length, employeesWithCheckIn: withIn }));
