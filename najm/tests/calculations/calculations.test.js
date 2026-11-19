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
  });
  test('بنود التقييم: 5 بنود من 0 لـ 2 = نجمة، والناقص مايتحسبش', async () => {
    eq(await ev(() => [crit([2, 2, 2, 2, 2]), crit([1, 1, 1, 1, 1]), crit([2, 2, 1, 2, 2]), crit([2, 2, null, 2, 2]), crit(null)]), [1, 0.5, 1, null, null]);
  });
  test('المدير المباشر: نص الفرع ونص الشيفت · وفي الفريش تلت لكل واحد', async () => {
    eq(await ev(() => {
      const D = { br: { a: [2, 2, 2, 2, 2] }, sh: { a: [0, 0, 0, 0, 0] }, fr: { a: [2, 2, 2, 2, 2] } };
      return [mgrStar(D, 'a', { dept: 'قسم الكاشير' }).mgr, mgrStar(D, 'a', { dept: 'قسم البقاله' }).mgr];
    }), [0.5, 0.75]);
  });
  test('نجوم اليوم = البصمة + المدير + التشغيل + الهايجين + المثالي (أقصى 5)', async () => {
    eq(await ev(() => {
      const code = activeEmps().find(e => !isFresh(e)).code, d = '2099-01-01', D = day(d), full = [2, 2, 2, 2, 2];
      D.full[code] = 1; D.att[code] = 'on'; D.br[code] = full; D.sh[code] = full; D.ops[code] = full; D.hy[code] = full; D.bonus[code] = { v: .5 };
      const s = score(d, code); delete S.days[d]; return [s.att, s.mgr, s.ops, s.hy, s.total, s.complete];
    }), [2, 1, 1, 1, 5, true]);
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
  test('رجال اليوم: البيطاش 2 + 2 · عين شمس 1 + 1 · المصنع صفر · البين مع الليل', async () => {
    eq(await ev(() => [winnersFor('البيطاش الرئيسي', 'Morning'), winnersFor('البيطاش الرئيسي', 'Night'), winnersFor('عين شمس', 'Morning'), winnersFor('عين شمس', 'Night'), winnersFor('المصنع', 'Morning'), shiftGroup('Between'), shiftGroup('Night'), shiftGroup('Morning')]), [2, 2, 1, 1, 0, 'Night', 'Night', 'Morning']);
  });
  test('إغلاق اليوم: آخر ميعاد = بداية الشيفت + 10 ساعات', async () => {
    eq(await ev(() => [closeDeadline('2026-11-10', 'x|Morning').getHours(), closeDeadline('2026-11-10', 'x|Night').getDate()]), [19, 11]);
  });
  test('نقط التارجت بالشرايح: أقل من 50% صفر · 50–85% نص · 85% وطالع بالنسبة', async () => {
    eq(await ev(() => [40, 60, 84, 85, 100, 120].map(tgtRatio)), [0, 0.5, 0.5, 0.85, 1, 1.2]);
  });
  test('العشرة الأوائل: لازم الـ KPI والتارجت مع بعض', async () => {
    eq(await ev(() => [
      qualify({ monthScore: 90 }, { v: 130, need: 120 }).ok,
      qualify({ monthScore: 90 }, { v: 100, need: 120 }).ok,
      qualify({ monthScore: 70 }, { v: 130, need: 120 }).ok,
      qualify({ monthScore: 90 }, null).ok,
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
