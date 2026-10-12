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
    app.js                Bootstrap + hash router (#/pos, #/orders, #/orders/:id)
    store.js              State (cart, customer, address, source) + actions
    catalog.js            Reference data cached at startup
    constants.js          Limits, housing types, weight presets
    data/
      mock-data.js        ⚠️ ALL MOCK DATA (products, customers, areas, fees, statuses, orders)
      data-source.js      The ONLY data access layer used by the UI
    components/           Topbar, categories, product grid, cart, dialogs, address form…
    screens/              POS, orders list, order details
    utils/                Formatting, Arabic/phone normalization, totals, order summary
```

## Replacing the mock data later

Re-implement the functions in `js/data/data-source.js` (same names and return shapes) against the
approved real source. UI components do not import `mock-data.js` directly.

## Confirmed decisions reflected in the demo

- Products and prices will come from the data-center products sheet (`products_master`), read only.
- How a product is sold comes from the DC sheet's Storage Unit (`dc_stock_levels.unit`, joined to `products_master` by SKU):
  - `كيلو` → sold by weight: quantity in kg, decimals allowed, price = price-per-kg × weight (estimated).
  - Anything else (Unit, علبة, لتر, كرتونة…) or no unit → sold by unit: whole numbers only; a decimal shows
    "لا يمكن أن تحتوي الكمية على أرقام عشرية في المنتجات التي يتم بيعها بالوحدة."
  - 52 products are marked `كيلو` although their name has a pack size; they were sent to the DC to fix in the sheet.
  - The UI uses a mock flag until the DB function returns it.
- No categories: the agent searches by the product name as written in the sheet (code/barcode also match).
  Products with a zero price stay visible as they are in the sheet.
- Cash on delivery is the only payment method.
- Order tickets print on an 80mm receipt roll, for the preparation team: customer, phones, address, items with
  quantity or weight and notes. No prices, fees or totals on the ticket.
- Two accounts: call-center agent and supervisor. The supervisor can also cancel orders (with a reason),
  manage delivery areas and fees, and see the daily summary.
- Order statuses: new and cancelled only. Both accounts see all orders.

## Order start (Foodics-style)

- Home is the call-center board (`#/board`): today's orders in columns — draft, new, cancelled.
- "طلب جديد لمركز الاتصال" opens a dialog: customer phone (+ optional second number). A registered customer's
  name and saved addresses appear automatically; a shared number lists the matching customers to choose from.
  Fixed order type (delivery, cash) and the address: pick a saved one, edit it (pencil), or
  "إضافة عنوان جديد". "حفظ" opens the product search with the customer and address already set.
- Address fields follow Foodics' "إنشاء العنوان": name, delivery area, street, housing type, extra information.
  ⚠️ The draft database (`db/`) still uses building/floor/apartment and has no address name / housing type or
  address editing — it must be updated before connecting.

- Order source (phone / WhatsApp / Facebook) was removed from the UI.

## Still mock / pending

- Products, customers, sample orders, delivery areas and fees are fictional.
  The supervisor will enter the real delivery areas and fees from the app.
- Login is a demo account picker. The real version uses Supabase Auth.
- "Created" orders and edits live in browser memory only and disappear on refresh.
