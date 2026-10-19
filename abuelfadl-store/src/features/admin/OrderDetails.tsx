"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoredOrder } from "@/types/order";
import { api, egp, formatDateTime, formatQty } from "./api";
import { Ic, useToast } from "./ui";

export function OrderDetails({ id }: { id: string }) {
  const toast = useToast();
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<StoredOrder>(`/api/admin/orders/${id}`).then(
      (found) => {
        setOrder(found);
        setNote(found.staffNote);
      },
      (err: Error) => setError(err.message),
    );
  }, [id]);

  const save = async (body: { staffNote: string }, message: string) => {
    setBusy(true);
    try {
      setOrder(await api<StoredOrder>(`/api/admin/orders/${id}`, { method: "PATCH", body }));
      toast(message);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="alert">{error}</div>;
  if (!order) return <div className="empty">جاري التحميل…</div>;

  const whatsapp = `https://wa.me/2${order.customer.phone}`;

  return (
    <>
      <div className="adm-head">
        <div className="row">
          <Link className="btn btn-sm btn-ghost" href="/admin/orders" aria-label="رجوع">
            <Ic name="back" />
          </Link>
          <div>
            <h1 className="num">{order.number}</h1>
            <p>{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <button className="btn btn-sm" type="button" onClick={() => window.print()}>
          طباعة
        </button>
      </div>

      <div className="order-grid">
        <div className="stack">
          <div className="card">
            <div className="card-pad">
              <h2>المنتجات</h2>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>السعر</th>
                    <th>الكمية</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={line.productId}>
                      <td>{line.name}</td>
                      <td className="num">
                        {egp(line.price)}
                        {line.weighed ? " / كجم" : ""}
                      </td>
                      <td className="num">{formatQty(line.quantity, line.weighed)}</td>
                      <td className="num">{egp(line.lineTotal)}</td>
                    </tr>
                  ))}
                  {order.deliveryArea ? (
                    <>
                      <tr>
                        <td colSpan={3} className="muted">
                          المنتجات
                        </td>
                        <td className="num">{egp(order.subtotal ?? order.total - (order.deliveryFee ?? 0))}</td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="muted">
                          التوصيل ({order.deliveryArea})
                        </td>
                        <td className="num">{egp(order.deliveryFee ?? 0)}</td>
                      </tr>
                    </>
                  ) : null}
                  <tr className="total-row">
                    <td colSpan={3}>الإجمالي (كاش عند الاستلام)</td>
                    <td className="num">{egp(order.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card card-pad stack">
            <h2>العميل</h2>
            <dl className="kv">
              <dt>الاسم</dt>
              <dd>{order.customer.name}</dd>
              <dt>الموبايل</dt>
              <dd className="row">
                <span className="num">{order.customer.phone}</span>
                <a className="btn btn-sm" href={`tel:${order.customer.phone}`}>
                  <Ic name="phone" />
                  اتصال
                </a>
                <a className="btn btn-sm" href={whatsapp} target="_blank" rel="noreferrer">
                  واتساب
                </a>
              </dd>
              {order.deliveryArea ? (
                <>
                  <dt>المنطقة</dt>
                  <dd>{order.deliveryArea}</dd>
                </>
              ) : null}
              <dt>العنوان</dt>
              <dd>{order.customer.address}</dd>
              {order.customer.note ? (
                <>
                  <dt>ملاحظة العميل</dt>
                  <dd>{order.customer.note}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </div>

        <div className="stack">
          <div className="card card-pad stack">
            <h2>ملاحظة داخلية</h2>
            <textarea className="textarea" placeholder="مثلاً: العميل طلب يتصل قبل ما يوصل" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn" type="button" disabled={busy || note === order.staffNote} onClick={() => save({ staffNote: note }, "الملاحظة اتحفظت")}>
              حفظ الملاحظة
            </button>
            <small className="muted">آخر تحديث: {formatDateTime(order.updatedAt)}</small>
          </div>
        </div>
      </div>
    </>
  );
}
