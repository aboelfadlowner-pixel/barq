"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";
import { api, egp } from "./api";
import { Ic, useToast } from "./ui";

/**
 * «ترتيب المنتجات»: the order products show in on a category page. Drag a row (press and hold on a phone) or use the
 * arrows, then «حفظ الترتيب».
 * The «الأكثر مبيعًا» label can be switched from here too (saved at once).
 */
export function ArrangePage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [order, setOrder] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api<Category[]>("/api/admin/categories"), api<Product[]>("/api/admin/products")]).then(
      ([cats, list]) => {
        setCategories(cats);
        setProducts(list);
        setCategoryId((current) => current || cats[0]?.id || "");
      },
      (err: Error) => setError(err.message),
    );
  }, []);

  const saved = useMemo(() => (products ?? []).filter((p) => p.categoryId === categoryId).map((p) => p.id), [products, categoryId]);
  useEffect(() => setOrder(saved), [saved]);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const changed = order.join() !== saved.join();

  const move = (from: number, to: number) =>
    setOrder((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [id] = next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });

  const listRef = useRef<HTMLOListElement>(null);
  const { draggingId, startDrag } = useDragSort(listRef, setOrder);

  const bestsellersFirst = () => setOrder((list) => [...list.filter((id) => byId.get(id)?.bestseller), ...list.filter((id) => !byId.get(id)?.bestseller)]);
  const inStockFirst = () => setOrder((list) => [...list.filter((id) => byId.get(id)?.inStock), ...list.filter((id) => !byId.get(id)?.inStock)]);

  const save = async () => {
    setBusy(true);
    try {
      await api("/api/admin/products/reorder", { method: "POST", body: { categoryId, ids: order } });
      // Put the category's products in the new order inside the local list too.
      setProducts((list) => {
        if (!list) return list;
        const slots = list.flatMap((p, i) => (p.categoryId === categoryId ? [i] : []));
        const next = [...list];
        slots.forEach((slot, i) => (next[slot] = byId.get(order[i])!));
        return next;
      });
      toast("تم حفظ الترتيب وأصبح ظاهرًا في المتجر");
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleBestseller = async (product: Product) => {
    try {
      const updated = await api<Product>(`/api/admin/products/${product.id}`, { method: "PATCH", body: { bestseller: !product.bestseller } });
      setProducts((list) => list?.map((p) => (p.id === updated.id ? updated : p)) ?? null);
      toast(updated.bestseller ? "تم وضع علامة «الأكثر مبيعًا»" : "تمت إزالة علامة «الأكثر مبيعًا»");
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const switchCategory = (next: string) => {
    if (changed && !confirm("يوجد ترتيب غير محفوظ. هل تريد تركه والانتقال إلى قسم آخر؟")) return;
    setCategoryId(next);
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>ترتيب المنتجات</h1>
          <p>ترتيب ظهور المنتجات في صفحة القسم</p>
        </div>
        <button className="btn btn-primary" type="button" disabled={!changed || busy} onClick={save}>
          {busy ? "جارٍ الحفظ…" : "حفظ الترتيب"}
        </button>
      </div>
      <div className="toolbar">
        <select className="select" value={categoryId} onChange={(e) => switchCategory(e.target.value)} aria-label="القسم">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" type="button" onClick={bestsellersFirst}>
          الأكثر مبيعًا أولًا
        </button>
        <button className="btn btn-sm" type="button" onClick={inStockFirst}>
          المتوفر أولًا
        </button>
        {changed ? (
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => setOrder(saved)}>
            استعادة الترتيب السابق
          </button>
        ) : null}
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <div className="card">
        {products === null ? (
          <div className="empty">جارٍ التحميل…</div>
        ) : order.length ? (
          <ol className={draggingId ? "arrange dragging" : "arrange"} ref={listRef}>
            {order.map((id, index) => {
              const product = byId.get(id)!;
              return (
                <li
                  key={id}
                  data-id={id}
                  className={[product.inStock ? "" : "off", draggingId === id ? "lifted" : ""].join(" ").trim() || undefined}
                  onPointerDown={(event) => startDrag(event, id)}
                >
                  <span className="grip" aria-hidden="true" title="اسحب لتغيير الترتيب">
                    ⠿
                  </span>
                  <span className="pos num">{index + 1}</span>
                  {product.imageUrl ? <img className="thumb" src={product.imageUrl} alt="" loading="lazy" /> : <span className="thumb none">لا صورة</span>}
                  <div className="grow">
                    <b>{product.name}</b>
                    <div className="row" style={{ gap: 6 }}>
                      <small className="muted num">{egp(product.price)}</small>
                      {!product.inStock ? <span className="badge red">غير متوفر</span> : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={product.bestseller ? "btn btn-sm best on" : "btn btn-sm best"}
                    onClick={() => toggleBestseller(product)}
                    aria-pressed={product.bestseller}
                    title="علامة «الأكثر مبيعًا» على صورة المنتج"
                  >
                    ★ الأكثر مبيعًا
                  </button>
                  <div className="moves">
                    <button type="button" className="btn btn-sm" disabled={index === 0} onClick={() => move(index, 0)} aria-label="أول القائمة" title="أول القائمة">
                      ⤒
                    </button>
                    <button type="button" className="btn btn-sm" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="إلى الأعلى">
                      <Ic name="up" />
                    </button>
                    <button type="button" className="btn btn-sm" disabled={index === order.length - 1} onClick={() => move(index, index + 1)} aria-label="إلى الأسفل">
                      <Ic name="down" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="empty">لا توجد منتجات في هذا القسم</div>
        )}
      </div>
    </>
  );
}

/** Pixels a mouse must move before a press becomes a drag (so clicks still work). */
const MOUSE_SLOP = 5;
/** How long a finger must stay down on a row before it can be dragged (shorter presses scroll the page as usual). */
const LONG_PRESS_MS = 280;
/** Distance from the top / bottom of the screen where dragging scrolls the page. */
const EDGE = 70;

/**
 * Drag-to-reorder for the rows of `listRef` (each row has `data-id`). Mouse: press and move. Touch: press and hold, then
 * move; the grip (⠿) starts at once. Rows swap places live while dragging; the page scrolls near the screen edges.
 * Buttons inside a row keep working because a drag never starts on them.
 */
function useDragSort(listRef: React.RefObject<HTMLOListElement | null>, setOrder: React.Dispatch<React.SetStateAction<number[]>>) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const drag = useRef<{
    id: number;
    active: boolean;
    startY: number;
    y: number;
    timer?: ReturnType<typeof setTimeout>;
    frame?: number;
    /** The window listeners added for this drag, removed by `end`. */
    move: (event: PointerEvent) => void;
    up: () => void;
  } | null>(null);

  // While a touch drag is active the page must not scroll: a non-passive touchmove listener cancels it.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const stop = (event: TouchEvent) => {
      if (drag.current?.active) event.preventDefault();
    };
    list.addEventListener("touchmove", stop, { passive: false });
    return () => list.removeEventListener("touchmove", stop);
  });

  // Leaving the page in the middle of a drag removes its window listeners.
  useEffect(
    () => () => {
      const current = drag.current;
      if (!current) return;
      clearTimeout(current.timer);
      if (current.frame) cancelAnimationFrame(current.frame);
      window.removeEventListener("pointermove", current.move);
      window.removeEventListener("pointerup", current.up);
      window.removeEventListener("pointercancel", current.up);
    },
    [],
  );

  /** Puts the dragged product after every other row whose middle is above the pointer. Works from ids, not indexes,
   *  so a move read from a not-yet-updated screen can never shuffle the other rows. */
  const reorderAt = (y: number) => {
    const current = drag.current;
    const list = listRef.current;
    if (!current || !list) return;
    const others = [...list.querySelectorAll<HTMLElement>("li[data-id]")].filter((row) => Number(row.dataset.id) !== current.id);
    const target = others.filter((row) => {
      const box = row.getBoundingClientRect();
      return box.top + box.height / 2 < y;
    }).length;
    setOrder((order) => {
      const rest = order.filter((id) => id !== current.id);
      if (order.indexOf(current.id) === target) return order;
      rest.splice(target, 0, current.id);
      return rest;
    });
  };

  const autoScroll = () => {
    const current = drag.current;
    if (!current?.active) return;
    const speed = current.y < EDGE ? -(EDGE - current.y) / 4 : current.y > window.innerHeight - EDGE ? (current.y - (window.innerHeight - EDGE)) / 4 : 0;
    if (speed) {
      window.scrollBy(0, speed);
      reorderAt(current.y);
    }
    current.frame = requestAnimationFrame(autoScroll);
  };

  const activate = () => {
    const current = drag.current;
    if (!current || current.active) return;
    current.active = true;
    setDraggingId(current.id);
    navigator.vibrate?.(15);
    current.frame = requestAnimationFrame(autoScroll);
  };

  const end = () => {
    const current = drag.current;
    if (!current) return;
    clearTimeout(current.timer);
    if (current.frame) cancelAnimationFrame(current.frame);
    drag.current = null;
    setDraggingId(null);
    window.removeEventListener("pointermove", current.move);
    window.removeEventListener("pointerup", current.up);
    window.removeEventListener("pointercancel", current.up);
  };

  function onMove(event: PointerEvent) {
    const current = drag.current;
    if (!current) return;
    current.y = event.clientY;
    if (!current.active) {
      const moved = Math.abs(event.clientY - current.startY);
      if (event.pointerType === "mouse" && moved > MOUSE_SLOP) activate();
      else if (event.pointerType !== "mouse" && moved > 10) end(); // finger moved before the long press: it is a scroll
      return;
    }
    event.preventDefault();
    reorderAt(event.clientY);
  }

  const startDrag = (event: React.PointerEvent, id: number) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, a, input, select")) return;
    end();
    const current = { id, active: false, startY: event.clientY, y: event.clientY, move: onMove, up: end };
    drag.current = current;
    const onGrip = Boolean((event.target as HTMLElement).closest(".grip"));
    if (event.pointerType !== "mouse") {
      if (onGrip) activate();
      else drag.current.timer = setTimeout(activate, LONG_PRESS_MS);
    }
    if (event.pointerType === "mouse") event.preventDefault(); // no text selection while dragging
    window.addEventListener("pointermove", current.move);
    window.addEventListener("pointerup", current.up);
    window.addEventListener("pointercancel", current.up);
  };

  return { draggingId, startDrag };
}
