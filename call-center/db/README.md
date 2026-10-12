# Call center database (FOR REVIEW — NOT APPLIED)

Nothing in this folder has been run on the real Supabase project.

| File | What it does | Where it may run |
|---|---|---|
| `01_schema.sql` | Preflight check + new `cc_*` tables + order-number sequence | via `apply_cc.sql` only |
| `02_functions.sql` | `cc_my_role`, `cc_list_products`, `cc_create_order`, `cc_cancel_order`, `cc_save_area` | via `apply_cc.sql` only |
| `03_security.sql` | RLS, grants, EXECUTE rights | via `apply_cc.sql` only |
| `build_apply.sh` | Builds `apply_cc.sql` = 01+02+03 in ONE transaction | local |
| `apply_cc.sql` | The file to run (all or nothing, safe to re-run) | test project, later production (after approval) |
| `precheck_readonly.sql` | SELECT-only checks before applying (duplicate skus, unique index, existing cc_*) | any, read-only, with approval |
| `rollback_cc.sql` | Drops cc_* objects only (deletes call-center data) | only with explicit approval |
| `test/00_local_supabase_stub.sql` | Fake `auth` schema for a plain local Postgres | **local sandbox only** |
| `test/01_products_master_stub.sql` | `products_master` copy with fictional rows | **test project / local only — never production** |
| `test/02_seed_test_data.sql` | Staff rows for test users + test areas | **test project / local only** |
| `test/10_tests.sql` | Roles, products paging, pricing, weight, duplicates, cancel, limits | **test project / local only** |
| `test/20_concurrency.sh` | Same draft from two sessions at once (M2) | **test project / local only** |
| `test/run_local.sh` | Runs everything on a throwaway local Postgres in /tmp | local |

Safety guards (test-only files):
- `test/01_products_master_stub.sql` stops (and changes nothing) if `products_master` already exists or any
  real table (`branch_orders`, `dc_products`, `pricing_requests_v3`) is present. It tags the stub table `CC_TEST_STUB`.
- `test/02_seed_test_data.sql`, every block in `test/10_tests.sql`, and `test/20_concurrency.sh` stop unless
  `products_master` carries the `CC_TEST_STUB` tag.
- `test/00_local_supabase_stub.sql` stops on any database that already has an `auth` schema (every Supabase project).
- `test/run_local.sh` proves this on a production-like local database: all files stop, nothing changes.

Run order (test project): `test/01_products_master_stub.sql` → `apply_cc.sql` → `test/02_seed_test_data.sql`
→ `test/10_tests.sql` → `test/20_concurrency.sh`. Each test prints `PASS …` or `FAIL …`.

Rules the SQL enforces:
- No existing table is altered, dropped or written. `products_master` is only read.
- The app never sends prices. `cc_create_order` reads prices from `products_master` and the fee from `cc_delivery_areas`.
- Weight lines: `price_per_kg × grams / 1000`, rounded to 2 decimals.
- `client_request_id` (one per draft) + a transaction-level advisory lock: a repeated or simultaneous submit returns the same order.
- Products are read only through `cc_list_products` (4 columns, staff only, pages of ≤1,000); duplicated skus are excluded and rejected.
- Every function: `SECURITY DEFINER`, `search_path = ''`, no EXECUTE for `anon`.
- No direct insert/update/delete on `cc_*` tables; writes only through the functions.
- `anon` has no access to any `cc_*` object.
