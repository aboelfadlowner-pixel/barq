"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoredOrder } from "@/types/order";
import { api, egp, formatDateTime, formatQty } from "./api";
import { BlockControl, BlockedBadge, useBlocked } from "./blocking";
import { Ic, useToast } from "./ui";

export function OrderDetails({ id }: { id: string }) {
  const toast = useToast();
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const blocked = useBlocked();

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
  if (!order) return <div className="empty">جارٍ التحميل…</div>;

  const whatsapp = `https://wa.me/2${order.customer.phone}`;
  const blockEntry = blocked.byPhone.get(order.customer.phone);

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
                    <td colSpan={3}>الإجمالي (الدفع نقدًا عند الاستلام)</td>
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
                <BlockedBadge entry={blockEntry} />
                <BlockControl phone={order.customer.phone} entry={blockEntry} isAdmin={blocked.isAdmin} onChange={blocked.reload} />
              </dd>
              {blockEntry ? (
                <>
                  <dt>الحظر</dt>
                  <dd>
                    لا يستطيع الطلب من الموقع منذ {formatDateTime(blockEntry.blockedAt)}
                    {blockEntry.reason ? ` · السبب: ${blockEntry.reason}` : ""}
                  </dd>
                </>
              ) : null}
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
            <textarea className="textarea" placeholder="مثلًا: طلب العميل الاتصال به قبل الوصول" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn" type="button" disabled={busy || note === order.staffNote} onClick={() => save({ staffNote: note }, "تم حفظ الملاحظة")}>
              حفظ الملاحظة
            </button>
            <small className="muted">آخر تحديث: {formatDateTime(order.updatedAt)}</small>
          </div>
        </div>
      </div>
    </>
  );
}
