import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RevealObserver } from "@/components/layout/RevealObserver";
import { BottomNav } from "@/components/layout/BottomNav";
import { ChromeProvider } from "@/components/layout/ChromeProvider";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { OverlayProvider } from "@/components/layout/OverlayProvider";
import { Notice } from "@/components/layout/Notice";
import { CheckoutProvider } from "@/features/checkout/CheckoutProvider";
import { CartDrawer } from "@/features/cart/CartDrawer";
import { CartProvider } from "@/features/cart/CartProvider";
import { CatalogProvider } from "@/features/catalog/CatalogProvider";
import { ProductSheetProvider } from "@/features/products/ProductSheet";
import { SearchProvider } from "@/features/search/SearchProvider";
import { CategorySwitcherSheet } from "@/features/products/CategorySwitcher";
import { FavoritesProvider } from "@/features/products/FavoritesProvider";
import { catalogService } from "@/services";
import { IconSprite, IllustrationSprite } from "@/components/layout/Sprites";

export const metadata: Metadata = {
  title: "أبو الفضل ستور بريميوم",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, products] = await Promise.all([catalogService.getCategories(), catalogService.getProducts()]);
  // The browser only needs these fields (v29 does not show the description or the offer flag).
  const catalogProducts = products.map(({ description: _description, offer: _offer, ...product }) => product);
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Same as v29 `00-core.js`: the `js` class is what lets the CSS hide .rv elements until they scroll into view. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {/* Readex Pro (Arabic + Latin, geometric) for headings and body; replaces v29's Cairo + IBM Plex Sans Arabic. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300..700&display=swap"
        />
      </head>
      <body>
        <div className="app" dir="rtl" lang="ar">
          <IconSprite />
          <IllustrationSprite />
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
                          <main id="top">{children}</main>
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
        </div>
      </body>
    </html>
  );
}
