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

## Still mock / pending decisions

- Products, categories, prices, customers and sample orders are fictional.
- Delivery areas and fees are placeholders. Fee rules are not confirmed.
- Order statuses are placeholders. Status changes are not implemented.
- "Created" orders live in browser memory only and disappear on refresh.
- No login: the employee is a fixed demo user.
- Weight presets, the "by amount" weight input and the required address fields are proposals.
