// نجم أبو الفضل — قراءة شيت الحضور الشهري (ملف الحسابات) للتحديث اليومي من الـ Drive
// بياخد من كل موظف لكل يوم بس: الكود · التاريخ · معاد الورديه · س الدخول · س الخروج (للعدّ بس) · نوع الاجازه
// وأي عمود تاني (الراتب، بدل الـ KPI، الجزاءات، السلف، الإضافي...) مبيتقريش خالص.
// الاستخدام:  node attendance-sheet.js <file.xlsx> <out.json> [--compact <payload.txt>] [--emps <emps.json>]
// --emps: بيانات الموظف من راس كل بلوك بس: الكود · الاسم · القسم · الوظيفة · الفرع (+ أكتر ميعاد وردية متكرر، وأيام «دخول + خروج» في آخر أسبوع، والرجوع بعد غياب) — من غير أي فلوس   (محتاج: npm i --no-save xlsx@0.18.5)
// --compact: صيغة صغيرة للتحديث اليومي «YYYY-MM|كود:يوم1,يوم2,...;كود:...» — كل يوم: دقايق التأخير عن ميعاد الوردية (0 لو بدري)
//            أو L إجازة أو - من غير بصمة ولا إجازة أو x مش مقروء / فرق أكتر من 4 ساعات عن ميعاد الوردية (للمراجعة) — ومعاها md5 عشان الداتابيز تتأكد إنها وصلت زي ما هي
const XLSX = require('xlsx');
const fs = require('fs');
const [, , inFile, outFile] = process.argv;
const argOf = f => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const compactFile = argOf('--compact'), empsFile = argOf('--emps'), flag = compactFile ? '--compact' : null;
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
const out = []; let blocks = 0; const EMPS = {}; const OUTS = new Set();
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
  for (let i = 0; i < rows.length; i++) {
    if (norm(rows[i][0]) !== norm('الكود')) continue;
    const code = String(rows[i][1] ?? '').trim(); if (!code) continue;
    let h = -1; for (let k = i + 1; k < Math.min(i + 6, rows.length); k++) if (rows[k].some(c => norm(c) === norm('معاد الورديه'))) { h = k; break; }
    if (h < 0) continue;
    const H = rows[h].map(norm); const ix = n => H.indexOf(norm(n));
    const c = { date: ix('التاريخ'), leave: ix('نوع الاجازه'), shift: ix('معاد الورديه'), in: ix('س الدخول'), out: ix('س الخروج') };
    if (c.date < 0 || c.shift < 0 || c.in < 0) continue;
    blocks++;
    // راس البلوك: «الاسم / القسم / الوظيفة / الفرع» والقيمة في أول خانة مليانة بعد العنوان
    const after = lab => { const j = rows[i].findIndex(x => norm(x) === norm(lab)); if (j < 0) return '';
      for (let k = j + 1; k < j + 8; k++) { const v = String(rows[i][k] ?? '').trim(); if (!v) continue;
        if (['الاسم', 'القسم', 'الوظيفه', 'الفرع', 'تاريخ التعيين'].includes(norm(v))) return ''; return v; } return ''; };   // الخانة الفاضية متاخدش قيمة العنوان اللي بعدها
    const id = { code, name: after('الاسم'), dept: after('القسم'), job: after('الوظيفة'), branch: after('الفرع') };
    if (!EMPS[code] || (!EMPS[code].name && id.name)) EMPS[code] = id;
    for (let k = h + 1; k < rows.length && k < h + 40; k++) {
      const day = sheetDate(rows[k][c.date]); if (!day) break;
      out.push({ code, day, shift: String(rows[k][c.shift] ?? '').trim(), in: String(rows[k][c.in] ?? '').trim(), leave: c.leave >= 0 ? String(rows[k][c.leave] ?? '').trim() : '' });
      if (c.out >= 0 && /\d:\d\d/.test(String(rows[k][c.out] ?? ''))) OUTS.add(code + '|' + day);   // بصمة الخروج — بنعدّ أيام «دخول + خروج» بس (مبتتحفظش)
    }
    i = h;
  }
}
fs.writeFileSync(outFile, JSON.stringify(out));
if (empsFile) {
  // أكتر ميعاد وردية متكرر للموظف (للشيفت لو موظف جديد)
  const cnt = {}, lastIn = {}; for (const r of out) if (r.shift && r.in) { const m = cnt[r.code] || (cnt[r.code] = {}); m[r.shift] = (m[r.shift] || 0) + 1; if (!lastIn[r.code] || r.day > lastIn[r.code]) lastIn[r.code] = r.day; }
  // lastIn: آخر يوم بصمة — الموظف الجديد بيتضاف بس لو بصم في آخر أسبوع (اللي وقف قبل كده غالبًا ساب)
  // آخر يوم في الملف فيه بصمات · fullWeek = أيام «دخول + خروج» في آخر 7 أيام (6 = شغال) · رجوع بعد غياب: آخر فترة من غير بصمة 7 أيام أو أكتر وبعدها رجع يبصم
  const hasIn = r => /\d:\d\d/.test(r.in);
  const fileLast = out.filter(hasIn).reduce((a, r) => r.day > a ? r.day : a, '');
  const back = (code) => { const D = [...new Set(out.filter(r => r.code === code && hasIn(r)).map(r => r.day))].sort(); let best = null;
    for (let i = 1; i < D.length; i++) { const gap = Math.round((new Date(D[i]) - new Date(D[i - 1])) / 864e5) - 1; if (gap >= 7) best = { backGap: gap, backDay: D[i] }; } return best || {}; };
  const week = (code) => { if (!fileLast) return 0; let n = 0; for (let i = 0; i < 7; i++) { const d = new Date(fileLast); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10);
      if (OUTS.has(code + '|' + k) && out.some(r => r.code === code && r.day === k && hasIn(r))) n++; } return n; };
  const L = Object.values(EMPS).filter(e => e.name).map(e => ({ ...e, shiftTime: Object.entries(cnt[e.code] || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '', lastIn: lastIn[e.code] || '', fullWeek: week(e.code), ...back(e.code) }));
  fs.writeFileSync(empsFile, JSON.stringify(L));
}
const withIn = new Set(out.filter(r => /\d{1,2}:\d{2}/.test(r.in)).map(r => r.code)).size;
console.log(JSON.stringify({ blocks, rows: out.length, employeesWithCheckIn: withIn }));

