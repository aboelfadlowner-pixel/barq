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
    constants.js          Order sources (confirmed) + weight presets (proposed)
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
- All products are sold by piece. The agent can switch a cart line to a weight, and the price is then price-per-kg × weight.
- Cash on delivery is the only payment method.
- Order tickets print on an 80mm receipt roll.
- Two accounts: call-center agent and supervisor. The supervisor can also cancel orders (with a reason),
  manage delivery areas and fees, and see the daily summary.
- Order statuses: new and cancelled only. Both accounts see all orders.

## Still mock / pending

- Products, customers, sample orders, delivery areas and fees are fictional.
- Login is a demo account picker. The real version uses Supabase Auth.
- "Created" orders and edits live in browser memory only and disappear on refresh.
