// Demo shell: renders the real store and dashboard components the way the Next.js layouts and pages do
// (src/app/(store)/**, src/app/(admin)/**), reading data from the in-browser store instead of the server.
import { useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { navigate } from "./shims/next-navigation";
import { RevealObserver } from "@/components/layout/RevealObserver";
import { BottomNav } from "@/components/layout/BottomNav";
import { ChromeProvider } from "@/components/layout/ChromeProvider";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { OverlayProvider } from "@/components/layout/OverlayProvider";
import { Notice } from "@/components/layout/Notice";
import { IconSprite, IllustrationSprite } from "@/components/layout/Sprites";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { EditorialSection } from "@/components/home/EditorialSection";
import { Hero } from "@/components/home/Hero";
import { TrustSection } from "@/components/home/TrustSection";
import { Icon } from "@/components/ui/Icon";
import { CheckoutProvider } from "@/features/checkout/CheckoutProvider";
import { CartDrawer } from "@/features/cart/CartDrawer";
import { CartProvider } from "@/features/cart/CartProvider";
import { CatalogProvider } from "@/features/catalog/CatalogProvider";
import { ProductSheetProvider } from "@/features/products/ProductSheet";
import { SearchProvider } from "@/features/search/SearchProvider";
import { CategorySwitcherButton, CategorySwitcherSheet } from "@/features/products/CategorySwitcher";
import { FavoritesProvider } from "@/features/products/FavoritesProvider";
import { SettingsProvider } from "@/features/settings/SettingsProvider";
import { toCatalogProduct } from "@/lib/pricing";
import { withDefaults } from "@/lib/settings";
import { getCategoryCover } from "@/features/products/CategoryCover";
import { LayoutToggle } from "@/features/products/LayoutToggle";
import { ContactPage } from "@/features/contact/ContactPage";
import { OffersBanner, OffersStrip } from "@/features/offers/OffersStrip";
import { OFFERS_SLUG } from "@/features/offers/useOffers";
import { CategoryProducts } from "@/features/products/CategoryProducts";
import { AdminNav } from "@/features/admin/AdminNav";
import { CategoriesManager } from "@/features/admin/CategoriesManager";
import { Dashboard } from "@/features/admin/Dashboard";
import { LoginForm } from "@/features/admin/LoginForm";
import { OrderDetails } from "@/features/admin/OrderDetails";
import { OrdersList } from "@/features/admin/OrdersList";
import { ProductForm } from "@/features/admin/ProductForm";
import { ProductsList } from "@/features/admin/ProductsList";
import { SyncPage } from "@/features/admin/SyncPage";
import { ArrangePage } from "@/features/admin/ArrangePage";
import { CustomersPage } from "@/features/admin/CustomersPage";
import { ReportsPage } from "@/features/admin/ReportsPage";
import { SettingsPage } from "@/features/admin/SettingsPage";
import { ToastProvider } from "@/features/admin/ui";
import type { Category } from "@/types/category";
import { getRoleSync } from "./server/auth";
import { resetData, snapshot } from "./server/db";

/** Switches between the store and dashboard stylesheets, like the full page load between the two Next.js root layouts. */
function useStylesheet(group: "store" | "admin") {
  useLayoutEffect(() => {
    for (const id of ["css-store", "css-admin"]) {
      const sheet = (document.getElementById(id) as HTMLStyleElement | null)?.sheet;
      if (sheet) sheet.disabled = id !== `css-${group}`;
    }
    document.title = group === "admin" ? "لوحة تحكم أبو الفضل" : "أبو الفضل ستور بريميوم";
  }, [group]);
}

export function App() {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  useStylesheet(isAdminRoute ? "admin" : "store");
  return (
    <>
      {isAdminRoute ? <AdminApp pathname={pathname} /> : <StoreApp key="store" pathname={pathname} />}
      <DemoBar admin={isAdminRoute} />
    </>
  );
}

// ---------------- store (src/app/(store)) ----------------

const ALL_SLUG = "all";
const ALL_CATEGORY: Category = { id: ALL_SLUG, name: "كل المنتجات", art: "", tint: "" };

function StoreApp({ pathname }: { pathname: string }) {
  // Read once per visit to the store, the way the server renders the layout (dashboard edits show on the next visit).
  const { categories, products, settings: saved } = useMemo(() => snapshot(), []);
  const settings = useMemo(() => withDefaults(saved), [saved]);
  const catalogProducts = useMemo(() => products.map((product) => toCatalogProduct(product)), [products]);
  const category = pathname.match(/^\/category\/([^/]+)$/)?.[1];

  return (
    <div className="app" dir="rtl" lang="ar">
      <IconSprite />
      <IllustrationSprite />
      <SettingsProvider settings={settings}>
        <ChromeProvider>
          <OverlayProvider>
            <CatalogProvider categories={categories} products={catalogProducts}>
              <CartProvider>
                <FavoritesProvider>
                  <SearchProvider>
                    <ProductSheetProvider>
                      <CheckoutProvider>
                        <RevealObserver />
                        <Notice />
                        <Header />
                        <main id="top">
                          {pathname === "/" ? (
                            <HomePage categories={categories} />
                          ) : pathname === "/contact" ? (
                          <ContactPage />
                        ) : category ? (
                            <CategoryPage slug={decodeURIComponent(category)} categories={categories} offersTitle={settings.offersTitle} />
                          ) : (
                            <StoreNotFound />
                          )}
                        </main>
                        <Footer />
                        <BottomNav />
                        <CategorySwitcherSheet categories={categories} />
                        <CartDrawer />
                      </CheckoutProvider>
                    </ProductSheetProvider>
                  </SearchProvider>
                </FavoritesProvider>
              </CartProvider>
            </CatalogProvider>
          </OverlayProvider>
        </ChromeProvider>
      </SettingsProvider>
    </div>
  );
}

/** src/app/(store)/page.tsx */
function HomePage({ categories }: { categories: Category[] }) {
  return (
    <div id="viewHome">
      <Hero />
      <OffersStrip />
      <CategoryGrid categories={categories} />
      <EditorialSection />
      <TrustSection />
    </div>
  );
}

/** src/app/(store)/category/[slug]/page.tsx */
function CategoryPage({ slug, categories, offersTitle }: { slug: string; categories: Category[]; offersTitle: string }) {
  const category =
    slug === ALL_SLUG ? ALL_CATEGORY : slug === OFFERS_SLUG ? { id: OFFERS_SLUG, name: offersTitle, art: "", tint: "" } : categories.find((c) => c.id === slug);
  if (!category) return <StoreNotFound />;
  const cover = getCategoryCover(slug);
  const tagline = category.tagline;
  return (
    <div id="viewCat" key={slug}>
      <div className="wrap" style={{ paddingBottom: 40 }}>
        <div className="cbar">
          <Link className="circ" href="/" id="back" aria-label="رجوع إلى الرئيسية">
            <Icon id="i-back" />
          </Link>
          <CategorySwitcherButton category={category} />
          <LayoutToggle />
        </div>
        {slug === OFFERS_SLUG ? (
          <OffersBanner />
        ) : (
          <div className={cover ? `cbanner has-cover cv-${slug}` : "cbanner"} id="cbanner">
            {cover ?? (
              <span className="slot">
                <Icon id="i-image" />
                مكان صورة القسم
              </span>
            )}
            <div className="ct">
              <h1 id="catTitle">{category.name}</h1>
              {tagline ? (
                <p>
                  {/* <bdi>: an English line keeps its own word order inside the right-to-left page. */}
                  <bdi>{tagline}</bdi>
                </p>
              ) : null}
            </div>
          </div>
        )}
        {category.notice ? (
          <p className="cat-notice" role="note">
            <Icon id="i-info" />
            <span>{category.notice}</span>
          </p>
        ) : null}
        <CategoryProducts categoryId={category.id} />
      </div>
    </div>
  );
}

function StoreNotFound() {
  return (
    <div className="wrap" style={{ padding: "80px 0", textAlign: "center" }}>
      <h1>هذه الصفحة غير موجودة</h1>
      <p style={{ marginTop: 12 }}>
        <Link className="btn btn-primary" href="/">
          العودة إلى الرئيسية
        </Link>
      </p>
    </div>
  );
}

// ---------------- dashboard (src/app/(admin)/admin) ----------------

function AdminApp({ pathname }: { pathname: string }) {
  const params = useSearchParams();
  const role = getRoleSync();
  const loggedIn = role !== null;
  const isLogin = pathname === "/admin/login";
  // Pages open to the call center too (see `adminOnlyPage` in src/server/auth.ts for the real app).
  const staffPage = pathname === "/admin" || pathname.startsWith("/admin/orders") || pathname === "/admin/customers";
  const blocked = loggedIn && !isLogin && role !== "admin" && !staffPage;

  // Same rules as the admin layouts: the login page sends signed-in users on, every other page needs a session,
  // and admin-only pages send the call center to the orders.
  useLayoutEffect(() => {
    if (isLogin && loggedIn) navigate(params.get("next")?.startsWith("/admin") ? params.get("next")! : "/admin");
    if (!isLogin && !loggedIn) navigate("/admin/login");
    if (blocked) navigate("/admin/orders");
  }, [isLogin, loggedIn, blocked, params]);

  if (isLogin) {
    const next = params.get("next");
    return (
      <ToastProvider>
        {!loggedIn ? <LoginForm next={next?.startsWith("/admin") ? next : "/admin"} devHint /> : null}
      </ToastProvider>
    );
  }
  if (!loggedIn || blocked) return null;

  const id = pathname.match(/^\/admin\/(?:orders|products)\/([^/]+)$/)?.[1];
  let page: React.ReactNode;
  if (pathname === "/admin") page = <Dashboard />;
  else if (pathname === "/admin/orders") page = <OrdersList />;
  else if (pathname.startsWith("/admin/orders/") && id) page = <OrderDetails key={id} id={id} />;
  else if (pathname === "/admin/products") page = <ProductsList />;
  else if (pathname === "/admin/products/new") page = <ProductForm key="new" />;
  else if (pathname.startsWith("/admin/products/") && id) page = <ProductForm key={id} id={id} />;
  else if (pathname === "/admin/categories")
    page = (
      <>
        <IllustrationSprite />
        <CategoriesManager />
      </>
    );
  else if (pathname === "/admin/sync") page = <SyncPage />;
  else if (pathname === "/admin/settings") page = <SettingsPage />;
  else if (pathname === "/admin/reports") page = <ReportsPage />;
  else if (pathname === "/admin/customers") page = <CustomersPage />;
  else if (pathname === "/admin/arrange") page = <ArrangePage />;
  else page = <div className="empty">هذه الصفحة غير موجودة</div>;

  return (
    <ToastProvider>
      <div className="adm">
        <AdminNav />
        <main className="adm-main">{page}</main>
      </div>
    </ToastProvider>
  );
}

// ---------------- demo bar ----------------

/** Small floating bar that only exists in the demo: switch between store and dashboard, and reset the data. */
function DemoBar({ admin }: { admin: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    if (!confirming) return setConfirming(true);
    resetData();
    try {
      localStorage.removeItem("abuelfadl_cart");
    } catch {
      // ignore
    }
    setConfirming(false);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
    navigate(admin ? "/admin" : "/");
    window.location.hash = "";
    // Remount so every screen reads the original data again.
    window.dispatchEvent(new Event("demo-reset"));
  };

  return (
    <div className="demo-bar" role="region" aria-label="نسخة تجريبية">
      <span className="demo-tag">نسخة تجريبية</span>
      <button type="button" onClick={() => navigate(admin ? "/" : "/admin")}>
        {admin ? "فتح المتجر" : "لوحة التحكم"}
      </button>
      {admin ? (
        <button type="button" className={confirming ? "warn" : undefined} onClick={reset} onBlur={() => setConfirming(false)}>
          {done ? "تمت الاستعادة ✓" : confirming ? "هل أنت متأكد؟ اضغط مرة أخرى" : "استعادة البيانات الأصلية"}
        </button>
      ) : null}
    </div>
  );
}
