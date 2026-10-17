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
No environment variables are needed yet, so there is no `.env.example`.

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
- No API exists yet and none is assumed. `submitOrder` is simulated exactly like v29: nothing is sent.
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
