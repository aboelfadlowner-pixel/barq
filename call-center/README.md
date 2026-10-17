# أبو الفضل — مركز الاتصال (Frontend demo)

Standalone call-center POS for creating delivery orders from phone, WhatsApp and Facebook.
**Frontend only. All data is MOCK. Nothing is saved or sent anywhere.**

## Run locally

From the repository root:

```bash
python3 -m http.server 8000
```

Open: <http://localhost:8000/call-center/>

(Plain HTML/CSS/JS ES modules. No build step and no dependencies. A local server is needed because
browsers block ES modules on `file://`.)

## Structure

```
call-center/
  index.html              App shell
  css/                    tokens · base · layout · components
  js/
    config.js             DATA_MODE ('mock' | 'supabase'), project URL, public anon key, account email
    app.js                Bootstrap (sign-in when connected) + hash router
    store.js              State (cart, customer, address, order note) + actions
    catalog.js            Reference data cached at startup
    constants.js          Limits, housing types, weight presets
    data/
      data-source.js      The ONLY data access layer used by the UI — forwards to one of:
      mock-source.js        demo data in browser memory (mock-data.js ⚠️ all fictional)
      supabase-source.js    the cc_* tables and functions in Supabase
    components/           Topbar, categories, product grid, cart, dialogs, address form…
    screens/              Board, POS, orders list, order details, areas, sign-in
    utils/                Formatting, Arabic/phone normalization, totals, order summary
```

## Connecting to Supabase

1. Apply `db/apply_cc.sql` to the target project (only after approval — see `db/README.md`).
2. In `js/config.js` set `DATA_MODE = 'supabase'`, `SUPABASE_URL`, the **public anon key** and
   `ACCOUNT_EMAIL` (the one call-center account). Never put the service_role key or a password there.
3. Open the app: it asks for the password once per device, then remembers the session.

In connected mode every "تجريبي" label is hidden; prices, fees and totals come from the database;
sending the same draft twice returns the same order. supabase-js 2.45.4 loads from jsDelivr.

## Confirmed decisions reflected in the demo

- Products and prices will come from the data-center products sheet (`products_master`), read only.
- How a product is sold (CONFIRMED): the products sheet column `is_sold_by_weight` (same as Foodics).
  The call-center edge function `cc-sale-unit` copies it into `cc_product_sale_unit` (read-only use of the same
  Drive file as dc-sync; at most every 10 minutes, triggered when the app opens). Products not in that list fall
  back to the storage unit (`كيلو` = weight). Unit products accept whole numbers only.
  ⚠️ Update the products file on Drive with "Upload new version"; deleting and re-uploading changes its id.
- Products & prices stay current while the screen is open (CONFIRMED, `js/catalog-sync.js`): every 5 minutes and
  from the «تحديث الأسعار» chip, the app reads `dc_sync_log` (read only) and, only if the products sheet was last
  pulled 10+ minutes ago, runs the data-center sync exactly as the pricing/inventory/receiving tools do
  (`dc-sync`, then `sync_catalog_from_dc`, which publishes at most every 10 minutes). Nothing in those tools is
  changed. A new sheet on Drive shows on every open call-center / admin screen within about 10–15 minutes.
- No categories: the agent searches by the product name as written in the sheet (code/barcode also match).
  Products with a zero price stay visible as they are in the sheet.
- Cash on delivery is the only payment method.
- Order tickets print on an 80mm receipt roll, for the preparation team: customer, phones, address, items with
  quantity or weight and notes. No prices, fees or totals on the ticket.
- One shared call-center account for everyone, no roles: it creates and cancels orders (with a reason),
  manages delivery areas and fees, and sees the daily summary and all orders.
- Order statuses: new and cancelled only.

## Order start (Foodics-style)

- Home is the call-center board (`#/board`): today's orders in columns — draft, new, cancelled.
- "طلب جديد لمركز الاتصال" opens a dialog: customer phone (+ optional second number). A registered customer's
  name and saved addresses appear automatically; a shared number lists the matching customers to choose from.
  Fixed order type (delivery, cash) and the address: pick a saved one, edit it (pencil), or
  "إضافة عنوان جديد". "حفظ" opens the product search with the customer and address already set.
- Address fields follow Foodics' "إنشاء العنوان": name, delivery area, street, housing type, extra information.
  - Delivery area: a searchable list of the four areas — الدخيلة، خارج الهانوفيل، الهانوفيل، البيطاش (required, it sets the fee).
  - Housing type: لاشيء، عمارة، فيلا، مكتب.
  - The draft database (`db/`) uses the same fields and supports editing a saved address.

- Order source (phone / WhatsApp / Facebook) was removed from the UI and the database.

## Still mock / pending

- Products, customers, sample orders and delivery fees are fictional; the four area names are real.
  The real fees will be entered from the "المناطق والرسوم" screen.
- No login screen in the demo: it opens with the one account. The real version signs in once per device
  (Supabase Auth email + password, never stored in the app) and stays signed in.
- "Created" orders and edits live in browser memory only and disappear on refresh.
