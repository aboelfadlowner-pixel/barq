"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { normalizeArabic } from "@/lib/arabic";
import type { Customer } from "@/server/reports";
import type { StoredOrder } from "@/types/order";
import { api, egp, formatDateTime } from "./api";
import { BlockControl, BlockedBadge, BlockedList, useBlocked } from "./blocking";
import { downloadCsv } from "./download";
import { Ic } from "./ui";

type Sort = "last" | "total" | "orders" | "idle";

const SORTS: { value: Sort; label: string }[] = [
  { value: "last", label: "آخر طلب" },
  { value: "total", label: "الأكثر شراءً" },
  { value: "orders", label: "الأكثر طلبات" },
  { value: "idle", label: "توقفوا عن الطلب" },
];

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/** Customers built from the website orders: who orders, how often and how much. Click a row for their orders. */
export function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("last");
  const [tab, setTab] = useState<"all" | "blocked">("all");
  const blocked = useBlocked();
  // Names for the blocked tab, from every order (a blocked number often has cancelled orders only, not counted above).
  const [orderNames, setOrderNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    api<Customer[]>("/api/admin/customers").then(setCustomers, (err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (tab !== "blocked") return;
    api<StoredOrder[]>("/api/admin/orders").then(
      (orders) => setOrderNames(new Map([...orders].reverse().map((order) => [order.customer.phone, order.customer.name]))),
      () => undefined,
    );
  }, [tab]);

  const visible = useMemo(() => {
    const needle = normalizeArabic(search);
    const list = (customers ?? []).filter((c) => !needle || normalizeArabic(`${c.name} ${c.phone} ${c.address}`).includes(needle));
    const by: Record<Sort, (a: Customer, b: Customer) => number> = {
      last: (a, b) => b.lastOrder.localeCompare(a.lastOrder),
      total: (a, b) => b.total - a.total,
      orders: (a, b) => b.orders - a.orders || b.total - a.total,
      // Repeat customers whose last order is the oldest first: the ones worth a call.
      idle: (a, b) => Number(b.orders > 1) - Number(a.orders > 1) || a.lastOrder.localeCompare(b.lastOrder),
    };
    return [...list].sort(by[sort]);
  }, [customers, search, sort]);

  const all = customers ?? [];
  const repeat = all.filter((c) => c.orders > 1).length;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>العملاء</h1>
          <p>من طلبات الموقع، عميل لكل رقم موبايل</p>
        </div>
        <button
          className="btn btn-sm"
          type="button"
          disabled={!all.length}
          onClick={() =>
            downloadCsv("abuelfadl-customers.csv", [
              ["الاسم", "الموبايل", "العنوان", "عدد الطلبات", "إجمالي الشراء", "أول طلب", "آخر طلب"],
              ...visible.map((c) => [c.name, c.phone, c.address, c.orders, c.total, c.firstOrder.slice(0, 10), c.lastOrder.slice(0, 10)]),
            ])
          }
        >
          <Ic name="download" />
          Excel
        </button>
      </div>
      <div className="stats">
        <div className="card stat">
          <span>عدد العملاء</span>
          <b className="num">{all.length}</b>
        </div>
        <div className="card stat">
          <span>طلبوا أكثر من مرة</span>
          <b className="num">
            {repeat} <small className="muted">{all.length ? `(${Math.round((repeat / all.length) * 100)}%)` : ""}</small>
          </b>
        </div>
        <div className="card stat">
          <span>متوسط الشراء للعميل</span>
          <b className="num">{egp(all.length ? Math.round(all.reduce((s, c) => s + c.total, 0) / all.length) : 0)}</b>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "all"} className={tab === "all" ? "on" : undefined} onClick={() => setTab("all")}>
          كل العملاء
        </button>
        <button type="button" role="tab" aria-selected={tab === "blocked"} className={tab === "blocked" ? "on" : undefined} onClick={() => setTab("blocked")}>
          المحظورين{blocked.list?.length ? ` (${blocked.list.length})` : ""}
        </button>
      </div>
      {tab === "blocked" ? (
        <div className="card">
          {blocked.list === null ? (
            <div className="empty">جارٍ التحميل…</div>
          ) : (
            <BlockedList list={blocked.list} names={orderNames} isAdmin={blocked.isAdmin} onChange={blocked.reload} />
          )}
        </div>
      ) : null}
      <div className="toolbar" hidden={tab !== "all"}>
        <input className="input" type="search" placeholder="ابحث بالاسم أو الموبايل أو العنوان" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="الترتيب">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              ترتيب: {s.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <div className="card" hidden={tab !== "all"}>
        {customers === null ? (
          <div className="empty">جارٍ التحميل…</div>
        ) : visible.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الموبايل</th>
                  <th>الطلبات</th>
                  <th>إجمالي الشراء</th>
                  <th>آخر طلب</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.phone} className="link" onClick={() => router.push(`/admin/orders?q=${c.phone}`)}>
                    <td>
                      <b style={{ fontWeight: 500 }}>{c.name}</b> <BlockedBadge entry={blocked.byPhone.get(c.phone)} />
                      <div className="muted" style={{ fontSize: 12 }}>
                        {c.address}
                      </div>
                    </td>
                    <td className="num">{c.phone}</td>
                    <td className="num">
                      {c.orders} {c.orders > 1 ? <span className="badge green">متكرر</span> : null}
                    </td>
                    <td className="num">{egp(c.total)}</td>
                    <td className="muted">
                      {formatDateTime(c.lastOrder)}
                      <div style={{ fontSize: 12 }}>{daysSince(c.lastOrder) === 0 ? "اليوم" : `منذ ${daysSince(c.lastOrder)} يوم`}</div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row">
                        <a className="btn btn-sm" href={`https://wa.me/2${c.phone}`} target="_blank" rel="noreferrer">
                          واتساب
                        </a>
                        <BlockControl phone={c.phone} entry={blocked.byPhone.get(c.phone)} isAdmin={blocked.isAdmin} onChange={blocked.reload} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">{all.length ? "لا يوجد عملاء مطابقون" : "لا يوجد عملاء بعد. سيظهر هنا صاحب أول طلب من الموقع."}</div>
        )}
      </div>
    </>
  );
}
