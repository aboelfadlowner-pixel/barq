# Abu El-Fadl Store — Frontend (Next.js + TypeScript)

Migration of the single-file v29 site to Next.js (App Router) + TypeScript.
The original is the source of truth for look and behavior: `reference/v29/abuelfadl-v29.html`
(the same site split into css/js/partials is in `reference/v29/split-source/`). Nothing in `reference/` is part of the build.

## Migration status
| Stage | What | Status |
|---|---|---|
| 1 | Project setup, Git rules, assets, ported CSS, fonts | done (this delivery) |
| 2 | Types, data (`src/data`), services interfaces | done |
| 3 | Layout (header, footer, bottom nav) + home page | done |
| 4 | Product cards + `/category/[slug]` | done |
| 5 | Cart, product sheet, search | done (this delivery) |
| 5b | Sandwich/salad category cover and home card photo (extra, requested by Ayaa) | done, see known issues |
| 6 | Hero (team photo) + motion | done |
| 7 | Checkout (simulated, same as v29) | done (this delivery) |
| 8 | Side-by-side visual comparison with v29, final checks | |
| B1 | Backend API + admin dashboard on a temporary JSON store (no database yet) | done (this delivery) |


## Run locally
Requirements: Node.js 20.9 or newer (https://nodejs.org, LTS), Git, VS Code.
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build check
npm run typecheck  # TypeScript check
npm run verify:data # checks src/data + services against the original v29 data
```
To open it on your phone while developing: connect the phone to the same Wi-Fi, run `npm run dev:lan`,
and open the `Network` address it prints (e.g. `http://192.168.1.20:3000`).
`next.config.ts` has `allowedDevOrigins` for this. Without it Next.js blocks its scripts for any address other than
`localhost`, so the page shows but buttons do nothing (switcher, grid/list, scroll buttons). After changing that file, restart `npm run dev:lan`.
This only concerns the dev server; Vercel / `npm run build` are not affected.

## Layout
```
public/images     logo icon, team photo
public/fonts      subset fonts used by the wordmark (Oswald, Yellowtail)
public/products   product photos named <productId>.webp
src/app           routes, layout, globals.css (imports src/styles in the original cascade order)
src/styles        ported v29 CSS (+ 23-next-adapters.css: the only CSS added for the port), same file names as the split version (legacy/ = unused old CSS, kept on purpose)
src/types        Category, Product, CartItem/StoredCart, Order types
src/data         categories.ts (17) and products.ts (621): copied unchanged from v29, one product per line
src/services     contracts.ts (CatalogService, OrderService), mock/ (static-data implementations), index.ts (the one place to swap implementations)
src/lib          constants (MIN_ORDER, localStorage keys), arabic.ts (search normalization)
src/components   layout/ (Header, Footer, BottomNav, Notice, Wordmark, Sprites, ChromeProvider), home/ (Hero, CategoryGrid, EditorialSection, TrustSection), ui/ (Icon, Art); layout/ also has OverlayProvider (shared scrim + open sheets)
src/features/products   ProductCard, ProductGrid, FavoriteButton/Provider, LayoutToggle, CategorySwitcher
src/hooks   filled in the next stages
reference/v29     original site for comparison (excluded from tsconfig)
```
Arabic and English fonts (Cairo, IBM Plex Sans Arabic) load from Google Fonts exactly as in v29.
Environment variables: see `.env.example` (only needed for the admin dashboard in production).

## Git
```bash
git init
git add .
git commit -m "chore: stage 1 - Next.js + TypeScript project setup, assets and ported CSS"
git branch -M main
# create an empty repo on github.com (no README), then:
git remote add origin https://github.com/<your-user>/abuelfadl-store.git
git push -u origin main
```
`.env*` files are ignored. Never commit secrets.

## Vercel (free Hobby plan)
1. Sign in at vercel.com with your GitHub account.
2. Add New → Project → import the `abuelfadl-store` repo.
3. Framework is auto-detected as Next.js. Keep the defaults and press Deploy.
4. Every `git push` to `main` redeploys; every branch/PR gets its own preview link you can open on your phone.

## Data layer rules
- UI code imports only `src/services` (never `src/data`). Swapping the mock for an API or database means changing `src/services/index.ts` and adding an implementation of `CatalogService` / `OrderService`; no UI changes.
- Server pages read the catalog through `src/services/index.ts` (server only). Client components use `src/services/client.ts`
  (the checkout sends `POST /api/orders`). `src/services/mock/` is the old static implementation, kept for `npm run verify:data`.
- Non-UI layers (types, data, services, lib) use relative imports; the `@/` alias is for UI code.

## Stage 5 notes

- `src/features/catalog/CatalogProvider.tsx`: the layout loads categories and products through `@/services` and hands them to the browser
  (like v29, all products are available client-side, so search and cart are instant). Swap point for a future API: this provider only.
- Cart: `src/features/cart/CartProvider.tsx` (localStorage key `abuelfadl_cart`, same `{ "<id>": quantity }` format as v29, restored after the first
  render, unknown/unavailable ids dropped), `CartDrawer.tsx` (minimum order 300 EGP).
- Product sheet: `src/features/products/ProductSheet.tsx`. Cards open it on click; weighed products (step 0.25 kg) always go through it.
- Search: `src/features/search/` (`SearchProvider` keeps the text, `SearchBox` is the header input with up to 6 suggestions).
  Typing on a category page filters it live; the text is cleared when you leave by any route except a search, as in v29.
- Checks to run before delivering: `npm run typecheck`, `npm run build`, `npm run verify:data`.

- The cart icon (`i-cart` in `src/components/layout/Sprites.tsx`) is a basket, not a shopping trolley (change from v29, requested by Ayaa). Header and bottom nav use it.
  The checkout-done animation uses a dedicated basket drawing with the Abu El-Fadl logo on a badge (`src/components/checkout/CheckoutBasket.tsx` + `src/styles/25-checkout-basket.css`, wired in Stage 7).

## Stage 7 notes (checkout)

- Flow: cart drawer "إتمام الطلب" (enabled from 300 EGP) -> delivery details sheet -> "order received" animation (`src/features/checkout/`).
- Validation as in v29: name 3+ characters, Egyptian mobile `01[0125]` + 8 digits (spaces, dashes and Arabic digits accepted), address 8+ characters.
  Name, phone and address are remembered in `abuelfadl_customer` and prefill the next order.
- The order is simulated by `orderService.submitOrder` (`src/services/mock/orders.ts`): it only returns the order number (`AF-` + 5 digits). Nothing is sent or saved.
  When an orders API exists, replace the implementation in `src/services/index.ts`; the UI does not change.
- "متابعة التسوق" returns to the home page. The done screen is not closed by Escape (same as v29). With reduced motion it skips the basket animation.

## Stage 6 notes (hero and motion)
- `HeroPhoto` (client) ports the v29 hero: plays once the image is decoded and at least 25% visible (3.5 s fallback), then 3D tilt from pointer or device orientation; click replays.
- `RevealObserver` adds `in` to `.rv` elements and re-arms on route change. `CardTilt` tilts category cards on fine-pointer devices.
- `lib/motion.ts` keeps `REDUCE_MOTION=false` exactly like v29. The order-done animation and cart fly effect do respect the reduced-motion setting.
- The checkout sheet focuses the name field twice (60 ms and 380 ms) because the cart drawer restores focus to the header button while closing.

## Backend B1: API + admin dashboard (no database yet)

### Try it
```bash
npm run dev
# store:      http://localhost:3000
# dashboard:  http://localhost:3000/admin   (password in development: admin)
```
Place an order from the store and it shows up in the dashboard (orders, status, note). Change a price, stock, product or category
in the dashboard and the store shows it right away.

### Where the data lives (temporary)
- `.data/store.json` (git-ignored) holds categories, products and orders. It is created from `src/data` the first time the server runs.
  Delete it to start over from the original v29 data.
- On Vercel the file system is read-only: the site works but dashboard changes and orders only live in memory until the next deploy/restart.
  So **do not take real orders on Vercel before the database step**.

### Layers
```
src/app/api/**          HTTP routes (thin: parse request, check admin, call src/server, return JSON)
src/server/catalog.ts   catalog rules: validation, create/update/delete products and categories
src/server/orders.ts    order rules: prices recomputed on the server, stock check, minimum order, AF-00001 numbering, statuses, stats
src/server/auth.ts      admin password + signed session cookie
src/server/db.ts        the temporary JSON store  <- the only file that knows how data is stored
src/app/(store)         the store (unchanged UI; root layout moved into a route group)
src/app/(admin)/admin   the dashboard (own root layout and admin.css, nothing shared with the store CSS)
src/features/admin      dashboard screens (client components that call the API)
```
Connecting a database = rewrite `src/server/catalog.ts` / `orders.ts` on top of it (same function signatures) and drop `db.ts`.
API routes, dashboard and store do not change.

### API
All responses are JSON. Errors are `{ "error": "<Arabic message>", "fields"?: { "<field>": "<message>" } }` with status 400/401/404/409/500.

Public:
| Method | Path | Notes |
|---|---|---|
| GET | `/api/categories` | display order |
| GET | `/api/products?category=&search=` | Arabic-normalized search (same rule as the store) |
| GET | `/api/products/:id` | |
| POST | `/api/orders` | `{ customer: { name, phone, address, note }, items: [{ productId, quantity }], paymentMethod: "cash" }` → 201 `{ number, total }`. Total is computed by the server; out-of-stock or unknown products → 409; below 300 EGP → 400 |

Admin (needs the session cookie from `/api/admin/login`, otherwise 401):
| Method | Path | Notes |
|---|---|---|
| POST | `/api/admin/login` / `/api/admin/logout` | `{ password }` |
| GET | `/api/admin/stats` | today's orders/revenue (Cairo day), counts by status, out of stock, latest 5 orders |
| GET, POST | `/api/admin/products` | GET filters: `category`, `search`, `stock=in\|out` |
| GET, PATCH, DELETE | `/api/admin/products/:id` | PATCH is partial, e.g. `{ "price": 120 }` or `{ "inStock": false }` |
| GET, POST | `/api/admin/categories` | GET includes `productCount` |
| PATCH, DELETE | `/api/admin/categories/:id` | PATCH `{ name?, art?, tint?, position? }`; the id never changes; DELETE only when the category is empty |
| GET | `/api/admin/orders?status=&search=` | newest first |
| GET, PATCH | `/api/admin/orders/:id` | PATCH `{ status?, staffNote? }`; statuses: new, preparing, out_for_delivery, delivered, cancelled |

Orders keep a copy of each product's name and price, so editing the catalog later never changes old orders.

### Admin login
- Development: password `admin` unless `ADMIN_PASSWORD` is set in `.env.local`.
- Production: set `ADMIN_PASSWORD` (and optionally `ADMIN_SESSION_SECRET`) in Vercel → Settings → Environment Variables. Without it the login is refused.
- One shared password for now; per-user accounts and roles come with the database.

### Foodics SKU linking and prices (B2)
- Every product has an optional `sku` (`sk-1234`, unique). 344 of the 621 products got theirs from the WooCommerce export
  (`src/data/skus.ts`, applied when the store is first created or upgraded); the rest are linked from the dashboard
  (SKU column in the products table, or the product form). Filter "مش مربوط" lists them.
- Prices come from the Foodics products sheet (`المنتجات.csv` in the "داتا سنتر" Drive folder): `src/server/sync.ts`
  reads it and gives every product with the same SKU the sheet price. Only the price changes. Dashboard page `/admin/sync`
  (temporary manual upload) shows the changes, linked SKUs missing from the sheet, active sheet SKUs not on the site, and history.
  The Supabase sync will call the same `applyPrices`. Stock is a later phase.
- API: `GET /api/admin/sync`, `POST /api/admin/sync/products { csv, fileName }`, `GET /api/admin/products?linked=yes|no`.

### Weight settings
Weighed products have `minWeight`, `weightStep` and `maxWeight` (kg; defaults 0.25 / 0.25 / 10), set in the product form like
WooCommerce weight-based pricing. The product sheet shows quick choices within those settings, +/- buttons, and a "وزن تاني؟"
field in grams that snaps to the nearest allowed weight. `src/lib/quantity.ts` holds the rules; orders are checked with the same code.

### Category photos
Categories have two optional pictures (dashboard → الأقسام): `imageUrl`, the portrait 4:5 card photo on the home page, and
`iconUrl`, a square picture shown small and round in place of the icon (category switcher, header pill; falls back to
`imageUrl`, then to the illustration). The category page banner only shows animated covers (sandwiches, juices); other
categories keep the placeholder until their cover is made. Dairy uses its group photo for the card and icon (schema 3 upgrade).

### Not done yet (next steps)
1. Database (Supabase/Postgres) behind `src/server/*`, then real orders on Vercel.
2. Product photo upload (today the dashboard takes an image path such as `/products/13221.webp`).
3. New-order notification to the branch (Telegram/WhatsApp/e-mail).
4. Delivery zones and fees, staff accounts with roles, sales reports.

### Demo link (no server)
`npm run build:demo` builds `demo/dist/abuelfadl-demo.html`: one page with the real store and dashboard code, published as a
claude.ai Artifact so it can be tried from any device before the backend is deployed.
- The API route files run inside the browser (`demo/api.ts`); `src/server/db.ts` and `auth.ts` are swapped for browser versions
  (`demo/server/`) and data is kept in the viewer's localStorage (each viewer has their own copy). Dashboard password: `admin`.
- `demo/shims/` stand in for `next/link`, `next/navigation`, `next/server`, `next/headers`, `next/cache`; `demo/App.tsx` mirrors the
  store and admin layouts. Nothing in `demo/` is part of the Next.js app.
- Open the link with `#admin` to start on the dashboard. A floating bar switches between store and dashboard and resets the data.
