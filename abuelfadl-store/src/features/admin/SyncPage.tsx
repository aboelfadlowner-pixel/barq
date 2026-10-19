"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SyncStatus } from "@/server/sync";
import type { SyncRun } from "@/types/sync";
import { api, egp, formatDateTime } from "./api";
import { Ic, useToast } from "./ui";

/** How many rows of the long lists are shown before "show more". */
const PAGE = 50;

/**
 * Prices from the Foodics products sheet: upload "المنتجات.csv", every product with the same SKU takes the sheet price.
 * Shows what changed, sheet SKUs no product uses yet, and the history. (Manual upload until Supabase is connected.)
 */
export function SyncPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<SyncRun | null>(null);

  const load = () =>
    api<SyncStatus>("/api/admin/sync").then(
      (next) => {
        setStatus(next);
        setLatest((current) => current ?? next.runs[0] ?? null);
      },
      (err: Error) => setError(err.message),
    );
  useEffect(() => {
    load();
  }, []);

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const csv = await file.text();
      const run = await api<SyncRun>("/api/admin/sync/products", { method: "POST", body: { csv, fileName: file.name } });
      setLatest(run);
      await load();
      toast(run.changes.length ? `تم تحديث سعر ${run.changes.length} منتج` : "لا يوجد تغيير في الأسعار");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>تحديث الأسعار</h1>
          <p>من شيت المنتجات الخاص بـ Foodics: كل منتج له نفس الـ SKU يأخذ سعر الشيت</p>
        </div>
        <div className="row">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            id="sheetFile"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Ic name="sync" />
            {busy ? "جارٍ التحديث…" : "رفع شيت المنتجات"}
          </button>
        </div>
      </div>

      {error ? <div className="alert" style={{ marginBottom: 14 }}>{error}</div> : null}

      {status ? (
        <div className="stats">
          <Link className="card stat" href="/admin/products?linked=yes">
            <span>منتجات مرتبطة بالشيت</span>
            <b className="num">{status.linkedProducts}</b>
          </Link>
          <Link className={`card stat${status.unlinkedProducts ? " alert-stat" : ""}`} href="/admin/products?linked=no">
            <span>منتجات بدون SKU</span>
            <b className="num">{status.unlinkedProducts}</b>
          </Link>
          <div className="card stat">
            <span>آخر تحديث</span>
            <b className="num" style={{ fontSize: 18 }}>
              {status.runs[0] ? formatDateTime(status.runs[0].at) : "لا يوجد"}
            </b>
          </div>
        </div>
      ) : !error ? (
        <div className="empty">جارٍ التحميل…</div>
      ) : null}

      {status && !latest ? (
        <div className="card card-pad stack">
          <h2>لا يوجد تحديث بعد</h2>
          <p className="muted">
            حمّل «المنتجات.csv» من مجلد «داتا سنتر» على الدرايف، ثم اضغط «رفع شيت المنتجات». يتم تحديث السعر فقط، ويبقى الاسم والصورة
            والقسم و«متوفر» كما أدخلتها.
          </p>
        </div>
      ) : null}

      {latest ? (
        <div className="stack">
          <div className="card card-pad stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>آخر تحديث: {formatDateTime(latest.at)}</h2>
              <span className="muted">{latest.source}</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge">
                صفوف الشيت <b className="num">{latest.rowsRead}</b>
              </span>
              <span className="badge green">
                تمت مطابقة <b className="num">{latest.matched}</b> منتج
              </span>
              <span className={`badge ${latest.changes.length ? "gold" : ""}`}>
                أسعار تغيّرت <b className="num">{latest.changes.length}</b>
              </span>
              <span className={`badge ${latest.missingFromSheet.length ? "red" : ""}`}>
                مرتبط وغير موجود في الشيت <b className="num">{latest.missingFromSheet.length}</b>
              </span>
              <span className="badge">
                SKU في الشيت وغير موجود على الموقع <b className="num">{latest.unlinkedCount}</b>
              </span>
            </div>
          </div>

          <ChangesTable run={latest} />
          {latest.missingFromSheet.length ? <MissingTable run={latest} /> : null}
          {status && status.runs[0]?.at === latest.at ? <UnlinkedTable status={status} /> : null}
          {status && status.runs.length > 1 ? <History runs={status.runs} onPick={setLatest} current={latest} /> : null}
        </div>
      ) : null}
    </>
  );
}

