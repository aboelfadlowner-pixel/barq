-- Id sent by the checkout form with each order: the same order sent twice (double tap, retry after a lost answer)
-- is recorded once.
alter table store.orders add column client_ref text check (client_ref ~ '^[A-Za-z0-9-]{8,64}$');
create unique index orders_client_ref on store.orders (client_ref) where client_ref is not null;
