# Call center database (FOR REVIEW — NOT APPLIED)

Nothing in this folder has been run on the real Supabase project.

| File | What it does | Where it may run |
|---|---|---|
| `01_schema.sql` | New `cc_*` tables + order-number sequence | test project, later production (after approval) |
| `02_functions.sql` | `cc_my_role`, `cc_create_order`, `cc_cancel_order`, `cc_save_area` | same |
| `03_security.sql` | RLS, grants, `cc_products` view (no cost/margin) | same |
| `test/00_local_supabase_stub.sql` | Fake `auth` schema for a plain local Postgres | **local sandbox only** |
| `test/01_products_master_stub.sql` | `products_master` copy with fictional rows | **test project / local only — never production** |
| `test/02_seed_test_data.sql` | Staff rows for test users + test areas | **test project / local only** |
| `test/10_tests.sql` | Role, pricing, weight, duplicate and cancel tests | **test project / local only** |

Run order (test): `01_products_master_stub` → `01_schema` → `02_functions` → `03_security` → `02_seed_test_data` → `10_tests`.
Each test prints `PASS …` or stops with `FAIL …`.

Rules the SQL enforces:
- No existing table is altered, dropped or written. `products_master` is only read.
- The app never sends prices. `cc_create_order` reads prices from `products_master` and the fee from `cc_delivery_areas`.
- Weight lines: `price_per_kg × grams / 1000`, rounded to 2 decimals.
- `client_request_id` (one per draft) makes a repeated submit return the same order.
- No direct insert/update/delete on `cc_*` tables; writes only through the functions.
- `anon` has no access to any `cc_*` object.
