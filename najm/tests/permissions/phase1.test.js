// المرحلة الأولى في الداتابيز: الكروت (الحالة، التحويل، الإلغاء من غير مسح)، الاعتراض، الرقم السري للموظف، إغلاق اليوم والخصم، السجل
const { test, run, eq, ok, freshDb, asAnon, today } = require('../helpers');

(async () => {
  const db = await freshDb('najm_test_p1', { employees: true });
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
  test('التصويت محتاج الرقم السري', async () => {
    eq((await rpc('select najm_vote($1,$2,$3,$4) r', ['125', '0000', 'device-aaaaaaaaaaaaaaaa', 'br'])).r.error, 'pin');
    eq((await rpc('select najm_vote($1,$2,$3,$4) r', ['125', '4321', 'device-aaaaaaaaaaaaaaaa', 'br'])).r.ok, true);
  });

  // ---------------- إغلاق اليوم
  test('مدير الصبح يقفل شيفته بس (وBetween مع الليل)', async () => {
    await fails(save('shm', '2222', 'day_close', { day: D, gkey: B + '|Night' }), /outside your scope/);
    await save('shm', '2222', 'day_close', { day: D, gkey: B + '|Morning' });
    await fails(save('shm', '2222', 'day_close', { day: D, gkey: B + '|Morning' }), /already closed/);
  });
  test('بعد الإغلاق، مدير الشيفت ميقدرش يعدّل تقييم اليوم ده', async () => {
    const m = (await db.query("select code from najm_employees where branch=$1 and shift='Morning' limit 1", [B])).rows[0].code;
    await fails(save('shm', '2222', 'rate', { day: D, code: m }, [2, 2, 2, 2, 2]), /day locked/);
    const n = (await db.query("select code from najm_employees where branch=$1 and shift='Between' limit 1", [B])).rows[0].code;
    await save('shn', '3333', 'rate', { day: D, code: n }, [2, 2, 2, 2, 2]);   // Between لسه مفتوح مع الليل
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
    eq(r, [{ username: 'shm', n: 3, p: -15 }, { username: 'shn', n: 3, p: -15 }]);
    eq((await db.query("select count(*)::int n from najm_history where kind='day_late'")).rows[0].n, 6);
  });
  test('الخصم مبيتكررش لنفس اليوم', async () => {
    await save('br', '1111', 'note', { id: 'n1', code: '125' }, { date: D, text: 'x' });
    eq((await db.query("select count(*)::int n from najm_mgr_ledger where id like 'late|%'")).rows[0].n, 6);
  });

  // ---------------- التصرف المثالي ½ فوق الـ 5 · رجل اليوم (سجل المرشحين + الحد) · تعديل التشغيل في يوم مغلق بسبب
  test('التصرف المثالي نص نجمة فوق الـ 5 (الأساسي 5 + ½ = 5.5)', async () => {
    const c = (await db.query("select code from najm_employees where branch=$1 and dept<>'قسم البقاله' and shift='Night' limit 1 offset 3", [B])).rows[0].code;
    for (const [u, pin] of [['br', '1111'], ['ops', '0000']]) await save(u, pin, 'rate', { day: D, code: c }, [2, 2, 2, 2, 2]);
    await save('ops', '0000', 'att', { day: D, code: c, reason: 'x' }, { st: 'on' });
    await db.query("update najm_ratings set sh='{2,2,2,2,2}', hy='{2,2,2,2,2}' where day=$1 and code=$2", [D, c]);
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
    await db.query("insert into najm_ratings(day,code,ops) values ($1,$2,'{1,1,1,1,1}') on conflict (day,code) do update set ops=excluded.ops", [ago(1), c]);
    await fails(save('ops', '0000', 'rate', { day: ago(1), code: c }, [2, 2, 2, 2, 2]), /reason required/);
    await save('ops', '0000', 'rate', { day: ago(1), code: c, reason: 'اتقيّم غلط' }, [2, 2, 2, 2, 2]);
    const h = (await db.query("select data from najm_history where kind='rate' and code=$1 order by id desc limit 1", [c])).rows[0].data;
    eq([h.old, h.data, h.key.reason], [[1, 1, 1, 1, 1], [2, 2, 2, 2, 2], 'اتقيّم غلط']);
  });
  test('مدير الفرع ميقدرش يعدّل بعد اعتماد رجل اليوم', async () => {
    const c = (await db.query("select code from najm_employees where branch=$1 and shift='Morning' limit 1 offset 5", [B])).rows[0].code;
    await fails(save('br', '1111', 'rate', { day: ago(1), code: c }, [1, 1, 1, 1, 1]), /day locked/);
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
    eq((await rpc('select najm_emp_complaint_appeal($1,$2,$3,$4) r', ['125', '0000', 'cp1', 'مكنتش أنا'])).r.error, 'najm: wrong code or PIN');
    eq((await rpc('select najm_emp_complaint_appeal($1,$2,$3,$4) r', ['125', '4321', 'cp1', 'مكنتش أنا'])).r.ok, true);
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

  // ---------------- تقييم المديرين كل 4 أيام
  test('تقييم المديرين كل 4 أيام: بيكمّل لوحده، والتعديل بيمشي لقدام لحد أول يوم متقيّم، والغياب من غير نجوم مديرين', async () => {
    const c = (await db.query("select code from najm_employees where branch=$1 and active order by code limit 1 offset 17", [B])).rows[0].code;
    const k = d => ({ day: d, code: c, reason: 'اختبار' });
    const row = async d => (await db.query('select ops, carry from najm_ratings where code=$1 and day=$2', [c, d])).rows[0];
    await save('ops', '0000', 'rate', k('2025-03-01'), [2, 2, 2, 2, 2]);
    // أيام جديدة (من البصمة) بتاخد آخر تقييم
    await db.query("insert into najm_ratings(day, code, att) values ('2025-03-02',$1,'on'),('2025-03-03',$1,'abs'),('2025-03-04',$1,'on')", [c]);
    eq([(await row('2025-03-02')).ops, (await row('2025-03-02')).carry], [[2, 2, 2, 2, 2], ['ops']]);
    // يوم 5 اتقيّم بإيد ← مبيتأثرش بتعديل يوم 2
    await save('ops', '0000', 'rate', k('2025-03-05'), [1, 1, 1, 1, 1]);
    await save('ops', '0000', 'rate', k('2025-03-02'), [0, 0, 0, 0, 0]);
    eq([(await row('2025-03-02')).carry, (await row('2025-03-04')).ops, (await row('2025-03-05')).ops], [[], [0, 0, 0, 0, 0], [1, 1, 1, 1, 1]]);
    // الغياب: مفيش نجوم مديرين حتى لو التقييم مكمّل
    const sc = async d => (await db.query("select public.najm_score(r, 'قسم الكاشير', (select data from najm_settings where id=1)) s from najm_ratings r where code=$1 and day=$2", [c, d])).rows[0].s;
    eq([(await sc('2025-03-03')).ops_star, (await sc('2025-03-04')).ops_star, (await sc('2025-03-04')).carry], [null, 0, ['ops']]);
    // مسح تعديل يوم 2 ← يرجع لتقييم يوم 1 ويكمّل لقدام
    await save('ops', '0000', 'rate', k('2025-03-02'), null);
    eq([(await row('2025-03-02')).ops, (await row('2025-03-02')).carry, (await row('2025-03-04')).ops], [[2, 2, 2, 2, 2], ['ops'], [2, 2, 2, 2, 2]]);
    await fails(save('ops', '0000', 'rate', k('2025-03-06'), [3, 2, 2, 2, 2]), /bad rating/);
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
