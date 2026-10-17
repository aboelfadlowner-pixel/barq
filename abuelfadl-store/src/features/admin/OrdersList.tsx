"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus, type StoredOrder } from "@/types/order";
import { api, egp, formatDateTime } from "./api";
import { StatusBadge } from "./ui";

/** Orders list with status tabs and search. Refreshes every 30 s so new orders appear without reloading. */
export function OrdersList() {
  const router = useRouter();
  const params = useSearchParams();
  const status = (params.get("status") as OrderStatus | null) ?? "";
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

  const setStatus = (next: OrderStatus | "") => router.replace(next ? `/admin/orders?status=${next}` : "/admin/orders");
  const needle = search.trim().toLowerCase();
  const visible = (orders ?? []).filter(
    (order) =>
      (!status || order.status === status) &&
      (!needle || `${order.number} ${order.customer.name} ${order.customer.phone}`.toLowerCase().includes(needle)),
  );
  const countOf = (s: OrderStatus) => (orders ?? []).filter((order) => order.status === s).length;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>الطلبات</h1>
          <p>اضغط على أي طلب لتفاصيله وتغيير حالته</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button type="button" className={!status ? "on" : undefined} onClick={() => setStatus("")}>
          الكل<span className="n num">{orders?.length ?? 0}</span>
        </button>
        {ORDER_STATUSES.map((s) => (
          <button key={s} type="button" className={status === s ? "on" : undefined} onClick={() => setStatus(s)}>
            {ORDER_STATUS_LABELS[s]}
            <span className="n num">{countOf(s)}</span>
          </button>
        ))}
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
                  <th>الحالة</th>
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
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
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
