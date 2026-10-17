"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/features/cart/CartProvider";
import { useCartDrawer } from "@/features/cart/CartDrawer";
import { SearchBox } from "@/features/search/SearchBox";
import { Icon } from "../ui/Icon";
import { useChrome } from "./ChromeProvider";
import { Wordmark } from "./Wordmark";

/**
 * Site header: logo, search box, account and cart buttons.
 * Scrolled shadow, `--hh` height variable, mobile search reveal, account toast, the search box (`SearchBox`)
 * and the cart button with its count badge (opens the cart drawer).
 */
export function Header() {
  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { searchOpen, showToast } = useChrome();
  const { count } = useCart();
  const { openCart } = useCartDrawer();

  // Adds the `scrolled` class after 8px of scroll (v29 `onScroll`).
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 8);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // When the mobile search box is revealed, focus it (v29 focuses right after toggling).
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // Publishes the header height as the CSS variable `--hh` (v29 `setHH`).
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const setHeight = () => root.style.setProperty("--hh", `${bar.getBoundingClientRect().height - 1}px`);
    setHeight();
    window.addEventListener("resize", setHeight);
    const observer = new ResizeObserver(setHeight);
    observer.observe(bar);
    return () => {
      window.removeEventListener("resize", setHeight);
      observer.disconnect();
    };
  }, []);

  const className = ["hdr-bar", scrolled ? "scrolled" : "", searchOpen ? "search-open" : ""].filter(Boolean).join(" ");

  return (
    <div className={className} id="hdrBar" ref={barRef}>
      <header className="wrap hdr">
        <Link className="logo" href="/" id="logo" aria-label="أبو الفضل ستور، الصفحة الرئيسية">
          <Wordmark />
        </Link>
        <SearchBox inputRef={inputRef} />
        <div className="hdr-act">
          <button
            className="circ acct"
            id="acct"
            type="button"
            aria-label="حسابي"
            onClick={() => showToast("تسجيل الدخول يتفعّل عند ربط الموقع بنظام الحسابات")}
          >
            <Icon id="i-user" />
          </button>
          <button className="cart-btn" id="cartBtn" type="button" aria-label="فتح سلة الطلبات" onClick={openCart}>
            <Icon id="i-cart" />
            <span className="lbl">السلة</span>
            <span className="cc" hidden={count === 0}>
              {count}
            </span>
          </button>
        </div>
      </header>
    </div>
  );
}
