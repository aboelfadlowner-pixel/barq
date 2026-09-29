# Website sync — Barq → abuelfadlstore.com

Every hour, Barq (Supabase) sends the **Semlehy branch** selling price and stock for each product
to the online store, matched by **SKU**. The site only needs one API endpoint.

## Flow

```
products_master (price) ─┐
                         ├─ view website_feed ─ edge function website-sync ─ POST /api/barq/stock-sync ─ Laravel products table
branch_stock (السمليهي) ─┘        (1,403 SKUs)        (hourly, pg_cron)           (Bearer token)
```

- Only SKUs with a price > 0 are sent (products without a price are skipped, never pushed as 0).
- `available = qty > 0`.
- The full list is sent every hour in chunks of 500; the site only writes rows that actually changed.
- Every run is logged in `public.website_sync_log` (sent / updated / unchanged / SKUs not found on the site).

## For the site developer (Laravel)

1. Copy `laravel/BarqStockSyncController.php` to `app/Http/Controllers/Api/` and set the
   table/column constants at the top to the real products table.
2. `routes/api.php`:
   ```php
   use App\Http\Controllers\Api\BarqStockSyncController;
   Route::post('/barq/stock-sync', BarqStockSyncController::class)->middleware('throttle:60,1');
   ```
3. `config/services.php`:
   ```php
   'barq' => ['token' => env('BARQ_SYNC_TOKEN')],
   ```
4. `.env`: `BARQ_SYNC_TOKEN=<long random string>` (e.g. `php -r "echo bin2hex(random_bytes(32));"`),
   then `php artisan config:cache`.
5. Confirm the site's product SKUs use exactly the Barq format (e.g. `sk-6811`).

### Contract

`POST /api/barq/stock-sync` — `Authorization: Bearer <BARQ_SYNC_TOKEN>`

```json
{ "items": [ { "sku": "sk-6811", "price": 18.00, "qty": 36, "available": true } ] }
```

Response:

```json
{ "updated": 12, "unchanged": 480, "not_found": ["sk-1234"] }
```

## Go-live steps (Barq side)

1. Deploy the function: `supabase functions deploy website-sync`
2. Secrets:
   ```
   supabase secrets set WEBSITE_SYNC_URL=https://new.abuelfadlstore.com/api/barq/stock-sync
   supabase secrets set WEBSITE_SYNC_TOKEN=<same value as BARQ_SYNC_TOKEN>
   supabase secrets set WEBSITE_SYNC_SKUS=sk-6811,sk-6854,sk-8628,...   # 5 SKUs for the first test
   ```
3. Preview without sending: call the function with `?dry=1`.
4. Run once for real, check `website_sync_log` and the 5 products on the site.
5. Remove `WEBSITE_SYNC_SKUS` and enable the hourly cron (commented at the bottom of
   `supabase/migrations/20260929_website_sync_feed.sql`).
