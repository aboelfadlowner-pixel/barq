"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCartDrawer } from "@/features/cart/CartDrawer";
import { useCart } from "@/features/cart/CartProvider";
import { instantScroll } from "@/lib/scroll";
import { Icon } from "../ui/Icon";
import { useChrome } from "./ChromeProvider";

/**
 * Mobile bottom navigation (shown by the CSS below 900px).
 * home / cats / cart / search behave as in v29; the fourth slot (v29 "account") opens «اتصل بنا».
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { searchOpen, setSearchOpen } = useChrome();
  const { count } = useCart();
  const { openCart } = useCartDrawer();
  const onHome = pathname === "/";
  const onCategory = pathname.startsWith("/category");
  const onContact = pathname === "/contact";

  const goHome = () => {
    if (onHome) instantScroll(() => window.scrollTo(0, 0));
    else router.push("/");
  };

  const goCategories = () => {
    const section = document.getElementById("catsSec");
    if (onHome && section) instantScroll(() => section.scrollIntoView({ block: "start" }));
    else router.push("/#catsSec");
  };

  const toggleSearch = () => {
    setSearchOpen(!searchOpen); // Header focuses the input once it is visible
  };

  return (
    <nav className="bnav" aria-label="التنقل">
      <button type="button" className={onHome ? "on" : undefined} onClick={goHome}>
        <Icon id="i-home" />
        الرئيسية
      </button>
      <button type="button" className={onCategory ? "on" : undefined} onClick={goCategories}>
        <Icon id="i-all" />
        الأقسام
      </button>
      <button type="button" data-nav="cart" onClick={openCart}>
        <Icon id="i-cart" />
        السلة
        <span className="cc" hidden={count === 0}>
          {count}
        </span>
      </button>
      {/* «حسابي» comes back here when customer accounts exist; until then the slot opens the contact page. */}
      <button type="button" className={onContact ? "on" : undefined} onClick={() => router.push("/contact")}>
        <Icon id="i-phone" />
        تواصل معنا
      </button>
      <button type="button" onClick={toggleSearch}>
        <Icon id="i-search" />
        بحث
      </button>
    </nav>
  );
}
