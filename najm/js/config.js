// نجم أبو الفضل — الإعدادات الثابتة: الفروع والشيفتات، بنود التقييم، الأدوار، الكروت، قوالب المؤشرات، Supabase، اللوجو
const BR = {B:'البيطاش الرئيسي', A:'عين شمس', F:'المصنع'};
const SH = {M:'Morning', N:'Night', W:'Between'};
// بنود تقييم المديرين (5، كل بند من 0 لـ 2): تنفيذ التعليمات وسرعتها · الوقت · التطور · الإيجابية · الصلاة
const CRITERIA = ['تنفيذ التعليمات وسرعة التنفيذ','المحافظة على الوقت','التطور','الإيجابية','الصلاة'];
const ATT = {on:'في ميعاده', late:'تأخير بسيط', vlate:'تأخير كبير', xlate:'تأخير فوق الحد', abs:'غياب', off:'إجازة'};   // فوق الحد = حاضر بس من غير نجوم بصمة
const ROLES = {ops:'مدير التشغيل', branch:'مدير الفرع', shift:'مدير الشيفت', fresh:'مدير الفريش فود', hygiene:'مسؤول الهايجين'};
const RATE_FIELD = {branch:'br', shift:'sh', fresh:'fr', ops:'ops', hygiene:'hy'};
// الهايجين = اللبس بس (النضافة جزء من مؤشرات الأقسام في التارجت). التيشرت إجباري على الكل، والباقي مسؤول الهايجين بيختار لو «مش مطلوب»
const HY_CRITERIA = ['التيشرت','الإيبرون','الكاسكيت','الأفرهيد (غطا الشعر)','الجلافز'];
const HY_NA = -1;   // البند مش مطلوب من الموظف ده
const critList=role=>role==='hygiene'?HY_CRITERIA:CRITERIA;
const CARD = {yellow:{t:'كارت أصفر',d:'كسر البريك / عدم الالتزام'}, red:{t:'كارت أحمر',d:'سلوك سيء مع زميل أو عميل'}, green:{t:'كارت أخضر',d:'إيجابية / مساعدة زميل / نقل لقسم تاني'}};
const KPI_KINDS = {score:'تقييم يومي من 10', count:'عدد (كل ما يزيد أحسن)', errors:'أخطاء (كل ما يقل أحسن)', mgr:'تقييم المدير المباشر (تلقائي من النجوم)'};
const PRESETS = {
  'الجروسري': [{name:'النضافة',kind:'score',target:9,weight:1},{name:'التفويل',kind:'score',target:9,weight:1}],
  'نضافة + تقييم المدير': [{name:'النضافة',kind:'score',target:9,weight:1},{name:'تقييم المدير المباشر',kind:'mgr',target:85,weight:1}],
  'المخزن':   [{name:'النضافة',kind:'score',target:9,weight:1},{name:'عدد التحويلات',kind:'count',target:300,weight:1},{name:'حالة المخزن',kind:'score',target:9,weight:1}],
  'الكاشير':  [{name:'أخطاء عدّت من الكاشير',kind:'errors',target:3,weight:1},{name:'أخطاء اكتشفها',kind:'count',target:20,weight:1},{name:'الابتسامة',kind:'score',target:9,weight:1},{name:'السرعة',kind:'score',target:9,weight:1},{name:'الدقة',kind:'score',target:9,weight:1},{name:'عدد المنسيات',kind:'errors',target:5,weight:1}],
};
const SB_URL='https://ojvbydnvywbsgyhqftap.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdmJ5ZG52eXdic2d5aHFmdGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzODQyMDcsImV4cCI6MjA5Njk2MDIwN30.3UyyKGcmehGVxadPotOgwYF6CmDbkdb8gw7BFxlYFcU'; // public anon key (same one the other barq tools use)
const SBH={apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'};
const LOGO_WHITE='assets/logo-white.png';
const LOGO_HEAD='assets/logo-head.png';
