// التطبيق مع نسخة محلية من الداتابيز: المتصفح بيكلّم Postgres محلي بدل Supabase (بصلاحيات anon زي الحقيقة)
const { test, run, eq, ok, browser, openApp, freshDb, asAnon, today } = require('../helpers');

const ident = s => { if (!/^[a-z_0-9]+$/.test(s)) throw new Error('bad ident ' + s); return s; };
function supabaseOn(db) {   // answers the REST/RPC calls the app makes, as role anon
  return async route => {
    const req = route.request(), u = new URL(req.url()), parts = u.pathname.split('/'), P = u.searchParams;
    if (u.pathname.startsWith('/storage/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"x"}' });
    try {
      let rows;
      const lim = P.get('limit') ? ` limit ${+P.get('limit')} offset ${+(P.get('offset') || 0)}` : '';
      const ord = P.get('order') ? ` order by ${P.get('order').split(',').map(ident).join(',')}` : '';
      if (parts[3] === 'rpc') {
        const fn = ident(parts[4]), body = JSON.parse(req.postData() || '{}'), keys = Object.keys(body);
        const args = keys.map((k, i) => `${ident(k)}=>$${i + 1}`).join(','), vals = keys.map(k => body[k] !== null && typeof body[k] === 'object' ? JSON.stringify(body[k]) : body[k]);
        const kind = (await db.query('select p.proretset, t.typname from pg_proc p join pg_type t on t.oid=p.prorettype where proname=$1', [fn])).rows[0];
        if (kind.proretset || kind.typname === 'record') rows = await asAnon(db, `select * from ${fn}(${args})${ord}${lim}`, vals);
        else { const r = await asAnon(db, `select ${fn}(${args}) as v`, vals); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r[0].v) }); }
      } else {
        const t = ident(parts[3]), where = [], vals = [];
        for (const [k, v] of P) { if (['select', 'order', 'limit', 'offset'].includes(k)) continue; const m = v.match(/^(eq|gte|lte)\.(.*)$/); vals.push(m[2]); where.push(`${ident(k)} ${{ eq: '=', gte: '>=', lte: '<=' }[m[1]]} $${vals.length}`); }
        const sel = P.get('select') && P.get('select') !== '*' ? P.get('select').split(',').map(ident).join(',') : '*';
        rows = await asAnon(db, `select ${sel} from ${t}${where.length ? ' where ' + where.join(' and ') : ''}${ord}${lim}`, vals);
      }
      for (const r of rows) for (const k in r) if (r[k] instanceof Date) r[k] = r[k].toISOString().slice(0, 10);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    } catch (e) { return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: e.message }) }); }
  };
}
const login = async (p, u, pin) => { await p.click('#roleBtn'); await p.fill('#l_user', u); await p.fill('#l_pin', pin); await p.click('.login .btn.pri'); await p.waitForTimeout(2500); };

(async () => {
  const db = await freshDb('najm_test_int', { employees: true });
  await asAnon(db, "select najm_save('ops','0000','user','{\"username\":\"hy\"}','{\"name\":\"هايجين\",\"role\":\"hygiene\",\"branch\":\"البيطاش الرئيسي\",\"pin\":\"7777\"}')");
  const D = today();
  await db.query(`insert into najm_ratings(day,code,att,br,sh,ops,hy) values ($1,'125','on','{2,2,2,2,2}','{2,2,2,2,2}','{2,1,2,2,2}','{2,2,1,2,2}')`, [D]);
  const b = await browser();
  const page = () => openApp(b, { query: '', supabase: supabaseOn(db) });

  test('التطبيق بيتصل بالداتابيز ويحمّل الموظفين', async () => {
    const p = await page();
    ok((await p.textContent('#demoFlag')).includes('متصل'));
    eq(await p.evaluate(() => S.employees.length), 175);
    eq(p.errors, []);
  });
  test('مدير التشغيل يدخل ويشوف التفاصيل', async () => {
    const p = await page(); await login(p, 'ops', '0000');
    eq(await p.evaluate(() => USER.role), 'ops');
    eq(await p.evaluate(d => peekDay(d).ops['125'], D), [2, 1, 2, 2, 2]);
  });
  test('الهايجين يدخل ويحفظ تقييمه في الداتابيز', async () => {
    const p = await page(); await login(p, 'hy', '7777');
    const code = await p.evaluate(() => (filtered(true).find(e => !dayLocked(e) && e.code !== '125') || {}).code);
    await p.evaluate(c => [0, 1, 2, 3, 4].forEach(i => setCrit(c, i, i % 2 ? 1 : 2)), code);
    await p.waitForTimeout(1500);
    eq((await db.query('select hy from najm_ratings where day=$1 and code=$2', [D, code])).rows[0]?.hy, [2, 1, 2, 1, 2]);
  });
  test('الموظف يفتح تقريره بكوده ويشوف تفاصيله هو بس', async () => {
    const p = await page();
    const r = await p.evaluate(async d => { ME = '125'; await refresh(true); return [peekDay(d).hy['125'], Object.keys(peekDay(d).hy).length]; }, D);
    eq(r, [[2, 2, 1, 2, 2], 1]);
  });
  test('رقم سري غلط مبيدخلش', async () => {
    const p = await page(); await login(p, 'ops', '1234');
    eq(await p.evaluate(() => USER), null);
  });
  await run('التكامل مع الداتابيز');
  await b.close(); await db.end();
})();
