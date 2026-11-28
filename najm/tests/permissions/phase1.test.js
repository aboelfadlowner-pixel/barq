// المرحلة الأولى في الداتابيز: الكروت (الحالة، التحويل، الإلغاء من غير مسح)، الاعتراض، الرقم السري للموظف، إغلاق اليوم والخصم، السجل
const { test, run, eq, ok, freshDb, asAnon, today } = require('../helpers');

(async () => {
  const db = await freshDb('najm_test_p1', { employees: true });
  await db.query("update najm_settings set data = jsonb_set(coalesce(data, '{}'::jsonb), '{monthFinalDay}', '100000') where id = 1");   // شهور الاختبار قديمة: نقفل تجميد الشهر النهائي (واختبار التجميد تحت بيرجّعه)
  const B = 'البيطاش الرئيسي', D = today();
  const ago = n => { const d = new Date(D); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const rpc = async (sql, params) => (await asAnon(db, sql, params))[0];
  // najm_save as the app calls it: {error:'najm: …'} replies or exceptions → thrown
  const save = async (u, pin, kind, key, data) => {
    const r = (await asAnon(db, 'select najm_save($1,$2,$3,$4,$5) r', [u, pin, kind, JSON.stringify(key), data === undefined || data === null ? null : JSON.stringify(data)]))[0].r;
    if (r && typeof r.error === 'string') throw new Error(r.error); return r;
  };
  const fails = async (p, re) => { try { await p; } catch (e) { if (re && !re.test(e.message)) throw new Error('wrong error: ' + e.message); return; } throw new Error('expected an error'); };
  await save('ops', '0000', 'user', { username: 'br' }, { name: 'مدير البيطاش', role: 'branch', branch: B, pin: '1111' });
  await save('ops', '0000', 'user', { username: 'shm' }, { name: 'مدير الصبح', role: 'shift', branch: B, shift: 'Morning', pin: '2222' });
  await save('ops', '0000', 'user', { username: 'shn' }, { name: 'مدير الليل', role: 'shift', branch: B, shift: 'Night', pin: '3333' });
  const card = (u, pin, id, code, color, day = D) => save(u, pin, 'card', { id, code }, { date: day, color, reason: 'سبب ' + id });
  const status = async id => (await db.query('select status from najm_cards where id=$1', [id])).rows[0]?.status;
  const points = async code => (await db.query('select * from najm_card_points($1,$2) where code=$3', [D.slice(0, 8) + '01', D, code])).rows[0];

  // ---------------- الكروت
  test('الأصفر والأخضر محسوبين على طول، والأحمر مستني التشغيل', async () => {
    await card('br', '1111', 'y1', '125', 'yellow'); await card('br', '1111', 'g1', '125', 'green'); await card('br', '1111', 'r1', '125', 'red');
    eq([await status('y1'), await status('g1'), await status('r1')], ['approved', 'approved', 'pending']);
  });
  test('الكارت لازم يبقى ليه سبب', () => fails(save('br', '1111', 'card', { id: 'x0', code: '125' }, { date: D, color: 'yellow', reason: ' ' }), /reason required/));
  test('رفض الأحمر مبيمسحهوش — بيفضل في السجل «مرفوض»', async () => {
    await save('ops', '0000', 'card_approve', { id: 'r1' }, { approved: false });
    eq(await status('r1'), 'rejected');
  });
  test('إلغاء كارت مبيمسحهوش — بيبقى «اتلغى»', async () => {
    await card('br', '1111', 'r2', '125', 'red');
    await save('br', '1111', 'card', { id: 'r2', code: '125' }, null);
    eq(await status('r2'), 'cancelled');
    eq((await db.query('select count(*)::int n from najm_cards where code=$1', ['125'])).rows[0].n, 4);
  });
  test('نقط الكروت في الداتابيز: أخضر +10، أصفر −5', async () => {
    const p = await points('125'); eq([p.yellow, p.green, +p.points], [1, 1, 5]);
  });
  test('3 صفر = أحمر −20 (والصفر التلاتة نقطهم بتتلغي)، والرابع −5', async () => {
    await card('br', '1111', 'y2', '4', 'yellow'); await card('br', '1111', 'y3', '4', 'yellow');
    eq(+(await points('4')).points, -10);
    await card('br', '1111', 'y4', '4', 'yellow'); eq(+(await points('4')).points, -20);
    await card('br', '1111', 'y5', '4', 'yellow'); eq(+(await points('4')).points, -25);
  });
  test('الكروت المرفوضة والملغية مش بتتحسب', async () => {
    await save('ops', '0000', 'card', { id: 'r3', code: '11' }, { date: D, color: 'red', reason: 'x' });
    await save('ops', '0000', 'card', { id: 'r3', code: '11' }, null);
    eq(await points('11'), undefined);
  });

  // ---------------- الرقم السري للموظف
  let pins;
  test('مدير التشغيل يطلّع أرقام سرية للموظفين (مرة واحدة)', async () => {
    pins = await save('ops', '0000', 'emp_pins_generate', {}, {});
    eq(Object.keys(pins).length, 175); ok(/^\d{4}$/.test(pins['125']));
    eq(Object.keys(await save('ops', '0000', 'emp_pins_generate', {}, {})).length, 0);
  });
  test('مدير الفرع ميقدرش يطلّع أرقام سرية', () => fails(save('br', '1111', 'emp_pins_generate', {}, {}), /operations manager only/));
  test('الموظف يدخل بكوده ورقمه، وأول مرة لازم يغيّره', async () => {
    const r = (await rpc('select najm_emp_login($1,$2) r', ['125', pins['125']])).r;
    eq([r.code, r.must_change], ['125', true]);
    eq((await rpc('select najm_emp_set_pin($1,$2,$3) r', ['125', pins['125'], '4321'])).r, { ok: true });
    eq((await rpc('select najm_emp_login($1,$2) r', ['125', '4321'])).r.must_change, false);
  });
  test('من غير الرقم السري مفيش تقرير ولا كروت', async () => {
    eq((await asAnon(db, 'select * from najm_my_ratings($1,$2,$3,$3)', ['125', '0000', D])).length, 0);
    ok((await rpc('select najm_my_cards($1,$2) r', ['125', '0000'])).r.error);
  });
  test('5 محاولات غلط ← حساب الموظف يتقفل', async () => {
    for (let i = 0; i < 5; i++) ok((await rpc('select najm_emp_login($1,$2) r', ['4', '0000'])).r.error);
    ok((await rpc('select najm_emp_login($1,$2) r', ['4', pins['4']])).r.error, 'locked employee logged in');
  });

  // ---------------- الاعتراض
  let appealId;
  test('الموظف يشوف كروته كلها بالسبب واسم المدير والحالة', async () => {
    const c = (await rpc('select najm_my_cards($1,$2) r', ['125', '4321'])).r.cards;
    eq(c.length, 4); ok(c.every(x => x.by === 'مدير البيطاش' && x.reason)); ok(c.some(x => x.status === 'rejected'));
  });
  test('الموظف يعترض على كارت ليه، ومينفعش اعتراضين مفتوحين على نفس الكارت', async () => {
    eq((await rpc('select najm_emp_appeal($1,$2,$3,$4) r', ['125', '4321', 'y1', 'كنت في البريك بإذن المدير'])).r, { ok: true });
    ok((await rpc('select najm_emp_appeal($1,$2,$3,$4) r', ['125', '4321', 'y1', 'تاني'])).r.error);
    ok((await rpc('select najm_emp_appeal($1,$2,$3,$4) r', ['125', '4321', 'y2', 'مش كارتي'])).r.error, 'appealed another employee card');
    appealId = (await db.query("select id from najm_card_appeals where card_id='y1'")).rows[0].id;
  });
  test('الاعتراض بيوصل لمدير التشغيل بس — حتى المدير اللي ادى الكارت ميشوفوش وميقررش', async () => {
    await fails(save('br', '1111', 'appeal_decide', { id: appealId }, { accept: true }), /operations manager only/);
    eq((await rpc('select najm_files($1,$2) r', ['br', '1111'])).r.appeals, null);
    eq((await rpc('select najm_files($1,$2) r', ['ops', '0000'])).r.appeals.length, 1);
  });
  test('مدير التشغيل يقبل الاعتراض ← الكارت يتلغى ويفضل في السجل', async () => {
    await save('ops', '0000', 'appeal_decide', { id: appealId }, { accept: true, note: 'اتأكدت من الكاميرا' });
    eq(await status('y1'), 'overturned');
    eq((await db.query('select status, decision_note from najm_card_appeals where id=$1', [appealId])).rows[0], { status: 'accepted', decision_note: 'اتأكدت من الكاميرا' });
    eq(+(await points('125')).points, 10);
  });

  // ---------------- التصويت بالرقم السري
  test('التصويت بكود البصمة بس: صوت واحد لكل كود، ومش بيتغيّر بعدها', async () => {
    eq((await rpc('select najm_vote($1,$2,$3,$4) r', ['125', '', 'device-aaaaaaaaaaaaaaaa', 'br'])).r.ok, true);
    eq((await rpc('select najm_vote($1,$2,$3,$4) r', ['125', '', 'device-bbbbbbbbbbbbbbbb', 'br'])).r.error, 'voted');
    eq((await rpc('select najm_vote($1,$2,$3,$4) r', ['99999', '', 'device-cccccccccccccccc', 'br'])).r.error, 'pin');
    await save('ops', '0000', 'user', { username: 'camv' }, { name: 'كاميرا', role: 'cameras', branch: B, pin: '4747' });
    eq((await rpc('select najm_vote($1,$2,$3,$4) r', ['133', '', 'device-dddddddddddddddd', 'camv'])).r.error, 'manager');   // الكاميرات مش بتتصوّت لها
    await save('ops', '0000', 'user', { username: 'camv' }, null);
  });

  // ---------------- إغلاق اليوم
  test('مدير الصبح يقفل شيفته بس (وBetween مع الليل)', async () => {
    await fails(save('shm', '2222', 'day_close', { day: D, gkey: B + '|Night' }), /outside your scope/);
    await save('shm', '2222', 'day_close', { day: D, gkey: B + '|Morning' });
    await fails(save('shm', '2222', 'day_close', { day: D, gkey: B + '|Morning' }), /already closed/);
  });
  test('بعد الإغلاق، مدير الشيفت ميقدرش يعدّل تقييم اليوم ده', async () => {
    const m = (await db.query("select code from najm_employees where branch=$1 and shift='Morning' and dept <> 'قسم البقاله' limit 1", [B])).rows[0].code;
    await fails(save('shm', '2222', 'rate', { day: D, code: m }, [2, 2, 2, 2]), /day locked/);
    const n = (await db.query("select code from najm_employees where branch=$1 and shift='Between' and dept <> 'قسم البقاله' limit 1", [B])).rows[0].code;
    await save('shn', '3333', 'rate', { day: D, code: n }, [2, 2, 2, 2]);   // Between لسه مفتوح مع الليل
  });
  test('مفيش خصم قبل ما التشغيل يحدد تاريخ البداية', async () => {
    eq((await db.query("select count(*)::int n from najm_mgr_ledger where id like 'late|%'")).rows[0].n, 0);
  });
  test('بعد تاريخ البداية: الإغلاق المتأخر بيتخصم من المسؤول تلقائي', async () => {
    const st = (await db.query('select data from najm_settings where id=1')).rows[0].data;
    await save('ops', '0000', 'settings', {}, { ...st, closeStart: ago(3), closeAfterHours: 10, lateClosePenalty: 5 });
    await save('shn', '3333', 'day_close', { day: ago(2), gkey: B + '|Night' });
    const c = (await db.query('select closed_by, penalty, late_minutes, responsible from najm_day_closes where day=$1 and gkey=$2', [ago(2), B + '|Night'])).rows[0];
    eq([c.closed_by, +c.penalty, c.responsible], ['shn', 5, ['shn']]); ok(c.late_minutes > 0);
    eq(+(await db.query("select points from najm_mgr_ledger where username='shn' and id like 'late|' || $1 || '%'", [ago(2)])).rows[0].points, -5);
  });
  test('الأيام اللي محدش قفلها ← خصم تلقائي على المسؤول من غير التشغيل', async () => {
    const r = (await db.query("select username, count(*)::int n, sum(points)::int p from najm_mgr_ledger where id like 'late|%' group by username order by username")).rows;
    // صبح: 3 أيام فاتوا (ago3, ago2, ago1) · ليل: 3 (ago2 اتعلّم متأخر تلقائي وبعدين المدير قفله — الخصم مرة واحدة)
    // آخر ميعاد لليل = بداية الشيفت + 10 ساعات (3 الفجر) — قبل 3 الفجر بتوقيت القاهرة يوم امبارح بالليل لسه ماعدّاش
    const early = (await db.query("select extract(hour from now() at time zone 'Africa/Cairo') < 3 x")).rows[0].x, nn = early ? 2 : 3;
    eq(r, [{ username: 'shm', n: 3, p: -15 }, { username: 'shn', n: nn, p: -5 * nn }]);
    eq((await db.query("select count(*)::int n from najm_history where kind='day_late'")).rows[0].n, 3 + nn);
  });
  test('الخصم مبيتكررش لنفس اليوم', async () => {
    await save('br', '1111', 'note', { id: 'n1', code: '125' }, { date: D, text: 'x' });
    const early = (await db.query("select extract(hour from now() at time zone 'Africa/Cairo') < 3 x")).rows[0].x;
    eq((await db.query("select count(*)::int n from najm_mgr_ledger where id like 'late|%'")).rows[0].n, early ? 5 : 6);
  });

  // ---------------- التصرف المثالي ½ فوق الـ 5 · رجل اليوم (سجل المرشحين + الحد) · تعديل التشغيل في يوم مغلق بسبب
  test('التصرف المثالي نص نجمة فوق الـ 5 (الأساسي 5 + ½ = 5.5)', async () => {
    const c = (await db.query("select code from najm_employees where branch=$1 and dept<>'قسم البقاله' and shift='Night' limit 1 offset 3", [B])).rows[0].code;
    await save('br', '1111', 'rate', { day: D, code: c }, [2, 2, 2, 2, 2]);
    await save('ops', '0000', 'att', { day: D, code: c, reason: 'x' }, { st: 'on' });
    await db.query("update najm_ratings set sh='{2,2,2,2,2}', hy='{2,2,2,2,2}' where day=$1 and code=$2", [D, c]);
    for (const k of ['pray', 'brk']) await save('ops', '0000', k, { day: D, code: c, reason: 'x' }, { v: 1 });
    await save('ops', '0000', 'bonus', { day: D, code: c, reason: 'x' }, { v: 0.5, note: 'ساعد زميله' });
    const r = (await db.query('select (najm_score(r, e.dept, (select data from najm_settings where id=1))) s from najm_ratings r join najm_employees e on e.code=r.code where r.day=$1 and r.code=$2', [D, c])).rows[0].s;
    eq([+r.base, +r.total], [5, 5.5]);
  });
  test('رجل اليوم: التشغيل يعتمد لحد 2 في البيطاش و1 في عين شمس، والمرشحين بيتسجلوا', async () => {
    const ms = (await db.query("select code from najm_employees where branch=$1 and shift='Morning' limit 3", [B])).rows.map(r => r.code);
    await fails(save('ops', '0000', 'winners', { day: ago(1), gkey: B + '|Morning' }, { codes: ms, candidates: [] }), /too many winners/);
    await fails(save('br', '1111', 'winners', { day: ago(1), gkey: B + '|Morning' }, { codes: ms.slice(0, 1) }), /operations manager only/);
    await save('ops', '0000', 'winners', { day: ago(1), gkey: B + '|Morning' }, { codes: ms.slice(0, 2), candidates: ms.map(c => ({ code: c, stars: 4.5, cards: 0 })) });
    const w = (await db.query('select codes, candidates, approved_by from najm_winners where day=$1 and gkey=$2', [ago(1), B + '|Morning'])).rows[0];
    eq([w.codes.length, w.candidates.length, w.approved_by], [2, 3, 'ops']);
    const A = 'عين شمس', as = (await db.query("select code from najm_employees where branch=$1 and shift='Morning' limit 2", [A])).rows.map(r => r.code);
    await fails(save('ops', '0000', 'winners', { day: ago(1), gkey: A + '|Morning' }, { codes: as }), /too many winners/);
  });
  test('بعد اعتماد رجل اليوم (اليوم مغلق): تعديل التشغيل لازم بسبب، والسجل فيه القديم والجديد', async () => {
    const c = (await db.query("select code from najm_employees where branch=$1 and shift='Morning' limit 1 offset 5", [B])).rows[0].code;
    await db.query("insert into najm_ratings(day,code,pray) values ($1,$2,0) on conflict (day,code) do update set pray=excluded.pray", [ago(1), c]);
    await fails(save('ops', '0000', 'pray', { day: ago(1), code: c }, { v: 1 }), /reason required/);
    await save('ops', '0000', 'pray', { day: ago(1), code: c, reason: 'اتقيّم غلط' }, { v: 1 });
    const h = (await db.query("select data from najm_history where kind='pray' and code=$1 order by id desc limit 1", [c])).rows[0].data;
    eq([h.old, h.data, h.key.reason], [0, { v: 1 }, 'اتقيّم غلط']);
  });
  test('مدير الفرع ميقدرش يعدّل بعد اعتماد رجل اليوم', async () => {
    const c = (await db.query("select code from najm_employees where branch=$1 and shift='Morning' limit 1 offset 5", [B])).rows[0].code;
    await fails(save('br', '1111', 'rate', { day: ago(1), code: c }, [1, 1, 1, 1]), /day locked/);
  });

  // ---------------- سجل تغيير الإعدادات
  test('تغيير الإعدادات بيتسجل بالقديم والجديد والسبب، والسجل لمدير التشغيل بس', async () => {
    const st = (await db.query('select data from najm_settings where id=1')).rows[0].data;
    await save('ops', '0000', 'settings', { reason: 'تجربة', path: 'graceMin' }, { ...st, graceMin: 17 });
    const L = (await rpc('select najm_settings_log($1,$2) r', ['ops', '0000'])).r;
    const h = L.find(x => x.data.key.reason === 'تجربة');
    eq([h.data.data.graceMin, h.data.old.graceMin === 17, h.actor], [17, false, 'ops']);
    eq((await rpc('select najm_settings_log($1,$2) r', ['br', '1111'])).r.error, 'najm: operations manager only');
    await save('ops', '0000', 'settings', { reason: 'رجوع' }, st);
  });

  // ---------------- شكاوى العملاء: مراجعة + اعتراض
  test('الشكوى: المدير يسجّل (مستنية) ← التشغيل يثبتها ← الخصم ← الموظف يعترض ← التشغيل يقبل فتتلغي', async () => {
    const cnt = async () => ((await rpc('select * from najm_public_complaints($1,$2)', [ago(5), D])) || {}).n || 0;
    const pc = async () => (await asAnon(db, 'select n from najm_public_complaints($1,$2) where code=$3', [ago(5), D, '125']))[0]?.n || 0;
    await fails(save('br', '1111', 'complaint', { id: 'cp1' }, { date: D, code: '125', note: ' ' }), /details required/);
    await save('br', '1111', 'complaint', { id: 'cp1' }, { date: D, code: '125', note: 'رد وحش على عميل' });
    eq([(await db.query("select status from najm_complaints where id='cp1'")).rows[0].status, await pc()], ['pending', 0]);
    await fails(save('br', '1111', 'complaint_decide', { id: 'cp1' }, { proven: true }), /operations manager only/);
    await save('ops', '0000', 'complaint_decide', { id: 'cp1' }, { proven: true, note: 'اتأكدنا من الكاميرا' });
    eq(await pc(), 1);
    await fails(save('ops', '0000', 'complaint_decide', { id: 'cp1' }, { proven: false }), /already decided/);
    eq((await rpc('select najm_emp_complaint_appeal($1,$2,$3,$4) r', ['99999', '', 'cp1', 'مكنتش أنا'])).r.error, 'najm: wrong code or PIN');
    eq((await rpc('select najm_emp_complaint_appeal($1,$2,$3,$4) r', ['125', '', 'cp1', 'مكنتش أنا'])).r.ok, true);   // الاعتراض بالكود بس
    eq((await rpc('select najm_emp_complaint_appeal($1,$2,$3,$4) r', ['125', '4321', 'cp1', 'تاني'])).r.error, 'najm: complaint cannot be appealed');
    const mine = (await rpc('select najm_my_complaints($1,$2) r', ['125', '4321'])).r.complaints;
    eq([mine.length, mine[0].appeal_status], [1, 'pending']);
    await save('ops', '0000', 'complaint_appeal_decide', { id: 'cp1' }, { accept: true, note: 'اتراجع الفيديو' });
    const c = (await db.query("select status, appeal_status from najm_complaints where id='cp1'")).rows[0];
    eq([c.status, c.appeal_status, await pc()], ['rejected', 'accepted', 0]);
    await fails(save('br', '1111', 'complaint', { id: 'cp2' }, { date: D, code: '16', note: 'x' }), /outside your scope/);
  });

  // ---------------- نقل الموظف + التصحيح المالي
  test('نقل الموظف بيتسجل تلقائي (من مين ولمين ومين نقله)، والتعديل من غير نقل مبيتسجلش', async () => {
    const e = (await db.query("select * from najm_employees where code='4'")).rows[0];
    await save('ops', '0000', 'employee', { code: '4' }, { name: e.name, branch: e.branch, dept: e.dept, job: 'شيف أول', shift: e.shift, active: true });
    eq((await db.query("select count(*)::int n from najm_emp_moves where code='4'")).rows[0].n, 0);
    await save('ops', '0000', 'employee', { code: '4' }, { name: e.name, branch: e.branch, dept: 'قسم الكاشير', job: e.job, shift: e.shift, active: true });
    const m = (await db.query("select from_dept, to_dept, by_user from najm_emp_moves where code='4'")).rows[0];
    eq([m.from_dept, m.to_dept, m.by_user], [e.dept, 'قسم الكاشير', 'ops']);
    eq((await asAnon(db, 'select count(*)::int n from najm_public_moves($1,$2)', [ago(3), D]))[0].n >= 1, true);
    eq((await asAnon(db, 'select count(*)::int n from najm_emp_moves'))[0].n, 0);
    await save('ops', '0000', 'employee', { code: '4' }, { name: e.name, branch: e.branch, dept: e.dept, job: e.job, shift: e.shift, active: true });
  });
  test('إلغاء صرف جايزة (تصحيح مالي) لازم بسبب، وبيتسجل بالمبلغ القديم', async () => {
    await rpc('select najm_payout_save($1,$2,$3,$4)', ['ops', '0000', 'pz1', { month: D.slice(0, 7), code: '125', kind: 'gold', ref: 'x', amount: 1500 }]);
    await fails(asAnon(db, 'select najm_payout_save($1,$2,$3,$4)', ['ops', '0000', 'pz1', null]), /reason required/);
    await rpc('select najm_payout_save($1,$2,$3,$4)', ['ops', '0000', 'pz1', { undo: true, reason: 'اتصرف للشخص الغلط' }]);
    const L = (await rpc('select najm_payout_log($1,$2) r', ['ops', '0000'])).r;
    const u = L.find(h => h.kind === 'payout_undo');
    eq([+u.data.old.amount, u.data.reason, L.some(h => h.kind === 'payout')], [1500, 'اتصرف للشخص الغلط', true]);
    eq((await rpc('select najm_payout_log($1,$2) r', ['br', '1111'])).r.error, 'najm: operations manager only');
  });

  test('شيت الحضور الشهري: مدير التشغيل بس، بيحفظ مرة واحدة، والحالات المسموحة بس', async () => {
    const rows = [{ day: ago(3), code: '125', st: 'on', time: '8:00 AM' }, { day: ago(3), code: '4', st: 'abs', time: null }, { day: ago(3), code: 'nope', st: 'on' }];
    await fails(save('br', '1111', 'att_bulk', { reason: 'x' }, rows), /operations manager only/);
    await fails(save('ops', '0000', 'att_bulk', { reason: 'x' }, [{ day: ago(3), code: '125', st: 'bad' }]), /bad attendance status/);
    const r = await save('ops', '0000', 'att_bulk', { reason: 'شيت الحضور الشهري' }, rows);
    eq(r.saved, 2);
    eq((await db.query('select att, att_time from najm_ratings where day=$1 and code=$2', [ago(3), '125'])).rows[0], { att: 'on', att_time: '8:00 AM' });
    const h = (await db.query("select data from najm_history where kind='att_bulk' order by id desc limit 1")).rows[0].data;
    eq([h.data.saved, h.data.rows], [2, 3]);
  });

  // ---------------- التحديث اليومي للبصمة من الـ Drive
  test('التحديث اليومي من الـ Drive: الحكم من ميعاد الوردية، الراحة والغياب، والتعديل اليدوي مبيتكتبش فوقه', async () => {
    const x = (await db.query("select code from najm_employees where branch=$1 and shift='Night' and dept<>'قسم البقاله' order by code limit 1 offset 9", [B])).rows[0].code;
    const base = '2026-03-'; const R = (d, shift, tin, leave) => ({ code: x, day: base + d, shift, in: tin, leave: leave || '' });
    // 7 مارس 2026 سبت
    const rows = [R('07', '8:00 AM', '8:05 AM'), R('08', '7:00 AM', '7:25 AM'), R('09', '5:00 PM', '6:10 PM'), R('10', '11:00 PM', '12:05 AM'),
      R('11', '8:00 ص', '', 'مرضي'), R('12', '8:00 AM', ''), R('13', '8:00 AM', ''), R('14', '8:00 AM', '7:59 AM'), R('20', '8:00 AM', ''),
      { code: '88888888', day: base + '07', shift: '8:00 AM', in: '8:00 AM', leave: '' }];
    await fails(asAnon(db, 'select najm_att_sync($1,$2)', [JSON.stringify(rows), 'x']), /permission denied/);
    const r = (await db.query('select najm_att_sync($1,$2) r', [JSON.stringify(rows), 'حضور ppv-03-2026'])).rows[0].r;
    const st = Object.fromEntries((await db.query("select to_char(day,'DD') d, att, att_src from najm_ratings where code=$1 and day between '2026-03-01' and '2026-03-31' order by day", [x])).rows.map(r => [r.d, r.att]));
    eq(st, { '07': 'on', '08': 'late', '09': 'xlate', '10': 'xlate', '11': 'off', '12': 'off', '13': 'abs', '14': 'on' });
    eq([r.to, r.unknown], ['2026-03-14', ['88888888']]);
    // مدير التشغيل عدّل يوم الغياب بإيده ← التحديث الجاي مبيرجّعهوش
    await save('ops', '0000', 'att', { day: base + '13', code: x, reason: 'كان في مأمورية' }, { st: 'on' });
    const r2 = (await db.query('select najm_att_sync($1,$2) r', [JSON.stringify(rows), 'حضور ppv-03-2026'])).rows[0].r;
    eq([(await db.query("select att, att_src from najm_ratings where code=$1 and day='2026-03-13'", [x])).rows[0].att, r2.manual_kept], ['on', 1]);
    eq((await db.query("select count(*)::int n from najm_history where kind='att_sync'")).rows[0].n >= 2, true);
  });
  test('قارئ الشيت (tools/attendance-sheet.js): بياخد الكود والتاريخ والوردية والدخول والإجازة بس', async () => {
    const XLSX = require('xlsx'), fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'najm-att-')); const inF = path.join(dir, 'a.xlsx'), outF = path.join(dir, 'a.json');
    const H = ['اليوم', 'التاريخ', 'ايام الحضور', 'اجازة مدفوعة', 'نوع الاجازه', 'بدل الأجازه', 'جزاء غياب بدون اذن', 'معاد الورديه', 'س الدخول', 'س الخروج'];
    const aoa = [['', 'o2'], ['الكود', '125', 'الاسم'], ['الراتب الاساسي', '7171717', 'بدل متغير kpi', '5252525'], H,
      ['Sunday', '1/11/2026', '1', '', '', '4545454', '6363636', '8:00 AM', '8:03 AM', '5:00 PM'], ['Monday', '2/11/2026', '0', '', 'مرضي', '', '', '8:00 AM', '', ''], ['الاجمالى']];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'راتب11'); XLSX.writeFile(wb, inF);
    const cF = path.join(dir, 'c.txt');
    const info = JSON.parse(execFileSync('node', [path.resolve(__dirname, '../../tools/attendance-sheet.js'), inF, outF, '--compact', cF], { env: process.env }).toString().trim().split('\n').pop());
    const out = JSON.parse(fs.readFileSync(outF, 'utf8')); const payload = fs.readFileSync(cF, 'utf8'); fs.rmSync(dir, { recursive: true });
    eq([payload, info.md5 === require('crypto').createHash('md5').update(payload).digest('hex')], ['2026-11|125:3', true]);   // الأيام بعد آخر بصمة بتتشال
    eq(out, [{ code: '125', day: '2026-11-01', shift: '8:00 AM', in: '8:03 AM', leave: '' }, { code: '125', day: '2026-11-02', shift: '8:00 AM', in: '', leave: 'مرضي' }]);
    ok(!['7171717', '5252525', '4545454', '6363636'].some(v => (JSON.stringify(out) + payload).includes(v)), 'money columns leaked');
  });
  test('التحديث اليومي بالصيغة الصغيرة: md5 لازم يطابق، والحكم صح، ومن غير أوقات', async () => {
    const x = (await db.query("select code from najm_employees where branch=$1 and shift='Night' and dept<>'قسم البقاله' order by code limit 1 offset 11", [B])).rows[0].code;
    // 1 مارس 2026 أحد · 7 مارس سبت: 0=في ميعاده · 20=تأخير بسيط · 45=كبير · L إجازة · - راحة ثم غياب · x مش مقروء · . مفيش
    const payload = `2026-04|${x}:0,20,45,L,-,-,0,x,.`;
    const md5 = require('crypto').createHash('md5').update(payload).digest('hex');
    await fails(db.query('select najm_att_sync_compact($1,$2,$3)', [payload + '1', md5, 'f']), /checksum mismatch/);
    await fails(asAnon(db, 'select najm_att_sync_compact($1,$2,$3)', [payload, md5, 'f']), /permission denied/);
    const r = (await db.query('select najm_att_sync_compact($1,$2,$3) r', [payload, md5, 'حضور ppv-04-2026'])).rows[0].r;
    const st = Object.fromEntries((await db.query("select to_char(day,'DD') d, att, att_time from najm_ratings where code=$1 and day between '2026-04-01' and '2026-04-30' order by day", [x])).rows.map(r => [r.d, [r.att, r.att_time]]));
    // 1 أبريل أربعاء: الأسبوع من السبت 28 مارس · 4 أبريل سبت = أسبوع جديد
    eq(st, { '01': ['on', null], '02': ['late', null], '03': ['vlate', null], '04': ['off', null], '05': ['off', null], '06': ['abs', null], '07': ['on', null] });
    eq(r.to, '2026-04-07');
  });

  test('اعتراض على الغياب: الموظف بكوده، التشغيل يقرر، القبول بيحوّل اليوم لإجازة ومابيتغيّرش بتحديث الشيت', async () => {
    const x = (await db.query("select code from najm_employees where branch=$1 and active and shift='Night' and dept<>'قسم البقاله' and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') order by code desc limit 1", [B])).rows[0].code;
    const t = today();
    await db.query("insert into najm_ratings(day, code, att, att_src) values ($1,$2,'abs','sheet'),($1::date - 1,$2,'on','sheet') on conflict (day, code) do update set att='abs', att_src='sheet'", [t, x]);
    const ap = (d, b) => asAnon(db, 'select najm_emp_att_appeal($1,$2,$3,$4) r', [x, '', d, b]).then(r => r[0].r);
    const yday = (await db.query("select ($1::date - 1)::text d", [t])).rows[0].d;
    eq((await ap(yday, 'مش غياب')).error, 'najm: day is not an absence');
    eq((await ap(t, 'x')).error, 'najm: write the reason (3-500 letters)');
    eq((await ap(t, 'كانت راحتي')).ok, true);
    eq((await ap(t, 'تاني')).error, 'najm: appeal already open');
    const id = (await db.query("select id from najm_att_appeals where code=$1 and status='pending'", [x])).rows[0].id;
    await fails(save('br', '1111', 'att_appeal_decide', { id }, { accept: true }), /operations manager only/);
    await save('ops', '0000', 'att_appeal_decide', { id }, { accept: true, note: 'تمام' });
    eq((await db.query("select att, att_src from najm_ratings where code=$1 and day=$2", [x, t])).rows[0], { att: 'off', att_src: 'manual' });
    await fails(save('ops', '0000', 'att_appeal_decide', { id }, { accept: false }), /already decided/);
    // تحديث الشيت بعد كده مبيلمسش اليوم المتعدّل
    const mo = t.slice(0, 7), dd = +t.slice(8, 10);
    const px = `${mo}|${x}:` + Array.from({ length: dd }, (_, i) => i + 1 === dd ? '-' : '0').join(',');
    await db.query('select najm_att_sync_compact($1,$2,$3)', [px, require('crypto').createHash('md5').update(px).digest('hex'), 'f']);
    eq((await db.query("select att from najm_ratings where code=$1 and day=$2", [x, t])).rows[0].att, 'off');
  });
  test('الشهر النهائي: التحديث من الشيت مبيغيّرش فيه (تنبيه بس)، واليوم الممسوح من الشيت بيتشال في الشهر المفتوح', async () => {
    const x = (await db.query("select code from najm_employees where branch=$1 and shift='Night' and dept<>'قسم البقاله' order by code limit 1 offset 7", [B])).rows[0].code;
    const md = p => require('crypto').createHash('md5').update(p).digest('hex');
    const sync = p => db.query('select najm_att_sync_compact($1,$2,$3) r', [p, md(p), 'f']).then(r => r.rows[0].r);
    const att = async d => (await db.query("select att from najm_ratings where code=$1 and day=$2", [x, d])).rows[0]?.att ?? null;
    // شهر مفتوح (الشيت واحد): اتسجل ← الشيت اتعدّل ← اتسجل التعديل ← اليوم اتمسح من الشيت ← اتشال
    await sync(`2026-02|${x}:0,0,0`);   eq(await att('2026-02-02'), 'on');
    await sync(`2026-02|${x}:0,20,0`);  eq(await att('2026-02-02'), 'late');
    await sync(`2026-02|${x}:0,.,0`);   eq(await att('2026-02-02'), null);
    // الشهر نهائي (اتعتمد): الشيت بعد كده مبيلمسهوش، والنتيجة بترجع frozen_days
    await sync(`2026-02|${x}:0,20,0`);  eq(await att('2026-02-02'), 'late');
    await db.query("update najm_settings set data = jsonb_set(data, '{monthsFinal}', '{\"2026-02\": {\"by\": \"ops\"}}'::jsonb) where id = 1");
    const r = await sync(`2026-02|${x}:0,45,.`);
    eq(await att('2026-02-02'), 'late');   // كان 'late' ومفيش تغيير رغم إن الشيت بقى «كبير»
    eq(r.frozen_days >= 1, true);
    eq((await db.query("select najm_month_final('2026-02') a, najm_month_final('2999-01') b")).rows[0], { a: true, b: false });
    await db.query("update najm_settings set data = data - 'monthsFinal' where id = 1");
    await db.query("delete from najm_alerts where kind = 'sheet_changed'");   // تنبيهات الاختبار ده متوصلش لاختبار التنبيهات
  });
  test('مراجعة الأيام الفاضية: مدير الفرع يقرر في فرعه بس، القرار بيتثبّت، والتشغيل يشوفه، والتراجع بيرجّعه غياب', async () => {
    const x = (await db.query("select code from najm_employees where branch=$1 and active and shift='Night' and dept<>'قسم البقاله' and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') order by code desc limit 1 offset 3", [B])).rows[0].code;
    const other = (await db.query("select code from najm_employees where branch<>$1 and active limit 1", [B])).rows[0].code;
    const md = p => require('crypto').createHash('md5').update(p).digest('hex');
    const t = today(), mo = t.slice(0, 7), dd = +t.slice(8, 10);
    if (dd < 3) return;   // محتاجين يومين فاتوا في نفس الشهر
    // جدول الراحات: يوم 1 بس. اليوم 2 فاضي (غير مخطط) ← غياب، واليوم 1 فاضي ومخطط ← راحة
    await save('ops', '0000', 'leave_plan', { month: mo }, { rows: [{ code: x, days: [1] }] });
    const px = `${mo}|${x}:-,-,` + Array.from({ length: dd - 2 }, () => '0').join(',');
    await db.query('select najm_att_sync_compact($1,$2,$3)', [px, md(px), 'f']);
    const d2 = `${mo}-02`;
    const att = async () => (await db.query("select att, att_src from najm_ratings where code=$1 and day=$2", [x, d2])).rows[0];
    eq(await att(), { att: 'abs', att_src: 'sheet' });
    const files = async u => (await asAnon(db, 'select najm_files($1,$2) r', [u, u === 'ops' ? '0000' : '1111']))[0].r.day_review;
    eq((await files('br')).pending.some(p => p.code === x && p.day.slice(0, 10) === d2), true);
    // مدير الفرع ميقررش لموظف فرع تاني ولا مدير الشيفت
    await fails(save('br', '1111', 'day_review', { day: d2, code: other }, { kind: 'off' }), /outside your scope|not a blank day/);
    await fails(save('sh', '2222', 'day_review', { day: d2, code: x }, { kind: 'off' }), /branch manager or operations only|wrong username or PIN/);
    await fails(save('br', '1111', 'day_review', { day: d2, code: x }, { kind: 'bogus' }), /bad decision/);
    await save('br', '1111', 'day_review', { day: d2, code: x }, { kind: 'off' });   // السبب اختياري
    eq(await att(), { att: 'off', att_src: 'manual' });
    // تحديث الشيت مبيلمسهوش، ومدير التشغيل بيشوف القرار ومين قرره
    await db.query('select najm_att_sync_compact($1,$2,$3)', [px, md(px), 'f']);
    eq((await att()).att, 'off');
    const ops = await files('ops'); const done = ops.done.find(d => d.code === x);
    eq([done.kind, done.by, ops.pending.some(p => p.code === x && p.day.slice(0, 10) === d2)], ['off', 'br', false]);
    // تغيير القرار لغياب مع سبب، وبعدين التراجع ← غياب من الشيت (مستني)
    await save('br', '1111', 'day_review', { day: d2, code: x }, { kind: 'abs', reason: 'غاب فعلاً' });
    eq((await files('ops')).done.find(d => d.code === x).reason, 'غاب فعلاً');
    await save('br', '1111', 'day_review', { day: d2, code: x }, null);
    eq(await att(), { att: 'abs', att_src: 'sheet' });
    // بعد ما الشهر يبقى نهائي مدير الفرع مبيغيّرش، والتشغيل يغيّر
    await db.query("update najm_settings set data = jsonb_set(coalesce(data, '{}'::jsonb), '{monthsFinal}', jsonb_build_object($1::text, jsonb_build_object('by','ops'))) where id = 1", [mo]);
    await fails(save('br', '1111', 'day_review', { day: d2, code: x }, { kind: 'off' }), /month is final/);
    await save('ops', '0000', 'day_review', { day: d2, code: x }, { kind: 'leave' });
    eq((await att()).att, 'off');
    await db.query("update najm_settings set data = data - 'monthsFinal' where id = 1");
    await db.query("delete from najm_alerts where kind = 'sheet_changed'");
  });
  test('جدول الراحات: اليوم الفاضي المخطط = راحة (حتى يومين ورا بعض)، وغير المخطط = غياب، ومن غير جدول = الحساب القديم', async () => {
    const [x, y] = (await db.query("select code from najm_employees where branch=$1 and shift='Night' and dept<>'قسم البقاله' order by code limit 2 offset 12", [B])).rows.map(r => r.code);
    await fails(save('br', '1111', 'leave_plan', { month: '2026-06' }, { rows: [{ code: x, days: [2, 3] }] }), /operations manager only/);
    await save('ops', '0000', 'leave_plan', { month: '2026-06' }, { rows: [{ code: x, days: [2, 3] }, { code: 'nope', days: [1] }] });
    eq((await db.query("select count(*)::int n from najm_leave_plan where code in ($1,'nope')", [x])).rows[0].n, 2);
    // يونيو 2026: 1 اثنين · الراحة 2 و3 (يومين ورا بعض في نفس الأسبوع) · 4 و5 فاضيين من غير تخطيط ← غياب
    const px = `2026-06|${x}:0,-,-,-,-,0,0;${y}:0,-,-,-,0,0,0`;
    await db.query('select najm_att_sync_compact($1,$2,$3)', [px, require('crypto').createHash('md5').update(px).digest('hex'), 'f']);
    const st = async c => Object.fromEntries((await db.query("select to_char(day,'DD') d, att from najm_ratings where code=$1 and day between '2026-06-01' and '2026-06-07' order by day", [c])).rows.map(r => [r.d, r.att]));
    eq(await st(x), { '01': 'on', '02': 'off', '03': 'off', '04': 'abs', '05': 'abs', '06': 'on', '07': 'on' });
    eq(await st(y), { '01': 'on', '02': 'off', '03': 'abs', '04': 'abs', '05': 'on', '06': 'on', '07': 'on' });   // من غير جدول: أول يوم فاضي في الأسبوع راحة والباقي غياب
  });

  // ---------------- تقييم المديرين كل 4 أيام
  test('تقييم المديرين كل 4 أيام: بيكمّل لوحده، والتعديل بيمشي لقدام لحد أول يوم متقيّم، والغياب من غير نجوم مديرين', async () => {
    const c = (await db.query("select code from najm_employees where branch=$1 and active order by code limit 1 offset 17", [B])).rows[0].code;
    const row = async d => (await db.query('select br, carry from najm_ratings where code=$1 and day=$2', [c, d])).rows[0];
    // المدير بيقيّم (صريح) ← najm_carry_forward زي najm_save بالظبط
    const rate = async (d, a) => { await db.query("insert into najm_ratings(day,code,br,carry) values ($1,$2,$3,'{}') on conflict (day,code) do update set br=excluded.br, carry=array_remove(coalesce(najm_ratings.carry,'{}'),'br')", [d, c, a]); await db.query("select najm_carry_forward($1,$2,'br')", [c, d]); };
    await rate('2025-03-01', [2, 2, 2, 2, 2]);
    await db.query("insert into najm_ratings(day, code, att) values ('2025-03-02',$1,'on'),('2025-03-03',$1,'abs'),('2025-03-04',$1,'on')", [c]);
    eq([(await row('2025-03-02')).br, (await row('2025-03-02')).carry], [[2, 2, 2, 2, 2], ['br']]);
    await rate('2025-03-05', [1, 1, 1, 1, 1]);
    await rate('2025-03-02', [0, 0, 0, 0, 0]);
    eq([(await row('2025-03-02')).carry, (await row('2025-03-04')).br, (await row('2025-03-05')).br], [[], [0, 0, 0, 0, 0], [1, 1, 1, 1, 1]]);
    const sc = async d => (await db.query("select public.najm_score(r, 'قسم الكاشير', (select data from najm_settings where id=1)) s from najm_ratings r where code=$1 and day=$2", [c, d])).rows[0].s;
    // الغياب: مفيش نجوم مديرين ولا صلاة — والتقييم المكمّل بيتحسب (بيقطع ← ربع نجمة صلاة على يوم 4)
    eq([(await sc('2025-03-03')).parts.br, (await sc('2025-03-03')).pray_star, (await sc('2025-03-04')).parts.br, (await sc('2025-03-04')).carry], [null, null, 0, ['br']]);
    await fails(save('ops', '0000', 'rate', { day: D, code: c }, [2, 2, 2, 2]), /rates managers only/);
    const n = (await db.query("select code from najm_employees where branch=$1 and active and shift='Night' order by code limit 1 offset 8", [B])).rows[0].code;
    await fails(save('br', '1111', 'rate', { day: D, code: n }, [3, 2, 2, 2, 2]), /bad rating/);
    await save('br', '1111', 'rate', { day: D, code: n }, [2, 2, 2, 2, 1]);   // 5 بنود: الخامس الصلاة (بيقطع)
  });

  test('الموظفين من شيت البصمة: الجديد بيتضاف بشيفته، والمتغيّر بيتعدّل (والنقل بيتسجل)، والقيم الغلط بتتساب', async () => {
    const x = (await db.query("select code, dept from najm_employees where branch=$1 and active order by code limit 1 offset 21", [B])).rows[0];
    const rows = [
      { code: '99001', name: 'موظف جديد صبح', dept: 'قسم البقاله', job: 'شيف', branch: B, shiftTime: '7:00 AM', lastIn: D },
      { code: '99002', name: 'موظف جديد بيتوين', dept: 'خدمه العملاء', job: 'سيلز', branch: B, shiftTime: '2:00 PM', lastIn: D },
      { code: '99003', name: 'موظف جديد ليل', dept: '#N/A', job: '', branch: B, shiftTime: '11:00 PM', lastIn: D },
      { code: '99006', name: 'ساب من زمان', dept: 'x', job: 'y', branch: B, shiftTime: '7:00 AM', lastIn: '2020-01-01' },
      { code: '99004', name: 'فرع غريب', dept: 'x', job: 'y', branch: 'فرع مش موجود', shiftTime: '' },
      { code: '99005', name: '', dept: 'x', job: 'y', branch: B, shiftTime: '' },
      { code: x.code, name: 'اسم متعدّل', dept: 'قسم الكاشير', job: '#N/A', branch: 'لا يوجد', shiftTime: '' },
    ];
    await fails(asAnon(db, 'select najm_emp_sync($1,$2)', [JSON.stringify(rows), 'f']), /permission denied/);
    const r = (await db.query('select najm_emp_sync($1,$2) r', [JSON.stringify(rows), 'حضور ppv'])).rows[0].r;
    const E = Object.fromEntries((await db.query("select code, name, dept, job, branch, shift from najm_employees where code = any($1)", [['99001', '99002', '99003', '99004', '99005', x.code]])).rows.map(e => [e.code, e]));
    eq([E['99001'].shift, E['99002'].shift, E['99003'].shift, E['99003'].dept, !!E['99004'], !!E['99005']], ['Morning', 'Between', 'Night', null, false, false]);
    eq([E[x.code].name, E[x.code].dept, E[x.code].branch], ['اسم متعدّل', 'قسم الكاشير', B]);
    eq(r.added.length, 3);   // الجديد اللي بصم آخر أسبوع بيتضاف فوراً، واللي وقف من بدري بيتسكّب
    eq((await db.query("select count(*)::int n from najm_alerts where kind='emp_added'")).rows[0].n, 3);   // وإشعار لمدير التشغيل
    ok(r.skipped.some(s => s.code === '99004') && r.skipped.some(s => s.code === '99006') && r.skipped.filter(s => s.code === '99004').length === 1, 'skips reported once');
    eq((await db.query("select by_user, to_dept from najm_emp_moves where code=$1 order by id desc limit 1", [x.code])).rows[0], { by_user: 'sheet', to_dept: 'قسم الكاشير' });
  });

  test('الكاميرات (صلاة ¼ + بريك ¼ كل يوم) · صلاة المدير كل 4 أيام (ملتزم ½ · بيقطع ¼) · التعارض لمدير التشغيل · وسام برق · خصم التارجت', async () => {
    const c = (await db.query("select code from najm_employees where branch=$1 and active and dept <> 'قسم البقاله' and shift='Night' order by code limit 1 offset 6", [B])).rows[0].code;   // الليل لسه مفتوح النهارده
    await save('ops', '0000', 'user', { username: 'cam1' }, { name: 'كاميرات', role: 'cameras', branch: B, pin: '4444' });
    await save('ops', '0000', 'att', { day: D, code: c, reason: 'اختبار' }, { st: 'on' });
    await fails(save('cam1', '4444', 'rate', { day: D, code: c }, [2, 2, 2, 2]), /cameras record prayer and break only/);
    await fails(save('cam1', '4444', 'pray', { day: D, code: c }, { v: 2 }), /bad value/);
    await fails(save('br', '1111', 'pray', { day: D, code: c }, { v: 1 }), /recorded by the cameras/);
    let r = await save('cam1', '4444', 'pray', { day: D, code: c }, { v: 1 });
    eq([r.score.cam_star, r.row.pray], [0.25, 1]);
    r = await save('cam1', '4444', 'brk', { day: D, code: c }, { v: 1 });
    eq([r.score.cam_star, r.row.brk], [0.5, 1]);
    await db.query("update najm_ratings set sh='{2,2,2,2,1}', br='{2,2,2,2,1}' where day=$1 and code=$2", [D, c]);
    r = (await db.query("select public.najm_score(r, 'x', (select data from najm_settings where id=1)) s from najm_ratings r where code=$1 and day=$2", [c, D])).rows[0].s;
    eq([r.pray_lvl, r.pray_star, r.ops_star ?? null], [1, 0.25, null]);
    // مدير التشغيل اعتمد رأي الكاميرات (ملتزم) للدورة
    const cyc = (await db.query("select ($1::date - ((extract(day from $1::date)::int - 1) % 4))::text d", [D])).rows[0].d;
    await save('ops', '0000', 'pray_review', { code: c, cycle: cyc }, { decision: 'cams', level: 2 });
    r = (await db.query("select public.najm_score(r, 'x', (select data from najm_settings where id=1)) s from najm_ratings r where code=$1 and day=$2", [c, D])).rows[0].s;
    eq(r.pray_star, 0.5);
    eq((await asAnon(db, 'select decision from najm_public_pray_reviews($1)', [D.slice(0, 7)])).length >= 1, true);
    // وسام برق مرة في الشهر
    await save('ops', '0000', 'medal', { code: c, day: D }, { note: 'أداء مميز' });
    await save('ops', '0000', 'medal', { code: c, day: D }, { note: 'تاني' });   // أي عدد في الشهر
    eq((await asAnon(db, 'select code from najm_public_medals($1)', [D.slice(0, 7)])).filter(x => x.code === c).length, 2);
    await save('ops', '0000', 'medal', { code: c, day: D }, null);   // الشيل بيشيل آخر وسام بس
    eq((await asAnon(db, 'select code from najm_public_medals($1)', [D.slice(0, 7)])).filter(x => x.code === c).length, 1);
    await save('ops', '0000', 'medal', { code: 'm:br', day: D }, { note: 'مدير مميز' });   // وسام لمدير (كود m:اسم-الدخول)
    eq((await asAnon(db, 'select code from najm_public_medals($1)', [D.slice(0, 7)])).some(x => x.code === 'm:br'), true);
    await fails(save('br', '1111', 'medal', { code: c, day: D }, {}), /operations manager only/);
    eq((await asAnon(db, 'select code from najm_public_medals($1)', [D.slice(0, 7)])).some(x => x.code === c), true);
    // خصم التارجت (تلاعب 50%) — للكل: النسبة بس من غير السبب
    await fails(save('ops', '0000', 'tgt_penalty', { id: 'tp1' }, { code: c, month: D.slice(0, 7), pct: 50, reason: ' ' }), /reason required/);
    await save('ops', '0000', 'tgt_penalty', { id: 'tp1' }, { code: c, month: D.slice(0, 7), pct: 50, reason: 'تلاعب في التقييم' });
    const pp = (await asAnon(db, 'select * from najm_public_penalties($1)', [D.slice(0, 7)])).find(x => x.code === c);
    eq([+pp.pct, 'reason' in pp], [50, false]);
    eq((await asAnon(db, 'select count(*)::int n from najm_medals'))[0].n, 0);   // الجدول مقفول عن العامة
  });

  test('التحديث اليومي: النهارده لسه شغال — اللي بصم بيتسجل، واللي لسه مابصمش مبيتحسبش غياب ولا راحة', async () => {
    const [a, b] = (await db.query("select code from najm_employees where branch=$1 and active order by code limit 2 offset 30", [B])).rows.map(r => r.code);
    const T = (await db.query("select ((now() at time zone 'Africa/Cairo')::date)::text d")).rows[0].d;
    const rows = [{ code: a, day: T, shift: '7:00 AM', in: '7:02 AM', leave: '' }, { code: b, day: T, shift: '5:00 PM', in: '', leave: '' }];
    await db.query("update najm_employees set shift='Morning' where code=$1", [a]);
    await db.query('select najm_att_sync($1,$2)', [JSON.stringify(rows), 'today-test']);
    const st = Object.fromEntries((await db.query('select code, att from najm_ratings where day=$1 and code = any($2)', [T, [a, b]])).rows.map(r => [r.code, r.att]));
    eq([st[a], st[b] ?? null], ['on', null]);   // مفيش بصمات شيفت ليل في الشيت ← النهارده مش كامل
    // الشيت فيه بصمة شيفت ليل النهارده + الساعة عدّت بداية الليل بساعتين ← اللي مابصمش بيتحسب (راحة أو غياب)
    const n = (await db.query("select code from najm_employees where branch=$1 and active and shift='Night' and code not in ($2,$3) order by code limit 1", [B, a, b])).rows[0].code;
    await db.query("update najm_employees set shift='Night' where code=$1", [b]);
    await db.query('select najm_att_sync($1,$2)', [JSON.stringify([...rows, { code: n, day: T, shift: '5:00 PM', in: '5:01 PM', leave: '' }, { code: b, day: (await db.query("select ((now() at time zone 'Africa/Cairo')::date - 1)::text d")).rows[0].d, shift: '5:00 PM', in: '5:01 PM', leave: '' }]), 'today-test-2']);
    const late = (await db.query("select (now() at time zone 'Africa/Cairo')::time >= time '19:00' x")).rows[0].x;
    const sb = (await db.query('select att from najm_ratings where day=$1 and code=$2', [T, b])).rows[0]?.att ?? null;
    ok(late ? ['off', 'abs'].includes(sb) : sb === null, 'today no-show: ' + sb + ' late=' + late);
  });

  test('الموظف بيدخل بكود البصمة بس — والرقم السري لو التشغيل حطه بس، وهو اللي بيفتح التصويت والاعتراض', async () => {
    const c = (await db.query("select code from najm_employees e where active and not exists (select 1 from najm_emp_pins p where p.code=e.code) and not exists (select 1 from najm_users u where u.emp_code=e.code) order by code desc limit 1")).rows[0].code;
    const login = async pin => (await rpc('select najm_login_any($1,$2) r', [c, pin])).r;
    const r = await login('');
    eq([r.kind, r.code, r.has_pin], ['emp', c, false]);
    eq((await rpc('select najm_emp_appeal($1,$2,$3,$4) r', [c, '', 'x', 'سبب'])).r.error, 'najm: card cannot be appealed');   // بالكود بس: وصل لحد فحص الكارت
    eq((await rpc('select najm_vote($1,$2,$3,$4) r', [c, '', 'device-0123456789abcdef', 'br'])).r.ok, true);
    eq((await rpc('select najm_emp_set_pin($1,$2,$3) r', [c, '', '1234'])).r.error, 'najm: PIN required');
    // التشغيل بيحط رقم ← لازم في الدخول
    await save('ops', '0000', 'emp_pin', { code: c }, { pin: '4321' });
    eq((await login('')).error, 'najm: wrong code or PIN');
    eq([(await login('4321')).kind, (await login('4321')).has_pin], ['emp', true]);
    // وبيتشال ← يرجع بالكود بس
    await save('ops', '0000', 'emp_pin', { code: c }, null);
    eq((await login('')).kind, 'emp');
    // المدير لسه لازم رقمه
    eq((await rpc('select najm_login_any($1,$2) r', ['br', ''])).r.error, 'najm: wrong code or PIN');
  });

  test('التنبيهات: الشيت اتغيّر في يوم فات ← تنبيه لمدير التشغيل · موظف رجع يبصم بعد 7 أيام · الموظف الجديد بيتضاف بعد أسبوع دخول + خروج', async () => {
    const x = (await db.query("select code from najm_employees where branch=$1 and active and shift='Morning' order by code limit 1 offset 33", [B])).rows[0].code;
    const y = ago(3);
    const run = async inT => db.query('select najm_att_sync($1,$2) r', [JSON.stringify([{ code: x, day: y, shift: '8:00 AM', in: inT, leave: '' }]), 'alerts-test']);
    await run('8:02 AM');
    eq((await db.query("select count(*)::int n from najm_alerts where kind='sheet_changed'")).rows[0].n, 0);
    await run('8:02 AM');   // نفس النتيجة ← مفيش تنبيه
    eq((await db.query("select count(*)::int n from najm_alerts where kind='sheet_changed'")).rows[0].n, 0);
    const r = (await run('9:40 AM')).rows[0].r;   // الشيت اتعدّل ليوم فات
    eq(r.changed_past_days, 1);
    const al = (await db.query("select data from najm_alerts where kind='sheet_changed'")).rows[0].data;
    eq([al.count, al.rows[0].code, al.rows[0].old, al.rows[0].new], [1, x, 'on', 'xlate']);
    // تغيير إعدادات التأخير بس (من غير ما الشيت يتغيّر) مبيعملش تنبيه
    await run('9:40 AM');
    eq((await db.query("select (data->>'count')::int n from najm_alerts where kind='sheet_changed'")).rows[0].n, 1);
    // رجع يبصم بعد غياب + الجديد محتاج أسبوع دخول + خروج
    const T = (await db.query("select ((now() at time zone 'Africa/Cairo')::date)::text d")).rows[0].d;
    const rows = [{ code: x, name: 'رجع', dept: '', job: '', branch: B, backGap: 9, backDay: T },
                  { code: '99101', name: 'جديد كمّل', dept: 'خدمه العملاء', job: 'سيلز', branch: B, shiftTime: '7:00 AM', lastIn: T, fullWeek: 6 },
                  { code: '99102', name: 'جديد لسه', dept: 'خدمه العملاء', job: 'سيلز', branch: B, shiftTime: '7:00 AM', lastIn: T, fullWeek: 3 }];
    const es = (await db.query('select najm_emp_sync($1,$2) r', [JSON.stringify(rows), 'f'])).rows[0].r;
    eq([es.added.map(a => a.code), es.skipped.length], [['99101', '99102'], 0]);
    await db.query('select najm_emp_sync($1,$2)', [JSON.stringify(rows), 'f']);   // التنبيه مرة واحدة
    eq((await db.query("select count(*)::int n from najm_alerts where kind='comeback' and code=$1", [x])).rows[0].n, 1);
    // موظف نشط من غير بصمة 14 يوم ← تنبيه مرة واحدة (حتى لو التحديث اتكرر)
    eq((await db.query("select count(*)::int n from najm_alerts where kind='stale' and code='99101'")).rows[0].n, 1);
    // مدير التشغيل بس بيشوفها، وبيعلّم «اتشاف»
    const L = (await rpc('select najm_alerts_list($1,$2) r', ['ops', '0000'])).r;
    eq(L.length >= 2, true);
    eq((await rpc('select najm_alerts_list($1,$2) r', ['br', '1111'])).r, []);
    await save('ops', '0000', 'alert_seen', { id: L[0].id }, {});
    eq((await db.query('select seen_by from najm_alerts where id=$1', [L[0].id])).rows[0].seen_by, 'ops');
    eq((await asAnon(db, 'select count(*)::int n from najm_alerts'))[0].n, 0);
  });

  test('الشيت واقف أو ناقص: آخر يوم ناقص مبيتحسبش غياب، وتنبيه «الشيت واقف» لو من يومين، واللي بعده بيكمّل من آخر يوم', async () => {
    const em = (await db.query("select code from najm_employees where branch=$1 and active order by code limit 40 offset 60", [B])).rows.map(r => r.code);
    const dd = n => { const d = new Date(D); d.setDate(d.getDate() - 70 - n); return d.toISOString().slice(0, 10); };
    const mk = (day, codes) => em.map(c => ({ code: c, day, shift: '9:00 AM', in: codes.includes(c) ? '9:01 AM' : '', leave: '' }));   // صف لكل موظف كل يوم (زي الشيت الحقيقي): اللي مابصمش صفه من غير دخول
    // 7 أيام كاملة (آخرها من 3 أيام) وبعدها يوم ناقص (من يومين): 40 موظف بصموا الأيام الكاملة، و4 بس في آخر يوم
    const rows = [];
    for (let n = 9; n >= 4; n--) rows.push(...mk(dd(n), em));
    rows.push(...mk(dd(3), em.slice(0, 4)));   // آخر يوم في الشيت: 4 من 40 ← ناقص
    await db.query('select najm_att_sync($1,$2)', [JSON.stringify(rows), 'stalled']);
    const r = (await db.query('select najm_att_sync($1,$2) r', [JSON.stringify(rows), 'stalled'])).rows[0].r;
    eq([r.last_day_partial, r.stale_days >= 2], [true, true]);
    // اللي ماجوش في اليوم الناقص مفيش ليهم غياب ولا راحة
    eq((await db.query("select count(*)::int n from najm_ratings where day=$1 and code = any($2) and att in ('abs','off')", [dd(3), em.slice(4)])).rows[0].n, 0);
    eq((await db.query("select count(*)::int n from najm_alerts where kind='sheet_stale'")).rows[0].n >= 1, true);
    // الشيت اتحدّث: اليوم اتكمل + أيام بعده ← الغياب بيتحسب، والنجوم بتكمّل من آخر يوم
    const full = [...rows.filter(x => x.day !== dd(3)), ...mk(dd(3), em.slice(0, 30)), ...mk(dd(2), em.slice(0, 30)), ...mk(dd(1), em.slice(0, 30))];
    const r2 = (await db.query('select najm_att_sync($1,$2) r', [JSON.stringify(full), 'recovered'])).rows[0].r;
    eq([r2.last_day_partial, r2.to], [false, dd(1)]);
    eq((await db.query("select count(*)::int n from najm_ratings where day=$1 and code = any($2) and att in ('abs','off')", [dd(3), em.slice(30)])).rows[0].n > 0, true);
  });

  test('مين بيقيّم مين: اللي بنفس الصلاحية مبيقيّمش بعض، هيد الكاشير بيقيّمه مديره، والتشغيل بيقيّم المديرين والكاميرات', async () => {
    const pickE = async (dept, n) => (await db.query("select code from najm_employees where branch=$1 and active and dept=$2 and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') order by code limit 1 offset $3", [B, dept, n])).rows[0].code;
    const [h1, h2] = [await pickE('قسم الكاشير', 0), await pickE('قسم الكاشير', 1)];
    const [k1, k2] = [await pickE('قسم البقاله', 0), await pickE('قسم البقاله', 1)];
    await save('ops', '0000', 'user', { username: 'hcr1' }, { name: 'هيد 1', role: 'headcashier', branch: B, pin: '4040' });
    await save('ops', '0000', 'user', { username: 'hcr2' }, { name: 'هيد 2', role: 'headcashier', branch: B, pin: '4041' });
    await save('ops', '0000', 'user', { username: 'cmr1' }, { name: 'كاميرا 1', role: 'cameras', branch: B, pin: '4042' });
    await save('ops', '0000', 'user', { username: 'cmr2' }, { name: 'كاميرا 2', role: 'cameras', branch: B, pin: '4043' });
    await db.query("update najm_users set emp_code=$2 where username=$1", ['hcr1', h1]);
    await db.query("update najm_users set emp_code=$2 where username=$1", ['hcr2', h2]);
    await db.query("update najm_users set emp_code=$2 where username=$1", ['cmr1', k1]);
    await db.query("update najm_users set emp_code=$2 where username=$1", ['cmr2', k2]);
    // هيد الكاشير: مديره (فرع) بيقيّمه والكاميرات بتسجّل صلاته، بس مش هيد كاشير زيه، ومش بيقيّم نفسه
    await save('br', '1111', 'rate', { day: D, code: h1 }, [2, 2, 2, 2]);
    await save('cmr1', '4042', 'pray', { day: D, code: h1 }, { v: 1 });
    await fails(save('hcr2', '4041', 'cashier_event', { id: 'z9' }, { code: h1, band: 'smile' }), /managers are not rated/);
    await fails(save('hcr1', '4040', 'cashier_event', { id: 'z8' }, { code: h1, band: 'smile' }), /managers are not rated/);
    // التشغيل مبيقيّمش هيد الكاشير في تقييم المديرين (مديره هو اللي بيقيّمه)
    await fails(rpc("select najm_market_save($1,$2,'mgr_rate',$3::jsonb,$4::jsonb) r", ['ops', '0000', JSON.stringify({ day: D, username: 'hcr1' }), JSON.stringify([2, 2, 2, 2, 2])]).then(x => { if (x.r?.error) throw new Error(x.r.error); return x; }), /rated by his managers/);
    // الكاميرات: مفيش كاميرا بتقيّم كاميرا
    await fails(save('cmr2', '4043', 'pray', { day: D, code: k1 }, { v: 1 }), /managers are not rated/);
    // مدير التشغيل بيقيّم الكاميرات (تقييم المديرين) عادي
    const ok1 = (await rpc("select najm_market_save($1,$2,'mgr_rate',$3::jsonb,$4::jsonb) r", ['ops', '0000', JSON.stringify({ day: D, username: 'cmr1' }), JSON.stringify([2, 2, 2, 2, 2])])).r;
    eq(ok1 == null || ok1.error == null, true);
    for (const u of ['hcr1', 'hcr2', 'cmr1', 'cmr2']) await save('ops', '0000', 'user', { username: u }, null);
  });

  test('محل الايس كريم جزء من البيطاش، ورفع المبيعات لمدير التشغيل بس', async () => {
    const T = (await db.query("select ((now() at time zone 'Africa/Cairo')::date)::text d")).rows[0].d;
    const e = (await db.query("select code, name, dept, job from najm_employees where branch=$1 and active order by code limit 1", [B])).rows[0];
    const rows = [{ code: e.code, name: e.name, dept: e.dept, job: e.job || '', branch: 'محل الايس كريم', lastIn: T, fullWeek: 6 },
                  { code: '99301', name: 'ايس كريم جديد', dept: 'قسم الايس كريم', job: 'بائع', branch: 'محل الايس كريم', shiftTime: '2:00 PM', lastIn: T, fullWeek: 6 }];
    const r = (await db.query('select najm_emp_sync($1,$2) r', [JSON.stringify(rows), 'ice'])).rows[0].r;
    eq(r.added.map(x => [x.code, x.branch]), [['99301', B]]);
    eq((await db.query('select branch from najm_employees where code=$1', [e.code])).rows[0].branch, B);
    await fails(save('br', '1111', 'sales', { day: D, branch: B }, {}), /operations manager only/);
  });

  test('موظف جديد في الشيت: بيتضاف لو بصم آخر أسبوع، ومبيتضافش لو وقف من بدري', async () => {
    const T = (await db.query("select ((now() at time zone 'Africa/Cairo')::date)::text d")).rows[0].d;
    const rows = [{ code: '99401', name: 'بصم امبارح', dept: 'قسم البقاله', job: 'سيلز', branch: B, shiftTime: '9:00 AM', lastIn: T, fullWeek: 1, monthIn: 2 },
                  { code: '99402', name: 'وقف من بدري', dept: 'قسم البقاله', job: 'سيلز', branch: B, shiftTime: '9:00 AM', lastIn: '2020-01-01', fullWeek: 0, monthIn: 20 }];
    const r = (await db.query('select najm_emp_sync($1,$2) r', [JSON.stringify(rows), 'month'])).rows[0].r;
    eq([r.added.map(x => x.code), r.skipped.map(x => x.code)], [['99401'], ['99402']]);
  });

  test('تنبيه الوقف: موظف نشط مابصمش 5 أيام (من آخر يوم في الشيت) ← تنبيه، ومن غير توقيف', async () => {
    const [A, Bq, C, Dn] = (await db.query("select code from najm_employees where active order by code desc limit 4")).rows.map(r => r.code);
    await db.query("delete from najm_ratings where code = any($1)", [[A, Bq, C, Dn]]);
    await db.query("delete from najm_alerts where kind='stale' and code = any($1)", [[A, Bq, C, Dn]]);
    const ref = (await db.query("select (max(day) + 30)::text d from najm_ratings where att in ('on','late','vlate','xlate')")).rows[0].d;   // يوم مرجع جديد
    const day = n => `('${ref}'::date - ${n})`;
    await db.query(`insert into najm_ratings(day, code, att) values (${day(0)}, $1, 'on'), (${day(7)}, $2, 'on'), (${day(2)}, $3, 'on')`, [A, Bq, C]);
    await db.query("select najm_emp_sync('[]'::jsonb, 'stall')");
    const al = Object.fromEntries((await db.query("select code, data from najm_alerts where kind='stale' and code = any($1)", [[A, Bq, C, Dn]])).rows.map(r => [r.code, r.data]));
    eq([!!al[A], !!al[C], al[Bq]?.days, !!al[Dn], al[Dn]?.last ?? null], [false, false, 7, true, null]);
    eq((await db.query("select active from najm_employees where code=$1", [Bq])).rows[0].active, true);   // مفيش توقيف تلقائي
    await db.query("delete from najm_ratings where day >= $1::date - 8 and code = any($2)", [ref, [A, Bq, C]]);
  });

  test('مدير على أكتر من شيفت: بيشوف موظفين الشيفتين، ويقفل الشيفتين، ومش التالت', async () => {
    const pickS = async sh => (await db.query("select code from najm_employees where branch=$1 and active and shift=$2 and dept <> 'قسم البقاله' and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') limit 1", [B, sh])).rows[0].code;
    const [m, n] = [await pickS('Morning'), await pickS('Night')];
    await save('ops', '0000', 'user', { username: 'msh' }, { name: 'مدير شيفتين', role: 'shift', branch: B, shift: 'Morning', shifts: ['Morning', 'Night'], pin: '5151' });
    const lg = (await rpc('select najm_login($1,$2) r', ['msh', '5151'])).r;
    eq(lg.shifts, ['Morning', 'Night']);
    await save('msh', '5151', 'note', { code: m }, { body: 'x' }).catch(() => {});
    const inSc = async c => (await db.query('select najm_in_scope(u, $1) r from najm_users u where u.username = $2', [c, 'msh'])).rows[0].r;
    eq([await inSc(m), await inSc(n)], [true, true]);
    const w = await pickS('Between');
    eq(await inSc(w), true);   // Between مع الليل
    const own = async g => (await db.query('select najm_close_owners($1) r', [B + '|' + g])).rows[0].r || [];
    eq([own('Morning'), own('Night')].length, 2);
    eq([(await own('Morning')).includes('msh'), (await own('Night')).includes('msh')], [true, true]);   // مسؤول عن إغلاق الشيفتين
    await save('ops', '0000', 'user', { username: 'msh' }, null);
  });

  test('شاشة الدخول: الدالة بتقول مين محتاج رقم سري (مدير أو موظف ليه رقم) من غير بيانات', async () => {
    const e = (await db.query("select code from najm_employees e where active and not exists (select 1 from najm_users u where u.emp_code=e.code) and not exists (select 1 from najm_emp_pins p where p.code=e.code) order by code limit 1")).rows[0].code;
    const needs = async id => (await rpc('select najm_login_needs_pin($1) r', [id])).r;
    eq([await needs(e), await needs('ops'), await needs('99999'), await needs('')], [false, true, false, false]);
    await save('ops', '0000', 'emp_pin', { code: e }, { pin: '8181' });
    eq(await needs(e), true);   // موظف مدير التشغيل حطله رقم
  });

  test('النجوم اليومية في الملف الكامل: الموظف بكوده، التشغيل بس للتانيين، وبأجزاء النجمة من غير بنود ولا مديرين', async () => {
    const c = (await db.query("select code from najm_employees where active and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') and code not in (select code from najm_emp_pins) order by code desc limit 1")).rows[0].code;
    await db.query("insert into najm_ratings(day, code, att) values ('2026-08-10', $1, 'on'), ('2026-08-11', $1, 'late') on conflict do nothing", [c]);
    const mine = (await rpc('select najm_my_history_days($1,$2,$3) r', [c, '', '2026-08'])).r;
    eq([mine.length, mine[0].att, mine[0].att_star, mine[1].att], [2, 'on', 2, 'late']);
    eq(Object.keys(mine[0]).sort().join(','), 'att,att_star,bonus,cam,day,green,hy,mgr,pray,red,total,win,yellow');
    eq((await rpc('select najm_emp_history_days($1,$2,$3,$4) r', ['ops', '0000', c, '2026-08'])).r.length, 2);
    eq((await rpc('select najm_emp_history_days($1,$2,$3,$4) r', ['br', '1111', c, '2026-08'])).r.error != null, true);
    eq((await rpc('select najm_my_history_days($1,$2,$3) r', ['99999', '', '2026-08'])).r.error != null, true);
    eq((await rpc('select najm_my_history_days($1,$2,$3) r', [c, '', 'x'])).r, []);
  });

  test('تقييم التشغيل للمديرين كل 4 أيام: بيكمّل على الأيام اللي بعده لحد ما يتغيّر، ومن غير ما يتقيّم مفيش نقط', async () => {
    const mr = (day, crit) => rpc("select najm_market_save($1,$2,'mgr_rate',$3::jsonb,$4::jsonb) r", ['ops', '0000', JSON.stringify({ day, username: 'br' }), JSON.stringify(crit)]);
    await db.query("delete from najm_mgr_ratings where username='br' and day between '2031-03-01' and '2031-03-31'");
    await mr('2031-03-01', [2, 2, 2, 2, 2]);
    await mr('2031-03-09', [1, 1, 1, 1, 1]);
    const pts = (await asAnon(db, "select day::text d, pts from najm_mgr_points('2031-03-01','2031-03-12') where username='br' order by day")).map(r => [r.d.slice(8), r.pts]);
    eq(pts.map(x => x[1]).join(','), '10,10,10,10,10,10,10,10,5,5,5,5');   // 1-8 بتقييم الدورة الأولى، 9 وبعدها بالجديد
    // الفترة اللي بتبدأ بعد التقييم بتكمّل عليه (آخر تقييم قبلها)
    const full = (await rpc('select najm_mgr_ratings_full($1,$2,$3,$4) r', ['ops', '0000', '2031-03-05', '2031-03-08'])).r;
    eq(Array.isArray(full) ? full.length >= 0 : true, true);
    const rows = (await db.query("select day::text d from najm_mgr_ratings_full('ops','0000','2031-03-05','2031-03-08') where username='br'")).rows.map(r => r.d);
    eq(rows, ['2031-03-01']);
    await db.query("delete from najm_mgr_ratings where username='br' and day between '2031-03-01' and '2031-03-31'");
  });

  test('الهايجين بيقيّم اللبس لكل الموظفين حتى المديرين (إلا هايجين زيه)، ومدير الفرع لأ', async () => {
    const pickE = async n => (await db.query("select code from najm_employees where branch=$1 and active and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') order by code limit 1 offset $2", [B, n])).rows[0].code;
    const [m1, h1] = [await pickE(40), await pickE(41)];
    await save('ops', '0000', 'user', { username: 'hyq' }, { name: 'هايجين', role: 'hygiene', branch: B, pin: '6161' });
    await save('ops', '0000', 'user', { username: 'hyr' }, { name: 'هايجين تاني', role: 'hygiene', branch: B, pin: '6162' });
    await save('ops', '0000', 'user', { username: 'mgx' }, { name: 'مدير', role: 'branch', branch: B, pin: '6163' });
    await db.query("update najm_users set emp_code=$2 where username=$1", ['mgx', m1]);
    await db.query("update najm_users set emp_code=$2 where username=$1", ['hyr', h1]);
    await save('hyq', '6161', 'rate', { day: D, code: m1 }, [2, 2, 2, 2, 2]);                       // لبس مدير الفرع: عادي
    await fails(save('hyq', '6161', 'rate', { day: D, code: h1 }, [2, 2, 2, 2, 2]), /managers are not rated/);   // هايجين مش بيقيّم هايجين
    await fails(save('br', '1111', 'rate', { day: D, code: m1 }, [2, 2, 2, 2]), /managers are not rated/);    // المدير مش بيقيّم مدير
    for (const u of ['hyq', 'hyr', 'mgx']) await save('ops', '0000', 'user', { username: u }, null);
  });

  test('حساب على أكتر من فرع: الهايجين بيقيّم موظفين الفرعين ومش التالت، والفروع بترجع في الدخول والملفات', async () => {
    const brs = (await db.query("select distinct branch from najm_employees where active and branch is not null order by 1")).rows.map(r => r.branch);
    const [b1, b2, b3] = brs;
    await save('ops', '0000', 'user', { username: 'hyx' }, { name: 'هايجين فرعين', role: 'hygiene', branch: b1, branches: [b1, b2], pin: '7878' });
    const lg = (await rpc('select najm_login($1,$2) r', ['hyx', '7878'])).r;
    eq([lg.branch, lg.branches], [b1, [b1, b2]]);
    const pick = async b => (await db.query("select code from najm_employees where branch=$1 and active and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') limit 1", [b])).rows[0].code;
    const [c1, c2, c3] = [await pick(b1), await pick(b2), await pick(b3)];
    await save('hyx', '7878', 'rate', { day: D, code: c1 }, [2, 2, 2, 2, 2]);
    await save('hyx', '7878', 'rate', { day: D, code: c2 }, [2, 1, 2, 2, 2]);
    await fails(save('hyx', '7878', 'rate', { day: D, code: c3 }, [2, 2, 2, 2, 2]), /outside your scope/);
    const f = (await rpc('select najm_files($1,$2) r', ['ops', '0000'])).r.users.find(x => x.username === 'hyx');
    eq(f.branches, [b1, b2]);
    eq((await rpc('select count(*)::int n from najm_full_scores($1,$2,$3,$3)', ['hyx', '7878', D])).n >= 2, true);
    await save('ops', '0000', 'user', { username: 'hyx' }, null);
  });

  test('الملف الكامل: الموظف بيشوف ملفه هو بس، ومدير التشغيل بيشوف الكل، من غير أي فلوس', async () => {
    const c = (await db.query("select code from najm_employees where active and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') and code not in (select code from najm_emp_pins) order by code desc limit 1")).rows[0].code;
    await db.query("insert into najm_ratings(day, code, att) values ('2026-09-10', $1, 'on') on conflict do nothing", [c]);
    const mine = (await rpc('select najm_my_history($1,$2) r', [c, ''])).r;
    eq([mine.emp.code, Array.isArray(mine.months), mine.months.length > 0, Array.isArray(mine.cards)], [c, true, true, true]);
    eq(JSON.stringify(mine).match(/salary|amount|payout|money|فلوس/i), null);
    const ops = (await rpc('select najm_emp_history($1,$2,$3) r', ['ops', '0000', c])).r;
    eq(ops.emp.code, c);
    eq((await rpc('select najm_emp_history($1,$2,$3) r', ['br', '1111', c])).r.error != null, true);
    eq((await rpc('select najm_my_history($1,$2) r', ['00000', ''])).r.error != null, true);
    eq((await asAnon(db, 'select count(*)::int n from pg_proc where proname = $1', ['najm_history_data']))[0].n >= 0, true);
    await fails(db.query("set role anon; select najm_history_data('1')"), /permission denied/);
    await db.query('reset role');
  });

  test('ضبط الصورة جوه الكارت: مدير التشغيل بس بيحفظه، وبيتقري مع بيانات الموظف', async () => {
    const c = (await db.query("select code from najm_employees where active order by code limit 1 offset 3")).rows[0].code;
    await fails(save('br', '1111', 'media', { code: c }, { photo_pos: '5,-10,1.5' }), /operations manager only/);
    await save('ops', '0000', 'media', { code: c }, { photo_pos: '5.0,-10.0,1.50' });
    eq((await asAnon(db, 'select photo_pos from najm_employees where code=$1', [c]))[0].photo_pos, '5.0,-10.0,1.50');
    await save('ops', '0000', 'media', { code: c }, { title: 'لقب' });   // تعديل حاجة تانية مبيمسحش الضبط
    eq((await db.query('select photo_pos from najm_employees where code=$1', [c])).rows[0].photo_pos, '5.0,-10.0,1.50');
    await save('ops', '0000', 'media', { code: c }, { photo_pos: '' });
    eq((await db.query('select photo_pos from najm_employees where code=$1', [c])).rows[0].photo_pos, null);
  });

  test('المدير مبيتقيّمش (اللي ليه حساب مدير)، ومدير الفريش من غير أقسام بيشوف أقسام الفريش من الإعدادات', async () => {
    const m = (await db.query("select emp_code from najm_users where role='branch' and coalesce(emp_code,'')<>'' limit 1")).rows[0]?.emp_code;
    if (m) { await fails(save('ops', '0000', 'pray', { day: D, code: m, reason: 'x' }, { v: 1 }), /managers are not rated/);
             await fails(save('ops', '0000', 'bonus', { day: D, code: m, reason: 'x' }, { v: 0.5, note: 'x' }), /managers are not rated/); }
    await save('ops', '0000', 'user', { username: 'fr1' }, { name: 'فريش', role: 'fresh', branch: B, pin: '5151', depts: [] });
    const g = (await db.query("select code from najm_employees where branch=$1 and active and dept='قسم البقاله' and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') limit 1", [B])).rows[0].code;
    const o = (await db.query("select code from najm_employees where branch=$1 and active and dept<>'قسم البقاله' limit 1", [B])).rows[0].code;
    await fails(save('fr1', '5151', 'rate', { day: D, code: o }, [2, 2, 2, 2]), /outside your scope/);
    await save('fr1', '5151', 'rate', { day: D, code: g }, [2, 2, 2, 2]);
  });

  test('هيد الكاشير: بيسجّل باندات على كاشيرات فرعه بس، النقط من الإعدادات، والتجميع للكل من غير تفاصيل', async () => {
    await save('ops', '0000', 'user', { username: 'hc1' }, { name: 'هيد كاشير', role: 'headcashier', branch: B, pin: '4545' });
    const c = (await db.query("select code from najm_employees where branch=$1 and active and dept='قسم الكاشير' and code not in (select emp_code from najm_users where coalesce(emp_code,'')<>'') order by code limit 1", [B])).rows[0].code;
    const o = (await db.query("select code from najm_employees where branch=$1 and active and dept<>'قسم الكاشير' limit 1", [B])).rows[0].code;
    const m = D.slice(0, 7);
    await fails(save('hc1', '4545', 'rate', { day: D, code: c }, [2, 2, 2, 2]), /cashier events only/);
    await fails(save('hc1', '4545', 'cashier_event', { id: 'ce0' }, { code: o, band: 'smile' }), /outside your scope/);
    await fails(save('hc1', '4545', 'cashier_event', { id: 'ce0' }, { code: c, band: 'nope' }), /unknown band/);
    await fails(save('br', '1111', 'cashier_event', { id: 'ce0' }, { code: c, band: 'smile' }), /head cashier only/);
    await save('hc1', '4545', 'cashier_event', { id: 'ce1' }, { code: c, band: 'smile' });
    await save('hc1', '4545', 'cashier_event', { id: 'ce2' }, { code: c, band: 'no_receipt' });
    await save('hc1', '4545', 'cashier_event', { id: 'ce3' }, { code: c, band: 'barcode_found' });
    await save('hc1', '4545', 'cashier_event', { id: 'ce3' }, { code: c, band: 'barcode_found' });   // نفس المعرّف مرة تانية ← مبيتكررش
    let p = (await asAnon(db, 'select pts, n from najm_public_cashier_pts($1) where code=$2', [m, c]))[0];
    eq([+p.pts, p.n], [20, 3]);   // +20 −20 +20
    // النقط من الإعدادات وقت التسجيل
    const st = (await db.query('select data from najm_settings where id=1')).rows[0].data;
    await save('ops', '0000', 'settings', {}, { ...st, cashierBands: [{ id: 'smile', pts: 50 }] });
    await save('hc1', '4545', 'cashier_event', { id: 'ce4' }, { code: c, band: 'smile' });
    p = (await asAnon(db, 'select pts from najm_public_cashier_pts($1) where code=$2', [m, c]))[0];
    eq(+p.pts, 70);
    // التفاصيل: هيد الكاشير والتشغيل بس
    eq((await rpc('select najm_cashier_events_list($1,$2,$3) r', ['hc1', '4545', m])).r.length >= 4, true);
    eq((await rpc('select najm_cashier_events_list($1,$2,$3) r', ['br', '1111', m])).r, []);
    eq((await asAnon(db, 'select count(*)::int n from najm_cashier_events'))[0].n, 0);
    // مسح حدث
    await save('hc1', '4545', 'cashier_event', { id: 'ce4' }, null);
    p = (await asAnon(db, 'select pts from najm_public_cashier_pts($1) where code=$2', [m, c]))[0];
    eq(+p.pts, 20);
    await save('ops', '0000', 'settings', {}, st);
  });

  // ---------------- الملفات المرفوعة: سجل + منع التكرار
  test('رفع ملف: بيتسجل، ونفس الملف مبيترفعش مرتين (مدير التشغيل بس يرفعه تاني بقصد)', async () => {
    const info = { kind: 'sales', file: 'foodics.xlsx', hash: 'abc123', branch: B, day: D, ok: 40, bad: 2, dup: 1 };
    await save('br', '1111', 'import_log', {}, info);
    await fails(save('br', '1111', 'import_log', {}, info), /already imported/);
    await fails(save('br', '1111', 'import_log', { force: true }, info), /already imported/);
    await save('ops', '0000', 'import_log', { force: true }, info);
    await fails(save('br', '1111', 'import_log', {}, { ...info, hash: 'x2', branch: 'عين شمس' }), /other branch/);
    await fails(save('br', '1111', 'import_log', {}, { ...info, kind: 'base_sales', hash: 'x3' }), /not allowed/);
    const L = (await rpc('select najm_files($1,$2) r', ['br', '1111'])).r.imports;
    eq([L.length >= 2, L[0].by_user, L.some(i => i.rows_bad === 2)], [true, 'ops', true]);
    eq((await asAnon(db, 'select count(*)::int n from najm_imports'))[0].n, 0);
  });

  // ---------------- الهايجين = اللبس
  test('الهايجين: التيشرت إجباري (0 لـ 2)، والباقي 0 لـ 2 أو −1 «مش مطلوب»، والنجمة من المطلوب بس', async () => {
    await save('ops', '0000', 'user', { username: 'hyg' }, { name: 'هايجين', role: 'hygiene', branch: B, pin: '7171' });
    const sec = (await db.query("select code from najm_employees where branch=$1 and dept='قسم الامن و المراقبه' and shift<>'Morning' limit 1", [B])).rows[0].code;
    await fails(save('hyg', '7171', 'rate', { day: D, code: sec }, [-1, 2, 2, 2, 2]), /bad hygiene items/);
    await fails(save('hyg', '7171', 'rate', { day: D, code: sec }, [2, 2, 2, 2, 5]), /bad hygiene items/);
    await fails(save('hyg', '7171', 'rate', { day: D, code: sec }, [2, 2, -2, 2, 2]), /bad hygiene items/);
    await save('hyg', '7171', 'rate', { day: D, code: sec }, [2, -1, -1, -1, -1]);
    const h = (await db.query("select najm_hy(hy) h from najm_ratings where day=$1 and code=$2", [D, sec])).rows[0].h;
    eq(+h, 1);
    eq([+(await db.query("select najm_hy('{2,2,2,2,0}') h")).rows[0].h, (await db.query("select najm_hy('{2,-1,null,-1,-1}') h")).rows[0].h, +(await db.query("select najm_hy('{1,-1,2,-1,-1}') h")).rows[0].h], [0.75, null, 0.75]);
  });

  // ---------------- الدخول بكود البصمة للكل
  test('حساب مدير من غير رقم سري: السيستم بيطلّع رقم مؤقت، والمدير يغيّره بنفسه (اختياري)، والتشغيل يعمل رقم جديد', async () => {
    const r = await save('ops', '0000', 'user', { username: 'tmpmgr' }, { name: 'مدير مؤقت', role: 'shift', branch: B, shift: 'Morning' });
    ok(/^\d{4}$/.test(r.pin), 'temp pin');
    const login = async pin => (await rpc('select najm_login_any($1,$2) r', ['tmpmgr', pin])).r;
    eq((await login(r.pin)).kind, 'mgr');
    // المدير بيغيّره: لازم القديم صح، والجديد 4-6 أرقام
    eq((await rpc('select najm_my_pin($1,$2,$3) r', ['tmpmgr', '9998', '5555'])).r.error, 'najm: wrong username or PIN');
    await fails(asAnon(db, 'select najm_my_pin($1,$2,$3)', ['tmpmgr', r.pin, '12']), /4-6 digits/);
    eq((await rpc('select najm_my_pin($1,$2,$3) r', ['tmpmgr', r.pin, '5555'])).r.ok, true);
    eq((await login('5555')).kind, 'mgr');
    // التعديل من غير رقم مبيغيّرش الرقم، و«رقم مؤقت جديد» بيبطّل القديم
    eq((await save('ops', '0000', 'user', { username: 'tmpmgr' }, { name: 'مدير مؤقت', role: 'shift', branch: B, shift: 'Morning' })), null);
    const r2 = await save('ops', '0000', 'user', { username: 'tmpmgr' }, { name: 'مدير مؤقت', role: 'shift', branch: B, shift: 'Morning', resetPin: true });
    ok(/^\d{4}$/.test(r2.pin), 'reset pin');
    eq((await login(r2.pin)).kind, 'mgr');
    // الرقم مبيتسجلش في السجل
    ok(!JSON.stringify((await db.query("select data from najm_history where kind in ('user','my_pin')")).rows).includes(r2.pin), 'pin in history');
    await fails(save('br', '1111', 'user', { username: 'x2' }, { name: 'x', role: 'shift' }), /operations manager only/);
  });

  test('الدخول بكود البصمة: المدير المربوط بكوده بيدخل كمدير بس، والموظف كموظف', async () => {
    const c = (await db.query("select code from najm_employees where branch='عين شمس' order by code limit 1 offset 7")).rows[0].code;
    await save('ops', '0000', 'user', { username: 'mx' }, { name: 'مدير تجربة', role: 'branch', branch: 'عين شمس', pin: '5555' });
    await db.query('update najm_users set emp_code=$1 where username=$2', [c, 'mx']);
    const any = (id, pin) => rpc('select najm_login_any($1,$2) r', [id, pin]).then(x => x.r);
    const m = await any(c, '5555'); eq([m.kind, m.username, m.role], ['mgr', 'mx', 'branch']);
    eq((await any(c, '0000')).error, 'najm: wrong code or PIN');
    eq((await any('ops', '0000')).kind, 'mgr');
    eq((await any('125', '4321')).kind, 'emp');
    await save('ops', '0000', 'emp_pin', { code: c }, { pin: '9090' });
    eq((await rpc('select najm_emp_login($1,$2) r', [c, '9090'])).r.error, 'najm: wrong code or PIN');
    await fails(db.query('insert into najm_users(username,name,role,salt,pin_hash,emp_code) values ($1,$1,$2,$3,$3,$4)', ['my', 'branch', 'x', c]), /duplicate key/);
  });

  // ---------------- السجل
  test('كل عملية بتتسجل في السجل باللي عملها — من غير أرقام سرية', async () => {
    const k = (await db.query('select kind, count(*)::int n from najm_history group by kind order by kind')).rows.map(r => r.kind);
    for (const x of ['card', 'card_approve', 'appeal', 'appeal_decide', 'day_close', 'rate', 'emp_pins_generate', 'emp_pin_change', 'user']) ok(k.includes(x), 'missing ' + x);
    eq((await db.query("select count(*)::int n from najm_history where data::text ~ '(\"pin\"|4321|1111|2222|3333)'")).rows[0].n, 0);
  });
  test('مدير الفرع يشوف سجل موظف في نطاقه، ومدير برّه النطاق لأ', async () => {
    ok((await asAnon(db, 'select * from najm_history_of($1,$2,$3)', ['br', '1111', '125'])).length >= 6);
    eq((await asAnon(db, 'select * from najm_history_of($1,$2,$3)', ['br', '1111', '16'])).length, 0);
  });
  test('الجداول الجديدة مقفولة عن العامة', async () => {
    for (const t of ['najm_card_appeals', 'najm_history', 'najm_day_closes', 'najm_emp_pins']) eq((await asAnon(db, `select count(*)::int n from ${t}`))[0].n, 0, t);
  });
  test('كل دالة بتتحقق من الرقم السري لازم تكون volatile (عشان تشتغل من المتصفح ومتترفضش كـ «قراءة بس»)', async () => {
    const r = (await db.query(`select proname from pg_proc where pronamespace='public'::regnamespace and proname like 'najm%' and provolatile<>'v'
      and (prosrc like '%najm_auth%' or prosrc like '%najm_emp_auth%' or prosrc like '%najm_emp_login%' or prosrc like '%najm_login_any%')`)).rows.map(x => x.proname);
    eq(r, []);
  });
  await run('المرحلة الأولى — الداتابيز');
  await db.end();
})();
