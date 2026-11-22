// الحسابات: نجوم اليوم، البصمة، المدير المباشر، الهايجين، الكروت، نقط التارجت، شرط العشرة الأوائل
const { test, run, eq, ok, browser, openApp } = require('../helpers');

(async () => {
  const b = await browser();
  const p = await openApp(b);
  const ev = (fn, arg) => p.evaluate(fn, arg);

  test('البصمة: في ميعاده 2 · تأخير بسيط 1.2 · كبير 0.4 · غياب 0 · إجازة مش بتتحسب', async () => {
    eq(await ev(() => ['on', 'late', 'vlate', 'abs', 'off', null].map(attStar)), [2, 1.2, 0.4, 0, null, null]);
  });
  test('وقت البصمة ← حالة (سماح 10 دقايق، تأخير بسيط لحد 30)', async () => {
    eq(await ev(() => { const e = { shift: 'Morning' }; return ['09:05', '09:25', '09:50', '08:40'].map(t => attFromTime(e, t)); }), ['on', 'late', 'vlate', 'on']);
    // «تأخير كبير لحد» (60 دقيقة افتراضي): بعده «فوق الحد» = حاضر من غير نجوم بصمة
    eq(await ev(() => { const e = { shift: 'Morning' }, k = S.settings.vlateMax; const a = ['10:00', '10:01'].map(t => attFromTime(e, t)); S.settings.vlateMax = 90; const b = attFromTime(e, '10:01'); S.settings.vlateMax = k; return [...a, b, attStar('xlate'), WORK_ST.includes('xlate')]; }), ['vlate', 'xlate', 'vlate', 0, true]);
  });
  test('بنود التقييم: 5 بنود من 0 لـ 2 = نجمة، والناقص مايتحسبش', async () => {
    eq(await ev(() => [crit([2, 2, 2, 2, 2]), crit([1, 1, 1, 1, 1]), crit([2, 2, 1, 2, 2]), crit([2, 2, null, 2, 2]), crit(null)]), [1, 0.5, 1, null, null]);
  });
  test('المدير المباشر: نص الفرع ونص الشيفت · وفي الفريش تلت لكل واحد', async () => {
    eq(await ev(() => {
      const keep = S.days; S.days = { '2026-05-02': { att: {}, br: { a: [2, 2, 2, 2, 2] }, sh: { a: [0, 0, 0, 0, 0] }, fr: { a: [2, 2, 2, 2, 2] }, ops: {}, hy: {}, bonus: {} } };
      const r = [mgrStar('2026-05-02', 'a', { dept: 'قسم الكاشير' }).mgr, mgrStar('2026-05-02', 'a', { dept: 'قسم البقاله' }).mgr]; S.days = keep; return r;
    }), [0.5, 0.75]);
  });
  test('نقط التارجت بالشرايح: أقل من 50% صفر · بالتناسب · سلّم · الحد الأقصى 120', async () => {
    eq(await p.evaluate(() => { const T = [[50, 50], [60, 60], [70, 70], [85, 85], [100, 100], [110, 110], [120, 120]]; const r = { ...RULE_DEF, ptsTiers: T, ptsMode: 'linear' }, st = { ...RULE_DEF, ptsTiers: T, ptsMode: 'step' }, c = { ...RULE_DEF, ptsTiers: [[50, 30], [100, 100]], ptsMode: 'linear' };
      return [tierPts(49, r), tierPts(50, r), tierPts(93, r), tierPts(130, r), tierPts(93, st), tierPts(75, c), tierPts(null, r)]; }), [0, 50, 93, 120, 85, 65, null]);
  });
  test('قواعد الشهر: التغيير بيبدأ من الشهر الجاي والشهور اللي فاتت بتفضل بقواعدها', async () => {
    eq(await p.evaluate(() => { const keep = S.settings.ruleVersions;
      S.settings.ruleVersions = [{ from: '0000-00', rules: { ...RULE_DEF } }, { from: '2026-12', rules: { ...RULE_DEF, weeklyOff: 2, goal: 90 } }];
      const r = [rulesFor('2026-11').weeklyOff, rulesFor('2026-12').weeklyOff, rulesFor('2027-03').goal, rulesFor('2025-01').goal];
      S.settings.ruleVersions = keep; return r; }), [1, 2, 90, 85]);
  });
  test('التأهل: مغابش خالص ومخدش غير إجازاته الأسبوعية (المرضي بيطلّعه)، والقسم حقق 100%', async () => {
    eq(await p.evaluate(() => { const tg = { v: 100, need: 100, dept: 100 }, m = s => ({ monthScore: 90, offMax: 5, ...s });
      return [qualify(m({ abs: 0, off: 4 }), tg).ok, qualify(m({ abs: 1, off: 0 }), tg).ok, qualify(m({ abs: 0, off: 6 }), tg).ok,
        qualify(m({ abs: 0, off: 4 }), { ...tg, dept: 92 }).ok, allowedOff('2026-02'), allowedOff('2026-11')]; }), [true, false, false, false, 4, 5]);
  });
  test('الموظف اللي اتنقل في نص الشهر: التارجت متقسم على القسمين بالأيام', async () => {
    eq(await p.evaluate(() => {
      const e = activeEmps().find(x => x.dept === 'قسم البقاله' && x.branch === 'البيطاش الرئيسي'); const m = monthOf(DATE); const keep = S.moves;
      const days = monthDays(m, DATE); const mid = days[Math.floor(days.length / 2)];
      const a = empTarget(e, m, DATE), b = empTarget({ ...e, dept: 'قسم الكاشير' }, m, DATE);
      S.moves = [{ code: e.code, day: mid, fromBranch: e.branch, fromDept: e.dept, toBranch: e.branch, toDept: 'قسم الكاشير' }];
      const seg = deptSegments({ ...e, dept: 'قسم الكاشير' }, m, DATE); const t = empTarget({ ...e, dept: 'قسم الكاشير' }, m, DATE); S.moves = keep;
      const w = seg.find(x => x.dept === e.dept).w; const exp = Math.round((a.basePoints || 0) * w + (b.basePoints || 0) * (1 - w));
      return [seg.length, Math.abs(seg.reduce((x, y) => x + y.w, 0) - 1) < 1e-9, Math.abs(t.basePoints - exp) <= 1, !!t.split];
    }), [2, true, true, true]);
  });
  test('الـ KPI بالنقط: اليوم الكامل ≈ 19.2 نقطة (500 ÷ 26)، الغياب صفر، الكروت بتتضاف، والفلوس أقصاها 500', async () => {
    eq(await p.evaluate(() => {
      const e = activeEmps()[0]; const m = '2026-05', keepD = S.days, keepC = S.cards, keepL = LIVE; S.days = {}; S.cards = []; LIVE = false;
      const days = monthDays(m, m + '-31'); const D = d => day(d);
      // 26 يوم 5 نجوم + ½ مثالي في يومين + كارت أخضر ← فوق الـ 500 (الفلوس 500 والنقط أكتر)
      days.slice(0, 26).forEach((d, i) => { const x = D(d); x.att[e.code] = 'on'; x.br[e.code] = x.sh[e.code] = x.ops[e.code] = x.hy[e.code] = [2, 2, 2, 2, 2]; x.pray[e.code] = 1; if (isFresh(e)) x.fr[e.code] = [2, 2, 2, 2, 2]; if (i < 2) x.bonus[e.code] = { v: .5, note: 'x' }; });
      S.cards = [{ id: 'g', date: days[3], code: e.code, color: 'green', reason: 'x', by: 'ops', approved: true, status: 'approved' }];
      const a = monthSummary(e, m, m + '-31');
      // غياب يومين
      days.slice(0, 2).forEach(d => { D(d).att[e.code] = 'abs'; });
      const b = monthSummary(e, m, m + '-31');
      S.days = keepD; S.cards = keepC; LIVE = keepL;
      return [Math.round(dayPts(m) * 10) / 10, a.kpiPts, a.kpiMoney, b.kpiPts < a.kpiPts - 38, b.kpiMoney, b.monthScore < 100];
    }), [19.2, 514, 500, true, 472, true]);
  });
  test('شيت الحضور الشهري: بياخد الكود والوردية والدخول والإجازة بس، والراحة أول يوم غياب في الأسبوع', async () => {
    eq(await p.evaluate(() => {
      const keep = DATE; DATE = '2026-11-30';
      const code = activeEmps()[0].code;
      const H = ['اليوم', 'التاريخ', 'ايام الحضور', 'اجازة مدفوعة', 'نوع الاجازه', 'بدل الأجازه', 'جزاء غياب بدون اذن', 'معاد الورديه', 'س الدخول', 'س الخروج'];
      const row = (dd, leave, shift, inT) => ['Day', dd + '/11/2026', '', '', leave, '4545454', '6363636', shift, inT, ''];
      const rows = [['الكود', code, 'الاسم'], ['الراتب الاساسي', '7171717', 'بدل متغير kpi', '5252525'], H,
        row(7, '', '8:00 AM', '8:05 AM'),      // سبت: في ميعاده (سماح)
        row(8, '', '7:00 AM', '7:25 AM'),      // تأخير بسيط
        row(9, '', '5:00 PM', '6:10 PM'),      // تأخير كبير
        row(10, '', '11:00 PM', '12:05 AM'),   // وردية بعد نص الليل: ساعة و5 دقايق = تأخير كبير
        row(11, 'مرضي', '8:00 AM', ''),        // إجازة
        row(12, '', '8:00 AM', ''),            // من غير بصمة: راحة الأسبوع
        row(13, '', '8:00 AM', ''),            // من غير بصمة تاني نفس الأسبوع: غياب
        row(14, '', '8:00 AM', '8:00 AM'),     // أسبوع جديد
        row(20, '', '8:00 AM', ''),            // آخر يوم في الملف فيه بصمة = 14 ← ده بيتشال
        ['الاجمالى'], ['الكود', '99999999', 'الاسم'], ['اليوم'], H, row(7, '', '8:00 AM', '8:00 AM')];
      const P = parseMonthSheet(rows); DATE = keep;
      const st = Object.fromEntries(P.recs.filter(r => r.code === code).map(r => [r.day.slice(8), r.st]));
      return [st, P.unknown, P.rest, P.to, isMonthSheet(rows), ['7171717', '5252525', '4545454', '6363636'].some(x => JSON.stringify(P).includes(x))];
    }), [{ '07': 'on', '08': 'late', '09': 'xlate', '10': 'xlate', '11': 'off', '12': 'off', '13': 'abs', '14': 'on' }, ['99999999'], 1, '2026-11-14', true, false]);
  });
  test('نجمة الهايجين (اللبس) من البنود المطلوبة بس', async () => {
    eq(await p.evaluate(() => [hyScore([2, -1, -1, -1, -1]), hyScore([2, 2, 2, 2, 0]), hyScore([1, -1, 2, -1, -1]), hyScore([2, -1, null, -1, -1]), hyScore([-1, -1, -1, -1, -1])]), [1, 0.75, 0.75, null, null]);
  });
  test('نجوم اليوم: الأساسي من 5 (البصمة + المدير + التشغيل + الهايجين) + ½ مثالي Bonus فوقه', async () => {
    eq(await ev(() => {
      const code = activeEmps().find(e => !isFresh(e)).code, d = '2099-01-01', D = day(d), full = [2, 2, 2, 2, 2];
      D.full[code] = 1; D.att[code] = 'on'; D.br[code] = full; D.sh[code] = full; D.ops[code] = full; D.hy[code] = full; D.pray[code] = 1; D.bonus[code] = { v: .5 };
      const s = score(d, code); D.pray[code] = 0; const s0 = score(d, code); delete S.days[d]; return [s.att, s.mgr, s.ops, s.hy, s.pray, s.base, s.total, s.complete, s0.base];
    }), [2, 1, 0.5, 1, 0.5, 5, 5.5, true, 4.5]);   // التشغيل ½ · الصلاة ½ (ماصلّاش = 0)
  });
  test('الكروت: الأخضر +10 · الأصفر −5 · الأحمر −20 · كل 3 صفر = أحمر (والصفر التلاتة بتتلغي)', async () => {
    eq(await ev(() => [cardPts({ y: 1, r: 0, g: 0 }), cardPts({ y: 2, r: 0, g: 0 }), cardPts({ y: 3, r: 0, g: 0 }), cardPts({ y: 4, r: 0, g: 0 }), cardPts({ y: 0, r: 0, g: 1 }), cardPts({ y: 3, r: 1, g: 2 })]), [-5, -10, -20, -25, 10, -20]);
  });
  test('الكروت الملغية والمرفوضة والمستنية مش بتتحسب', async () => {
    eq(await ev(() => ['approved', 'pending', 'rejected', 'cancelled', 'overturned'].map(status => counted({ status }))), [true, false, false, false, false]);
  });
  test('رجل اليوم: 4 نجوم وطالع ومفيش أصفر أو أحمر يومها، والأخضر بيرفّع', async () => {
    eq(await ev(() => {
      const d = '2099-02-02', D = day(d), L = activeEmps().filter(e => !isFresh(e)).slice(0, 4), full = [2, 2, 2, 2, 2], low = [1, 1, 1, 1, 1];
      L.forEach((e, i) => { D.full[e.code] = 1; D.att[e.code] = 'on'; D.br[e.code] = D.sh[e.code] = D.ops[e.code] = D.hy[e.code] = i === 3 ? low : full; });
      S.cards.push({ id: 'tY', code: L[0].code, date: d, color: 'yellow', status: 'approved' }, { id: 'tG', code: L[2].code, date: d, color: 'green', status: 'approved' });
      const R = rankGroup(d, L).map(x => x.e.code); S.cards = S.cards.filter(c => !['tY', 'tG'].includes(c.id)); delete S.days[d];
      return [R.length, R[0] === L[2].code, R.includes(L[0].code), R.includes(L[3].code)];
    }), [2, true, false, false]);
  });
  test('رجال اليوم: البيطاش 2 + 2 · عين شمس 1 + 1 · المصنع صفر · Between مع الليل', async () => {
    eq(await ev(() => [winnersFor('البيطاش الرئيسي', 'Morning'), winnersFor('البيطاش الرئيسي', 'Night'), winnersFor('عين شمس', 'Morning'), winnersFor('عين شمس', 'Night'), winnersFor('المصنع', 'Morning'), shiftGroup('Between'), shiftGroup('Night'), shiftGroup('Morning')]), [2, 2, 1, 1, 0, 'Night', 'Night', 'Morning']);
  });
  test('إغلاق اليوم: آخر ميعاد = بداية الشيفت + 10 ساعات', async () => {
    eq(await ev(() => [closeDeadline('2026-11-10', 'x|Morning').getHours(), closeDeadline('2026-11-10', 'x|Night').getDate()]), [19, 11]);
  });
  test('نسبة نقط التارجت (الشرايح المعتمدة): أقل من 85% صفر · من 85% نص · 100% فأكتر كامل', async () => {
    eq(await ev(() => [40, 60, 84, 85, 99, 100, 120].map(tgtRatio)), [0, 0, 0, 0.5, 0.5, 1, 1]);
  });
  test('العشرة الأوائل: لازم الـ KPI والتارجت مع بعض (والأيام مكتملة)', async () => {
    eq(await ev(() => [
      qualify({ abs: 0, off: 0, monthScore: 90 }, { dept: 104 }).ok,
      qualify({ abs: 0, off: 0, monthScore: 90 }, { dept: 90 }).ok,
      qualify({ abs: 0, off: 0, monthScore: 70 }, { dept: 104 }).ok,
      qualify({ abs: 0, off: 0, monthScore: 90 }, null).ok,
    ]), [true, false, false, false]);
  });
  test('الترتيب: المؤهلين الأول، والجوايز للمؤهلين بس', async () => {
    const r = await ev(() => { const R = ranks(); const firstNot = R.rows.findIndex(x => !x.q.ok); return { okBefore: R.rows.slice(0, firstNot < 0 ? R.rows.length : firstNot).every(x => x.q.ok), prizeOnlyQualified: R.rows.every(x => !cupOf(prizeRank(x.e.code)) || x.q.ok) }; });
    ok(r.okBefore, 'non-qualified ranked before qualified'); ok(r.prizeOnlyQualified, 'prize for non-qualified');
  });
  test('مفيش أخطاء في الصفحة', async () => eq(p.errors, []));
  await run('الحسابات');
  await b.close();
})();
