/* The driver's phone (26_driver_devices.sql): a random id kept in this browser,
   and a readable type — «Android – SM-A515F – Chrome», «iPhone – Safari».
   A website cannot know the phone number or its owner; Apple hides the iPhone model. */
const KEY = 'cc-device-id';

export function deviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch { return null; }   // storage blocked: nothing to compare
}

function browserName(ua) {
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/EdgA?\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/FxiOS|Firefox/i.test(ua)) return 'Firefox';
  if (/CriOS|Chrome/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua)) return 'Safari';
  return '';
}

export async function deviceLabel() {
  const ua = navigator.userAgent || '';
  let os = /iPhone/i.test(ua) ? 'iPhone' : /iPad/i.test(ua) ? 'iPad' : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'جهاز';
  let model = '';
  try {   // Android Chrome tells the model when asked
    const hi = await navigator.userAgentData?.getHighEntropyValues?.(['model']);
    model = (hi?.model || '').trim();
  } catch { /* not available */ }
  if (!model && os === 'Android') {
    const m = ua.match(/Android [\d.]+; ([^;)]+)[;)]/);
    if (m && m[1] && m[1].trim().length > 1 && !/^K$/i.test(m[1].trim())) model = m[1].replace(/ Build\/.*$/, '').trim();
  }
  return [os, model, browserName(ua)].filter(Boolean).join(' – ').slice(0, 120);
}
