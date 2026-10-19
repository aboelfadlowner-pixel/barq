"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { StoredOrder } from "@/types/order";
import { api, egp, formatDateTime } from "./api";

/** Orders list (newest first) with search. Refreshes every 30 s so new orders appear without reloading. */
export function OrdersList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<StoredOrder[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<StoredOrder[]>("/api/admin/orders").then(
        (list) => alive && setOrders(list),
        (err: Error) => alive && setError(err.message),
      );
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const needle = search.trim().toLowerCase();
  const visible = (orders ?? []).filter(
    (order) =>
      !needle || `${order.number} ${order.customer.name} ${order.customer.phone}`.toLowerCase().includes(needle),
  );

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>الطلبات</h1>
          <p>{orders ? `${orders.length} طلب، ` : ""}اضغط على أي طلب عشان تشوف تفاصيله</p>
        </div>
      </div>
      <div className="toolbar">
        <input className="input" type="search" placeholder="ابحث برقم الطلب أو الاسم أو الموبايل" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <div className="card">
        {orders === null ? (
          <div className="empty">جاري التحميل…</div>
        ) : visible.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>الموبايل</th>
                  <th>الوقت</th>
                  <th>المنتجات</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id} className="link" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                    <td className="num">{order.number}</td>
                    <td>{order.customer.name}</td>
                    <td className="num">{order.customer.phone}</td>
                    <td className="muted">{formatDateTime(order.createdAt)}</td>
                    <td className="num">{order.lines.length}</td>
                    <td className="num">{egp(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">مفيش طلبات هنا</div>
        )}
      </div>
    </>
  );
}
