  /* ---------- static pieces ---------- */
  var SUBT={dairy:'طازجة كل يوم',cheese:'بلدية ورومي وفيتا',imported:'اختيارات مستوردة',bakery:'من الفرن لحد بيتك',produce:'مختارة بعناية',meat:'طازجة يوميًا',fish:'فسيخ ورنجة',deli:'مخللات ومقبلات',drinks:'فريش وبارد',sandwich:'جاهزة في دقايق',eggs:'بكل أنواعه',syrian:'أصلية',nature:'من الطبيعة',kiri:'ابتكارات ونكهات',suhoor:'طاسات وفول وفراخ'};
  $('#cats').innerHTML=CATS.map(function(c){
    return '<button class="pc rv" type="button" data-go="'+c.id+'"><span class="pph">'+(c.shot?'<img alt="" src="'+c.shot+'">':'<span class="slot">'+icon('i-image')+'مكان الصورة</span>')+'</span><span class="pt"><b>'+c.name+'</b></span></button>';
  }).join('');
