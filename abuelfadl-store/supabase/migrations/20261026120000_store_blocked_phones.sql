-- Mobile numbers the manager blocked from ordering on the website (fake orders, repeated refusals).
-- Website orders only: the call center system is separate and does not read this table.
create table store.blocked_phones (
  phone      text primary key check (phone ~ '^01[0125][0-9]{8}$'),
  reason     text not null default '' check (char_length(reason) <= 200),
  blocked_at timestamptz not null default now()
);

grant select, insert, update, delete on store.blocked_phones to store_app;
