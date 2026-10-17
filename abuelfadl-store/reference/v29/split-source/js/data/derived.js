  var PRODUCTS=RAW.map(function(r){var p={id:r[0],cat:r[1],name:r[2],price:r[3]}; if(PHOTOS[r[0]]) p.img=PHOTOS[r[0]]; if(r[5]){p.weighed=true;p.step=0.25} if(r[7]) p.tag='الأكثر مبيعًا'; if(r[8]) p.offer=true; if(r[9]) p.desc=r[9]; return p});
  var SUBS={}, NEWIDS=[], FEATURED=[];
  var STOCK={}; RAW.forEach(function(r){if(r[6]) STOCK[r[0]]=0});
  var BY_ID={}; PRODUCTS.forEach(function(p){BY_ID[p.id]=p});
