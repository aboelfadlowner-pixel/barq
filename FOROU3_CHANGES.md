# سجل تعديلات forou3.html — للمرجعية عند دمج النسخ

هذا الملف بيوثق كل تعديل اتعمل على `forou3.html` في الفرع `claude/github-branches-file-access-c2lnrh`،
عشان ينفع يتطبق يدويًا على أي نسخة تانية (زي البرنامج المجمّع اللي بيتعمل في محادثة تانية) من غير ما
حد يحتاج يعيد التحليل من الصفر. كل تعديل جديد هيتضاف هنا أول ما يحصل.

---

## 1. تصحيح فرق وزن الطبق/العلبة للأصناف اللي بالكيلو

**المشكلة**: فوديكس بيسجل "المباع" أعلى من الحقيقي للأصناف اللي بتتباع بالكيلو، لأن وزن الطبق/العلبة بينضاف
مع وزن المنتج وقت الوزن.

**التنفيذ**:
- ثابت `KG_TARE_DEDUCTION_G = 60` (جرام يُخصم لكل كيلو).
- دالة `applyTareCorrection(rawQty, sku)`: لو وحدة الصنف `'كيلو'`، ترجع `rawQty * (1 - 60/1000)`. غير كده ترجع الرقم زي ما هو.
- بتتطبق على أي رقم استهلاك محسوب قبل ما يتحط في أي معادلة اقتراح (الاستخدام الحالي: داخل `refreshLearnedAverages()`).

---

## 2. رفع الجرد اليومي (مستويات المخزون)

**الفكرة**: الموظف يرفع تقرير جرد يومي من فوديكس (CSV/Excel) قبل ما يعمل الطلبية، عشان النظام يعرف الرصيد الحالي.

**التخزين**: محلي بس (localStorage)، مفيش رفع على سيرفر لتقليل استهلاك سوبابيز — إلا الجزء الخاص بالتعلّم (بند 6 تحت).

**التنفيذ**:
- `let stockLevels = {}` (sku الأساسي → الكمية)، `let stockUpdatedAt = null`.
- `handleStockFileUpload(event)` → يقرأ CSV/XLSX (باستخدام SheetJS المحمّل من CDN لو XLSX).
- `parseStockRows(rows)` / `parseStockCSV(text)`: يدور على عمودين (SKU + كمية) بمرونة على أسماء متعددة محتملة
  (`STOCK_SKU_HEADERS`, `STOCK_QTY_HEADERS`)، ولو مالقاش يرجع `{error: [الأعمدة اللي لقاها]}` بدل ما يفشل بصمت.
- `applyStockRows(result)`: يحفظ في `stockLevels`، `saveStockToStorage()` (localStorage)، وبعد كده بيبعت نسخة
  لسوبابيز (بند 6) ويعيد حساب المتعلّم.
- `stockStorageKey()` → `barq_stock_${branchKey}` (مفتاح لكل فرع لوحده).

### الكروت الافتراضية (تعبئة/تتبيلة)
بعض الأصناف بتتقسم في واجهة الطلب لأكتر من "كارت" (تمن/ربع، تتبيلة معينة...) بس فوديكس بيسجل الجرد على
الـ SKU الحقيقي بس. `VIRTUAL_SKU_MAP` (موجود أصلاً في الكود من قبل) بيربط كل كارت افتراضي بالـ SKU الحقيقي
ونسبة (factor). `getRawOnHand(sku)` بيرجّع الرصيد الحقيقي مقسوم على الـ factor لو الكارت افتراضي.

---

## 3. تصحيح عجز فوديكس الدفتري (الرصيد السالب)

**المشكلة**: فوديكس بيحسب الرصيد بطرح "المباع" (المتضخم بسبب وزن الطبق) من المخزون، فالرصيد بيصفّي سالب
تدريجيًا حتى لو الصنف فعليًا خلص بالظبط (صفر) — العجز ده دفتري مش نقص حقيقي.

