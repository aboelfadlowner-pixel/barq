// ============================================================
// برق — عميل Supabase المشترك
// نفس SB_URL / SB_KEY الموجودين حرفيًا في الملفات الحالية
// (forou3.html, makhzoun_v2.html, tas3eer_v3_proto.html,
//  istilam-w-gerd.html, masna3.html, masna3-dept.html)
// ما بيتغيرش اسم جدول ولا عمود ولا قيمة status هنا أبدًا —
// الموديولات المنقولة تستخدم sb() بنفس شكل الاستعلامات القديمة.
// ============================================================

var SB_URL = 'https://ojvbydnvywbsgyhqftap.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdmJ5ZG52eXdic2d5aHFmdGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzODQyMDcsImV4cCI6MjA5Njk2MDIwN30.3UyyKGcmehGVxadPotOgwYF6CmDbkdb8gw7BFxlYFcU';
var SB_HEADERS = {
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

/**
 * sb(path, options) — نداء REST مباشر لنفس مشروع Supabase المستخدم في الملفات الحالية.
 * path: مثال 'branch_orders?select=*&status=eq.pending'
 * options: نفس معايير fetch (method, body, headers إضافية)
 */
function sb(path, options) {
  options = options || {};
  var headers = Object.assign({}, SB_HEADERS, options.headers || {});
  return fetch(SB_URL + '/rest/v1/' + path, Object.assign({}, options, { headers: headers }))
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('Supabase error ' + res.status + ': ' + t);
        });
      }
      var ct = res.headers.get('content-type') || '';
      return ct.indexOf('application/json') !== -1 ? res.json() : res.text();
    });
}

// دالة مساعدة لاستدعاء RPC / Edge Functions بنفس الهيدرز
function sbFunction(fnPath, options) {
  options = options || {};
  var headers = Object.assign({}, SB_HEADERS, options.headers || {});
  return fetch(SB_URL + '/functions/v1/' + fnPath, Object.assign({}, options, { headers: headers }))
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('Supabase function error ' + res.status + ': ' + t);
        });
      }
      var ct = res.headers.get('content-type') || '';
      return ct.indexOf('application/json') !== -1 ? res.json() : res.text();
    });
}
