// الشغل من ناحية المستخدم على نسخة التجربة (?demo=1)
const { test, run, eq, ok, browser, openApp } = require('../helpers');

const login = async (p, u, pin) => { await p.click('#roleBtn'); await p.fill('#l_user', u); await p.fill('#l_pin', pin); await p.click('.login .btn.pri'); await p.waitForTimeout(400); };
const MONEY = /جنيه|[\d٠-٩][\d٠-٩٬,]*\s*ج(?![؀-ۿ])/;

(async () => {
  const b = await browser();
  const p = await openApp(b);
  const tabs = () => p.$$eval('#nav button', a => a.map(x => x.textContent.trim()));

  test('كل التابات بتفتح من غير أخطاء (موظف، مدير فرع، هايجين، تشغيل)', async () => {
    const errs = await p.evaluate(() => {
      const out = [];
      for (const who of [null, { username: 'haitham', role: 'branch', branch: 'البيطاش الرئيسي', name: 'x', shift: '', depts: [] },
        { username: 'yasser', role: 'hygiene', branch: 'البيطاش الرئيسي', name: 'x', shift: '', depts: [] }, { username: 'ops', role: 'ops', name: 'x', branch: '', shift: '', depts: [] }]) {
        USER = who; RANK_CACHE = null;
        for (const t of TABS.filter(t => t[2]())) { try { VIEW = t[0]; render(); } catch (e) { out.push((who?.role || 'guest') + ':' + t[0] + ' ' + e.message); } }
      }
      USER = null; VIEW = 'dash'; render(); return out;
    });
    eq(errs, []);
  });
  test('الهايجين يدخل ويقيّم ببنود الهايجين بس', async () => {
    await login(p, 'yasser', '7777');
    eq(await p.evaluate(() => USER.role), 'hygiene');
    const t = await tabs(); ok(t.some(x => x.includes('تقييم اليوم')) && !t.some(x => x.includes('الكروت')), t.join('|'));
    const r = await p.evaluate(() => { const e = filtered(true)[0]; delete day(DATE).hy[e.code]; [0, 1, 2, 3, 4].forEach(i => setCrit(e.code, i, 2)); return [day(DATE).hy[e.code], document.querySelector('#main').innerText.includes('النضافة الشخصية')]; });
    eq(r, [[2, 2, 2, 2, 2], true]);
    await p.evaluate(() => { USER = null; render(); });
  });
  test('مدير التشغيل يحدد نقط القسم والمطلوب، والتقرير يحسب بيها', async () => {
    await p.evaluate(() => { USER = { username: 'ops', role: 'ops', name: 'x', branch: '', shift: '', depts: [] }; TG.branch = 'البيطاش الرئيسي'; TG.dept = 'قسم البقاله'; TG.mode = 'edit'; go('target'); });
    ok(await p.evaluate(() => document.querySelector('#main').innerText.includes('نقط القسم للشهر ده')));
    const r = await p.evaluate(() => { DRAFT.pts = 150; DRAFT.need = 170; saveTarget(); const t = empTarget(activeEmps().find(e => e.branch === 'البيطاش الرئيسي' && e.dept === 'قسم البقاله'), monthOf(DATE), DATE); return [t.deptMax, t.need]; });
    eq(r, [150, 170]);
  });
  test('خانة نقط الكابتن تظهر لمدير التشغيل بس', async () => {
    await p.evaluate(() => { TG.mode = 'view'; render(); });
    ok(await p.$('#capPts'), 'ops should see captain points');
    await p.evaluate(() => { USER = { username: 'haitham', role: 'branch', branch: 'البيطاش الرئيسي', name: 'x', shift: '', depts: [] }; render(); });
    ok(!(await p.$('#capPts')), 'branch manager sees captain points');
  });
  test('الموظف يدخل بكوده ويشوف تقريره بالمربعين (KPI ونقط التارجت)', async () => {
    const txt = await p.evaluate(() => { USER = null; ME = ranks().rows[0].e.code; go('progress'); return document.querySelector('#main').innerText; });
    ok(txt.includes('الـ KPI بتاعك') && txt.includes('نقط التارجت'), txt.slice(0, 120));
  });
  test('المبالغ مخفية عن الموظف ومدير الفرع، وظاهرة للتشغيل', async () => {
    const r = await p.evaluate(src => {
      const re = new RegExp(src); const seen = {};
      for (const who of [null, { username: 'haitham', role: 'branch', branch: 'البيطاش الرئيسي', name: 'x', shift: '', depts: [] }, { username: 'ops', role: 'ops', name: 'x', branch: '', shift: '', depts: [] }]) {
        USER = who; VIEW = 'month'; render(); seen[who?.role || 'guest'] = re.test(document.querySelector('#main').innerText.replace(/\n\d+\t\n/g, ' '));
      }
      return seen;
    }, MONEY.source);
    eq(r, { guest: false, branch: false, ops: true });
  });
  test('شاشة الفرع: كل المشاهد شغالة ومفيهاش أي مبالغ', async () => {
    const tv = await openApp(b, { query: '?tv=' + encodeURIComponent('البيطاش الرئيسي') + '&demo=1', viewport: { width: 1920, height: 1080 } });
    const r = await tv.evaluate(src => { const re = new RegExp(src); return tvScenes().map(f => { const d = document.createElement('div'); d.innerHTML = f(); return re.test(d.innerText) ? f.name : null; }).filter(Boolean); }, MONEY.source);
    eq(r, []); eq(tv.errors, []);
  });
  test('اللوجو بيتحمّل من assets', async () => {
    const r = await p.evaluate(async () => Promise.all([LOGO_WHITE, LOGO_HEAD].map(src => new Promise(res => { const i = new Image(); i.onload = () => res(i.width > 0); i.onerror = () => res(false); i.src = src; }))));
    eq(r, [true, true]);
  });
  test('مفيش أخطاء في الصفحة', async () => eq(p.errors, []));
  await run('سيناريوهات الاستخدام (نسخة التجربة)');
  await b.close();
})();
