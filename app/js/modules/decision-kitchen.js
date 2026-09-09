// ============================================================
// برق — موديول "مطبخ القرار" (جديد، مبني من "foodicsanalytics.html" اللي
// المستخدم رفعه، بس معاد ربطه ببيانات Supabase الحقيقية بدل مولّد البيانات
// التجريبي بتاعه الأصلي)
// المصدر: جدول menu_analysis — جدول جاهز في القاعدة بنفس أعمدة تحليل
// فوديكس (sales/quantity/total_cost/item_profit/profit_pct/popularity_pct/
// profit_category/popularity_category/class) وبيتحدّث من مزامنة خارجية.
// الموديول ده قراءة بس — مفيش أي تعديل على الجدول.
// ============================================================

var BARQ_KITCHEN = (function () {
  var ROWS = [];
  var lastUpdated = null;
  var search = '';
  var classFilter = 'all';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return (Math.round((parseFloat(n) || 0) * 100) / 100).toLocaleString('ar-EG') + ' ج.م'; }
  function fmt(n) { return (Math.round((parseFloat(n) || 0) * 100) / 100).toLocaleString('ar-EG'); }
  function pct(n) { return (n == null || isNaN(n)) ? '—' : (Math.round(parseFloat(n) * 10) / 10).toLocaleString('ar-EG') + '%'; }
  function mean(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; }

  // تصنيفات محتملة (عربي/إنجليزي) — أي قيمة تانية بتتعرض زي ما هي بشكل محايد
  var CLASS_MAP = {
    star: ['⭐ نجم', 'good'], plowhorse: ['🐎 حصان شغل', 'info'], puzzle: ['💡 فرصة', 'accent'], dog: ['⚠ ضعيف', 'bad'],
    horse: ['🐎 حصان شغل', 'info'], opp: ['💡 فرصة', 'accent'], weak: ['⚠ ضعيف', 'bad'],
    'نجم': ['⭐ نجم', 'good'], 'حصان عمل': ['🐎 حصان شغل', 'info'], 'حصان شغل': ['🐎 حصان شغل', 'info'],
    'لغز': ['💡 فرصة', 'accent'], 'فرصة': ['💡 فرصة', 'accent'], 'كلب': ['⚠ ضعيف', 'bad'], 'ضعيف': ['⚠ ضعيف', 'bad']
  };
  function classChip(cls) {
    if (!cls) return '<span class="chip chip-info">—</span>';
    var m = CLASS_MAP[String(cls).toLowerCase()] || CLASS_MAP[cls] || [esc(cls), 'info'];
    return '<span class="chip chip-' + m[1] + '">' + m[0] + '</span>';
  }
  var CAT_MAP = {
    high: ['مرتفع', 'good'], medium: ['متوسط', 'warn'], low: ['منخفض', 'bad'],
    'مرتفع': ['مرتفع', 'good'], 'متوسط': ['متوسط', 'warn'], 'منخفض': ['منخفض', 'bad'],
    'عالي': ['مرتفع', 'good']
  };
  function catChip(v) {
    if (!v) return '<span class="chip chip-info">—</span>';
    var m = CAT_MAP[String(v).toLowerCase()] || CAT_MAP[v] || [esc(v), 'info'];
    return '<span class="chip chip-' + m[1] + '">' + m[0] + '</span>';
  }

  function loadData() {
    var root = document.getElementById('mk-root');
    if (root) root.innerHTML = '<div class="mk-loading">⏳ جاري تحميل بيانات مطبخ القرار...</div>';
    return sb('menu_analysis?select=*').then(function (rows) {
      ROWS = rows || [];
      lastUpdated = ROWS.reduce(function (max, r) { return (r.updated_at && (!max || r.updated_at > max)) ? r.updated_at : max; }, null);
      renderShell();
    }).catch(function (e) {
      if (root) root.innerHTML = '<div class="mk-empty mk-error">⚠️ تعذر تحميل بيانات مطبخ القرار</div>';
      console.error(e);
    });
  }

  function distinctClasses() {
    var set = {};
    ROWS.forEach(function (r) { if (r.class) set[r.class] = true; });
    return Object.keys(set);
  }

  function filteredRows() {
    var rows = ROWS;
    if (search) rows = rows.filter(function (r) { return (r.product_name || '').indexOf(search) !== -1 || (r.sku || '').indexOf(search) !== -1; });
    if (classFilter !== 'all') rows = rows.filter(function (r) { return r.class === classFilter; });
    return rows;
  }

  function renderShell() {
    var root = document.getElementById('mk-root');
    if (!root) return;
    if (!ROWS.length) {
      root.innerHTML =
        '<div class="mk-header"><h2>🍳 مطبخ القرار</h2><p class="mk-sub">تحليل أداء الأصناف (مبيعات / ربحية / شعبية)</p></div>' +
        '<div class="mk-empty">لا توجد بيانات تحليل قوائم بعد — هتظهر هنا تلقائيًا فور رفع/مزامنة بيانات فوديكس في جدول menu_analysis.</div>';
      return;
    }
    var totalSales = ROWS.reduce(function (a, r) { return a + (parseFloat(r.sales) || 0); }, 0);
    var totalProfit = ROWS.reduce(function (a, r) { return a + (parseFloat(r.total_profit) || 0); }, 0);
    var avgMargin = mean(ROWS.map(function (r) { return parseFloat(r.profit_pct) || 0; }));
    var needsReview = ROWS.filter(function (r) {
      var pc = (r.profit_category || '').toLowerCase(), poc = (r.popularity_category || '').toLowerCase();
      return pc === 'low' || pc === 'منخفض' || poc === 'low' || poc === 'منخفض' || r.class === 'dog' || r.class === 'كلب';
    }).length;
    var kpis = [
      { l: 'إجمالي المبيعات', v: money(totalSales) },
      { l: 'إجمالي الأرباح', v: money(totalProfit) },
      { l: 'متوسط هامش الربح', v: pct(avgMargin) },
      { l: 'عدد الأصناف', v: fmt(ROWS.length) },
      { l: 'يحتاج مراجعة', v: fmt(needsReview) }
    ];
    var classes = distinctClasses();

    root.innerHTML =
      '<div class="mk-header"><h2>🍳 مطبخ القرار</h2>' +
      '<p class="mk-sub">تحليل أداء الأصناف (مبيعات / ربحية / شعبية)' + (lastUpdated ? ' — آخر تحديث: ' + new Date(lastUpdated).toLocaleString('ar-EG') : '') + '</p></div>' +
      '<div class="mk-kpis">' + kpis.map(function (k) { return '<div class="mk-kpi"><div class="lbl">' + k.l + '</div><div class="val">' + k.v + '</div></div>'; }).join('') + '</div>' +
      '<div class="mk-chart-wrap"><canvas id="mk-chart-top"></canvas></div>' +
      '<div class="mk-filters">' +
      '<input class="mk-input" id="mk-search" placeholder="🔍 بحث بالاسم أو SKU" value="' + esc(search) + '">' +
      '<select class="mk-select" id="mk-class-filter"><option value="all">كل التصنيفات</option>' + classes.map(function (c) { return '<option value="' + esc(c) + '"' + (c === classFilter ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<div id="mk-table-wrap"></div>' +
      '<div class="mk-modal-overlay" id="mk-overlay"><div class="mk-modal" id="mk-modal-content"></div></div>';

    document.getElementById('mk-search').addEventListener('input', function (e) { search = e.target.value.trim(); renderTable(); });
    document.getElementById('mk-class-filter').addEventListener('change', function (e) { classFilter = e.target.value; renderTable(); });
    document.getElementById('mk-overlay').addEventListener('click', function (e) { if (e.target.id === 'mk-overlay') e.currentTarget.classList.remove('open'); });

    renderTable();
    renderChart();
  }

  var sortKey = 'sales', sortDir = -1;
  var COLS = [
    { key: 'product_name', label: 'الصنف' },
    { key: 'quantity', label: 'الكمية', num: true },
    { key: 'sales', label: 'المبيعات', num: true },
    { key: 'total_cost', label: 'التكلفة', num: true },
    { key: 'item_profit', label: 'ربح الوحدة', num: true },
    { key: 'total_profit', label: 'إجمالي الربح', num: true },
    { key: 'profit_pct', label: 'الهامش %', num: true },
    { key: 'popularity_category', label: 'الشعبية' },
    { key: 'profit_category', label: 'الربحية' },
    { key: 'class', label: 'التصنيف' }
  ];

  function renderTable() {
    var wrap = document.getElementById('mk-table-wrap');
    if (!wrap) return;
    var rows = filteredRows().slice();
    rows.sort(function (a, b) {
      var va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string' || typeof vb === 'string') return sortDir * String(va || '').localeCompare(String(vb || ''), 'ar');
      return sortDir * ((parseFloat(va) || 0) - (parseFloat(vb) || 0));
    });
    var thead = '<tr>' + COLS.map(function (c) {
      return '<th class="' + (c.num ? 'num-col' : '') + '" data-k="' + c.key + '">' + c.label + (c.key === sortKey ? (sortDir === 1 ? ' ▲' : ' ▼') : '') + '</th>';
    }).join('') + '</tr>';
    var tbody = rows.map(function (r) {
      return '<tr class="mk-row" data-sku="' + esc(r.sku) + '">' +
        '<td><div class="mk-name">' + esc(r.product_name) + '</div><div class="mk-sku">' + esc(r.sku) + '</div></td>' +
        '<td class="num-col num">' + fmt(r.quantity) + '</td>' +
        '<td class="num-col num">' + money(r.sales) + '</td>' +
        '<td class="num-col num">' + money(r.total_cost) + '</td>' +
        '<td class="num-col num">' + money(r.item_profit) + '</td>' +
        '<td class="num-col num">' + money(r.total_profit) + '</td>' +
        '<td class="num-col num">' + pct(r.profit_pct) + '</td>' +
        '<td>' + catChip(r.popularity_category) + '</td>' +
        '<td>' + catChip(r.profit_category) + '</td>' +
        '<td>' + classChip(r.class) + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="' + COLS.length + '" class="mk-empty-cell">لا توجد أصناف مطابقة</td></tr>';

    wrap.innerHTML = '<table class="mk-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
    wrap.querySelectorAll('th[data-k]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = -1; }
        renderTable();
      });
    });
    wrap.querySelectorAll('.mk-row').forEach(function (tr) {
      tr.addEventListener('click', function () { openItemModal(tr.getAttribute('data-sku')); });
    });
  }

  function renderChart() {
    if (typeof Chart === 'undefined') return;
    var top = ROWS.slice().sort(function (a, b) { return (parseFloat(b.sales) || 0) - (parseFloat(a.sales) || 0); }).slice(0, 10);
    var canvas = document.getElementById('mk-chart-top');
    if (!canvas) return;
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: top.map(function (r) { return r.product_name; }), datasets: [{ label: 'المبيعات', data: top.map(function (r) { return parseFloat(r.sales) || 0; }), backgroundColor: '#12c77a', borderRadius: 5 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: function (v) { return fmt(v); } } } } }
    });
  }

  function openItemModal(sku) {
    var r = ROWS.find(function (x) { return x.sku === sku; });
    if (!r) return;
    var verdict;
    var pc = (r.profit_category || '').toLowerCase(), poc = (r.popularity_category || '').toLowerCase();
    if ((pc === 'low' || pc === 'منخفض') && (poc === 'high' || poc === 'مرتفع' || poc === 'عالي')) {
      verdict = 'الصنف شعبي (مبيعات عالية) لكن هامش ربحه منخفض — يُنصح بمراجعة سعر البيع أو تكلفة المكونات.';
    } else if ((pc === 'high' || pc === 'مرتفع') && (poc === 'low' || poc === 'منخفض')) {
      verdict = 'الصنف يحقق هامش ربح جيد لكن مبيعاته منخفضة — فرصة جيدة للترويج له وإبرازه في القائمة.';
    } else if (r.class === 'dog' || r.class === 'كلب' || ((pc === 'low' || pc === 'منخفض') && (poc === 'low' || poc === 'منخفض'))) {
      verdict = 'الصنف ضعيف في المبيعات والربحية معًا — يُنصح بمراجعة استمراره ضمن القائمة.';
    } else if (r.class === 'star' || r.class === 'نجم' || ((pc === 'high' || pc === 'مرتفع') && (poc === 'high' || poc === 'مرتفع' || poc === 'عالي'))) {
      verdict = 'صنف "نجم" — مبيعات مرتفعة وهامش ربح جيد. يُنصح بضمان توافره الدائم والتركيز عليه في الترويج.';
    } else {
      verdict = 'أداء الصنف ضمن المتوسط العام حاليًا — يُنصح بالمتابعة الدورية.';
    }
    document.getElementById('mk-modal-content').innerHTML =
      '<div class="mk-im-head"><button class="mk-close" id="mk-modal-close">✕</button>' +
      '<h3>' + esc(r.product_name) + '</h3><div class="mk-im-meta">SKU: ' + esc(r.sku) + '</div></div>' +
      '<div class="mk-im-grid">' +
      '<div class="mk-im-row"><span>الكمية المباعة</span><b>' + fmt(r.quantity) + '</b></div>' +
      '<div class="mk-im-row"><span>المبيعات</span><b>' + money(r.sales) + '</b></div>' +
      '<div class="mk-im-row"><span>التكلفة الإجمالية</span><b>' + money(r.total_cost) + '</b></div>' +
      '<div class="mk-im-row"><span>ربح الوحدة</span><b>' + money(r.item_profit) + '</b></div>' +
      '<div class="mk-im-row"><span>إجمالي الربح</span><b>' + money(r.total_profit) + '</b></div>' +
      '<div class="mk-im-row"><span>هامش الربح</span><b>' + pct(r.profit_pct) + '</b></div>' +
      '<div class="mk-im-row"><span>نسبة الشعبية</span><b>' + pct(r.popularity_pct) + '</b></div>' +
      '<div class="mk-im-row"><span>تصنيف الشعبية</span>' + catChip(r.popularity_category) + '</div>' +
      '<div class="mk-im-row"><span>تصنيف الربحية</span>' + catChip(r.profit_category) + '</div>' +
      '<div class="mk-im-row"><span>الفئة</span>' + classChip(r.class) + '</div>' +
      '</div>' +
      '<div class="mk-im-note"><b>قرار النظام:</b> ' + verdict + '</div>';
    document.getElementById('mk-modal-close').addEventListener('click', function () { document.getElementById('mk-overlay').classList.remove('open'); });
    document.getElementById('mk-overlay').classList.add('open');
  }

  function mount(container) {
    search = ''; classFilter = 'all'; sortKey = 'sales'; sortDir = -1;
    container.innerHTML = '<div class="mk-mod"><div id="mk-root"></div></div>';
    loadData();
  }

  return { mount: mount };
})();

window.BARQ_MODULES = window.BARQ_MODULES || {};
window.BARQ_MODULES['decision-kitchen'] = { mount: BARQ_KITCHEN.mount };
