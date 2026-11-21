-- نجم أبو الفضل — سجل نقل الموظفين (الفرع / القسم / الشيفت) — بيتسجل تلقائي مع أي تعديل، وبيتحفظ تاريخه
-- (التارجت في شهر النقل بيتقسم على القسمين حسب عدد الأيام في كل قسم)
create table if not exists public.najm_emp_moves (
  id bigserial primary key,
  code text not null,
  day date not null default ((now() at time zone 'Africa/Cairo')::date),
  at timestamptz not null default now(),
  from_branch text, from_dept text, from_shift text,
  to_branch text, to_dept text, to_shift text,
  by_user text
);
create index if not exists najm_emp_moves_code_idx on public.najm_emp_moves (code, day);
alter table public.najm_emp_moves enable row level security;

create or replace function public.najm_track_move()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.branch, old.dept, old.shift) is distinct from (new.branch, new.dept, new.shift) then
    insert into najm_emp_moves(code, from_branch, from_dept, from_shift, to_branch, to_dept, to_shift, by_user)
      values (new.code, old.branch, old.dept, old.shift, new.branch, new.dept, new.shift, nullif(current_setting('najm.actor', true), ''));
  end if;
  return new;
end $$;
drop trigger if exists najm_emp_moves_trg on public.najm_employees;
create trigger najm_emp_moves_trg after update on public.najm_employees for each row execute function public.najm_track_move();
revoke all on function public.najm_track_move() from public, anon, authenticated;
