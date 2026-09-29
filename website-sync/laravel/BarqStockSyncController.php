<?php

// app/Http/Controllers/Api/BarqStockSyncController.php
//
// Receives hourly price + availability updates from Barq (Supabase), matched by SKU.
// Adjust the 4 constants below to the site's real products table/columns.

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BarqStockSyncController extends Controller
{
    private const TABLE       = 'products';     // products table
    private const SKU_COL     = 'sku';          // column holding the Barq SKU (e.g. "sk-6811")
    private const PRICE_COL   = 'price';        // selling price column
    private const STOCK_COL   = 'stock';        // quantity column (set to null if the site has none)
    private const AVAIL_COL   = 'is_available'; // availability flag column (set to null if the site derives it from stock)

    public function __invoke(Request $request)
    {
        $expected = (string) config('services.barq.token');
        $given    = (string) $request->bearerToken();
        if ($expected === '' || !hash_equals($expected, $given)) {
            return response()->json(['error' => 'unauthorized'], 401);
        }

        $data = $request->validate([
            'items'             => 'required|array|max:1000',
            'items.*.sku'       => 'required|string|max:64',
            'items.*.price'     => 'required|numeric|min:0',
            'items.*.qty'       => 'required|numeric',
            'items.*.available' => 'required|boolean',
        ]);

        $items = collect($data['items'])->keyBy('sku');
        $existing = DB::table(self::TABLE)
            ->whereIn(self::SKU_COL, $items->keys())
            ->get()
            ->keyBy(self::SKU_COL);

        $updated = 0;
        $unchanged = 0;

        DB::transaction(function () use ($items, $existing, &$updated, &$unchanged) {
            foreach ($existing as $sku => $row) {
                $in = $items[$sku];
                $changes = [];

                if ((float) $row->{self::PRICE_COL} !== (float) $in['price']) {
                    $changes[self::PRICE_COL] = $in['price'];
                }
                if (self::STOCK_COL && (float) $row->{self::STOCK_COL} !== (float) $in['qty']) {
                    $changes[self::STOCK_COL] = max(0, $in['qty']);
                }
                if (self::AVAIL_COL && (bool) $row->{self::AVAIL_COL} !== (bool) $in['available']) {
                    $changes[self::AVAIL_COL] = $in['available'];
                }

                if ($changes) {
                    $changes['updated_at'] = now();
                    DB::table(self::TABLE)->where(self::SKU_COL, $sku)->update($changes);
                    $updated++;
                } else {
                    $unchanged++;
                }
            }
        });

        return response()->json([
            'updated'   => $updated,
            'unchanged' => $unchanged,
            'not_found' => $items->keys()->diff($existing->keys())->values(),
        ]);
    }
}
