// المرحلة الأولى على نسخة التجربة: رجل اليوم بالشيفتات الجديدة، إغلاق اليوم، دخول الموظف بالرقم السري، الاعتراض، السجل، الأرقام السرية
const { test, run, eq, ok, browser, openApp } = require('../helpers');

(async () => {
  const b = await browser();
  const p = await openApp(b);
  const as = who => p.evaluate(w => { USER = w; RANK_CACHE = null; render(); }, who);
  const OPS = { username: 'ops', name: 'مدير التشغيل', role: 'ops', branch: '', shift: '', depts: [] };
  const MAHMOUD = { username: 'mahmoud', name: 'محمود', role: 'shift', branch: 'البيطاش الرئيسي', shift: 'Morning', depts: [] };
  const ISLAM = { username: 'islam', name: 'إسلام', role: 'shift', branch: 'البيطاش الرئيسي', shift: 'Night', depts: [] };
  const answer = async text => { await p.waitForSelector('#askBg.open', { timeout: 5000 }); if (text != null) await p.fill('#askIn', text); await p.click('#askOk'); await p.waitForTimeout(150); };
  const main = () => p.evaluate(() => document.querySelector('#main').innerText);

  test('رجل اليوم: البيطاش «الصبح» و«الليل + Between» بـ 2 لكل شيفت، وعين شمس 1', async () => {
    const r = await p.evaluate(() => { const y = new Date(); y.setDate(y.getDate() - 1); const W = peekDay(ymd(y)).winners; return [W['البيطاش الرئيسي|Morning']?.length, W['البيطاش الرئيسي|Night']?.length, W['عين شمس|Morning']?.length, Object.keys(W).some(k => k.endsWith('|Between'))]; });
    eq(r, [2, 2, 1, false]);
    await as(OPS); await p.evaluate(() => go('day'));
    const t = await main(); ok(t.includes('الليل + Between') && t.includes('اعتماد (٢)'), t.slice(0, 200));
  });
  test('مفيش فايز عنده كارت أصفر أو أحمر يومها أو أقل من 4 نجوم', async () => {
    eq(await p.evaluate(() => { const bad = []; for (const [d, D] of Object.entries(S.days)) for (const codes of Object.values(D.winners || {})) for (const c of codes) if (badCardOn(d, c) || score(d, c).total < 4) bad.push(d + ':' + c); return bad; }), []);
  });
  test('مدير الصبح يشوف إغلاق شيفته بس، ويقفله ← التقييم يتقفل', async () => {
    await p.evaluate(() => { DATE = todayC(); });
    await as(MAHMOUD); await p.evaluate(() => go('rate'));
    eq(await p.evaluate(() => myCloseGroups()), ['البيطاش الرئيسي|Morning']);
    await p.evaluate(() => { closeDay('البيطاش الرئيسي|Morning'); }); await answer();
    await p.waitForTimeout(200);
    const r = await p.evaluate(() => { const c = closeOf(DATE, 'البيطاش الرئيسي|Morning'); const e = activeEmps().find(x => x.branch === 'البيطاش الرئيسي' && x.shift === 'Morning'); return [c?.closed_by, dayLocked(e)]; });
    eq(r, ['mahmoud', true]);
    ok((await main()).includes('اتقفل'));
  });
  test('مدير الليل بيقيّم Between (Between مع الليل)', async () => {
    eq(await p.evaluate(w => { USER = w; const e = activeEmps().find(x => x.branch === 'البيطاش الرئيسي' && x.shift === 'Between'); return inScope(e); }, ISLAM), true);
  });
  test('الإغلاق المتأخر بيتخصم من المدير ويظهر في سجله', async () => {
    const r = await p.evaluate(() => { const L = (S.ledger || []).filter(l => l.id.startsWith('late|')); return [L.length > 0, L.every(l => l.points === -S.settings.lateClosePenalty)]; });
    eq(r, [true, true]);
    await as(OPS); await p.evaluate(() => openMgrHistory('islam'));
    const t = await p.evaluate(() => document.querySelector('#modal').innerText); await p.evaluate(() => closeModal());
    ok(t.includes('تأخير تسليم يوم') || t.includes('مفيش حركات'), t.slice(0, 150));
  });
  let card;
  test('الموظف يدخل بكوده + الرقم السري (الغلط مبيدخلش)', async () => {
    card = await p.evaluate(() => S.cards.find(c => c.status === 'approved' && c.color === 'yellow' && !(S.appeals || []).some(a => a.cardId === c.id)));
    await as(null); await p.evaluate(() => { meLogout(); go('me'); });
    await p.fill('#l_id', card.code); await p.fill('#l_pin', '9999'); await p.evaluate(() => doLogin());
    eq(await p.evaluate(() => ME), null);
    await p.fill('#l_id', card.code); await p.fill('#l_pin', '1234'); await p.evaluate(() => doLogin()); await p.waitForTimeout(200);
    eq(await p.evaluate(() => ME), card.code);
    await p.evaluate(() => meLogout()); await p.evaluate(() => openLogin());
    await p.fill('#l_id', card.code + ' — ' + await p.evaluate(c => emp(c).name, card.code)); await p.fill('#l_pin', '1234'); await p.evaluate(() => doLogin()); await p.waitForTimeout(200);
    eq(await p.evaluate(() => ME), card.code);   // لو المتصفح كتب «الكود — الاسم» بناخد الكود بس
    ok((await main()).includes('كروتي'));
  });
  test('الموظف يشوف كروته بالسبب واسم المدير ويعترض', async () => {
    const t = await main(); ok(t.includes(card.reason), 'reason missing');
    await p.evaluate(id => { empAppeal(id); }, card.id); await answer('مكنتش موجود الساعة دي');
    ok((await main()).includes('اعتراضك مستني قرار'));
  });
  test('الاعتراض بيوصل لمدير التشغيل بس (المدير اللي ادى الكارت مبيشوفوش)', async () => {
    const issuer = card.by;
    await as({ username: issuer, name: issuer, role: issuer === 'haitham' ? 'branch' : 'shift', branch: 'البيطاش الرئيسي', shift: issuer === 'islam' ? 'Night' : 'Morning', depts: [] });
    await p.evaluate(() => go('cards'));
    ok(!(await main()).includes('مكنتش موجود'), 'issuer sees the appeal');
    await as(OPS); await p.evaluate(() => go('cards'));
    const t = await main(); ok(t.includes('اعتراضات مستنية قرار') && t.includes('مكنتش موجود'), 'ops does not see the appeal');
  });
  test('قبول الاعتراض ← الكارت «اتلغى بعد اعتراض» ونقطه بتتشال، ويفضل في السجل', async () => {
    const before = await p.evaluate(c => cardPts(cardCount(c, monthOf(DATE), DATE)), card.code);
    const id = await p.evaluate(c => S.appeals.find(a => a.cardId === c && a.status === 'pending').id, card.id);
    await p.evaluate(i => { decideAppeal(i, true); }, id); await answer('اتأكدت'); await p.waitForTimeout(200);
    const r = await p.evaluate(c => [S.cards.find(x => x.id === c.id).status, cardPts(cardCount(c.code, monthOf(DATE), DATE))], card);
    eq(r[0], 'overturned'); eq(r[1], before + 5);
  });
  test('مدير التشغيل يطلّع أرقام سرية (ملف Excel)', async () => {
    await as(OPS);
    await p.evaluate(() => { window.__rows = 0; XLSX.writeFile = wb => { window.__rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).length; }; genEmpPins(true); });
    await answer(); await p.waitForTimeout(400);
    const n = await p.evaluate(() => window.__rows);
    ok(n === 0 || n > 100, 'rows ' + n);
  });
  test('سجل الموظف: الكارت والاعتراض والقرار باللي عملهم', async () => {
    const t = await p.evaluate(async c => { await openHistory(c); return document.querySelector('#modal').innerText; }, card.code); await p.evaluate(() => closeModal());
    ok(t.includes('اعتراض') && t.includes('قرار اعتراض'), t.slice(0, 200));
  });
  test('مراحل اليوم: مفتوح ← مراجعة (بعد التسليم) ← مغلق (بعد اعتماد رجل اليوم)', async () => {
    const r = await p.evaluate(() => { const gk = 'البيطاش الرئيسي|Night'; const y = new Date(); y.setDate(y.getDate() - 3); const old = ymd(y);
      return [dayStage(todayC(), 'عين شمس|Night'), dayStage(todayC(), 'البيطاش الرئيسي|Morning'), dayStage(old, gk)]; });
    eq(r[1] >= 2, true); eq(r[2], 4);
  });
  test('شاشة رجل اليوم: المرشحين الأربعة + مين مش مرشح وليه', async () => {
    await as(OPS); await p.evaluate(() => { F.branch = 'البيطاش الرئيسي'; go('day'); });
    const t = await main(); ok(t.includes('أعلى ٤ مرشحين') && t.includes('مش مرشحين') && t.includes('مفتوح'), t.slice(0, 300));
  });
  test('تعديل التشغيل في يوم مغلق بيطلب سبب، وبيتسجل مع القيمة القديمة', async () => {
    await p.evaluate(() => { const y = new Date(); y.setDate(y.getDate() - 3); DATE = ymd(y); USER = { username: 'ops', name: 'مدير التشغيل', role: 'ops', branch: '', shift: '', depts: [] }; });
    const code = await p.evaluate(() => activeEmps().find(e => peekDay(DATE).pray?.[e.code] != null).code);
    await p.evaluate(c => { setCam('pray', c, peekDay(DATE).pray[c] ? 0 : 1); }, code); await answer('اتسجل غلط');
    await p.waitForTimeout(200);
    const h = await p.evaluate(c => S.history.find(x => x.kind === 'pray' && x.code === c), code);
    eq([h.data.key.reason, typeof h.data.old], ['اتسجل غلط', 'number']);
    await p.evaluate(() => { DATE = todayC(); });
  });
  test('تقييم المديرين كل 4 أيام: الدورات 1/5/9…، التقييم بيكمّل، و«تأكيد» بيثبّته للدورة الجديدة', async () => {
    await as(MAHMOUD); await p.evaluate(() => go('rate'));
    const r = await p.evaluate(async () => {
      const cyc = [cycleStart('2026-11-01'), cycleStart('2026-11-08'), cycleEnd('2026-11-29'), isRateDay('2026-11-13'), isRateDay('2026-11-14')];
      const e = filtered(true)[0]; const c = e.code;
      for (let i = 0; i <= 12; i++) { const D = day(shiftDay(DATE, -i)); delete D.sh[c]; delete D.carry[c]; }
      const old = shiftDay(cycleStart(DATE), -1); day(old).sh[c] = [2, 1, 2, 1, 2]; day(DATE).att[c] = 'on';
      const before = [rateOf(DATE, 'sh', c, true).carried, rateStale(DATE, 'sh', c), rateDone(DATE, 'sh', c), score(DATE, c).parts.sh];
      render(); const btn = !!document.querySelector(`#rc-${c} button[onclick^="confirmRate"]`);
      await confirmRate(c);
      const after = [rateStale(DATE, 'sh', c), JSON.stringify(peekDay(DATE).sh[c])];
      await setCrit(c, 1, 2);   // التعديل بيبدأ من التقييم المكمّل
      return [cyc, before, btn, after, JSON.stringify(peekDay(DATE).sh[c])];
    });
    eq(r, [['2026-11-01', '2026-11-05', '2026-11-30', true, false], [true, true, true, 0.75], true, [false, '[2,1,2,1,2]'], '[2,2,2,1,2]']);
  });
  test('فترات التأخير: «من / لحد» لكل حالة مربوطة ببعض، والترتيب الغلط مبيتحفظش', async () => {
    await as(OPS); await p.evaluate(() => go('settings'));
    eq(await p.evaluate(() => { const k = { ...S.settings }; setBand('lateMax', 20); const a = [S.settings.graceMin, S.settings.lateMax, S.settings.vlateMax]; setBand('vlateMax', 15);
      const r = [a, S.settings.vlateMax, attFromTime({ shift: 'Morning' }, '09:21'), attFromTime({ shift: 'Morning' }, '09:20')]; Object.assign(S.settings, k); render(); return r; }),
      [[10, 20, 60], 60, 'vlate', 'late']);
  });
  test('مفيش أخطاء في الصفحة', async () => eq(p.errors, []));
  await run('المرحلة الأولى — الشاشات (نسخة التجربة)');
  await b.close();
})();
