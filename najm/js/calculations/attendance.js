// نجم أبو الفضل — البصمة: نجوم الحضور وتحويل وقت البصمة لحالة
// stars for the attendance state (settings: on 2 · late 1.2 · very late 0.4 · absent 0); day off = not counted
const attStar=st=>st==null||st==='off'?null:(S.settings.att[st]??0);
const toMin=t=>{const m=String(t).match(/(\d{1,2}):(\d{2})/);if(!m)return null;let h=+m[1];if(/pm|م/i.test(t)&&h<12)h+=12;if(/am|ص/i.test(t)&&h===12)h=0;return h*60+ +m[2];};
// check-in time → on / late / very late, from the shift start and the grace minutes in settings
// من ميعاد الوردية الحقيقي في اليوم ده (شيت الحضور الشهري) — الوردية اللي بعد نص الليل بتتحسب صح
function attFromShift(shiftT,inT){const a=toMin(shiftT),b=toMin(inT);if(a==null||b==null)return null;let d=b-a;if(d<-720)d+=1440;if(d>720)d-=1440;return d<=S.settings.graceMin?'on':d<=S.settings.lateMax?'late':'vlate';}
function attFromTime(e,tm){const diff=toMin(tm)-toMin(S.settings.shiftStart[e.shift]||'09:00');return diff<=S.settings.graceMin?'on':diff<=S.settings.lateMax?'late':'vlate';}
