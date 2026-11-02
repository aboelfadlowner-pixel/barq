/**
 * أبو الفضل — نسخة احتياطية يومية من داتا الكول سنتر على Google Drive
 * (Google Apps Script — بيشتغل على حساب جوجل بتاعك، كل يوم لوحده)
 *
 * كل يوم: بيجيب نسخة كاملة من الداتا (نفس «تنزيل نسخة احتياطية») ويحفظها كـ Google Sheet
 * في فولدر «نسخ الكول سنتر» على Drive بتاعك — شيت لكل نوع داتا. بيفضّل آخر 60 نسخة؛
 * الأقدم بيروح سلة المهملات (بتفضل فيها 30 يوم كمان).
 *
 * الإعداد (مرة واحدة):
 *  1) Project Settings ← Script Properties ← Add property:
 *       Property: CC_BACKUP_SECRET   Value: نفس كلمة السر اللي اتحطت في Supabase
 *  2) شغّلي الدالة backupToDrive مرة بإيدك (Run) ووافقي على الصلاحيات.
 *  3) شغّلي الدالة setupDailyTrigger مرة بإيدك — بتظبط تشغيل backupToDrive كل يوم 5 الصبح (القاهرة).
 *     (أو: Triggers ← Add Trigger ← backupToDrive ← Time-driven ← Day timer ← 5am to 6am)
 */
const CC_URL = 'https://ojvbydnvywbsgyhqftap.supabase.co/functions/v1/cc-daily';
const FOLDER_NAME = 'نسخ الكول سنتر';
const KEEP = 60;
const SHEETS = [
  ['orders', 'الطلبات'], ['order_items', 'أصناف الطلبات'], ['order_events', 'سجل الحالات'],
  ['customers', 'العملاء'], ['addresses', 'العناوين'], ['areas', 'المناطق'], ['agents', 'أسماء الموظفين'],
  ['staff', 'الحسابات'], ['blocked_phones', 'المحظورين'], ['deliveries', 'التوصيل'],
];

function backupToDrive() {
  const secret = PropertiesService.getScriptProperties().getProperty('CC_BACKUP_SECRET');
  if (!secret) throw new Error('حطي CC_BACKUP_SECRET في Script Properties الأول');
  const res = UrlFetchApp.fetch(CC_URL, { method: 'get', headers: { 'x-cc-backup': secret }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('النسخة ما اتجابتش: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  const data = JSON.parse(res.getContentText());

  const folder = getFolder_();
  const day = Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy-MM-dd');
  const ss = SpreadsheetApp.create('نسخة الكول سنتر ' + day);
  SHEETS.forEach(([key, title], i) => {
    const rows = data[key] || [];
    const sh = i === 0 ? ss.getSheets()[0].setName(title) : ss.insertSheet(title);
    if (!rows.length) { sh.getRange(1, 1).setValue('مفيش داتا'); return; }
    const cols = Object.keys(rows[0]);
    const values = [cols].concat(rows.map((r) => cols.map((c) => {
      const v = r[c];
      return v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
    })));
    sh.getRange(1, 1, values.length, cols.length).setValues(values);
    sh.setFrozenRows(1);
  });
  DriveApp.getFileById(ss.getId()).moveTo(folder);

  // keep the last KEEP copies
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  files.slice(KEEP).forEach((f) => f.setTrashed(true));
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'backupToDrive')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupToDrive')
    .timeBased().everyDays(1).atHour(5).inTimezone('Africa/Cairo')
    .create();
}