if (flag === '--compact' && compactFile) {
  const tmin = t => { const m = String(t).match(/(\d{1,2}):(\d{2})/); if (!m) return null; let h = +m[1]; if (/pm|م/i.test(t) && h < 12) h += 12; if (/am|ص/i.test(t) && h === 12) h = 0; return h * 60 + +m[2]; };
  // آخر يوم فيه بصمة (الأيام اللي بعده لسه ماجتش)
  let last = ''; for (const r of out) if (tmin(r.in) != null && r.day > last) last = r.day;
  if (!last) { console.error('no check-ins in file'); process.exit(1); }
  const month = last.slice(0, 7); const nDays = +last.slice(8);
  const by = {}; for (const r of out) if (r.day.startsWith(month)) (by[r.code] ||= {})[+r.day.slice(8)] = r;
  const segs = [], starters = [], stopped = [], review = [];
  for (const [code, D] of Object.entries(by)) {
    if (!/^[0-9A-Za-z]+$/.test(code)) continue;
    const toks = []; let any = false;
    for (let d = 1; d <= nDays; d++) {
      const r = D[d]; let t = '.';
      if (r) { if (r.leave) { t = 'L'; any = true; } else if (tmin(r.in) != null) { const a = tmin(r.shift), b = tmin(r.in); if (a == null) t = 'x'; else { let x = b - a; if (x < -720) x += 1440; if (x > 720) x -= 1440; /* فرق أكتر من 4 ساعات = ميعاد الوردية مش مظبوط في الشيت (مش تأخير) ← بيتساب للمراجعة */ t = Math.abs(x) > 240 ? 'x' : String(Math.max(0, x)); } any = true; } else if (r.in) t = 'x'; else t = '-'; }
      toks.push(t);
    }
    if (!any) continue;
    // موظف جديد: الأيام الفاضية قبل أول يوم ليه في الشيت مش غياب · بيانات وقفت أكتر من أسبوع: غالباً ساب الشغل ← مبتتحسبش غياب
    const has = t => t !== '-' && t !== '.';
    const first = toks.findIndex(has), lastI = toks.length - 1 - [...toks].reverse().findIndex(has);
    for (let i = 0; i < first; i++) if (toks[i] === '-') toks[i] = '.';
    if (first > 0) starters.push(code);
    if (toks.length - 1 - lastI > 7) { for (let i = lastI + 1; i < toks.length; i++) if (toks[i] === '-') toks[i] = '.'; stopped.push(code); }
    const xs = toks.filter(t => t === 'x').length; if (xs) review.push(code + '×' + xs);
    segs.push(code + ':' + toks.join(','));
  }
  const payload = month + '|' + segs.join(';');
  if (!/^[0-9A-Za-z:,;|.\-]+$/.test(payload)) { console.error('unexpected characters in payload'); process.exit(1); }
  fs.writeFileSync(compactFile, payload);
  const md5 = require('crypto').createHash('md5').update(payload).digest('hex');
  console.log(JSON.stringify({ compact: compactFile, month, lastDay: last, employees: segs.length, length: payload.length, md5, newStarters: starters, stoppedOverWeek: stopped, shiftMismatchDays: review }));
}
