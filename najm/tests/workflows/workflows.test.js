// الشغل من ناحية المستخدم على نسخة التجربة (?demo=1)
const { test, run, eq, ok, browser, openApp } = require('../helpers');

const login = async (p, u, pin) => { await p.click('#roleBtn'); await p.fill('#l_id', u); await p.fill('#l_pin', pin); await p.click('.login .btn.pri'); await p.waitForTimeout(400); };
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
    const r = await p.evaluate(async () => { go('rate'); const e = filtered(true).find(x => x.dept === 'قسم البقاله'); delete day(DATE).hy[e.code]; for (const i of [0, 1, 2, 3, 4]) await setCrit(e.code, i, 2); return [day(DATE).hy[e.code], document.querySelector('#main').innerText.includes('الأفرهيد')]; });
    eq(r, [[2, 2, 2, 2, 2], true]);
    await p.evaluate(() => { USER = null; render(); });
  });
  test('الهايجين: الخمس بنود جنب كل موظف، والتيشرت إجباري، و«مش مطلوب» مبيتحسبش', async () => {
    const r = await p.evaluate(async () => {
      USER = { username: 'yasser', role: 'hygiene', branch: 'البيطاش الرئيسي', name: 'x', shift: '', depts: [] }; go('rate');
      const sec = filtered(true).find(x => x.dept === 'قسم الامن و المراقبه'); delete day(DATE).hy[sec.code];
      const card = document.querySelector('#rc-' + sec.code).innerText; const rows = document.querySelectorAll('#rc-' + sec.code + ' .crit').length;
      await setCrit(sec.code, 0, 2); const a = [...day(DATE).hy[sec.code]]; const st = hyStar(day(DATE), sec.code);   // «مش مطلوب» من امبارح بيتفتكر
      await setCrit(sec.code, 1, 0); const half = hyStar(day(DATE), sec.code);                                         // الإيبرون بقى مطلوب ومش لابسه ← 2 من 4
      const notReq = document.querySelector('#rc-' + sec.code).innerText.split('مش مطلوب').length - 1;
      USER = null; return [card.includes('التيشرت') && card.includes('الجلافز'), rows, half, a, st, notReq];
    });
    eq(r, [true, 5, 0.5, [2, -1, -1, -1, -1], 1, 4]);
  });
  test('قواعد الشهر: الحفظ بيبدأ من الشهر الجاي وبيظهر في سجل التغييرات', async () => {
    const r = await p.evaluate(async () => {
      USER = { username: 'ops', role: 'ops', name: 'مدير التشغيل', branch: '', shift: '', depts: [] }; go('settings');
      const cm = monthOf(ymd(new Date())), nm = nextMonthOf(cm); RD.minWorkDays = 23;
      const sv = saveRules(false); await new Promise(r => setTimeout(r, 50)); document.querySelector('#askOk').click(); await sv;
      const out = [rulesFor(cm).minWorkDays, rulesFor(nm).minWorkDays];
      await openSettingsLog(); const t = document.querySelector('#modal').innerText; closeModal(); USER = null;
      return [...out, t.includes('قواعد الشهر')];
    });
    eq(r, [20, 23, true]);
  });
  test('رفع المبيعات: معاينة بالمرفوض والمكرر، ونفس الملف مبيترفعش مرتين لمدير الفرع', async () => {
    const r = await p.evaluate(async () => {
      USER = { username: 'haitham', role: 'branch', branch: 'البيطاش الرئيسي', name: 'x', shift: '', depts: [] };
      const t = new Date(); t.setDate(t.getDate() + 2); const TMR = ymd(t);   // يوم مفيش فيه مبيعات
      const rows = [['كود', 'اسم الصنف', 'الكمية'], ['1', 'جبنة', '10'], ['1', 'جبنة', '5'], ['2', 'لبن', 'abc'], ['', '', ''], ['3', 'زبادي', '-2'], ['', 'إجمالي', '13']];
      const mk = () => { IMP = { rows, H: { row: 0, idx: { code: 0, name: 1, qty: 2 } }, fname: 'f.xlsx', hash: 'h-test-1', branch: 'البيطاش الرئيسي', monthly: false, month: '', date: TMR }; };
      mk(); const P = parseImpFull(); const before = (S.imports || []).length;
      await commitImp(); const after1 = (S.imports || []).length; const sold = S.sales[TMR]['البيطاش الرئيسي']['1'].qty;
      mk(); await commitImp(); const after2 = (S.imports || []).length;
      delete S.sales[TMR]; USER = null; return [Object.keys(P.out).length, P.bad.length, P.dup, P.neg, after1 - before, sold, after2 - after1];
    });
    eq(r, [2, 1, 1, 1, 1, 15, 0]);
  });
  test('شيت البصمة: معاينة + الموظفين الناقصين للمراجعة، ونفس الملف مبيترفعش مرتين', async () => {
    const r = await p.evaluate(async () => {
      USER = { username: 'mahmoud', role: 'shift', branch: 'البيطاش الرئيسي', name: 'x', shift: 'Morning', depts: [] };
      const L = filtered(true); const keep = DATE; const y = new Date(); y.setDate(y.getDate() + 1); DATE = ymd(y);   // يوم فاضي
      ATT_IMP = { fname: 'att.xlsx', hash: 'att-h-1', res: { [L[0].code]: { st: 'on', time: null }, [L[1].code]: { st: 'abs', time: null } }, bad: [], unknown: ['99999'], outScope: [], dup: 0, missing: L.slice(2) };
      const n0 = (S.imports || []).length; await commitAttendance(); const st = [peekDay(DATE).att[L[0].code], peekDay(DATE).att[L[1].code]];
      ATT_IMP = { fname: 'att.xlsx', hash: 'att-h-1', res: { [L[2].code]: { st: 'on', time: null } }, bad: [], unknown: [], outScope: [], dup: 0, missing: [] };
      await commitAttendance(); const third = peekDay(DATE).att[L[2].code];
      const log = S.imports[0]; delete S.days[DATE]; DATE = keep; USER = null;
      return [st, third ?? null, (S.imports || []).length - n0, log.note.includes('ناقص')];
    });
    eq(r, [['on', 'abs'], null, 1, true]);
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
