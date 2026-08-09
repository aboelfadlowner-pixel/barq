// ============================================================
// برق — موديول "تقارير" (جديد بالكامل، مش منقول من أي ملف قديم)
// بيقرا من نفس جداول Supabase المستخدمة في باقي التطبيق (عبر sb()):
// branch_orders / branch_order_items (طلبيات الفروع)
// purchase_orders / purchase_order_items (المشتريات)
// branch_order_receipts (الفرق بين المطلوب والمستلم، من شاشة الاستلام)
// مفيش أي تعديل على الجداول دي — قراءة بس.
// ============================================================

var BARQ_REPORTS = (function () {
  var activeTab = 'branch';
  var branchNames = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtNum(n) {
    n = parseFloat(n) || 0;
    return (Math.round(n * 100) / 100).toLocaleString('ar-EG');
  }

  function todayStr() { return new Date().toISOString().split('T')[0]; }
  function daysAgoStr(n) {
    var d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  function downloadCSV(filename, headers, rows) {
    var csv = '﻿' + headers.join(',') + '\n';
    rows.forEach(function (row) {
      csv += row.map(function (v) {
        v = (v == null ? '' : String(v)).replace(/"/g, '""');
        return /[,\n"]/.test(v) ? '"' + v + '"' : v;
      }).join(',') + '\n';
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============ التبويبات ============
  var TABS = [
    { key: 'branch', label: '🏪 طلبيات الفروع' },
    { key: 'purchasing', label: '📦 المشتريات' },
    { key: 'shortage', label: '⚠️ النواقص (المطلوب مقابل المستلم)' },
    { key: 'topitems', label: '🔥 الأكثر طلبًا' }
  ];

  function renderShell() {
    var root = document.getElementById('rp-root');
    if (!root) return;
    var tabsHtml = TABS.map(function (t) {
      return '<button class="rp-tab ' + (activeTab === t.key ? 'active' : '') + '" onclick="BARQ_REPORTS.setTab(\'' + t.key + '\')">' + t.label + '</button>';
    }).join('');
    root.innerHTML =
      '<div class="rp-header"><h2>📊 تقارير</h2><p class="rp-sub">تقارير مبنية على نفس بيانات التطبيق الحية.</p></div>' +
      '<div class="rp-tabs">' + tabsHtml + '</div>' +
      '<div id="rp-body"></div>';
    renderTabBody();
  }

  function renderTabBody() {
    var body = document.getElementById('rp-body');
    if (!body) return;
    if (activeTab === 'branch') return renderBranchTab(body);
    if (activeTab === 'purchasing') return renderPurchasingTab(body);
    if (activeTab === 'shortage') return renderShortageTab(body);
    if (activeTab === 'topitems') return renderTopItemsTab(body);
  }

  function setTab(key) { activeTab = key; renderTabBody(); }

  function filtersBarHtml(opts) {
    // opts: { withBranch, fromId, toId, branchId, btnId, extra }
    return '' +
      '<div class="rp-filters">' +
      (opts.withBranch ? '<select class="rp-select" id="' + opts.branchId + '"><option value="">كل الفروع</option>' + branchNames.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('') + '</select>' : '') +
      '<label class="rp-flabel">من <input type="date" class="rp-input" id="' + opts.fromId + '" value="' + daysAgoStr(30) + '"></label>' +
      '<label class="rp-flabel">إلى <input type="date" class="rp-input" id="' + opts.toId + '" value="' + todayStr() + '"></label>' +
      '<button class="rp-btn rp-btn-primary" id="' + opts.btnId + '">📊 عرض التقرير</button>' +
      '</div>';
  }

  // ============ تقرير 1: طلبيات الفروع ============
  function renderBranchTab(body) {
    body.innerHTML =
      filtersBarHtml({ withBranch: true, fromId: 'rp-b-from', toId: 'rp-b-to', branchId: 'rp-b-branch', btnId: 'rp-b-go' }) +
      '<div id="rp-b-result" class="rp-result"></div>';
    document.getElementById('rp-b-go').addEventListener('click', loadBranchReport);
    if (!branchNames.length) loadBranchNames();
  }

  function loadBranchNames() {
    sb('branch_orders?select=branch_name').then(function (rows) {
      var set = {};
      (rows || []).forEach(function (r) { if (r.branch_name) set[r.branch_name] = true; });
      branchNames = Object.keys(set).sort();
      var sel = document.getElementById('rp-b-branch');
      if (sel) {
        sel.innerHTML = '<option value="">كل الفروع</option>' + branchNames.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');
      }
    }).catch(function (e) { console.error(e); });
  }

  function loadBranchReport() {
    var resultEl = document.getElementById('rp-b-result');
    var branch = document.getElementById('rp-b-branch').value;
    var from = document.getElementById('rp-b-from').value;
    var to = document.getElementById('rp-b-to').value;
    resultEl.innerHTML = '<div class="rp-loading">⏳ جاري التحميل...</div>';

    var path = 'branch_orders?select=id,branch_name,created_at&created_at=gte.' + from + '&created_at=lte.' + to + 'T23:59:59';
    if (branch) path += '&branch_name=eq.' + encodeURIComponent(branch);

    sb(path).then(function (orders) {
      if (!orders || !orders.length) { resultEl.innerHTML = '<div class="rp-empty">لا توجد طلبيات في هذه الفترة</div>'; return null; }
      var ids = orders.map(function (o) { return o.id; });
      return sb('branch_order_items?select=sku,product_name,quantity,unit,order_id&order_id=in.(' + ids.join(',') + ')').then(function (items) {
        var agg = {};
        (items || []).forEach(function (it) {
          var key = it.sku || it.product_name;
          if (!agg[key]) agg[key] = { name: it.product_name, sku: it.sku, unit: it.unit, qty: 0, orders: {} };
          agg[key].qty += parseFloat(it.quantity) || 0;
          agg[key].orders[it.order_id] = true;
        });
        var rows = Object.values(agg).sort(function (a, b) { return b.qty - a.qty; });
        renderBranchResult(resultEl, orders, rows, branch, from, to);
      });
    }).catch(function (e) {
      resultEl.innerHTML = '<div class="rp-empty rp-error">⚠️ تعذر تحميل التقرير</div>';
      console.error(e);
    });
  }

  function renderBranchResult(el, orders, rows, branch, from, to) {
    var tableRows = rows.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.sku) + '</td><td>' + fmtNum(r.qty) + ' ' + esc(r.unit || '') + '</td><td>' + Object.keys(r.orders).length + '</td></tr>';
    }).join('');
    el.innerHTML =
      '<div class="rp-summary">📦 ' + orders.length + ' طلبية' + (branch ? ' — ' + esc(branch) : ' — كل الفروع') + ' — من ' + from + ' إلى ' + to + '</div>' +
      '<button class="rp-btn" id="rp-b-export">📥 تصدير CSV</button>' +
      '<table class="rp-table"><thead><tr><th>الصنف</th><th>SKU</th><th>الكمية الإجمالية</th><th>عدد الطلبيات</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
    document.getElementById('rp-b-export').addEventListener('click', function () {
      downloadCSV('تقرير_طلبيات_' + (branch || 'كل_الفروع') + '_' + from + '_' + to + '.csv',
        ['الصنف', 'SKU', 'الكمية الإجمالية', 'الوحدة', 'عدد الطلبيات'],
        rows.map(function (r) { return [r.name, r.sku, fmtNum(r.qty), r.unit || '', Object.keys(r.orders).length]; }));
    });
  }

  // ============ تقرير 2: المشتريات ============
  function renderPurchasingTab(body) {
    body.innerHTML =
      filtersBarHtml({ withBranch: false, fromId: 'rp-p-from', toId: 'rp-p-to', btnId: 'rp-p-go' }) +
      '<div id="rp-p-result" class="rp-result"></div>';
    document.getElementById('rp-p-go').addEventListener('click', loadPurchasingReport);
  }

  function loadPurchasingReport() {
    var resultEl = document.getElementById('rp-p-result');
    var from = document.getElementById('rp-p-from').value;
    var to = document.getElementById('rp-p-to').value;
    resultEl.innerHTML = '<div class="rp-loading">⏳ جاري التحميل...</div>';

    var path = 'purchase_orders?select=id,po_number,supplier_name,created_at,status&created_at=gte.' + from + '&created_at=lte.' + to + 'T23:59:59';
    sb(path).then(function (pos) {
      if (!pos || !pos.length) { resultEl.innerHTML = '<div class="rp-empty">لا توجد أوامر شراء في هذه الفترة</div>'; return null; }
      var ids = pos.map(function (p) { return p.id; });
      return sb('purchase_order_items?select=po_id,sku,product_name,unit,qty_ordered,total_price&po_id=in.(' + ids.join(',') + ')').then(function (items) {
        var agg = {};
        (items || []).forEach(function (it) {
          var key = it.sku || it.product_name;
          if (!agg[key]) agg[key] = { name: it.product_name, sku: it.sku, unit: it.unit, qty: 0, total: 0 };
          agg[key].qty += parseFloat(it.qty_ordered) || 0;
          agg[key].total += parseFloat(it.total_price) || 0;
        });
        var rows = Object.values(agg).sort(function (a, b) { return b.total - a.total; });
        renderPurchasingResult(resultEl, pos, rows, from, to);
      });
    }).catch(function (e) {
      resultEl.innerHTML = '<div class="rp-empty rp-error">⚠️ تعذر تحميل التقرير</div>';
      console.error(e);
    });
  }

  function renderPurchasingResult(el, pos, rows, from, to) {
    var grandTotal = rows.reduce(function (s, r) { return s + r.total; }, 0);
    var tableRows = rows.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.sku) + '</td><td>' + fmtNum(r.qty) + ' ' + esc(r.unit || '') + '</td><td>' + fmtNum(r.total) + ' ج.م</td></tr>';
    }).join('');
    el.innerHTML =
      '<div class="rp-summary">🧾 ' + pos.length + ' أمر شراء — من ' + from + ' إلى ' + to + ' — الإجمالي: ' + fmtNum(grandTotal) + ' ج.م</div>' +
      '<button class="rp-btn" id="rp-p-export">📥 تصدير CSV</button>' +
      '<table class="rp-table"><thead><tr><th>الصنف</th><th>SKU</th><th>الكمية المشتراة</th><th>الإجمالي</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
    document.getElementById('rp-p-export').addEventListener('click', function () {
      downloadCSV('تقرير_المشتريات_' + from + '_' + to + '.csv',
        ['الصنف', 'SKU', 'الكمية المشتراة', 'الوحدة', 'الإجمالي'],
        rows.map(function (r) { return [r.name, r.sku, fmtNum(r.qty), r.unit || '', fmtNum(r.total)]; }));
    });
  }

  // ============ تقرير 3: النواقص (المطلوب مقابل المستلم) ============
  function renderShortageTab(body) {
    body.innerHTML =
      filtersBarHtml({ withBranch: true, fromId: 'rp-s-from', toId: 'rp-s-to', branchId: 'rp-s-branch', btnId: 'rp-s-go' }) +
      '<div id="rp-s-result" class="rp-result"></div>';
    document.getElementById('rp-s-go').addEventListener('click', loadShortageReport);
    if (!branchNames.length) loadBranchNamesInto('rp-s-branch'); else fillBranchSelect('rp-s-branch');
  }

  function loadBranchNamesInto(selectId) {
    sb('branch_orders?select=branch_name').then(function (rows) {
      var set = {};
      (rows || []).forEach(function (r) { if (r.branch_name) set[r.branch_name] = true; });
      branchNames = Object.keys(set).sort();
      fillBranchSelect(selectId);
    }).catch(function (e) { console.error(e); });
  }
  function fillBranchSelect(selectId) {
    var sel = document.getElementById(selectId);
    if (sel) sel.innerHTML = '<option value="">كل الفروع</option>' + branchNames.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');
  }

  function loadShortageReport() {
    var resultEl = document.getElementById('rp-s-result');
    var branch = document.getElementById('rp-s-branch').value;
    var from = document.getElementById('rp-s-from').value;
    var to = document.getElementById('rp-s-to').value;
    resultEl.innerHTML = '<div class="rp-loading">⏳ جاري التحميل...</div>';

    var path = 'branch_order_receipts?select=branch,sku,product_name,qty_ordered,qty_received,unit,created_at&created_at=gte.' + from + '&created_at=lte.' + to + 'T23:59:59';
    if (branch) path += '&branch=eq.' + encodeURIComponent(branch);

    sb(path).then(function (rows0) {
      if (!rows0 || !rows0.length) { resultEl.innerHTML = '<div class="rp-empty">لا توجد بيانات استلام في هذه الفترة</div>'; return; }
      var agg = {};
      rows0.forEach(function (r) {
        var key = (r.branch || '') + '|' + (r.sku || r.product_name);
        if (!agg[key]) agg[key] = { branch: r.branch, name: r.product_name, sku: r.sku, unit: r.unit, ordered: 0, received: 0 };
        agg[key].ordered += parseFloat(r.qty_ordered) || 0;
        agg[key].received += parseFloat(r.qty_received) || 0;
      });
      var rows = Object.values(agg).map(function (r) { r.diff = r.ordered - r.received; return r; })
        .filter(function (r) { return r.diff > 0.001; })
        .sort(function (a, b) { return b.diff - a.diff; });
      renderShortageResult(resultEl, rows, branch, from, to);
    }).catch(function (e) {
      resultEl.innerHTML = '<div class="rp-empty rp-error">⚠️ تعذر تحميل التقرير</div>';
      console.error(e);
    });
  }

  function renderShortageResult(el, rows, branch, from, to) {
    if (!rows.length) { el.innerHTML = '<div class="rp-empty">✅ مفيش نواقص مسجلة في الفترة دي — كل حاجة اتوصلت كاملة</div>'; return; }
    var tableRows = rows.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.sku) + '</td><td>' + esc(r.branch) + '</td><td>' + fmtNum(r.ordered) + '</td><td>' + fmtNum(r.received) + '</td><td class="rp-shortage">' + fmtNum(r.diff) + ' ' + esc(r.unit || '') + '</td></tr>';
    }).join('');
    el.innerHTML =
      '<div class="rp-summary">⚠️ ' + rows.length + ' صنف عليه نقص' + (branch ? ' — ' + esc(branch) : '') + ' — من ' + from + ' إلى ' + to + '</div>' +
      '<button class="rp-btn" id="rp-s-export">📥 تصدير CSV</button>' +
      '<table class="rp-table"><thead><tr><th>الصنف</th><th>SKU</th><th>الفرع</th><th>المطلوب</th><th>المستلم</th><th>النقص</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
    document.getElementById('rp-s-export').addEventListener('click', function () {
      downloadCSV('تقرير_النواقص_' + (branch || 'كل_الفروع') + '_' + from + '_' + to + '.csv',
        ['الصنف', 'SKU', 'الفرع', 'المطلوب', 'المستلم', 'النقص', 'الوحدة'],
        rows.map(function (r) { return [r.name, r.sku, r.branch, fmtNum(r.ordered), fmtNum(r.received), fmtNum(r.diff), r.unit || '']; }));
    });
  }

  // ============ تقرير 4: الأكثر طلبًا ============
  function renderTopItemsTab(body) {
    body.innerHTML =
      filtersBarHtml({ withBranch: false, fromId: 'rp-t-from', toId: 'rp-t-to', btnId: 'rp-t-go' }) +
      '<div class="rp-filters" style="margin-top:-6px">' +
      '  <label class="rp-flabel"><input type="radio" name="rp-t-sort" value="qty" checked> ترتيب بالكمية</label>' +
      '  <label class="rp-flabel"><input type="radio" name="rp-t-sort" value="count"> ترتيب بعدد مرات الطلب</label>' +
      '</div>' +
      '<div id="rp-t-result" class="rp-result"></div>';
    document.getElementById('rp-t-go').addEventListener('click', loadTopItemsReport);
  }

  function loadTopItemsReport() {
    var resultEl = document.getElementById('rp-t-result');
    var from = document.getElementById('rp-t-from').value;
    var to = document.getElementById('rp-t-to').value;
    var sortBy = document.querySelector('input[name="rp-t-sort"]:checked').value;
    resultEl.innerHTML = '<div class="rp-loading">⏳ جاري التحميل...</div>';

    var path = 'branch_orders?select=id,created_at&created_at=gte.' + from + '&created_at=lte.' + to + 'T23:59:59';
    sb(path).then(function (orders) {
      if (!orders || !orders.length) { resultEl.innerHTML = '<div class="rp-empty">لا توجد طلبيات في هذه الفترة</div>'; return null; }
      var ids = orders.map(function (o) { return o.id; });
      return sb('branch_order_items?select=sku,product_name,quantity,unit,order_id&order_id=in.(' + ids.join(',') + ')').then(function (items) {
        var agg = {};
        (items || []).forEach(function (it) {
          var key = it.sku || it.product_name;
          if (!agg[key]) agg[key] = { name: it.product_name, sku: it.sku, unit: it.unit, qty: 0, orders: {} };
          agg[key].qty += parseFloat(it.quantity) || 0;
          agg[key].orders[it.order_id] = true;
        });
        var rows = Object.values(agg).map(function (r) { r.count = Object.keys(r.orders).length; return r; });
        rows.sort(function (a, b) { return sortBy === 'count' ? b.count - a.count : b.qty - a.qty; });
        rows = rows.slice(0, 30);
        renderTopItemsResult(resultEl, rows, from, to, sortBy);
      });
    }).catch(function (e) {
      resultEl.innerHTML = '<div class="rp-empty rp-error">⚠️ تعذر تحميل التقرير</div>';
      console.error(e);
    });
  }

  function renderTopItemsResult(el, rows, from, to, sortBy) {
    var tableRows = rows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.sku) + '</td><td>' + fmtNum(r.qty) + ' ' + esc(r.unit || '') + '</td><td>' + r.count + '</td></tr>';
    }).join('');
    el.innerHTML =
      '<div class="rp-summary">🔥 أعلى ' + rows.length + ' صنف — من ' + from + ' إلى ' + to + ' (' + (sortBy === 'count' ? 'بعدد مرات الطلب' : 'بالكمية') + ')</div>' +
      '<button class="rp-btn" id="rp-t-export">📥 تصدير CSV</button>' +
      '<table class="rp-table"><thead><tr><th>#</th><th>الصنف</th><th>SKU</th><th>الكمية الإجمالية</th><th>عدد مرات الطلب</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
    document.getElementById('rp-t-export').addEventListener('click', function () {
      downloadCSV('تقرير_الأكثر_طلبًا_' + from + '_' + to + '.csv',
        ['الترتيب', 'الصنف', 'SKU', 'الكمية الإجمالية', 'الوحدة', 'عدد مرات الطلب'],
        rows.map(function (r, i) { return [i + 1, r.name, r.sku, fmtNum(r.qty), r.unit || '', r.count]; }));
    });
  }

  function mount(container) {
    activeTab = 'branch';
    branchNames = [];
    container.innerHTML = '<div class="rp-mod"><div id="rp-root"></div></div>';
    renderShell();
  }

  return { mount: mount, setTab: setTab };
})();

window.BARQ_MODULES = window.BARQ_MODULES || {};
window.BARQ_MODULES['reports'] = { mount: BARQ_REPORTS.mount };