**التنفيذ**:
- `getRawOnHand(sku)`: الرقم الخام من الجرد المرفوع (ممكن يطلع سالب).
- `getDailyTareOffset(sku)`: تقدير تقريبي لقد إيه فوديكس هيخصم زيادة النهاردة = `getLearnedDailyAvg(sku) * (60/1000)` (للكيلو بس).
- `getOnHand(sku)`: = `getRawOnHand(sku) + getDailyTareOffset(sku)`، ومش بينزل تحت صفر (`Math.max(0, ...)`).
- في العرض: لو `getRawOnHand(sku) < 0` بيظهر تحذير "⚠️ عجز دفتري بفوديكس (...) — غالبًا فرق أطباق مش نقص حقيقي"
  جنب الرقم المصحح، عشان الموظف يشوف الاتنين.

---

## 4. أيام التغطية لكل قسم (مش رقم عام واحد)

**المشكلة الأولى**: رقم واحد بس لكل الأقسام، بينما أصناف زي المعلبات ممكن تتحمّل تغطية أطول (كل 3 أيام) عكس
الأصناف الطازة (يوم واحد).

**التنفيذ**:
- `let defaultCoverageDays` (رقم عام، محفوظ في `localStorage['barq_default_coverage_days']`).
- `let coverageDaysByDept = {}` (استثناءات لكل قسم بس، محفوظة في `localStorage['barq_coverage_days_by_dept']`).
- `hasDeptCoverageOverride(dept)`, `getCoverageDays(dept)` (يرجع الاستثناء لو موجود، غير كده الرقم العام).
- `setDefaultCoverageDays(v)`, `setCoverageDaysForDept(dept, v)` (لو القسم مالوش استثناء، تعديل الرقم بيعدل
  العام مش يعمل استثناء جديد — القسم ده بيتحدد بـ checkbox "رقم خاص بـ...").
- `toggleDeptCoverageOverride(dept, enabled, currentVal)`: تفعيل/إلغاء الاستثناء.

**باگ اتصلح**: تغيير التاب (`setTab()`) كان بيعمل `renderProductsOnly()` بس (تحديث جزئي للمنتجات)، من غير
ما يلمس شريط أيام التغطية — فكان فاضل عالق على آخر قسم كان مفتوح وقت آخر render كامل. الحل:
`coverageDaysWrapHTML(deptTab)` (دالة مشتركة تبني الـ HTML) + `updateCoverageDaysBar()` (بتحدّث الـ DOM
مباشرة بـ `document.getElementById('coverageDaysWrap').innerHTML = ...`)، بتتنادى من جوه `setTab()`.

---

## 5. عرض "المقترح" كمرجع بس — مش auto-fill

**المشكلة**: أول نسخة كانت بتكتب الكمية المقترحة تلقائي في خانة الطلب، وده كان بيلغبط لأن أصناف مش
مطلوبة كانت بتتحط في الطلبية تلقائي.

**التنفيذ الحالي**: `getSuggestedQty(sku)` بترجع رقم أو `null` (لو مفيش بيانات كفاية)، وبيظهر بس كنص
"🎯 المقترح: X" جنب "📦 الموجود: X" — الموظف هو اللي بيكتب الكمية في الخانة بإيده زي الأول تمامًا.
مفيش أي كتابة تلقائية في `quantities`.

**المعادلة**: `getSuggestedQty(sku) = max(0, dailyAvg * coverageDays - onHand)` حيث `dailyAvg` جاي من
نظام التعلّم (بند 6).

---

## 6. نظام التعلّم من الجرد + الطلبيات الحقيقية (بديل مرجع أبريل الثابت)

**كان فيه قبل كده**: `DAILY_SALES` — object ضخم مبني في الكود، بيانات مبيعات شهر أبريل ثابتة، بيتم
استخدامها كمرجع "متوسط استهلاك يومي" بغض النظر عن الشهر الحالي. **اتشال بالكامل.**

**البديل**: النظام بيتعلم من البيانات الحقيقية المتراكمة، وبيبوّبها حسب **يوم الأسبوع** (مش تاريخ ميلادي)
و**وجود عرض من عدمه** (بند 7).

