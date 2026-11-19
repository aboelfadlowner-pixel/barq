// الداتابيز: ملفات db/ بتبني قاعدة كاملة من الصفر، وكل الجداول والدوال والصلاحيات موجودة
const { test, run, eq, ok, freshDb } = require('../helpers');

const TABLES = ['najm_employees', 'najm_users', 'najm_ratings', 'najm_winners', 'najm_targets', 'najm_sales', 'najm_base_sales', 'najm_kpi_vals',
  'najm_complaints', 'najm_notes', 'najm_settings', 'najm_private', 'najm_cards', 'najm_captains', 'najm_mgr_ratings', 'najm_mgr_ledger',
  'najm_market', 'najm_offers', 'najm_upload_tokens', 'najm_login_fails', 'najm_payouts', 'najm_votes',
  'najm_card_appeals', 'najm_history', 'najm_day_closes', 'najm_emp_pins'];
const PUBLIC_FN = ['najm_login', 'najm_public_scores', 'najm_full_scores', 'najm_files', 'najm_save', 'najm_public_cards', 'najm_sales_sum',
  'najm_public_users', 'najm_mgr_points', 'najm_market_list', 'najm_balance', 'najm_market_player', 'najm_market_save', 'najm_mgr_ratings_full',
  'najm_card_stats', 'najm_upload_token', 'najm_payouts_list', 'najm_payout_save', 'najm_vote', 'najm_vote_counts', 'najm_my_ratings', 'najm_upload_ok',
  'najm_emp_login', 'najm_emp_set_pin', 'najm_my_cards', 'najm_emp_appeal', 'najm_history_of', 'najm_card_points', 'najm_public_day_cards', 'najm_closes_list', 'najm_shift_group'];
const PRIVATE_FN = ['najm_auth', 'najm_in_scope', 'najm_score', 'najm_emp_auth', 'najm_apply_late_closes', 'najm_close_penalty', 'najm_close_owners', 'najm_close_deadline'];

(async () => {
  const db = await freshDb('najm_test_db', { employees: true });
  const q = (s, p) => db.query(s, p).then(r => r.rows);

  test('كل الجداول موجودة', async () => {
    const have = (await q("select tablename from pg_tables where schemaname='public'")).map(r => r.tablename);
    eq(TABLES.filter(t => !have.includes(t)), []);
  });
  test('كل الجداول مقفولة بـ RLS', async () => {
    eq((await q("select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity")).map(r => r.relname), []);
  });
  test('الجداول الحساسة مالهاش قراءة عامة', async () => {
    const pol = (await q('select tablename from pg_policies')).map(r => r.tablename);
    for (const t of ['najm_ratings', 'najm_users', 'najm_complaints', 'najm_notes', 'najm_private', 'najm_votes', 'najm_payouts', 'najm_login_fails', 'najm_card_appeals', 'najm_history', 'najm_day_closes', 'najm_emp_pins']) ok(!pol.includes(t), t + ' has a public policy');
  });
  test('الدوال اللي المتصفح بيكلمها متاحة', async () => {
    for (const f of PUBLIC_FN) ok((await q("select has_function_privilege('anon', oid, 'execute') x from pg_proc where proname=$1", [f]))[0]?.x, f);
  });
  test('الدوال الداخلية (الرقم السري والصلاحيات والحساب) مقفولة', async () => {
    for (const f of PRIVATE_FN) ok(!(await q("select has_function_privilege('anon', oid, 'execute') x from pg_proc where proname=$1", [f]))[0].x, f);
  });
  test('البيانات الأولية: حساب ops و175 موظف', async () => {
    eq((await q('select username from najm_users'))[0].username, 'ops');
    eq((await q('select count(*)::int n from najm_employees'))[0].n, 175);
  });
  test('الأدوار المسموحة تشمل الهايجين', async () => {
    ok(/hygiene/.test((await q("select pg_get_constraintdef(oid) d from pg_constraint where conname='najm_users_role_check'"))[0].d));
  });
  await run('الداتابيز');
  await db.end();
})();
