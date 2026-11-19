// الشغل من ناحية المستخدم على نسخة التجربة (?demo=1)
const { test, run, eq, ok, browser, openApp } = require('../helpers');

const login = async (p, u, pin) => { await p.click('#roleBtn'); await p.click('#lt_mgr'); await p.fill('#l_user', u); await p.fill('#l_pin', pin); await p.click('.login .btn.pri'); await p.waitForTimeout(400); };
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
    const r = await p.evaluate(async () => { const e = filtered(true)[0]; delete day(DATE).hy[e.code]; for (const i of [0, 1, 2, 3, 4]) await setCrit(e.code, i, 2); return [day(DATE).hy[e.code], document.querySelector('#main').innerText.includes('النضافة الشخصية')]; });
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
    const txt = await p.evaluate(() => { USER = null; ME = ranks().rows[0].e.code; MEPIN = '1234'; go('me'); return document.querySelector('#main').innerText; });
    ok(txt.includes('الـ KPI بتاعك') && txt.includes('نقط التارجت'), txt.slice(0, 120));
  });
  test('مين يشوف إيه: الزائر / الموظف / المدير / التشغيل', async () => {
    const r = await p.evaluate(() => {
      const tabs = () => TABS.filter(t => t[2]()).map(t => t[0]);
      const keep = [ME, MEPIN]; const out = {};
      USER = null; ME = null; MEPIN = null; out.guest = tabs();
      ME = activeEmps()[0].code; MEPIN = '1234'; out.emp = tabs();
      USER = { username: 'haitham', role: 'branch', branch: 'البيطاش الرئيسي', name: 'x', shift: '', depts: [] }; out.branch = tabs();
      USER = { username: 'ops', role: 'ops', name: 'x', branch: '', shift: '', depts: [] }; out.ops = tabs();
      USER = null; [ME, MEPIN] = keep; return out;
    });
    eq(r.guest, ['dash', 'me', 'day', 'month']);
    eq(r.emp, ['dash', 'me', 'day', 'month', 'players', 'vote', 'target']);
    ok(r.branch.includes('league') && r.branch.includes('rate') && !r.branch.includes('vote') && !r.branch.includes('settings'), r.branch.join());
    ok(r.ops.includes('settings') && r.ops.includes('league'), r.ops.join());
  });
  test('الزائر ميفتحش بروفايل حد · الموظف يشوف بروفايل زميله مختصر من غير كروت · المدير يشوفه كامل', async () => {
    const r = await p.evaluate(() => {
      const keep = [ME, MEPIN]; closeModal();
      const A = activeEmps().filter(e => e.branch === 'البيطاش الرئيسي'); const other = A.find(e => S.cards.some(c => c.code === e.code)) || A[1];
      USER = null; ME = null; MEPIN = null; openEmp(other.code); const guest = !!document.querySelector('#modal.on, .modal.on') && document.querySelector('#modal')?.innerText.includes(other.name);
      closeModal(); ME = A.find(e => e.code !== other.code).code; MEPIN = '1234'; openEmp(other.code); const t1 = document.querySelector('#modal').innerText; closeModal();
      USER = { username: 'haitham', role: 'branch', branch: 'البيطاش الرئيسي', name: 'x', shift: '', depts: [] }; openEmp(other.code); const t2 = document.querySelector('#modal').innerText; closeModal();
      USER = null; [ME, MEPIN] = keep; return [guest, t1.includes('بروفايل مختصر') && !t1.includes('الكروت\n') && !t1.includes('ملاحظات الإدارة'), t2.includes('ملاحظات الإدارة')];
    });
    eq(r, [false, true, true]);
  });
  test('الموظف يشوف تارجت قسمه بس', async () => {
    const t = await p.evaluate(() => { USER = null; const e = activeEmps().find(x => x.dept === 'قسم البقاله'); ME = e.code; MEPIN = '1234'; go('target'); return document.querySelector('#main').innerText; });
    ok(t.includes('تارجت قسمك — قسم البقاله') && !t.includes('📥'), t.slice(0, 200));
  });
  test('صفحة المدير: مهام النهارده وفريقه ونقطه · التشغيل: مستني قرارك وكل المديرين', async () => {
    const r = await p.evaluate(() => {
      USER = { username: 'haitham', role: 'branch', branch: 'البيطاش الرئيسي', name: 'هيثم', shift: '', depts: [] }; go('me'); const a = document.querySelector('#main').innerText;
      USER = { username: 'ops', role: 'ops', name: 'مدير التشغيل', branch: '', shift: '', depts: [] }; go('me'); const b = document.querySelector('#main').innerText;
      openMgrProfile('haitham'); const c = document.querySelector('#modal').innerText; closeModal(); USER = null; go('dash');
      return [a.includes('مهام النهارده') && a.includes('فريقك') && a.includes('دوري المديرين'), b.includes('مستني قرارك') && b.includes('كل المديرين'), c.includes('فريقك')];
    });
    eq(r, [true, true, true]);
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
