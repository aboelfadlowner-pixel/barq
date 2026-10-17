# Call center database (FOR REVIEW — NOT APPLIED)

Nothing in this folder has been run on the real Supabase project.

| File | What it does | Where it may run |
|---|---|---|
| `01_schema.sql` | Preflight check + new `cc_*` tables + order-number sequence | via `apply_cc.sql` only |
| `02_functions.sql` | `cc_is_staff`, `cc_sold_by` (internal), `cc_list_products`, `cc_create_order`, `cc_cancel_order`, `cc_save_area` | via `apply_cc.sql` only |
| `03_security.sql` | RLS, grants, EXECUTE rights | via `apply_cc.sql` only |
| `build_apply.sh` | Builds `apply_cc.sql` = 01+02+03 in ONE transaction | local |
| `apply_cc.sql` | The file to run (all or nothing, safe to re-run) | test project, later production (after approval) |
| `precheck_readonly.sql` | SELECT-only checks before applying (duplicate skus, unique index, existing cc_*) | any, read-only, with approval |
| `rollback_cc.sql` | Drops cc_* objects only (deletes call-center data) | only with explicit approval |
| `test/00_local_supabase_stub.sql` | Fake `auth` schema for a plain local Postgres | **local sandbox only** |
| `test/01_products_master_stub.sql` | `products_master` copy with fictional rows | **test project / local only — never production** |
| `test/02_seed_test_data.sql` | Staff rows for test users + test areas | **test project / local only** |
| `test/10_tests.sql` | Access (account / outsider / anon), products paging, pricing, weight, sold by unit/weight, duplicates, cancel, limits | **test project / local only** |
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
- Products are read only through `cc_list_products` (sku, name, barcode, price, sold_by; staff only, pages of ≤1,000); duplicated skus are excluded and rejected.
- One shared call-center account, no roles (`cc_staff`: user, name, active). It can create and cancel orders and
  manage delivery areas; nobody can write tables directly. Tests use two Auth users: `staff@cc.test` and
  `outsider@cc.test` (signed in, not staff).
- No order source (removed). Addresses follow the app form: name (`label`, ≤40), delivery area, street (≤150),
  housing type (optional: building/villa/office = عمارة/فيلا/مكتب), extra information (`notes`, ≤200).
  `cc_create_order` takes a saved address as is, a saved address with edits (updated in place, old orders keep
  their copy), or a new one. A second number is saved on the customer only if they have none, and is always
  copied onto the order.
- "Sold by" comes from the DC Storage Unit (`dc_stock_levels.unit`, read only): `كيلو` → `weight`; anything else
  (including `لتر`) or no row → `unit`. `cc_create_order` rejects a decimal quantity on a unit product with
  "لا يمكن أن تحتوي الكمية على أرقام عشرية في المنتجات التي يتم بيعها بالوحدة.", a weight on a unit product, and a
  piece quantity on a weight product. The apply stops if `dc_stock_levels (sku, unit)` is missing.
- Every function: `SECURITY DEFINER`, `search_path = ''`, no EXECUTE for `anon`.
- No direct insert/update/delete on `cc_*` tables; writes only through the functions.
- `anon` has no access to any `cc_*` object.
