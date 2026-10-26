"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardStats } from "@/server/orders";
import type { BlockedPhone } from "@/types/order";
import { api, formatDateTime } from "./api";
import { useToast } from "./ui";

/**
 * Blocked numbers for the orders and customers pages: who is blocked, and whether this user may change it
 * (the manager only; the call center sees the badge).
 */
export function useBlocked() {
  const [list, setList] = useState<BlockedPhone[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const reload = useCallback(() => api<BlockedPhone[]>("/api/admin/blocked").then(setList, () => setList([])), []);

  useEffect(() => {
    reload();
    api<DashboardStats>("/api/admin/stats").then(
      (stats) => setIsAdmin(stats.role === "admin"),
      () => setIsAdmin(false),
    );
  }, [reload]);

  const byPhone = new Map((list ?? []).map((entry) => [entry.phone, entry]));
  return { list, byPhone, isAdmin, reload };
}

export function BlockedBadge({ entry }: { entry: BlockedPhone | undefined }) {
  if (!entry) return null;
  return (
    <span className="badge red" title={entry.reason ? `السبب: ${entry.reason}` : undefined}>
      رقم محظور
    </span>
  );
}

/**
 * «حظر» (asks for an optional reason first) or «إلغاء الحظر», for the manager. Shows nothing to the call center.
 * `onChange` runs after a successful change so the page can reload its list.
 */
export function BlockControl({ phone, entry, isAdmin, onChange }: { phone: string; entry: BlockedPhone | undefined; isAdmin: boolean; onChange: () => void }) {
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const run = async (request: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await request();
      toast(message);
      setAsking(false);
      setReason("");
      onChange();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (entry) {
    return (
      <button
        className="btn btn-sm"
        type="button"
        disabled={busy}
        onClick={() => run(() => api(`/api/admin/blocked?phone=${phone}`, { method: "DELETE" }), `تم إلغاء حظر ${phone}`)}
      >
        إلغاء الحظر
      </button>
    );
  }

  if (!asking) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setAsking(true)}>
        حظر
      </button>
    );
  }

  return (
    <span className="block-ask">
      <input
        className="input"
        placeholder="السبب (اختياري): طلبات وهمية…"
        maxLength={200}
        value={reason}
        autoFocus
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
      />
      <button
        className="btn btn-sm btn-danger"
        type="button"
        disabled={busy}
        onClick={() =>
          run(
            () =>
              api("/api/admin/blocked", {
                method: "POST",
                body: { phone, reason },
              }),
            `تم حظر ${phone}: لن يستطيع الطلب من الموقع`,
          )
        }
      >
        تأكيد الحظر
      </button>
      <button className="btn btn-sm btn-ghost" type="button" onClick={() => setAsking(false)}>
        إلغاء
      </button>
    </span>
  );
}

/** «المحظورين» tab of the customers page: every blocked number, its reason and date, with «إلغاء الحظر». */
export function BlockedList({ list, names, isAdmin, onChange }: { list: BlockedPhone[]; names: Map<string, string>; isAdmin: boolean; onChange: () => void }) {
  if (!list.length) return <div className="empty">لا توجد أرقام محظورة. يمكن حظر رقم من صفحة العملاء أو من تفاصيل الطلب.</div>;
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>الموبايل</th>
            <th>الاسم</th>
            <th>السبب</th>
            <th>تاريخ الحظر</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((entry) => (
            <tr key={entry.phone}>
              <td className="num">{entry.phone}</td>
              <td>{names.get(entry.phone) ?? <span className="muted">—</span>}</td>
              <td>{entry.reason || <span className="muted">بدون سبب</span>}</td>
              <td className="muted">{formatDateTime(entry.blockedAt)}</td>
              <td>
                <BlockControl phone={entry.phone} entry={entry} isAdmin={isAdmin} onChange={onChange} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
