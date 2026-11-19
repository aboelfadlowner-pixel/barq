// الصلاحيات في الداتابيز: كل واحد يعمل اللي مسموحله بس (بيشتغل على نسخة محلية من db/)
const { test, run, eq, ok, freshDb, asAnon, today } = require('../helpers');

const fails = async (p, re) => { try { await p; } catch (e) { if (re && !re.test(e.message)) throw new Error('wrong error: ' + e.message); return; } throw new Error('expected an error'); };

(async () => {
  const db = await freshDb('najm_test_perm', { employees: true });
  const save = (u, pin, kind, key, data) => asAnon(db, 'select najm_save($1,$2,$3,$4,$5) r', [u, pin, kind, JSON.stringify(key), data === null ? null : JSON.stringify(data)]);
  const B = 'البيطاش الرئيسي', A = 'عين شمس';
  await save('ops', '0000', 'user', { username: 'br' }, { name: 'مدير فرع', role: 'branch', branch: B, pin: '1111' });
  await save('ops', '0000', 'user', { username: 'hy' }, { name: 'هايجين', role: 'hygiene', branch: B, pin: '7777' });
  const D = today();

  test('الرقم السري الغلط مرفوض', () => fails(save('ops', '9999', 'att', { day: D, code: '125' }, { st: 'on' }), /wrong username or PIN/));
  test('مدير الفرع يقيّم موظف فرعه', async () => { await save('br', '1111', 'rate', { day: D, code: '125' }, [2, 2, 2, 2, 2]); });
  test('مدير الفرع ميقدرش يقيّم موظف فرع تاني', () => fails(save('br', '1111', 'rate', { day: D, code: '16' }, [2, 2, 2, 2, 2]), /outside your scope/));
  test('مدير الفرع ميقدرش يغيّر الإعدادات', () => fails(save('br', '1111', 'settings', {}, {}), /operations manager only/));
  test('مدير الفرع ميقدرش يعدّل يوم قديم', () => fails(save('br', '1111', 'att', { day: '2020-01-01', code: '125' }, { st: 'on' }), /day locked/));
  test('الهايجين بيقيّم في عمود الهايجين بس', async () => {
    await save('hy', '7777', 'rate', { day: D, code: '125' }, [2, 1, 2, 1, 2]);
    const r = (await db.query('select hy, br from najm_ratings where day=$1 and code=$2', [D, '125'])).rows[0];
    eq([r.hy, r.br], [[2, 1, 2, 1, 2], [2, 2, 2, 2, 2]]);
  });
  test('الهايجين ميقدرش يسجّل بصمة ولا يدّي كروت', async () => {
    await fails(save('hy', '7777', 'att', { day: D, code: '125' }, { st: 'on' }), /hygiene rates only/);
    await fails(save('hy', '7777', 'card', { id: 'x1', code: '125' }, { date: D, color: 'yellow', reason: 'x' }), /hygiene rates only/);
  });
  test('نقط الكابتن: مدير التشغيل بس اللي يحددها', async () => {
    await save('ops', '0000', 'captain', { month: D.slice(0, 7), code: '125', sku: 'sk-1' }, { name: 'رومي', target: 500, pts: 60, active: true });
    await save('br', '1111', 'captain', { month: D.slice(0, 7), code: '125', sku: 'sk-1' }, { name: 'رومي', target: 600, pts: 999, active: true });
    const r = (await db.query('select target, pts from najm_captains where code=$1', ['125'])).rows[0];
    eq([+r.target, +r.pts], [600, 60]);
  });
  test('الموظف (من غير دخول) ميقدرش يقرا التقييمات التفصيلية ولا الشكاوى ولا الحسابات', async () => {
    eq((await asAnon(db, 'select count(*)::int n from najm_ratings'))[0].n, 0);
    eq((await asAnon(db, 'select count(*)::int n from najm_complaints'))[0].n, 0);
    eq((await asAnon(db, 'select count(*)::int n from najm_users'))[0].n, 0);
  });
  test('الموظف يشوف المجموع بس من الجدول العام', async () => {
    const r = await asAnon(db, 'select * from najm_public_scores($1,$1) where code=$2', [D, '125']);
    ok(r.length === 1 && !('hy' in r[0]) && !('br' in r[0]), 'public scores expose details');
  });
  test('التصويت: صوت واحد لكل كود ولكل جهاز، ومفيش تصويت للهايجين', async () => {
    const v = (code, dev, m) => asAnon(db, 'select najm_vote($1,$2,$3) r', [code, dev, m]).then(r => r[0].r);
    eq((await v('125', 'device-aaaaaaaaaaaaaaaa', 'hy')).error, 'manager');
    eq((await v('125', 'device-aaaaaaaaaaaaaaaa', 'br')).ok, true);
    eq((await v('125', 'device-bbbbbbbbbbbbbbbb', 'br')).error, 'voted');
    eq((await v('4', 'device-aaaaaaaaaaaaaaaa', 'br')).error, 'device_used');
  });
  test('5 محاولات دخول غلط ← الحساب يتقفل 15 دقيقة (من شاشة الدخول)', async () => {
    const login = pin => asAnon(db, 'select najm_login($1,$2) r', ['br', pin]).then(r => r[0].r);
    for (let i = 0; i < 5; i++) eq(await login('0000'), null);
    eq(await login('1111'), null, 'locked account still logs in:');
    await db.query("update najm_login_fails set locked_until = now() - interval '1 minute' where username='br'");
    ok(await login('1111'), 'account did not unlock after 15 minutes');
  });
  await run('الصلاحيات');
  await db.end();
})();
