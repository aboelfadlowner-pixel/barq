"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { DashboardStats } from "@/server/orders";
import { api } from "./api";
import { Ic } from "./ui";

const LINKS = [
  { href: "/admin", label: "الرئيسية", icon: "home" },
  { href: "/admin/orders", label: "الطلبات", icon: "orders" },
  { href: "/admin/products", label: "المنتجات", icon: "box" },
  { href: "/admin/categories", label: "الأقسام", icon: "tag" },
];

/** How often the new-orders counter refreshes. */
const POLL_MS = 30_000;

export function AdminNav() {
  const pathname = usePathname();
  const [newOrders, setNewOrders] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<DashboardStats>("/api/admin/stats")
        .then((stats) => alive && setNewOrders(stats.byStatus.new))
        .catch(() => {});
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);

  const logout = async () => {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/admin/login";
  };

  return (
    <aside className="adm-side">
      <div className="adm-brand">
        <img src="/images/logo-icon.png" alt="" />
        <div>
          أبو الفضل
          <small>لوحة التحكم</small>
        </div>
      </div>
      <nav className="adm-nav">
        {LINKS.map((link) => {
          const on = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className={on ? "on" : undefined}>
              <Ic name={link.icon} />
              {link.label}
              {link.icon === "orders" && newOrders > 0 ? <span className="count num">{newOrders}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="adm-side-foot">
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
