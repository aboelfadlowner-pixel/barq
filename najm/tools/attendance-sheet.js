// نجم أبو الفضل — قراءة شيت الحضور الشهري (ملف الحسابات) للتحديث اليومي من الـ Drive
// بياخد من كل موظف 4 حاجات بس لكل يوم: الكود · التاريخ · معاد الورديه · س الدخول · نوع الاجازه
// وأي عمود تاني (الراتب، بدل الـ KPI، الجزاءات، السلف، الإضافي...) مبيتقريش خالص.
// الاستخدام:  node attendance-sheet.js <file.xlsx> <out.json> [--compact <payload.txt>]   (محتاج: npm i --no-save xlsx@0.18.5)
// --compact: صيغة صغيرة للتحديث اليومي «YYYY-MM|كود:يوم1,يوم2,...;كود:...» — كل يوم: دقايق التأخير عن ميعاد الوردية (0 لو بدري)
//            أو L إجازة أو - من غير بصمة ولا إجازة أو x مش مقروء — ومعاها md5 عشان الداتابيز تتأكد إنها وصلت زي ما هي
const XLSX = require('xlsx');
const fs = require('fs');
const [, , inFile, outFile, flag, compactFile] = process.argv;
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

if (flag === '--compact' && compactFile) {
  const tmin = t => { const m = String(t).match(/(\d{1,2}):(\d{2})/); if (!m) return null; let h = +m[1]; if (/pm|م/i.test(t) && h < 12) h += 12; if (/am|ص/i.test(t) && h === 12) h = 0; return h * 60 + +m[2]; };
  // آخر يوم فيه بصمة (الأيام اللي بعده لسه ماجتش)
  let last = ''; for (const r of out) if (tmin(r.in) != null && r.day > last) last = r.day;
  if (!last) { console.error('no check-ins in file'); process.exit(1); }
  const month = last.slice(0, 7); const nDays = +last.slice(8);
  const by = {}; for (const r of out) if (r.day.startsWith(month)) (by[r.code] ||= {})[+r.day.slice(8)] = r;
  const segs = [];
  for (const [code, D] of Object.entries(by)) {
    if (!/^[0-9A-Za-z]+$/.test(code)) continue;
    const toks = []; let any = false;
    for (let d = 1; d <= nDays; d++) {
      const r = D[d]; let t = '.';
      if (r) { if (r.leave) { t = 'L'; any = true; } else if (tmin(r.in) != null) { const a = tmin(r.shift), b = tmin(r.in); if (a == null) t = 'x'; else { let x = b - a; if (x < -720) x += 1440; if (x > 720) x -= 1440; t = String(Math.min(600, Math.max(0, x))); } any = true; } else if (r.in) t = 'x'; else t = '-'; }
      toks.push(t);
    }
    if (any) segs.push(code + ':' + toks.join(','));
  }
  const payload = month + '|' + segs.join(';');
  if (!/^[0-9A-Za-z:,;|.\-]+$/.test(payload)) { console.error('unexpected characters in payload'); process.exit(1); }
  fs.writeFileSync(compactFile, payload);
  const md5 = require('crypto').createHash('md5').update(payload).digest('hex');
  console.log(JSON.stringify({ compact: compactFile, month, lastDay: last, employees: segs.length, length: payload.length, md5 }));
}
