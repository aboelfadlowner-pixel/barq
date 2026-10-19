"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { DashboardStats } from "@/server/orders";
import { ROLE_LABELS } from "@/types/auth";
import { api } from "./api";
import { AlertToggle, useNewOrderAlert } from "./NewOrderAlert";
import { Ic } from "./ui";

/** `main` links stay in the phone's bottom bar; the others open from «المزيد». `admin` links are hidden from the call center. */
const LINKS = [
  { href: "/admin", label: "الرئيسية", icon: "home", main: true },
  { href: "/admin/orders", label: "الطلبات", icon: "orders", main: true },
  { href: "/admin/products", label: "المنتجات", icon: "box", main: true, admin: true },
  { href: "/admin/customers", label: "العملاء", icon: "users", main: true },
  { href: "/admin/reports", label: "التقارير", icon: "chart", admin: true },
  { href: "/admin/arrange", label: "ترتيب المنتجات", icon: "sort", admin: true },
  { href: "/admin/categories", label: "الأقسام", icon: "tag", admin: true },
  { href: "/admin/sync", label: "الأسعار", icon: "sync", admin: true },
  { href: "/admin/settings", label: "الإعدادات", icon: "gear", admin: true },
];

/** How often the today's-orders counter (and the new-order alert) refreshes. */
const POLL_MS = 15_000;

export function AdminNav() {
  const pathname = usePathname();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const alert = useNewOrderAlert(stats);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<DashboardStats>("/api/admin/stats")
        .then((next) => alive && setStats(next))
        .catch(() => {});
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => setMoreOpen(false), [pathname]);

  const logout = async () => {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/admin/login";
  };

  const isOn = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const todayOrders = stats?.todayOrders ?? 0;
  // Until the role is known only the links both roles share are shown.
  const links = LINKS.filter((link) => !link.admin || stats?.role === "admin");
  const moreOn = links.some((link) => !link.main && isOn(link.href));

  return (
    <aside className="adm-side">
      <div className="adm-brand">
        <img src="/images/logo-icon.png" alt="" />
        <div>
          أبو الفضل
          <small>لوحة التحكم{stats ? ` · ${ROLE_LABELS[stats.role]}` : ""}</small>
        </div>
      </div>
      <nav className={moreOpen ? "adm-nav more-open" : "adm-nav"}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={`${isOn(link.href) ? "on" : ""}${link.main ? "" : " extra"}`.trim() || undefined}>
            <Ic name={link.icon} />
            {link.label}
            {link.icon === "orders" && todayOrders > 0 ? (
              <span className="count num" title="طلبات النهارده">
                {todayOrders}
              </span>
            ) : null}
          </Link>
        ))}
        <button type="button" className={moreOn || moreOpen ? "more-btn on" : "more-btn"} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
          <Ic name="more" />
          المزيد
        </button>
        <div className="more-foot">
          <AlertToggle enabled={alert.enabled} onToggle={alert.toggle} />
          <a href="/" target="_blank" rel="noreferrer">
            <Ic name="store" />
            فتح المتجر
          </a>
          <button type="button" onClick={logout}>
            <Ic name="logout" />
            خروج
          </button>
        </div>
      </nav>
      {moreOpen ? <button type="button" className="more-backdrop" aria-label="إغلاق" onClick={() => setMoreOpen(false)} /> : null}
      <div className="adm-side-foot">
        <AlertToggle className={alert.enabled ? "btn btn-ghost alert-on" : "btn btn-ghost"} enabled={alert.enabled} onToggle={alert.toggle} />
        <a className="btn btn-ghost" href="/" target="_blank" rel="noreferrer">
          <Ic name="store" />
          فتح المتجر
        </a>
        <button className="btn btn-ghost" type="button" onClick={logout}>
          <Ic name="logout" />
          خروج
        </button>
      </div>
    </aside>
  );
}