function ChangesTable({ run }: { run: SyncRun }) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <div className="card">
      <div className="card-pad">
        <h2>الأسعار التي تغيّرت</h2>
      </div>
      {run.changes.length ? (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>SKU</th>
                <th>كان</th>
                <th>أصبح</th>
                <th>الفرق</th>
              </tr>
            </thead>
            <tbody>
              {run.changes.slice(0, limit).map((change) => {
                const diff = Math.round((change.newPrice - change.oldPrice) * 100) / 100;
                return (
                  <tr key={change.productId}>
                    <td>
                      <Link href={`/admin/products/${change.productId}`}>{change.name}</Link>
                    </td>
                    <td className="num muted">{change.sku}</td>
                    <td className="num muted">{egp(change.oldPrice)}</td>
                    <td className="num">
                      <b style={{ fontWeight: 600 }}>{egp(change.newPrice)}</b>
                    </td>
                    <td>
                      <span className={`badge ${diff > 0 ? "red" : "green"} num`}>
                        {diff > 0 ? "+" : ""}
                        {diff}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <More total={run.changes.length} limit={limit} onMore={() => setLimit((n) => n + PAGE)} />
        </div>
      ) : (
        <div className="empty">كل الأسعار المرتبطة مطابقة للشيت</div>
      )}
    </div>
  );
}

function MissingTable({ run }: { run: SyncRun }) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <div className="card">
      <div className="card-pad stack" style={{ gap: 4 }}>
        <h2>مرتبطة بـ SKU غير موجود في الشيت</h2>
        <p className="muted">لم يتم تحديث سعرها. غالبًا الـ SKU مكتوب بشكل خاطئ أو تم حذف المنتج من Foodics: راجع الـ SKU في صفحة المنتج.</p>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>SKU</th>
            </tr>
          </thead>
          <tbody>
            {run.missingFromSheet.slice(0, limit).map((item) => (
              <tr key={item.productId}>
                <td>
                  <Link href={`/admin/products/${item.productId}`}>{item.name}</Link>
                </td>
                <td className="num muted">{item.sku}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <More total={run.missingFromSheet.length} limit={limit} onMore={() => setLimit((n) => n + PAGE)} />
      </div>
    </div>
  );
}

function UnlinkedTable({ status }: { status: SyncStatus }) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const needle = search.trim().toLowerCase();
  const rows = status.unlinkedSkus.filter((row) => !needle || `${row.sku} ${row.name}`.toLowerCase().includes(needle));
  return (
    <div className="card">
      <div className="card-pad stack" style={{ gap: 8 }}>
        <h2>في الشيت وغير موجودة على الموقع</h2>
        <p className="muted">منتجات نشطة في Foodics ليس لها منتج على الموقع. إذا كان المنتج موجودًا على الموقع باسم آخر، فاكتب الـ SKU الخاص به في صفحته.</p>
        <input className="input" type="search" placeholder="ابحث بالاسم أو الـ SKU" value={search} onChange={(e) => (setSearch(e.target.value), setLimit(PAGE))} style={{ maxWidth: 320 }} />
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>الاسم في Foodics</th>
                <th>SKU</th>
                <th>السعر</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((row) => (
                <tr key={row.sku}>
                  <td>{row.name}</td>
                  <td className="num">{row.sku}</td>
                  <td className="num">
                    {egp(row.price)}
                    {row.weighed ? " / كجم" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <More total={rows.length} limit={limit} onMore={() => setLimit((n) => n + PAGE)} />
        </div>
      ) : (
        <div className="empty">لا يوجد</div>
      )}
    </div>
  );
}

function History({ runs, current, onPick }: { runs: SyncRun[]; current: SyncRun; onPick: (run: SyncRun) => void }) {
  return (
    <div className="card">
      <div className="card-pad">
        <h2>التحديثات السابقة</h2>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>الوقت</th>
              <th>المصدر</th>
              <th>المطابق</th>
              <th>تغيّر</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.at} className={`link${run.at === current.at ? " on" : ""}`} onClick={() => onPick(run)}>
                <td className="num">{formatDateTime(run.at)}</td>
                <td className="muted">{run.source}</td>
                <td className="num">{run.matched}</td>
                <td className="num">{run.changes.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function More({ total, limit, onMore }: { total: number; limit: number; onMore: () => void }) {
  if (total <= limit) return null;
  return (
    <div className="card-pad" style={{ textAlign: "center" }}>
      <button className="btn" type="button" onClick={onMore}>
        عرض المزيد ({total - limit})
      </button>
    </div>
  );
}