### الفكرة الحسابية
كل يوم بيترفع فيه جرد، بيتحفظ Snapshot في سوبابيز. لما يتوفر يومين متتاليين (D و D+1)، بنحسب:
```
الاستهلاك الفعلي ليوم D = onHand(D) + الكمية_المطلوبة(D) − onHand(D+1)
```
(الافتراض: الجرد بيترفع كل يوم *قبل* الطلبية، والتوصيل بيوصل خلال نفس اليوم أو تاني يوم — الاتنين
بيشتغلوا صح مع المعادلة دي طالما الجرد بيترفع بانتظام من غير فجوات).

### جدول سوبابيز: `inventory_snapshots`
```sql
id uuid pk, snapshot_date date, branch text, data jsonb, created_at timestamptz
-- data = {"levels": {"sk-xxx": 12.5, ...}, "has_promo": true/false}
-- unique index على (snapshot_date, branch) لدعم upsert
```
(الجدول والعمود `branch` والـ unique index اتضافوا بمigration في المشروع؛ الجدول نفسه كان موجود فاضي من قبل).

**الكتابة**: `saveSnapshotToSupabase(dateStr, branch, levels, hasPromo)` — POST بـ
`?on_conflict=snapshot_date,branch` و`Prefer: resolution=merge-duplicates`. بتتنادى من جوه
`applyStockRows()` بعد كل رفع جرد، وكمان من `setTodayPromo()` لو الجرد كان اتحفظ أصلاً النهاردة (عشان
تحديث علم العرض من غير رفع تاني).

**القراءة/الحساب**: `refreshLearnedAverages()` (async):
1. بيجيب كل `inventory_snapshots` للفرع (مرتبة بالتاريخ) + كل `branch_order_items` مع `branch_orders`
   (join عن طريق PostgREST embedding: `branch_order_items?select=sku,quantity,branch_orders!inner(created_at,branch_name)&branch_orders.branch_name=eq.X`).
2. بيبني `ordersByDate[date][sku] = مجموع الكمية المطلوبة`.
3. بيمشي على كل زوج أيام متتاليين فعليًا (`diffDays === 1`، غير كده يتجاهل الزوج — أي فجوة في الرفع
   بتضيع نقطة بيانات نهائيًا)، ويحسب `rawConsumption` زي المعادلة فوق، يرفض أي رقم `<= 0`
   (يعني الرصيد زاد أو فضل زي ما هو — مش استهلاك حقيقي)، ويطبّق `applyTareCorrection`.
4. بيجمّع النتائج في `series[sku][weekday][promoKey] = [قيم مرتبة بالتاريخ]`.
5. لكل bucket: لو آخر قيمة مسجلة بعيدة عن متوسط الباقي بمقدار "عتبة الكشف التلقائي" (بند 8)، يستخدمها
   هي كأساس للاقتراح الجاي (تعديل خطوة واحدة قدام) بدل المتوسط العادي — ويعلّم `anomalyAdjusted: true`.
6. النتيجة بتتخزن في `learnedBuckets[sku][weekday][promoKey] = {value, anomalyAdjusted}` — **كل
   البوابات محفوظة مش بس بتاعة النهاردة**، عشان لو الموظف بدّل زرار العرض، الاقتراح يتغير فورًا من غير
   طلب شبكة تاني.

**القراءة السريعة (sync، بتتنادى وقت العرض)**:
```js
function getLearnedDailyAvg(sku) {
  const weekday = new Date().getDay();
  const promoKey = todayHasPromo ? 1 : 0;
  const bucket = learnedBuckets[sku]?.[weekday]?.[promoKey];
  return bucket ? bucket.value : null;
}
```
لو `null`، الاقتراح والتنبيه بيختفوا تمامًا (مفيش بيانات كفاية لسه) — مفيش fallback لرقم افتراضي.

**استخدامات `getLearnedDailyAvg`**: `getDailyTareOffset`, `getSuggestedQty`, `getQtyAlert` (تنبيه
"✓ مناسب/⬇ منخفض/⬆ مرتفع")، وتحليل "منتجات بيتباع ولم تُطلب" + "طلب زيادة/طلب ناقص" في `renderDashboardView`.

