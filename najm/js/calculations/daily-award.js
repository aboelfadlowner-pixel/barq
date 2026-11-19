// نجم أبو الفضل — رجل اليوم: ترتيب المرشحين والفايزين
function rankGroup(d,list){
  return list.map(e=>({e,s:score(d,e.code)}))
    .filter(x=>x.s.total!=null&&x.s.st!=='abs'&&x.s.st!=='off'&&!redOn(d,x.e.code))
    .sort((a,b)=>b.s.total-a.s.total||(b.s.att||0)-(a.s.att||0)||(b.s.ops||0)-(a.s.ops||0)||(b.s.mgr||0)-(a.s.mgr||0));
}
function isWinner(d,code){return Object.values(peekDay(d).winners||{}).some(a=>a.includes(code));}
