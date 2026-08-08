// ============================================================
// برق — نظام الدخول والصلاحيات الموحد
//
// كل المستخدمين (فروع + إدارة) بقوا في قائمة وصول واحدة قابلة للتعديل
// (usersDB، محفوظة في localStorage['barq_unified_users_db']) — كل مستخدم عنده
// اسم مستخدم + كلمة سر مشفّرة + دور. الدور نفسه (ROLES) هو اللي بيحدد
// الصلاحيات وأقسام القائمة الجانبية (sections) ومنطق can[] الداخلي.
// دخول واحد بس: اسم مستخدم + كلمة سر، والدور المرتبط بالحساب هو اللي
// بيستدعي الصلاحيات تلقائيًا. الإدارة (admin/ceo) تقدر تضيف/تعدّل/تمسح
// مستخدمين من شاشة "المستخدمين والصلاحيات".
// ============================================================

var BARQ_AUTH = (function () {

  // ---------- سجل الأدوار (الصلاحيات وأقسام القائمة الجانبية بس، من غير أي بيانات دخول) ----------
  var ROLES = {
    admin:    { label: 'مدير عام',   icon: '👑', method: 'password', can: ['order','history','dashboard','manage_users','admin_panel','admin_settings','data_entry','production','freezer','factory_receive'], sections: ['orders','purchasing','pricing','receiving','finance','barcode','stocktake','access-list'] },
    manager:  { label: 'مدير فرع',   icon: '🏪', method: 'password', can: ['order','dashboard','production','freezer','factory_receive'], sections: ['orders'] },
    staff:    { label: 'موظف',       icon: '👤', method: 'password', can: ['data_entry','admin_panel','freezer','factory_receive'], sections: ['orders'] },
    receiving: { label: 'الاستلام',                    icon: '📦', method: 'pin', sections: ['receiving','stocktake'] },
    pricing:   { label: 'مسؤول التسعير',                icon: '💰', method: 'pin', sections: ['pricing'] },
    finance:   { label: 'أمين الخزينة',                 icon: '🏦', method: 'pin', sections: ['finance'] },
    finmgr:    { label: 'مدير المالية',                 icon: '📊', method: 'pin', sections: ['finance'] },
    purchmgr:  { label: 'مدير قسم المشتريات',            icon: '📦', method: 'pin', sections: ['purchasing'] },
    ceo:       { label: 'رئيس مجلس الإدارة',             icon: '👔', method: 'pin', sections: ['orders','purchasing','pricing','receiving','finance','barcode','stocktake','access-list'] },
    deptprep:  { label: 'تحضير الأقسام',                 icon: '🏭', method: 'pin', sections: ['dept-prep'] }
  };

  var SESSION_KEY = 'barq_unified_session';

  // ---------- قائمة المستخدمين (اسم مستخدم + كلمة سر مشفّرة + دور) ----------
  // كلمات السر الافتراضية هنا هي نفسها القديمة (كانت أرقام PIN لأدوار
  // الإدارة، وكلمة سر الفروع الأصلية) — مشفّرة بنفس دالة hashPassword
  // عشان تفضل شغالة زي ما هي أول تشغيل، وبعد كده تتغيّر من شاشة الصلاحيات.
  var DEFAULT_USERS = [
    { username: 'admin',     passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', role: 'admin',    branch: 'الإدارة',    branchKey: 'admin', icon: '👑', active: true },
    { username: 'ainshams',  passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', role: 'manager',  branch: 'عين شمس',    branchKey: 'فرع1',  icon: '🏬', active: true },
    { username: 'smalhy',    passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', role: 'manager',  branch: 'السمليهي',  branchKey: 'فرع2',  icon: '🏪', active: true },
    { username: 'receiving', passwordHash: '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', role: 'receiving', active: true },
    { username: 'pricing',   passwordHash: 'edee29f882543b956620b26d0ee0e7e950399b1c4222f5de05e06425b4c995e9', role: 'pricing',   active: true },
    { username: 'finance',   passwordHash: '318aee3fed8c9d040d35a7fc1fa776fb31303833aa2de885354ddf3d44d8fb69', role: 'finance',   active: true, label: 'أمين الخزينة — أحمد صلاح' },
    { username: 'finmgr',    passwordHash: '79f06f8fde333461739f220090a23cb2a79f6d714bee100d0e4b4af249294619', role: 'finmgr',    active: true, label: 'مدير المالية — عمر أبو الفضل' },
    { username: 'purchmgr',  passwordHash: 'c1f330d0aff31c1c87403f1e4347bcc21aff7c179908723535f2b31723702525', role: 'purchmgr',  active: true },
    { username: 'ceo',       passwordHash: '888df25ae35772424a560c7152a1de794440e0ea5cfee62828333a456a506e05', role: 'ceo',       active: true },
    { username: 'deptprep',  passwordHash: 'b698d86c67a2cff80405bd47af322216c552fd3a52f9c58a70f7b3a3313895b1', role: 'deptprep',  active: true }
  ];

  var usersDB = [];
  var usersLoaded = false;

  function loadUsersDB() {
    if (usersLoaded) return;
    var saved = localStorage.getItem('barq_unified_users_db');
    if (saved) {
      try { usersDB = JSON.parse(saved); } catch (e) { usersDB = DEFAULT_USERS.slice(); }
    } else {
      usersDB = DEFAULT_USERS.slice();
      localStorage.setItem('barq_unified_users_db', JSON.stringify(usersDB));
    }
    usersLoaded = true;
  }

  function saveUsersDB() {
    localStorage.setItem('barq_unified_users_db', JSON.stringify(usersDB));
  }

  function findUser(username) {
    loadUsersDB();
    return usersDB.find(function (u) { return u.username === username; });
  }

  // SHA-256 محلي — نسخة طبق الأصل من forou3.html (hashPassword/_sha256)
  function _sha256(ascii) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var result = '';
    var words = [];
    var asciiBitLength = ascii.length * 8;
    var hash = _sha256.h = _sha256.h || [];
    var k = _sha256.k = _sha256.k || [];
    var primeCounter = k.length;
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (var i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (var i = 0; i < ascii.length; i++) {
      var j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength);
    for (var j2 = 0; j2 < words.length;) {
      var w = words.slice(j2, j2 += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (var i2 = 0; i2 < 64; i2++) {
        var w15 = w[i2 - 15], w2 = w[i2 - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i2]
          + (w[i2] = (i2 < 16) ? w[i2] : (
            w[i2 - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i2 - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0
          );
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (var i3 = 0; i3 < 8; i3++) {
        hash[i3] = (hash[i3] + oldHash[i3]) | 0;
      }
    }
    for (var i4 = 0; i4 < 8; i4++) {
      for (var j3 = 3; j3 + 1; j3--) {
        var b = (hash[i4] >> (j3 * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  function hashPassword(str) {
    if (typeof sha256 === 'function') {
      try { return sha256(str); } catch (e) {}
    }
    return _sha256(str);
  }

  // ---------- الحالة والجلسة ----------
  var currentUser = null; // { role, label, icon, username?, branch? }

  function saveSession() {
    if (!currentUser) { localStorage.removeItem(SESSION_KEY); return; }
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  }

  function restoreSession() {
    try {
      var saved = localStorage.getItem(SESSION_KEY);
      if (!saved) return null;
      var sess = JSON.parse(saved);
      if (sess && sess.role && ROLES[sess.role]) {
        currentUser = sess;
        return currentUser;
      }
    } catch (e) {}
    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  // ---------- دخول موحّد: اسم مستخدم + كلمة سر بس ----------
  // اليوزر والباسورد بيحددوا الحساب في usersDB، والدور المرتبط بيه (role)
  // هو اللي بيستدعي الصلاحيات وأقسام القائمة الجانبية تلقائيًا.
  function login(username, password) {
    username = (username || '').trim();
    var user = findUser(username);
    if (!user) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    if (!user.active) return { ok: false, error: 'الحساب موقوف — تواصل مع مدير النظام' };
    if (hashPassword(password) !== user.passwordHash) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    var roleDef = ROLES[user.role];
    if (!roleDef) return { ok: false, error: 'الدور المرتبط بالحساب غير معروف' };
    currentUser = {
      method: roleDef.method,
      role: user.role,
      label: user.label || roleDef.label,
      icon: user.icon || roleDef.icon,
      username: user.username,
      branch: user.branch
    };
    saveSession();
    return { ok: true, user: currentUser };
  }

  // للتوافق مع أي كود قديم بيستدعيها بالاسم ده
  function loginWithPassword(username, password) { return login(username, password); }

  function logout() {
    currentUser = null;
    saveSession();
  }

  function can(action) {
    if (!currentUser) return false;
    var roleDef = ROLES[currentUser.role];
    return !!(roleDef && roleDef.can && roleDef.can.indexOf(action) !== -1);
  }

  function allowedSections() {
    if (!currentUser) return [];
    var roleDef = ROLES[currentUser.role];
    return (roleDef && roleDef.sections) || [];
  }

  // ---------- إدارة المستخدمين (شاشة "المستخدمين والصلاحيات") ----------
  function listUsers() {
    loadUsersDB();
    return usersDB.map(function (u) {
      var copy = Object.assign({}, u);
      delete copy.passwordHash;
      return copy;
    });
  }

  function addUser(data) {
    loadUsersDB();
    var username = (data.username || '').trim();
    if (!username) return { ok: false, error: 'اسم المستخدم مطلوب' };
    if (!ROLES[data.role]) return { ok: false, error: 'دور غير معروف' };
    if (findUser(username)) return { ok: false, error: 'اسم المستخدم ده موجود بالفعل' };
    if (!data.password) return { ok: false, error: 'كلمة السر مطلوبة' };
    usersDB.push({
      username: username,
      passwordHash: hashPassword(data.password),
      role: data.role,
      label: data.label || null,
      active: true
    });
    saveUsersDB();
    return { ok: true };
  }

  function updateUser(username, changes) {
    loadUsersDB();
    var user = findUser(username);
    if (!user) return { ok: false, error: 'المستخدم مش موجود' };
    if (changes.role) {
      if (!ROLES[changes.role]) return { ok: false, error: 'دور غير معروف' };
      user.role = changes.role;
    }
    if (typeof changes.active === 'boolean') user.active = changes.active;
    if (changes.label !== undefined) user.label = changes.label || null;
    if (changes.password) user.passwordHash = hashPassword(changes.password);
    saveUsersDB();
    return { ok: true };
  }

  function deleteUser(username) {
    loadUsersDB();
    if (currentUser && currentUser.username === username) {
      return { ok: false, error: 'مينفعش تمسح الحساب اللي داخل بيه دلوقتي' };
    }
    var idx = usersDB.findIndex(function (u) { return u.username === username; });
    if (idx === -1) return { ok: false, error: 'المستخدم مش موجود' };
    usersDB.splice(idx, 1);
    saveUsersDB();
    return { ok: true };
  }

  function rolesList() {
    return Object.keys(ROLES).map(function (k) {
      return { key: k, label: ROLES[k].label, icon: ROLES[k].icon };
    });
  }

  return {
    ROLES: ROLES,
    getCurrentUser: function () { return currentUser; },
    restoreSession: restoreSession,
    login: login,
    loginWithPassword: loginWithPassword,
    logout: logout,
    can: can,
    allowedSections: allowedSections,
    listUsers: listUsers,
    addUser: addUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    rolesList: rolesList
  };
})();
