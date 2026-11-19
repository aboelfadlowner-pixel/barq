// يشغّل كل الاختبارات بالترتيب. اختبارات الداتابيز محتاجة Postgres محلي (NAJM_TEST_DB) — لو مش موجود بتتخطّى وبيتقال كده
const { execFileSync } = require('child_process');
const path = require('path');
const suites = [
  ['calculations/calculations.test.js', false], ['workflows/workflows.test.js', false], ['workflows/phase1.test.js', false],
  ['database/database.test.js', true], ['permissions/permissions.test.js', true], ['permissions/phase1.test.js', true], ['integration/integration.test.js', true],
];
(async () => {
  let dbOk = true;
  try { const { Client } = require('pg'); const c = new Client({ connectionString: process.env.NAJM_TEST_DB || 'postgres://postgres:pw@127.0.0.1:5432/postgres' }); await c.connect(); await c.end(); }
  catch (e) { dbOk = false; console.log('⚠️ مفيش Postgres محلي — اختبارات الداتابيز والصلاحيات والتكامل اتخطّت'); }
  let failed = 0;
  for (const [f, needsDb] of suites) {
    if (needsDb && !dbOk) continue;
    try { execFileSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' }); } catch (e) { failed++; }
  }
  console.log(failed ? `\n✖ ${failed} مجموعة فيها أخطاء` : '\n✔ كل الاختبارات نجحت');
  process.exit(failed ? 1 : 0);
})();
