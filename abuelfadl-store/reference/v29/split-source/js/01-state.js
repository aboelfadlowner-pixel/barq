
  var state={view:'home',cat:'all',sub:'all',q:'',layout:'grid'};
  var cart={}, favs={};
  try{var sv=JSON.parse(localStorage.getItem('abuelfadl_cart')||'{}'); Object.keys(sv).forEach(function(k){if(BY_ID[k]&&sv[k]>0&&STOCK[k]!==0) cart[k]=Math.min(+sv[k],20)})}catch(e){}
  function saveCart(){try{localStorage.setItem('abuelfadl_cart',JSON.stringify(cart))}catch(e){}}
  var grid=$('#grid'), chips=$('#chips'), countEl=$('#count'), emptyEl=$('#empty'), input=$('#q'), sug=$('#sug');
  var cartBtn=$('#cartBtn'), drawer=$('#drawer'), scrim=$('#scrim'), bar=$('#hdrBar');
