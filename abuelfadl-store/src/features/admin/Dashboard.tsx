"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DashboardStats } from "@/server/orders";
import { api, egp, formatDateTime } from "./api";
import { StatusBadge } from "./ui";

export function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardStats>("/api/admin/stats").then(setStats, (err: Error) => setError(err.message));
  }, []);

  const logout = async () => {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/admin/login";
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>أهلًا بيك 👋</h1>
          <p>ملخص النهارده</p>
        </div>
        <div className="row">
          <a className="btn btn-sm" href="/" target="_blank" rel="noreferrer">
            فتح المتجر
          </a>
          <button className="btn btn-sm" type="button" onClick={logout}>
            خروج
          </button>
        </div>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      {stats ? (
        <>
          <div className="stats">
            <div className="card stat">
              <span>طلبات النهارده</span>
              <b className="num">{stats.todayOrders}</b>
            </div>
            <div className="card stat">
              <span>مبيعات النهارده</span>
              <b className="num">{egp(stats.todayRevenue)}</b>
            </div>
            <div className="card stat">
              <span>متوسط الطلب</span>
              <b className="num">{egp(stats.averageOrder)}</b>
            </div>
            <Link className={`card stat${stats.byStatus.new ? " alert-stat" : ""}`} href="/admin/orders?status=new">
              <span>طلبات جديدة مستنية</span>
              <b className="num">{stats.byStatus.new}</b>
            </Link>
            <Link className={`card stat${stats.outOfStock ? " alert-stat" : ""}`} href="/admin/products?stock=out">
              <span>منتجات خلصانة</span>
              <b className="num" dir="ltr" style={{ textAlign: "right" }}>
                {stats.outOfStock} <small className="muted">/ {stats.products}</small>
              </b>
            </Link>
          </div>

          <div className="card">
            <div className="card-pad row" style={{ justifyContent: "space-between" }}>
              <h2>آخر الطلبات</h2>
              <Link className="btn btn-sm" href="/admin/orders">
                كل الطلبات
              </Link>
            </div>
            {stats.latestOrders.length ? (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>رقم الطلب</th>
                      <th>العميل</th>
                      <th>الوقت</th>
                      <th>الإجمالي</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.latestOrders.map((order) => (
                      <tr key={order.id} className="link" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                        <td className="num">{order.number}</td>
                        <td>{order.customer.name}</td>
                        <td className="muted">{formatDateTime(order.createdAt)}</td>
                        <td className="num">{egp(order.total)}</td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">لسه مفيش طلبات. اعمل طلب تجربة من المتجر وهيظهر هنا.</div>
            )}
          </div>
        </>
      ) : !error ? (
        <div className="empty">جاري التحميل…</div>
      ) : null}
    </>
  );
}