**التوقيت**: `refreshLearnedAverages()` بتتنادى بعد اللوجين، بعد استعادة الجلسة (مؤجلة بـ `setTimeout(...,0)`
عشان تستنى `SB_URL`/`SB_HEADERS` يتعرّفوا لأنهم متعرفين لاحقًا في الملف)، وبعد كل رفع جرد.

**تحذير أمانة مهم**: اتفحصت البيانات الحقيقية (~2.5 أسبوع بيانات لفرع السمليهي)، ولقينا إن أغلب الـ
buckets عندها نقطة بيانات واحدة أو اتنين بس — مش كفاية إحصائيًا. الدقة الحقيقية محتاجة شهر-شهرين رفع
يومي متواصل بدون فجوات. أي فجوة في رفع الجرد بتضيع يوم نهائيًا (مش بترجع).

---

## 7. علم "فيه عرض النهاردة؟"

**المشكلة**: عروض أسبوعية ثابتة (زي الخميس/الجمعة) بتزوّد المبيعات بشكل مصطنع، فلو اتخلطت مع الأيام
العادية في التعلّم، الاقتراح هيتضخم في الأيام العادية أو يتقلل في أيام العرض المنقولة.

**التنفيذ**:
- `let todayHasPromo = false` — بيتحفظ يوميًا لكل فرع: `localStorage['barq_promo_${branchKey}_${date}']`
  (`promoStorageKey()`, `loadTodayPromo()`, `setTodayPromo(checked)`).
- زرار (مش checkbox عادي — كان باهت جدًا وبان مختفي، اتحول لزرار ملوّن واضح): أحمر solid لو مفعّل،
  أبيض بحد أخضر واضح لو لأ (`onclick="setTodayPromo(...)"` في شريط الجرد).
- العلم بيتحفظ مع الـ snapshot (`data.has_promo`)، وبيتعلم بيه منفصل عن باقي الأيام (بند 6، خطوة 4).
- لو الموظف بدّل الزرار بعد ما الجرد اتحفظ أصلاً النهاردة، `setTodayPromo()` بتعيد حفظ الـ snapshot
  بنفس المستويات المحلية + العلم الجديد (من غير رفع ملف تاني).

---

## 8. كشف تلقائي محافظ للضغط غير المعتاد

**الفكرة**: حتى من غير ما حد يحدد "عرض"، لو صنف معين طلع استهلاكه أعلى بكتير من المعتاد ليه في يوم
معين، النظام يستخدم الرقم ده كأساس لتوقع نفس اليوم الأسبوع الجاي (تعديل خطوة واحدة قدام)، ويظهر تنبيه.

**العتبة (محافظة، مش نسبة مئوية)**:
```js
function isAnomalousDeviation(value, baseline, sku) {
  const info = getActiveSkuMap()[sku];
  const threshold = (info?.unit === 'كيلو') ? 2 : 6; // كيلوجرام أو وحدة/قطعة
  return Math.abs(value - baseline) >= threshold;
}
```
- **أصناف بالكيلو**: عتبة ٢ كيلو فرق عن باقي التاريخ.
- **أصناف بالوحدة/القطعة**: عتبة ٦-٧ وحدة (اتحدد ٦).

مفيش آلية منفصلة لـ"يوم مزدحم بشكل عام" (كل الأصناف) — بتظهر تلقائيًا من نفس الآلية لأن كل صنف بيتفحص
لوحده، فلو كل الأصناف اتزودت يوم معين، كل واحد فيهم هيتعلّم منفصل وهيتضخم توقعه لنفس اليوم الجاي.

**العرض**: `isSuggestionAnomalyAdjusted(sku)` — لو `true`، يظهر تنبيه "⚠️ ضغط غير معتاد في آخر [يوم بعرض/من
غير عرض] زي النهاردة — المقترح اتعدّل" جنب "🎯 المقترح".

---

## 9. إصلاح باگ حرج: `calcEggTotals` كانت بتتنادى ومش معرّفة

