  var doc=document, root=doc.documentElement;
  root.lang='ar'; root.dir='rtl'; root.classList.add('js');
  var $=function(s,r){return (r||doc).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||doc).querySelectorAll(s))};
  var reduce=false; /* الحركة مقصودة في التصميم؛ بنوقف التكرار اللانهائي فقط لو الجهاز طالب تقليل الحركة */
  var MIN_ORDER=300;
