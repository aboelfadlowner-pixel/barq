-- Category notice (shown above its products) and display-only categories (shown, not ordered from the site).
alter table store.categories
  add column notice text check (length(notice) <= 200),
  add column display_only boolean not null default false;

update store.categories
   set notice = 'تنبيه: قسم العصائر والآيس كريم والقهوة للعرض فقط ولا يوجد طلب مباشر من هذا القسم.',
       display_only = true
 where id = 'drinks';
