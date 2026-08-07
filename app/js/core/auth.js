// ============================================================
// برق — نظام الدخول والصلاحيات الموحد
//
// يجمع أسلوبَي الدخول الموجودين فعليًا في الملفات الحالية:
//  - اسم مستخدم + كلمة سر (منقول حرفيًا من forou3.html: ADMIN_CREDENTIALS,
//    DEFAULT_USERS, hashPassword/_sha256, findUser) — لأدوار الفروع.
//  - دور + رقم سري 4 أرقام (منقول من tas3eer_v3_proto.html: ROLES) — لأدوار الإدارة.
//
// كل الأدوار اتجمعت هنا في سجل واحد (BARQ_ROLES) بخاصية إضافية "sections"
// بتحدد أقسام القائمة الجانبية المسموحة لكل دور. منطق الصلاحيات الداخلي
// لكل دور (role.can[] لأدوار الفروع) اتحفظ زي ما هو عشان الموديولات
// المنقولة تكمل تستخدمه من غير تعديل.
// ============================================================

var BARQ_AUTH = (function () {

  // ---------- سجل الأدوار الموحّد (superset) ----------
  var ROLES = {
    // أدوار الفروع — من forou3.html (اسم مستخدم + كلمة سر)
    admin:    { label: 'مدير عام',   icon: '👑', method: 'password', can: ['order','history','dashboard','manage_users','admin_panel','admin_settings','data_entry','production','freezer','factory_receive'], sections: ['orders','purchasing','pricing','receiving','finance','barcode','stocktake'] },
    manager:  { label: 'مدير فرع',   icon: '🏪', method: 'password', can: ['order','dashboard','production','freezer','factory_receive'], sections: ['orders'] },
    staff:    { label: 'موظف',       icon: '👤', method: 'password', can: ['data_entry','admin_panel','freezer','factory_receive'], sections: ['orders'] },

    // أدوار الإدارة — من tas3eer_v3_proto.html (كانت دور + رقم سري، دلوقتي
    // بقى ليها اسم مستخدم ظاهري عشان تدخل من نفس نموذج الدخول البسيط)
    receiving: { label: 'الاستلام',                    icon: '📦', method: 'pin', username: 'receiving', pass: '1111', sections: ['receiving','stocktake'] },
    pricing:   { label: 'مسؤول التسعير',                icon: '💰', method: 'pin', username: 'pricing',   pass: '2222', sections: ['pricing'] },
    finance:   { label: 'أمين الخزينة — أحمد صلاح',      icon: '🏦', method: 'pin', username: 'finance',   pass: '3333', sections: ['finance'] },
    finmgr:    { label: 'مدير المالية — عمر أبو الفضل',  icon: '📊', method: 'pin', username: 'finmgr',    pass: '4444', sections: ['finance'] },
    purchmgr:  { label: 'مدير قسم المشتريات',            icon: '📦', method: 'pin', username: 'purchmgr',  pass: '5555', sections: ['purchasing'] },
    ceo:       { label: 'رئيس مجلس الإدارة',             icon: '👔', method: 'pin', username: 'ceo',       pass: '9999', sections: ['orders','purchasing','pricing','receiving','finance','barcode','stocktake'] }
  };

  var SESSION_KEY = 'barq_unified_session';

  // ---------- أسلوب الدخول بالاسم وكلمة السر (منقول من forou3.html) ----------
  var ADMIN_CREDENTIALS = { username: 'admin', passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branch: 'الإدارة', branchKey: 'admin', icon: '👑', role: 'admin', active: true };
  var DEFAULT_USERS = [
    { username: 'ainshams', passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branch: 'عين شمس', branchKey: 'فرع1', icon: '🏬', role: 'manager', active: true },
    { username: 'smalhy', passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', branch: 'السمليهي', branchKey: 'فرع2', icon: '🏪', role: 'manager', active: true }
  ];

  var usersDB = [];

  function loadUsersDB() {
    var saved = localStorage.getItem('barq_users_db');
    if (saved) {
      try { usersDB = JSON.parse(saved); } catch (e) { usersDB = DEFAULT_USERS.slice(); }
    } else {
      usersDB = DEFAULT_USERS.slice();
      localStorage.setItem('barq_users_db', JSON.stringify(usersDB));
    }
  }

  function findUser(username) {
    if (username === ADMIN_CREDENTIALS.username) return ADMIN_CREDENTIALS;
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

  // ---------- دخول باسم مستخدم وكلمة سر ----------
  function loginWithPassword(username, password) {
    loadUsersDB();
    var user = findUser(username);
    if (!user || !user.active) return { ok: false, error: 'اسم المستخدم غير صحيح' };
    if (hashPassword(password) !== user.passwordHash) return { ok: false, error: 'كلمة السر غير صحيحة' };
    var roleDef = ROLES[user.role];
    currentUser = {
      method: 'password',
      role: user.role,
      label: roleDef.label,
      icon: roleDef.icon,
      username: user.username,
      branch: user.branch
    };
    saveSession();
    return { ok: true, user: currentUser };
  }

  // ---------- دخول بدور + رقم سري (لسه موجودة داخليًا، مش مستخدمة من واجهة الدخول البسيطة) ----------
  function loginWithPin(roleKey, pin) {
    var roleDef = ROLES[roleKey];
    if (!roleDef || roleDef.method !== 'pin') return { ok: false, error: 'دور غير معروف' };
    if (roleDef.pass !== pin) return { ok: false, error: 'الرقم السري غير صحيح' };
    currentUser = {
      method: 'pin',
      role: roleKey,
      label: roleDef.label,
      icon: roleDef.icon
    };
    saveSession();
    return { ok: true, user: currentUser };
  }

  // ---------- دخول موحّد: اسم مستخدم + كلمة سر بس ----------
  // بيدوّر أول حاجة على أدوار الفروع (usersDB بكلمة سر مشفّرة)، ولو مالقاش
  // بيدوّر على أدوار الإدارة (username الظاهري + الرقم السري بتاعها كـ"كلمة سر").
  function login(username, password) {
    username = (username || '').trim();

    loadUsersDB();
    var user = findUser(username);
    if (user) {
      if (!user.active) return { ok: false, error: 'الحساب موقوف' };
      if (hashPassword(password) !== user.passwordHash) return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      var roleDef = ROLES[user.role];
      currentUser = {
        method: 'password',
        role: user.role,
        label: roleDef.label,
        icon: roleDef.icon,
        username: user.username,
        branch: user.branch
      };
      saveSession();
      return { ok: true, user: currentUser };
    }

    var pinRoleKey = Object.keys(ROLES).find(function (k) {
      return ROLES[k].method === 'pin' && ROLES[k].username && ROLES[k].username.toLowerCase() === username.toLowerCase();
    });
    if (pinRoleKey && ROLES[pinRoleKey].pass === password) {
      var pd = ROLES[pinRoleKey];
      currentUser = {
        method: 'pin',
        role: pinRoleKey,
        label: pd.label,
        icon: pd.icon,
        username: pd.username
      };
      saveSession();
      return { ok: true, user: currentUser };
    }

    return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  }

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

  function pinRoles() {
    return Object.keys(ROLES).filter(function (k) { return ROLES[k].method === 'pin'; }).map(function (k) {
      return Object.assign({ key: k }, ROLES[k]);
    });
  }

  return {
    ROLES: ROLES,
    getCurrentUser: function () { return currentUser; },
    restoreSession: restoreSession,
    login: login,
    loginWithPassword: loginWithPassword,
    loginWithPin: loginWithPin,
    logout: logout,
    can: can,
    allowedSections: allowedSections,
    pinRoles: pinRoles
  };
})();
