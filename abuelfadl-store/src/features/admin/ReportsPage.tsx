"use client";

import { useEffect, useState } from "react";
import type { SalesReport } from "@/server/reports";
import type { StoredOrder } from "@/types/order";
import { api, egp, formatQty } from "./api";
import { downloadCsv } from "./download";
import { Ic, useToast } from "./ui";

const PERIODS = [
  { days: 1, label: "النهارده" },
  { days: 7, label: "آخر 7 أيام" },
  { days: 30, label: "آخر 30 يوم" },
  { days: 90, label: "آخر 3 شهور" },
];

const dayLabel = (day: string) => {
  const [, m, d] = day.split("-");
  return `${Number(d)}/${Number(m)}`;
};
const hourLabel = (hour: number) => `${hour % 12 || 12}${hour < 12 ? "ص" : "م"}`;
/** Cairo date and time for the export, e.g. ["2026-10-19", "14:05"]. */
const cairoParts = (iso: string) => {
  const date = new Date(iso);
  return [
    date.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }),
    date.toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" }),
  ];
};

/** Sales reports: period totals, sales per day and per hour, best sellers, categories, and the Excel export. */
export function ReportsPage() {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setReport(null);
    api<SalesReport>(`/api/admin/reports?days=${days}`).then(setReport, (err: Error) => setError(err.message));
  }, [days]);

  /** Orders of the selected period, from the same rule as the report (Cairo days, cancelled left out). */
  const periodOrders = async () => {
    const orders = await api<StoredOrder[]>("/api/admin/orders");
    const from = report?.daily[0]?.day ?? "";
    return orders.filter((order) => order.status !== "cancelled" && cairoParts(order.createdAt)[0] >= from).reverse();
  };

  const exportOrders = async () => {
    const orders = await periodOrders();
    if (!orders.length) return toast("مفيش طلبات في الفترة دي");
    downloadCsv(`abuelfadl-orders-${report!.daily[0].day}_${report!.daily.at(-1)!.day}.csv`, [
      ["رقم الطلب", "التاريخ", "الوقت", "العميل", "الموبايل", "المنطقة", "العنوان", "ملاحظة العميل", "عدد الأصناف", "الأصناف", "المنتجات", "التوصيل", "الإجمالي"],
      ...orders.map((order) => [
        order.number,
        ...cairoParts(order.createdAt),
        order.customer.name,
        order.customer.phone,
        order.deliveryArea ?? "",
        order.customer.address,
        order.customer.note,
        order.lines.length,
        order.lines.map((line) => `${line.name} × ${formatQty(line.quantity, line.weighed)}`).join(" | "),
        order.subtotal ?? order.total - (order.deliveryFee ?? 0),
        order.deliveryFee ?? 0,
        order.total,
      ]),
    ]);
  };

  const exportLines = async () => {
    const orders = await periodOrders();
    if (!orders.length) return toast("مفيش طلبات في الفترة دي");
    downloadCsv(`abuelfadl-items-${report!.daily[0].day}_${report!.daily.at(-1)!.day}.csv`, [
      ["رقم الطلب", "التاريخ", "الموبايل", "كود المنتج", "المنتج", "بالوزن", "الكمية", "السعر", "الإجمالي"],
      ...orders.flatMap((order) =>
        order.lines.map((line) => [order.number, cairoParts(order.createdAt)[0], order.customer.phone, line.productId, line.name, line.weighed ? "كجم" : "قطعة", line.quantity, line.price, line.lineTotal]),
      ),
    ]);
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>التقارير</h1>
          <p>من الطلبات اللي جت من الموقع</p>
        </div>
        <div className="row">
          <button className="btn btn-sm" type="button" disabled={!report?.orders} onClick={exportOrders}>
            <Ic name="download" />
            Excel الطلبات
          </button>
          <button className="btn btn-sm" type="button" disabled={!report?.orders} onClick={exportLines}>
            <Ic name="download" />
            Excel الأصناف
          </button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {PERIODS.map((period) => (
          <button key={period.days} type="button" className={days === period.days ? "on" : undefined} onClick={() => setDays(period.days)}>
            {period.label}
          </button>
        ))}
      </div>
      {error ? <div className="alert">{error}</div> : null}
      {!report ? (
        <div className="empty">جاري التحميل…</div>
      ) : (
        <div className="stack">
          <div className="stats" style={{ marginBottom: 0 }}>
            <div className="card stat">
              <span>المبيعات (المنتجات)</span>
              <b className="num">{egp(report.revenue)}</b>
            </div>
            <div className="card stat">
              <span>عدد الطلبات</span>
              <b className="num">{report.orders}</b>
            </div>
            <div className="card stat">
              <span>متوسط الطلب</span>
              <b className="num">{egp(report.averageOrder)}</b>
            </div>
            <div className="card stat">
              <span>رسوم التوصيل</span>
              <b className="num">{egp(report.deliveryFees)}</b>
            </div>
            <div className="card stat">
              <span>عملاء طلبوا</span>
              <b className="num">{report.customers}</b>
            </div>
          </div>

          {report.orders === 0 ? (
            <div className="card empty">مفيش طلبات في الفترة دي لسه.</div>
          ) : (
            <>
              {report.days > 1 ? (
                <div className="card card-pad stack">
                  <h2>المبيعات بالأيام</h2>
                  <Bars items={report.daily.map((d) => ({ label: dayLabel(d.day), value: d.revenue, note: `${d.orders} طلب` }))} format={egp} />
                </div>
              ) : null}
              <div className="card card-pad stack">
                <h2>الطلبات بالساعة</h2>
                <p className="muted" style={{ fontSize: 13 }}>
                  تعرف منها وقت الزحمة وتظبط عليه الشيفتات
                </p>
                <Bars items={report.byHour.map((count, hour) => ({ label: hourLabel(hour), value: count, note: "" }))} format={(n) => `${n} طلب`} />
              </div>
              <div className="report-grid">
                <TopTable title="الأكثر مبيعًا (بالفلوس)" rows={report.topByRevenue} />
                <TopTable title="الأكثر طلبًا (بعدد الطلبات)" rows={report.topByOrders} />
              </div>
              <div className="card card-pad stack">
                <h2>المبيعات بالأقسام</h2>
                <div className="hbars">
                  {report.byCategory.map((c) => (
                    <div key={c.name} className="hbar">
                      <span>{c.name}</span>
                      <i style={{ width: `${Math.max(2, (c.revenue / report.byCategory[0].revenue) * 100)}%` }} />
                      <b className="num">
                        {egp(c.revenue)} <small className="muted">({Math.round((c.revenue / report.revenue) * 100)}%)</small>
                      </b>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Vertical bar chart in plain HTML/CSS. Hover (or tap) a bar for its exact value. */
function Bars({ items, format }: { items: { label: string; value: number; note: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const every = Math.ceil(items.length / 12); // label every Nth bar so they never overlap
  return (
    <div className="bars" style={{ "--n": items.length } as React.CSSProperties}>
      {items.map((item, i) => (
        <div key={i} className="bar" title={`${item.label}: ${format(item.value)}${item.note ? ` · ${item.note}` : ""}`}>
          <i style={{ height: `${(item.value / max) * 100}%` }} className={item.value ? undefined : "zero"} />
          <span>{i % every === 0 ? item.label : ""}</span>
        </div>
      ))}
    </div>
  );
}

function TopTable({ title, rows }: { title: string; rows: SalesReport["topByRevenue"] }) {
  return (
    <div className="card">
      <div className="card-pad">
        <h2>{title}</h2>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>طلبات</th>
              <th>المبيعات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.productId}>
                <td className="num muted">{i + 1}</td>
                <td>{row.name}</td>
                <td className="num">{formatQty(row.quantity, row.weighed)}</td>
                <td className="num">{row.orders}</td>
                <td className="num">{egp(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
