// ============================================================
// برق — القائمة الجانبية الموحدة + تركيب شاشة الدخول
// ============================================================

var BARQ_SECTIONS = [
  { key: 'orders',      label: 'الطلبيات',              icon: '🛒',
    subsections: [
      { key: 'orders-main',    label: 'الأصناف والطلبيات' },
      { key: 'orders-factory', label: 'المصنع' },
      { key: 'orders-dept',    label: 'تحضير الأقسام' }
    ] },
  { key: 'purchasing',  label: 'المشتريات والمخزون',   icon: '📦' },
  { key: 'pricing',     label: 'تسعير',                  icon: '💰' },
  { key: 'receiving',   label: 'استلامات',               icon: '📥' },
  { key: 'finance',     label: 'مالية',                  icon: '🏦' },
  { key: 'barcode',     label: 'باركود وطباعة',          icon: '🏷️' },
  { key: 'stocktake',   label: 'جرد',                    icon: '🔢' }
];

// سجل الموديولات — كل مرحلة قادمة بتسجل نفسها هنا: BARQ_MODULES['orders'] = { mount(container){...} }
var BARQ_MODULES = window.BARQ_MODULES || (window.BARQ_MODULES = {});

var BarqApp = (function () {
  var activeSection = null;
  var activeSub = null;

  function root() { return document.getElementById('barq-root'); }

  function render() {
    var user = BARQ_AUTH.getCurrentUser();
    if (!user) { renderAuth(); return; }
    renderShell(user);
  }

  // ---------------- شاشة الدخول (بسيطة: اسم مستخدم + كلمة سر بس) ----------------
  var authError = '';

  function renderAuth() {
    root().innerHTML =
      '<div class="auth-screen">' +
      '  <div class="auth-card">' +
      '    <div class="auth-logo">⚡</div>' +
      '    <h1>برق</h1>' +
      '    <p class="sub">سجّل دخولك للمتابعة</p>' +
      '    <form id="auth-form">' +
      '      <input class="auth-field" type="text" id="f-username" placeholder="اسم المستخدم" autocomplete="username" autofocus>' +
      '      <input class="auth-field" type="password" id="f-password" placeholder="كلمة المرور" autocomplete="current-password">' +
      '      <button type="submit" class="auth-btn">دخول</button>' +
      '    </form>' +
      (authError ? '<div class="auth-error">' + authError + '</div>' : '') +
      '  </div>' +
      '</div>';

    var form = document.getElementById('auth-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var u = document.getElementById('f-username').value.trim();
      var p = document.getElementById('f-password').value;
      var res = BARQ_AUTH.login(u, p);
      if (!res.ok) { authError = res.error; render(); return; }
      authError = '';
      render();
    });
  }

  // ---------------- هيكل التطبيق بعد الدخول ----------------
  function renderShell(user) {
    var allowed = BARQ_AUTH.allowedSections();
    if (!activeSection || allowed.indexOf(activeSection) === -1) {
      activeSection = allowed[0] || null;
      var initDef = BARQ_SECTIONS.find(function (s) { return s.key === activeSection; });
      activeSub = (initDef && initDef.subsections && initDef.subsections[0]) ? initDef.subsections[0].key : null;
    }

    var sectionsHtml = BARQ_SECTIONS.filter(function (s) {
      return allowed.indexOf(s.key) !== -1;
    }).map(function (s) {
      var isActive = activeSection === s.key;
      var hasSub = !!s.subsections;
      var subHtml = '';
      if (hasSub) {
        subHtml = '<div class="sidebar-subnav">' + s.subsections.map(function (sub) {
          return '<div class="sidebar-subitem ' + (isActive && activeSub === sub.key ? 'active' : '') + '" data-section="' + s.key + '" data-sub="' + sub.key + '">' + sub.label + '</div>';
        }).join('') + '</div>';
      }
      return '<div class="sidebar-section ' + (hasSub ? 'has-sub' : '') + ' ' + (isActive ? 'open active' : '') + '" data-section="' + s.key + '">' +
        '<span class="ic">' + s.icon + '</span><span>' + s.label + '</span>' +
        '</div>' + subHtml;
    }).join('');

    var currentSectionDef = BARQ_SECTIONS.find(function (s) { return s.key === activeSection; });

    root().innerHTML =
      '<div class="app-shell" id="app-shell">' +
      '  <aside class="sidebar" id="sidebar">' +
      '    <div class="sidebar-header"><span class="logo">⚡</span><span class="title">برق</span></div>' +
      '    <div class="sidebar-user"><span class="ic">' + user.icon + '</span><div class="info"><span class="name">' + (user.username || user.label) + '</span><span class="role">' + user.label + '</span></div></div>' +
      '    <nav class="sidebar-nav">' + sectionsHtml + '</nav>' +
      '    <div class="sidebar-footer"><button class="sidebar-logout" id="btn-logout">تسجيل الخروج</button></div>' +
      '  </aside>' +
      '  <div class="main-area">' +
      '    <div class="topbar">' +
      '      <button class="menu-toggle" id="btn-menu">☰</button>' +
      '      <div class="section-title">' + (currentSectionDef ? currentSectionDef.icon + ' ' + currentSectionDef.label : '') + '</div>' +
      '      <div></div>' +
      '    </div>' +
      '    <div class="content-area" id="content-area"></div>' +
      '  </div>' +
      '</div>';

    document.getElementById('btn-logout').addEventListener('click', function () {
      BARQ_AUTH.logout();
      activeSection = null; activeSub = null;
      render();
    });
    var menuBtn = document.getElementById('btn-menu');
    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('app-shell').classList.toggle('sidebar-open');
      });
    }

    root().querySelectorAll('.sidebar-section').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.sidebar-subitem')) return;
        activeSection = el.getAttribute('data-section');
        var secDef = BARQ_SECTIONS.find(function (s) { return s.key === activeSection; });
        activeSub = (secDef && secDef.subsections && secDef.subsections[0]) ? secDef.subsections[0].key : null;
        render();
        mountActiveContent();
      });
    });
    root().querySelectorAll('.sidebar-subitem').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        activeSection = el.getAttribute('data-section');
        activeSub = el.getAttribute('data-sub');
        render();
        mountActiveContent();
      });
    });

    mountActiveContent();
  }

  function mountActiveContent() {
    var container = document.getElementById('content-area');
    if (!container) return;
    if (!activeSection) {
      container.innerHTML = '<div class="placeholder-card"><div class="pic">🔒</div><h3>لا توجد أقسام متاحة لهذا الدور</h3></div>';
      return;
    }
    var key = activeSub || activeSection;
    var mod = BARQ_MODULES[key];
    if (mod && typeof mod.mount === 'function') {
      mod.mount(container, key);
      return;
    }
    var def = BARQ_SECTIONS.find(function (s) { return s.key === activeSection; });
    container.innerHTML = '<div class="placeholder-card"><div class="pic">' + (def ? def.icon : '⚡') + '</div><h3>' + (def ? def.label : '') + '</h3><p>هذا القسم قيد النقل من التطبيق القديم — قريبًا.</p></div>';
  }

  return { render: render };
})();