`renderEggSummary()` (شاشة ملخص البيض) كانت بتنادي `calcEggTotals()` اللي مكانتش موجودة في الكود خالص —
باگ قديم من قبل أي شغل في المحادثة دي. وبما إنها بتتنادى جوه template string بتاع `renderApp()` نفسه،
أي خطأ فيها كان بيوقف **الصفحة كلها** مش بس شاشة البيض، لأي حد يفتح تاب "بيض".

**الحل**: إضافة الدالة الناقصة:
```js
function calcEggTotals() {
  const byType = {};
  let grandTotal = 0;
  EGG_SKUS.forEach(sku => {
    const qty = parseFloat(quantities[sku]) || 0;
    if (qty <= 0) return;
    const cfg = EGG_CONFIG[sku];
    if (!cfg) return;
    const total = qty * cfg.count;
    byType[cfg.type] = (byType[cfg.type] || 0) + total;
    grandTotal += total;
  });
  return { byType, grandTotal };
}
```

---

## 10. مزامنة كتالوج المنتجات بين الأجهزة

**المشكلة**: إضافة/نقل منتج من شاشة الإدارة كانت بتتحفظ في `localStorage['custom_sku_map']` بس — يعني
جهاز الأدمن بس اللي بيشوفها. مفيش أي مزامنة مركزية.

**التنفيذ**:
- جدولين موجودين أصلاً في سوبابيز (مستخدمين من تطبيقات تانية عندك زي التسعير/المخزون):
  - `products_master (sku pk, name, cost, price, margin, ...)`
  - `sku_departments (sku pk, department, unit)` ← عمود `unit` اتضاف بmigration.
- `syncSkusToSupabase(skus)`: بتاخد array من الـ skus، وتعمل upsert بـ `on_conflict=sku` +
  `Prefer: resolution=merge-duplicates` على الجدولين — **بترسل بس `{sku, name}` لـ products_master**
  عشان متلمسش `cost`/`price`/`margin` اللي التسعير مسكها (اتأكد بالاختبار: تحديث `name` عن طريق
  upsert ما بيمسحش القيم التانية للصف).
- بتتنادى من كل نقاط تعديل الكتالوج المحلي: `addNewProduct()`, `confirmAddProduct()` (إضافة صنف
  واحد)، `applyUploadedData()` (استبدال كامل)، `applyUploadedDataMerge()` (دمج)،
  `moveSelectedToTabId()`, `moveSelectedToTab()` (نقل بين أقسام).
- **الحذف مش بيتزامن عمدًا** (`deleteSheet`, `deleteProductBySku`, `deleteProductBySku2`) — تطبيقات
  تانية ممكن لسه محتاجة الـ sku ده، فمسحه من قاعدة البيانات المشتركة خطر.

**القراءة**: `refreshRemoteSkuMap()` — بتجيب الجدولين كاملين، وبتضيف أي `sku` **مش موجود محليًا خالص**
لآخر صف في نفس القسم (`row = max_row_in_dept + 1`)، من غير ما تلمس أي sku موجود محليًا أصلاً (النسخة
المحلية دايمًا بتكسب لو فيه تعارض). بتتخزن في `let remoteSkuMap = {}`.

```js
function getActiveSkuMap() {
  const base = customSKUMap || SKU_MAP;
  if (!remoteSkuMap || Object.keys(remoteSkuMap).length === 0) return base;
  return Object.assign({}, remoteSkuMap, base); // المحلي بيكسب
}
```

بتتنادى بعد اللوجين وبعد استعادة الجلسة، زي `refreshLearnedAverages()`.

---

## ملاحظة عن حالة main
اتلقى إن فرع `main` فيه شغل تاني (آيس كريم/فريزر، إصلاح تكرار طلبيات، جرد افتتاحي...) اتعمل بالتوازي
مش من نفس الفرع ده، فيه ٩ commits لمست `forou3.html` نفسه. التعديلات في الملف ده **لسه ما اتدمجتش**
مع main لحد ما يتم التأكيد من صاحب الحساب على طريقة الدمج.
